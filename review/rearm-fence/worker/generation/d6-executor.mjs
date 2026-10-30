// D6 (WS-2) — Standard-only executor with flush-before-commit
// (CONTRACTS.md §d6-executor; proposal §4 + §6.4).
//
// The D6 successor to worker/executor.mjs's Standard path, redesigned
// for the D10 blocker: synthesized bytes are flushed to R2 and
// verified there BEFORE any binding/report commit, every provider
// call is fenced by the coordinator spend intent AND recorded in the
// genstore append-only attempt log (reserved -> dispatching ->
// confirmed) at attempt time, and crash recovery resumes each
// per-occurrence execution record from its recorded state — never by
// re-synthesizing inside the same execution.
//
// Claim discipline is mirrored from executor.mjs exactly: claimGrant
// first; completed/closed/unknown grant -> drop the message; another
// consumer's claim -> stand down. Occurrence state is re-read fresh
// per occurrence (a partial report earlier in the same pass may have
// deferred a sibling back to pending).
//
// Coordinator methods this executor calls (the documented set):
//   coord.claimGrant({ grantId, consumerId })
//   coord.jobView(jobId)                       (lane, occurrence rows)
//   coord.acquireSpendIntent({ grantId, jobId, occurrenceId, consumerId })
//   coord.noteSpendOutcome({ jobId, occurrenceId, outcome, detail })
//   coord.handleReport({ grantId, jobRevision, results })  — ONCE per
//     message, at the end, carrying ONLY non-success results (plus an
//     empty results array when successes were committed, to close the
//     grant). Successes are committed by store.commitVerified (which
//     itself runs coord.validateAndBind + the occurrences.cache_key
//     update + coord.applyOccEvent report_success inside coord._tx);
//     they are never re-reported through handleReport, whose binding
//     gate would be a second, redundant validation. Non-success
//     results use handleReport's own outcomes (provider_error ->
//     report_failed, policy_block -> report_blocked, daily_limit ->
//     defer + quota park). When an unknown-billing outcome occurs the
//     message STOPS and handleReport is NOT called at all — mirroring
//     executor.mjs's ambiguous path, no knowledge is claimed for the
//     grant and the lease machinery surfaces the uncertainty.
//   coord._oneOrNull(...) / coord._all(...) — read-only. The
//     pre-claim fence (Workstream A, below) resolves the job's plan
//     authoritatively from persisted records — the d6_plan_jobs
//     link cross-checked against the job's data_json stamp — and
//     reads the plan's state from d6_plans (jobView does not expose
//     data_json; the resolved plan id also keys the genstore
//     records for the post-claim bookkeeping).
//
// Lane law: D6 is Standard-only. A batch job (coord.jobView lane not
// in the allowlist), a batch dispatch payload, or a batch work-source
// payload refuses the WHOLE message with { refused:
// "lane_not_allowed" } and zero provider contact. This executor has
// no submitBatch call anywhere — the Batch lane cannot execute here.
//
// Repair law: the executor NEVER loops retries. A retryable known
// failure (HTTP 500/502/503, or a flush/verify stage failure) returns
// an outcome carrying { repair: { occurrenceId, reason,
// retryable: true } }; the generation service owns the repair chain
// (bounded by REPAIR_MAX_RETRIES and the shared 12-attempt segment
// budget in the genstore attempt log).
import { fingerprintFor } from "../executor.mjs";
import {
  heldQuarantine, heldQuarantineStrict, ensureQuarantineSchema,
} from "./quarantine.mjs";
import {
  synthesizeSegment, synthesizeLongSegment, PRE_SPLIT_MAX_CHARS,
  stitchWav, TerminalBlock,
} from "./policy-split.mjs";
import { FlushError } from "./flush-store.mjs";
import { noteCommitted as noteBindingCommitted } from "./binding-projection.mjs";
// Canonical pins from WS-1's gen-constants.mjs (CONTRACTS.md): the
// lane allowlist (membership test is the only lane check), the
// segment attempt budget, and the cost model ($0.81/audio-hour = 225
// micro-cents/sec; per-attempt upper bound at chars/10 seconds).
import {
  D6_LANE_ALLOWLIST, SEGMENT_ATTEMPT_BUDGET, knownCostMicro, upperBoundAttemptMicro,
} from "./gen-constants.mjs";
export { D6_LANE_ALLOWLIST, knownCostMicro, upperBoundAttemptMicro };

const TERMINAL_EXECUTION_STATES = new Set(["committed", "failed"]);
const RETRYABLE_HTTP = new Set([500, 502, 503]);

// Workstream A re-arm fence — the plan-state vocabulary (design
// packet §2.1, accepted by Rowan's ruling, board issue #15 comment
// 6532307605). REFUSED is exactly the complement of the driver's
// own selection (service.mjs driveOnce: state NOT IN ('complete',
// 'partial', 'retired', 'halted_unknown')) — a plan in one of
// these states can never have a legitimately dispatchable message,
// so a message resolving to one is refused before claim.
// DISPATCHABLE is the closed recognized remainder: 'active' plus
// the parked family (service.mjs GRANT_STOP_MAP). Any other state
// string is unrecognized and fails closed — the vocabulary is
// enumerable from setPlanState call sites and never grows by
// default.
const PLAN_STATES_REFUSED = new Set(
  ["complete", "partial", "retired", "halted_unknown"]);
const PLAN_STATES_DISPATCHABLE = new Set(
  ["active", "parked_quota", "parked_cap", "parked_budget", "parked_storage"]);

// Execution records are read tolerantly: WS-1's genstore columns
// (gen-schema) and its detail_json both carry the flush facts.
function execFacts(row) {
  let detail = {};
  if (row?.detail_json) { try { detail = JSON.parse(row.detail_json) || {}; } catch { detail = {}; } }
  else if (row?.detail && typeof row.detail === "object") detail = row.detail;
  return {
    executionId: row?.execution_id ?? row?.executionId ?? null,
    planId: row?.plan_id ?? row?.planId ?? detail.planId ?? null,
    jobId: row?.job_id ?? row?.jobId ?? null,
    occurrenceId: row?.occurrence_id ?? row?.occurrenceId ?? null,
    state: row?.state ?? null,
    stage: row?.stage ?? detail.stage ?? null,
    cacheKey: row?.cache_key ?? row?.cacheKey ?? detail.cacheKey ?? null,
    objectKey: row?.object_key ?? row?.objectKey ?? detail.objectKey ?? null,
    etag: row?.etag ?? detail.etag ?? null,
    sizeBytes: row?.size_bytes ?? row?.sizeBytes ?? detail.sizeBytes ?? null,
    sha256: row?.sha256 ?? detail.sha256 ?? null,
    format: detail.format ?? null,
  };
}

export function createD6Executor({ coord, coordinator, store, providers, flushStore, cache = null, workSource, consumerId }) {
  const coordinatorRef = coord || coordinator;
  if (!coordinatorRef) throw new Error("createD6Executor requires coord (the coordinator)");
  if (!store) throw new Error("createD6Executor requires a genstore (store)");
  if (!providers || typeof providers.synthesize !== "function")
    throw new Error("createD6Executor requires providers.synthesize");
  if (!flushStore) throw new Error("createD6Executor requires a flushStore");
  if (typeof workSource !== "function")
    throw new Error("createD6Executor requires a workSource(jobId, occurrenceId)");
  const cid = consumerId || "d6-executor-1";
  const c = coordinatorRef;

  function planIdFor(jobId, msg) {
    if (msg && (msg.planId || msg.d6PlanId)) return msg.planId || msg.d6PlanId;
    try {
      const row = typeof c._oneOrNull === "function"
        ? c._oneOrNull(`SELECT data_json FROM jobs WHERE job_id = ?`, jobId) : null;
      if (row?.data_json) {
        const d = JSON.parse(row.data_json);
        if (d.d6PlanId) return d.d6PlanId;
        if (d.planId) return d.planId;
      }
    } catch { /* plan id is optional bookkeeping; never fail work over it */ }
    return null;
  }

  // --- Workstream A re-arm fence: authoritative plan resolution ---
  //
  // Design packet §2.1 (Revision 1), accepted for build by Rowan's
  // ruling (board issue #15 comment 6532307605). planIdFor above is
  // message-first and error-swallowing BY DESIGN for bookkeeping;
  // it must never feed a fence decision. This resolver is its
  // strict inverse, used ONLY for the pre-claim checks on
  // store-backed coordinators:
  //
  //   - the plan identity comes from persisted server records
  //     only: the d6_plan_jobs link, cross-checked against the
  //     job's own data_json stamp (both server-written at plan /
  //     job creation, service.mjs) — never from the message;
  //   - every read is strict: SQL errors PROPAGATE to the caller,
  //     which refuses the message (a database fault never reads
  //     as "no plan" and never as dispatchable);
  //   - conflicting persisted records are reported by the caller
  //     as plan_link_conflict, corrupt job data as
  //     plan_state_check_failed; a job with NEITHER record is
  //     genuinely plan-less and resolves to null.
  //
  // Returns { planId } (planId may be null) or { conflict: true }.
  // Throws on any read fault or malformed job data.
  function resolvePlanForFence(jobId) {
    // (1) Link read. SELECT DISTINCT + a local count: multiplicity
    // is itself the conflict signal and must survive as
    // plan_link_conflict — _oneOrNull's cardinality throw would
    // collapse it into the generic fault refusal (Rowan build
    // pin 3, comment 6532307605).
    const linkRows = typeof c._all === "function"
      ? c._all(`SELECT DISTINCT plan_id FROM d6_plan_jobs WHERE job_id = ?`, jobId)
      : c.sql.exec(`SELECT DISTINCT plan_id FROM d6_plan_jobs WHERE job_id = ?`, jobId).toArray();
    let pLink = null;
    if (linkRows.length > 1) return { conflict: true };
    if (linkRows.length === 1) {
      // Rowan F2 (comment 6532568882): the schema declares
      // plan_id TEXT NOT NULL, so a NULL cannot be stored — but
      // a blank string can. A present link row whose plan_id is
      // not a non-empty, non-whitespace string is a CORRUPT
      // link: refuse it as such, never read it as "no plan"
      // (a blank would otherwise slip past the caller's
      // truthiness gate on the resolved identity and dispatch).
      const linkId = linkRows[0].plan_id;
      if (typeof linkId !== "string" || linkId.trim().length === 0)
        throw new Error("plan_resolution_corrupt_link");
      pLink = linkId;
    }

    // (2) Job stamp read. A present data_json that does not parse,
    // or parses to a non-object, is CORRUPTION (Rowan build pin
    // 2), never evidence of a plan-less job; an absent value
    // (no row / NULL column) is simply no second record.
    const jobRow = c._oneOrNull(`SELECT data_json FROM jobs WHERE job_id = ?`, jobId);
    let pData = null;
    if (jobRow && jobRow.data_json != null) {
      let data;
      try { data = JSON.parse(jobRow.data_json); }
      catch { throw new Error("plan_resolution_malformed_job_data"); }
      if (!data || typeof data !== "object" || Array.isArray(data))
        throw new Error("plan_resolution_malformed_job_data");
      const stampOf = (v) => {
        // Absent key (undefined) and explicit null stay "no
        // stamp" — legitimate legacy plan-less records carry
        // neither. But a PRESENT stamp must be a non-empty,
        // non-whitespace string (Rowan F2, comment 6532568882):
        // an empty or whitespace-only value is invalid persisted
        // data, not an absent stamp — converting it to null let
        // a stamped job masquerade as genuinely plan-less.
        if (v === null || v === undefined) return null;
        if (typeof v !== "string" || v.trim().length === 0)
          throw new Error("plan_resolution_malformed_job_data");
        return v;
      };
      const stampA = stampOf(data.d6PlanId);
      const stampB = stampOf(data.planId);
      // Rowan build pin 1: when BOTH persisted stamps exist they
      // must agree — a disagreement refuses, neither wins.
      if (stampA !== null && stampB !== null && stampA !== stampB)
        return { conflict: true };
      pData = stampA ?? stampB;
    }

    // (3) Cross-check the two persisted records; (4) the resolved
    // identity (null = genuinely plan-less).
    if (pLink !== null && pData !== null && pLink !== pData)
      return { conflict: true };
    return { planId: pLink ?? pData };
  }

  // The plan-state half of the fence, for a resolved plan. Returns
  // a refusal object, or null when the plan may dispatch. Throws
  // on any read fault (the caller refuses plan_state_check_failed).
  function planStateFenceRefusal(resolvedPlanId, msg) {
    // The message's own plan fields confer nothing and select
    // nothing; carried against a resolved plan they are only ever
    // a discrepancy to refuse on. EACH present field is validated
    // independently (Rowan F1, comment 6532568882): the earlier
    // first-truthy selection (msg.planId || msg.d6PlanId) let a
    // matching planId mask a conflicting d6PlanId. A present
    // field that is not a non-empty string is malformed, and any
    // present field disagreeing with the resolved identity
    // refuses — no fallback is ever selected, and no message
    // field may become an authority.
    if (msg) {
      for (const key of ["planId", "d6PlanId"]) {
        const carried = msg[key];
        if (carried === undefined) continue; // absent: nothing to check
        if (typeof carried !== "string" || carried.length === 0)
          return { refused: "plan_link_mismatch" };
        if (carried !== resolvedPlanId)
          return { refused: "plan_link_mismatch" };
      }
    }
    const row = c._oneOrNull(
      `SELECT * FROM d6_plans WHERE plan_id = ?`, resolvedPlanId);
    // A persisted link to a plan that does not exist is a dangling
    // link — corruption, never a plan-less all-clear.
    if (!row) return { refused: "plan_state_check_failed" };
    if (PLAN_STATES_REFUSED.has(row.state))
      return { refused: "plan_not_dispatchable",
               planId: resolvedPlanId, planState: row.state };
    if (!PLAN_STATES_DISPATCHABLE.has(row.state))
      return { refused: "plan_state_check_failed" }; // unrecognized state
    return null;
  }

  async function recordVoicePrompt(planId, occurrenceId, ws) {
    const row = {
      planId, occurrenceId,
      characterName: ws.povName ?? null,
      provider: ws.provider ?? null,
      recordedMapping: ws.recordedMapping ?? null,
    };
    if (typeof store.recordVoicePrompt === "function") {
      await store.recordVoicePrompt(row);
      return;
    }
    // Fallback (the genstore contract lists no prompt writer): write
    // the contract's table directly, idempotently.
    if (c.sql && typeof c.sql.exec === "function") {
      c.sql.exec(
        `INSERT OR IGNORE INTO d6_voice_prompts (plan_id, occurrence_id, character_name, provider, recorded_mapping, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        row.planId, row.occurrenceId, row.characterName, row.provider,
        row.recordedMapping, typeof c._now === "function" ? c._now() : Date.now());
    }
  }

  function noteOutcome(jobId, occurrenceId, outcome, detail) {
    try { c.noteSpendOutcome({ jobId, occurrenceId, outcome, detail }); } catch { /* already noted */ }
  }

  async function hydrateProbeKey(cacheKey) {
    // Production wiring: the coordinator's binding gate reads the R2
    // cache snapshot; hydrate the just-flushed key into it so
    // validateAndBind sees the durable object. Test doubles without
    // the method are simply skipped.
    if (cache && typeof cache.hydrateKey === "function") {
      try { await cache.hydrateKey(cacheKey); } catch { /* commit gate will judge */ }
    }
  }

  // --- recovery tails ------------------------------------------------

  // flushed | verified: re-verify against R2, then commit. NEVER
  // synthesizes. Returns the per-occurrence outcome.
  async function verifyAndCommit(execution, facts) {
    const { executionId } = facts;
    const jobId = facts.jobId, occurrenceId = facts.occurrenceId;
    const failVerify = async () => {
      await store.failExecution(executionId, "verify",
        { objectKey: facts.objectKey, recovered: true });
      return { failed: true, stage: "verify", objectKey: facts.objectKey,
               repair: { occurrenceId, reason: "verify_failed_on_recovery", retryable: true } };
    };
    if (!facts.objectKey || !facts.cacheKey) return failVerify();
    const headOk = await flushStore.headVerify(facts.objectKey,
      { sizeBytes: facts.sizeBytes, etag: facts.etag });
    if (!headOk) return failVerify();
    const prime = await flushStore.primeDigest(facts.cacheKey);
    if (!prime) return failVerify();
    if (facts.sha256 && prime.sha256 !== facts.sha256) return failVerify();
    if (facts.state === "flushed")
      await store.transitionExecution(executionId, "verified",
        { objectKey: facts.objectKey, etag: prime.etag, sizeBytes: prime.sizeBytes, sha256: prime.sha256 });
    const view = c.jobView(jobId);
    const row = view?.occurrences?.find((o) => o.occurrence_id === occurrenceId);
    if (!row) return { skipped: true, reason: "occurrence_missing" };
    await hydrateProbeKey(facts.cacheKey);
    let commit;
    try {
      commit = await store.commitVerified({
        executionId, jobId, occurrenceId,
        // The binding's revision key is the payload fingerprint (the
        // cache key) — the accepted executor kernel's semantics
        // (executor.mjs reports revisionKey: key). The job row's
        // revision_key is the REQUEST key, not the recording's.
        revisionKey: facts.cacheKey, cacheKey: facts.cacheKey,
        sha256: prime.sha256, provenance: `d6:${executionId}`,
      });
    } catch (err) {
      if (err && typeof err.reason === "string") {
        await store.failExecution(executionId, "commit", { reason: err.reason, objectKey: facts.objectKey });
        return { failed: true, stage: "commit", objectKey: facts.objectKey,
                 repair: { occurrenceId, reason: `commit_${err.reason}`, retryable: true } };
      }
      throw err; // a crash, not a verdict: the record stays verified
    }
    if (commit && commit.bound === false) {
      await store.failExecution(executionId, "commit", { reason: commit.reason || "not_bound", objectKey: facts.objectKey });
      return { failed: true, stage: "commit", objectKey: facts.objectKey,
               repair: { occurrenceId, reason: `commit_${commit.reason || "not_bound"}`, retryable: true } };
    }
    // gen-pkg-1: publish the committed binding to the sync plane
    // (commit first, then project — the projection is idempotent
    // and self-healing via the reconciliation sweep; it never
    // throws and never fails the commit's outcome).
    noteBindingCommitted(c, { executionId, jobId, occurrenceId });
    noteOutcome(jobId, occurrenceId, "success", "d6_recovery_commit");
    return { reported: "success", committed: true, via: "recovery", cacheKey: facts.cacheKey, objectKey: facts.objectKey };
  }

  // synthesized: the bytes were never durably flushed inside this
  // execution (flushAndVerify never returned). If an object exists at
  // the recorded key, adopt it as flushed and continue to verify +
  // commit; if not, the flush was interrupted — fail the execution
  // and NEVER re-synthesize within it.
  async function reenterFlush(execution, facts) {
    const { executionId } = facts;
    const occurrenceId = facts.occurrenceId;
    const objectKey = facts.objectKey ||
      (facts.cacheKey ? flushStore.objectKeyFor(facts.cacheKey, facts.format || "wav") : null);
    const failInterrupted = async () => {
      await store.failExecution(executionId, "flush_interrupted",
        { objectKey, recovered: true });
      return { failed: true, stage: "flush_interrupted", objectKey,
               repair: { occurrenceId, reason: "flush_interrupted", retryable: true } };
    };
    if (!objectKey || !facts.cacheKey) return failInterrupted();
    const exists = await flushStore.headVerify(objectKey, {});
    if (!exists) return failInterrupted();
    const prime = await flushStore.primeDigest(facts.cacheKey);
    if (!prime) return failInterrupted();
    await store.transitionExecution(executionId, "flushed", {
      objectKey, etag: prime.etag, sizeBytes: prime.sizeBytes, sha256: prime.sha256,
      cacheKey: facts.cacheKey, format: facts.format || "wav", recovered: true,
    });
    return verifyAndCommit(execution, {
      ...facts, state: "flushed", objectKey,
      etag: prime.etag, sizeBytes: prime.sizeBytes, sha256: prime.sha256,
    });
  }

  async function recoverExecution(execution) {
    const facts = execFacts(execution);
    if (facts.state === "flushed" || facts.state === "verified")
      return verifyAndCommit(execution, facts);
    if (facts.state === "synthesized")
      return reenterFlush(execution, facts);
    if (facts.state === "unknown_billing")
      return { reconcileHold: true, state: "unknown_billing" };
    if (facts.state === "attempted") {
      const attempts = typeof store.attemptsForOccurrence === "function"
        ? await store.attemptsForOccurrence(facts.planId, facts.occurrenceId) : [];
      const hasDispatching = (attempts || []).some((a) => a.phase === "dispatching");
      if (hasDispatching) return { reconcileHold: true, state: "attempted" };
      // Attempted but provably never dispatched: release the reserved
      // attempts and fail the execution (the service's recover() owns
      // this same action for scan-driven recovery).
      for (const a of attempts || []) {
        if (a.phase === "reserved" && typeof store.releaseAttempt === "function")
          await store.releaseAttempt(a.attempt_id ?? a.attemptId);
      }
      await store.failExecution(facts.executionId, "interrupted", { recovered: true });
      return { failed: true, stage: "interrupted" };
    }
    return null; // granted (fresh continuation) or terminal: caller decides
  }

  // --- fresh synthesis -------------------------------------------------

  // Runs one fresh occurrence. Returns { outcome, report?, committed?,
  // stop?: "quota" | "unknown" } — the caller assembles the message
  // result and the single end-of-message report.
  async function runFresh(msg, occurrenceId, payload, planId) {
    const jobId = msg.jobId, grantId = msg.grantId;
    const created = await store.createExecution({ planId, jobId, occurrenceId, grantId });
    const executionId = created.executionId ?? created.execution_id;
    const existingFacts = created.existing ? execFacts(created.existing) : null;
    if (!created.created && existingFacts && !TERMINAL_EXECUTION_STATES.has(existingFacts.state) &&
        existingFacts.state !== "granted") {
      // Lost a race with a concurrent recovery classification.
      const rec = await recoverExecution(created.existing);
      if (rec) return { outcome: rec, committed: !!rec.committed };
    }

    const intent = c.acquireSpendIntent({ grantId, jobId, occurrenceId, consumerId: cid });
    if (!intent.acquired) {
      if (intent.intent && intent.intent.outcome === "success") {
        // A KNOWN success was paid for under this fence but its commit
        // never landed: re-commit from the durable object, verified —
        // with NO new provider call (executor.mjs's intent recovery,
        // restated on the flush store).
        const cacheKey = fingerprintFor(payload);
        const prime = await flushStore.primeDigest(cacheKey);
        if (!prime) {
          await store.failExecution(executionId, "intent_success_unverified", { cacheKey });
          return { outcome: { skipped: true, reason: "intent_success_cache_unverified" } };
        }
        const format = prime.objectKey.endsWith(".mp3") ? "mp3" : "wav";
        await store.transitionExecution(executionId, "attempted", { via: "intent_recovery" });
        await store.transitionExecution(executionId, "synthesized", { cacheKey, format });
        await store.transitionExecution(executionId, "flushed",
          { objectKey: prime.objectKey, etag: prime.etag, sizeBytes: prime.sizeBytes, sha256: prime.sha256, cacheKey, format });
        const rec = await verifyAndCommit({ execution_id: executionId },
          { ...execFacts({}), executionId, planId, jobId, occurrenceId, state: "flushed",
            cacheKey, objectKey: prime.objectKey, etag: prime.etag, sizeBytes: prime.sizeBytes, sha256: prime.sha256 });
        return { outcome: rec, committed: !!rec.committed };
      }
      await store.failExecution(executionId, "intent_fence",
        { reason: intent.reason || "intent_exists", outcome: intent.intent ? intent.intent.outcome : null });
      return { outcome: { skipped: true, reason: intent.reason || "intent_exists",
                          outcome: intent.intent ? intent.intent.outcome : null } };
    }

    await store.transitionExecution(executionId, "attempted", { grantId });
    const used = typeof store.segmentAttemptsUsed === "function"
      ? await store.segmentAttemptsUsed(planId, occurrenceId) : 0;
    const budget = { remaining: Math.max(0, SEGMENT_ATTEMPT_BUDGET - Number(used || 0)) };

    // Every provider call is wrapped: reserve -> dispatching -> call
    // -> confirm, in the genstore's append-only attempt log, BEFORE
    // the outcome is known — the record survives any later failure.
    async function wrappedSynthesize(partPayload) {
      const attemptId = await store.reserveAttempt(executionId,
        { upperMicroCents: upperBoundAttemptMicro(String(partPayload.text ?? "").length) });
      await store.markDispatching(attemptId);
      try {
        const res = await providers.synthesize({ occurrenceId, payload: partPayload });
        await store.confirmAttempt(attemptId, {
          outcome: "success",
          costMicroCents: knownCostMicro(res?.durationSec),
          providerRequestId: res?.providerRequestId ?? null,
        });
        return res;
      } catch (err) {
        if (err && err.contentBlocked) {
          await store.confirmAttempt(attemptId, { outcome: "policy_block", costMicroCents: 0, providerRequestId: null });
        } else if (err && err.httpStatus) {
          // Known HTTP failure (incl. quota 429): failed_known, cost 0.
          await store.confirmAttempt(attemptId, { outcome: "failed_known", costMicroCents: 0, providerRequestId: null });
        } else {
          // Non-HTTP throw: the billing outcome is UNKNOWN. Cost stays
          // null; the executor halts the phase after this call.
          await store.confirmAttempt(attemptId, { outcome: "unknown", costMicroCents: null, providerRequestId: null });
        }
        throw err;
      }
    }

    let synth;
    try {
      // CH2 FIX PACKAGE (fix 3): pre-dispatch length split. A
      // segment over PRE_SPLIT_MAX_CHARS goes through
      // synthesizeLongSegment (exact-concat pre-split + the
      // unmodified synthesizeSegment per chunk, one shared
      // budget); at or under the ceiling the call below is the
      // identical single synthesizeSegment call this executor
      // has always made. Rationale: the 120 s provider fetch
      // ceiling can expire on a long segment with its billing
      // genuinely unknowable (the Ch 2 halt) — shorter calls
      // make that outcome rarer without ever reclassifying it:
      // an unknown still halts the phase, fail-closed, exactly
      // as the branch below this one does.
      synth = String(payload.text ?? "").length > PRE_SPLIT_MAX_CHARS
        ? await synthesizeLongSegment({ synthesize: wrappedSynthesize, payload, budget })
        : await synthesizeSegment({ synthesize: wrappedSynthesize, payload, budget });
    } catch (err) {
      if (err instanceof TerminalBlock || (err && err.code === "policy_block_terminal")) {
        await store.failExecution(executionId, "policy_block", { depth: err.depth ?? null, detail: err.detail ?? null });
        noteOutcome(jobId, occurrenceId, "failed_known", "policy_block_terminal");
        return { outcome: { blocked: true, stage: "policy_block", depth: err.depth ?? null },
                 report: { occurrenceId, outcome: "policy_block",
                           evidence: { code: "policy_block_terminal", depth: err.depth ?? null } } };
      }
      if (err && err.quotaExceeded) {
        await store.failExecution(executionId, "quota", { httpStatus: err.httpStatus ?? 429 });
        noteOutcome(jobId, occurrenceId, "failed_known", "quota_exceeded");
        return { outcome: { quotaExhausted: true }, stop: "quota",
                 report: { occurrenceId, outcome: "daily_limit",
                           evidence: { quotaExceeded: true, httpStatus: err.httpStatus ?? 429 } } };
      }
      if (err && err.httpStatus) {
        await store.failExecution(executionId, "synthesis", { httpStatus: err.httpStatus });
        noteOutcome(jobId, occurrenceId, "failed_known", `HTTP ${err.httpStatus}`);
        const outcome = { reported: "provider_error", httpStatus: err.httpStatus };
        if (RETRYABLE_HTTP.has(err.httpStatus))
          outcome.repair = { occurrenceId, reason: `http_${err.httpStatus}`, retryable: true };
        return { outcome, report: { occurrenceId, outcome: "provider_error", detail: { httpStatus: err.httpStatus } } };
      }
      // Unknown billing outcome: fail closed. The execution goes to
      // unknown_billing (which halts the phase in the genstore), the
      // intent is left open (no outcome note — ambiguity is never
      // resolved by claiming knowledge), and the WHOLE message stops:
      // later occurrences are untouched.
      await store.markUnknownBilling(executionId,
        { message: String((err && err.message) || err), occurrenceId });
      return { outcome: { unknownBilling: true }, stop: "unknown" };
    }

    noteOutcome(jobId, occurrenceId, "success", "d6_synthesized");
    const parts = synth.parts;
    let bytes, format, durationSec;
    if (parts.length === 1) {
      const p = parts[0];
      bytes = p.audio instanceof Uint8Array ? p.audio : new TextEncoder().encode(String(p.audio ?? ""));
      format = p.format || "wav";
      durationSec = p.durationSec;
    } else {
      bytes = stitchWav(parts); // throws on any format mismatch, before any state change
      format = "wav";
      durationSec = parts.reduce((n, p) => n + Number(p.durationSec || 0), 0);
    }
    const cacheKey = fingerprintFor(payload);
    await store.transitionExecution(executionId, "synthesized", { cacheKey, format, durationSec });

    let flushed;
    try {
      flushed = await flushStore.flushAndVerify(cacheKey, bytes, format, durationSec);
    } catch (err) {
      if (err instanceof FlushError) {
        await store.failExecution(executionId, err.stage,
          { code: err.code, objectKey: flushStore.objectKeyFor(cacheKey, format) });
        return { outcome: { failed: true, stage: err.stage, code: err.code,
                            objectKey: flushStore.objectKeyFor(cacheKey, format),
                            repair: { occurrenceId, reason: err.code, retryable: true } },
                 report: { occurrenceId, outcome: "provider_error",
                           detail: { stage: err.stage, code: err.code } } };
      }
      throw err; // a crash mid-flush: the record stays `synthesized`
    }
    await store.transitionExecution(executionId, "flushed", {
      objectKey: flushed.objectKey, etag: flushed.etag,
      sizeBytes: flushed.sizeBytes, sha256: flushed.sha256, cacheKey, format,
    });
    await store.transitionExecution(executionId, "verified", {
      objectKey: flushed.objectKey, etag: flushed.etag,
      sizeBytes: flushed.sizeBytes, sha256: flushed.sha256, cacheKey, format,
    });
    await hydrateProbeKey(cacheKey);
    const view = c.jobView(jobId);
    const row = view?.occurrences?.find((o) => o.occurrence_id === occurrenceId);
    let commit;
    try {
      commit = await store.commitVerified({
        executionId, jobId, occurrenceId,
        // Binding revision key = payload fingerprint (= cacheKey), per
        // the accepted executor kernel (executor.mjs: revisionKey: key).
        revisionKey: cacheKey,
        cacheKey, sha256: flushed.sha256, provenance: `d6:${executionId}`,
      });
    } catch (err) {
      if (err && typeof err.reason === "string") {
        await store.failExecution(executionId, "commit", { reason: err.reason, objectKey: flushed.objectKey });
        return { outcome: { failed: true, stage: "commit", objectKey: flushed.objectKey,
                            repair: { occurrenceId, reason: `commit_${err.reason}`, retryable: true } },
                 report: { occurrenceId, outcome: "provider_error",
                           detail: { stage: "commit", reason: err.reason } } };
      }
      throw err; // a crash, not a verdict: the record stays `verified`
    }
    if (commit && commit.bound === false) {
      await store.failExecution(executionId, "commit", { reason: commit.reason || "not_bound", objectKey: flushed.objectKey });
      return { outcome: { failed: true, stage: "commit", objectKey: flushed.objectKey,
                          repair: { occurrenceId, reason: `commit_${commit.reason || "not_bound"}`, retryable: true } },
               report: { occurrenceId, outcome: "provider_error",
                         detail: { stage: "commit", reason: commit.reason || "not_bound" } } };
    }
    // gen-pkg-1: publish the committed binding to the sync plane
    // (commit first, then project — see binding-projection.mjs).
    noteBindingCommitted(c, { executionId, jobId, occurrenceId });
    return { outcome: { reported: "success", committed: true, cacheKey, objectKey: flushed.objectKey },
             committed: true };
  }

  // --- message handling --------------------------------------------------

  async function handleMessage(msg) {
    // Batch refusal, layer 1: a batch dispatch payload is refused
    // before any claim or provider contact.
    if (msg && (msg.mode === "batch" || msg.lane === "batch" ||
                (msg.payload && msg.payload.mode === "batch"))) {
      return { refused: "lane_not_allowed" };
    }
    const jobId = msg?.jobId, grantId = msg?.grantId;
    // Batch refusal, layer 2: the job's own lane. A job the
    // coordinator does not know falls through to claim discipline
    // (unknown_grant drop), exactly as executor.mjs behaves.
    const jobAtStart = jobId ? c.jobView(jobId) : null;
    if (jobAtStart && !D6_LANE_ALLOWLIST.includes(jobAtStart.lane || "standard"))
      return { refused: "lane_not_allowed" };

    // D7-2 executor defense (Rowan ruling 6524426826 req 2): the
    // grant guard is the primary fence — a held plan's jobs can
    // never be granted, so no legitimate message for one exists.
    // This is the defense-in-depth layer for a replayed or
    // hand-crafted message carrying a grant the guard never
    // issued (or issued before a hold existed): if the job's plan
    // or the job itself is under a HELD quarantine, refuse BEFORE
    // any claim, execution record, or provider contact.
    //
    // D8-1 (Rowan review 6525035570): on a store-backed
    // coordinator the reads are STRICT — the schema is ensured
    // (so a never-created table is a proven "no hold", not an
    // error) and any read failure refuses the message with
    // { refused: "quarantine_check_failed" } BEFORE claim: a
    // database fault must never read as an all-clear at an
    // execute fence. The throw-safe read survives only for
    // coordinator doubles without a SQL store (unit fixtures),
    // where there is no store a hold could live in.
    //
    // Workstream A re-arm fence (design packet §2.1/§5, accepted
    // for build by Rowan's ruling, comment 6532307605): on a
    // store-backed coordinator the plan identity for BOTH
    // pre-claim checks — and for the post-claim bookkeeping below
    // — comes from ONE strict resolution over persisted server
    // records (resolvePlanForFence), never from message-carried
    // fields and never from planIdFor's message-first,
    // error-swallowing lookup. Order inside the block: (1)
    // resolution; (2) the D8-1 quarantine hold read against the
    // RESOLVED identity; (3) the plan-state fence, which refuses
    // exactly the states the driver can never drive. A refusal
    // from any step is terminal for the message and a NORMAL
    // return: _execute answers 200 and the queue handler ACKs —
    // the stale message is consumed, never retried into the
    // fence. Genuinely plan-less jobs resolve to null and pass
    // both checks exactly as before.
    let resolvedPlanId; // undefined = no strict resolution ran
    if (jobId) {
      const storeBacked = typeof c._oneOrNull === "function" &&
        !!c.sql && typeof c.sql.exec === "function";
      if (storeBacked) {
        // (1) Authoritative resolution. A throw is a read fault
        // or corrupt job data — fail closed; conflicting
        // persisted records refuse under their own diagnostic.
        let resolution;
        try {
          resolution = resolvePlanForFence(jobId);
        } catch {
          return { refused: "plan_state_check_failed" };
        }
        if (resolution.conflict) return { refused: "plan_link_conflict" };
        resolvedPlanId = resolution.planId;
        // (2) Quarantine hold read (D8-1 discipline, unchanged)
        // against the resolved identity only.
        let heldPlan = null, heldJob = null;
        try {
          ensureQuarantineSchema(c.sql);
          heldPlan = resolvedPlanId
            ? heldQuarantineStrict(c, "plan", resolvedPlanId) : null;
          heldJob = heldQuarantineStrict(c, "job", jobId);
        } catch {
          return { refused: "quarantine_check_failed" };
        }
        if (heldPlan || heldJob) return { refused: "plan_quarantined" };
        // (3) Plan-state fence.
        if (resolvedPlanId) {
          let refusal;
          try {
            refusal = planStateFenceRefusal(resolvedPlanId, msg);
          } catch {
            return { refused: "plan_state_check_failed" };
          }
          if (refusal) return refusal;
        }
      } else {
        // Coordinator doubles without a SQL store (unit
        // fixtures): no store exists in which a plan could be
        // persisted, so there is nothing to resolve — the
        // pre-existing tolerant hold read, unchanged.
        const qPlanId = planIdFor(jobId, msg);
        if ((qPlanId && heldQuarantine(c, "plan", qPlanId)) ||
            heldQuarantine(c, "job", jobId)) {
          return { refused: "plan_quarantined" };
        }
      }
    }

    const claim = c.claimGrant({ grantId, consumerId: cid });
    if (claim.status === "completed" || claim.status === "closed" || claim.status === "unknown_grant")
      return { dropped: claim.status };
    if (claim.status === "already_claimed" && claim.claim && claim.claim.consumer_id !== cid)
      return { stoodDown: true };

    // Bookkeeping identity: on a store-backed coordinator this is
    // the fence's resolved identity (Workstream A) — no executor
    // surface attributes work to a message-carried plan. On the
    // fixture-only path (no resolution ran) it is planIdFor's
    // answer, exactly as before.
    const planId = resolvedPlanId !== undefined
      ? resolvedPlanId : planIdFor(jobId, msg);
    const out = {};
    const reportResults = [];
    let committedCount = 0;
    let stop = null;

    for (const oid of msg.occurrences || []) {
      // Fresh state read per occurrence (executor.mjs discipline).
      const row = c.jobView(jobId)?.occurrences?.find((o) => o.occurrence_id === oid);
      if (!row || row.state !== "granted") {
        out[oid] = { skipped: true, state: row ? row.state : "missing" };
        continue;
      }

      // Existing non-terminal execution -> recovery classification,
      // never a fresh synthesis inside the same execution.
      const existing = typeof store.executionFor === "function"
        ? await store.executionFor(jobId, oid) : null;
      if (existing && !TERMINAL_EXECUTION_STATES.has(existing.state)) {
        const facts = execFacts(existing);
        if (facts.state !== "granted") {
          const rec = await recoverExecution(existing);
          if (rec) {
            out[oid] = rec;
            if (rec.committed) committedCount++;
            continue;
          }
        }
      }

      const ws = await workSource(jobId, oid);
      if (!ws) { out[oid] = { skipped: true, state: "no_content" }; continue; }
      if (typeof ws === "object" && typeof ws.status === "string") {
        if (ws.status === "no_content") { out[oid] = { skipped: true, state: "no_content" }; continue; }
        if (ws.status === "unmapped_pov") { out[oid] = { skipped: true, state: "unmapped_pov", povName: ws.povName ?? null }; continue; }
        if (ws.status === "removed_provider") {
          const created = await store.createExecution({ planId, jobId, occurrenceId: oid, grantId });
          const executionId = created.executionId ?? created.execution_id;
          await recordVoicePrompt(planId, oid, ws);
          if (created.created)
            await store.failExecution(executionId, "voice_prompt",
              { provider: ws.provider, povName: ws.povName ?? null });
          out[oid] = { prompt: true, povName: ws.povName ?? null, provider: ws.provider,
                       recordedMapping: ws.recordedMapping ?? null };
          reportResults.push({ occurrenceId: oid, outcome: "policy_block",
            evidence: { voicePrompt: true, provider: ws.provider, povName: ws.povName ?? null } });
          continue;
        }
        if (ws.status !== "ok") { out[oid] = { skipped: true, state: ws.status }; continue; }
      }
      const payload = (ws && typeof ws === "object" && ws.status === "ok") ? ws.payload : ws;
      if (!payload) { out[oid] = { skipped: true, state: "no_content" }; continue; }
      // Batch refusal, layer 3: a batch work payload never executes.
      if (payload.mode === "batch") return { refused: "lane_not_allowed" };

      const r = await runFresh(msg, oid, payload, planId);
      out[oid] = r.outcome;
      if (r.report) reportResults.push(r.report);
      if (r.committed) committedCount++;
      if (r.stop) { stop = r.stop; break; } // quota or unknown: STOP the message
    }

    if (stop === "unknown") {
      // Fail-closed: no report at all (see header). Committed
      // successes stay committed; the unreported grant's lease
      // machinery surfaces the uncertainty.
      return { claimed: claim.status, occurrences: out, stoppedUnknownBilling: true };
    }
    if (reportResults.length > 0 || committedCount > 0) {
      const view = c.jobView(jobId);
      await c.handleReport({ grantId, jobRevision: view ? view.revision : undefined, results: reportResults });
    }
    const result = { claimed: claim.status, occurrences: out };
    if (stop === "quota") result.quotaExhausted = true;
    return result;
  }

  // Scan-driven recovery continuation (the service's recover()
  // returns the scan; this runs the R2-owning actions). Returns one
  // entry per actionable record; reconcile holds are reported, never
  // retried.
  async function recover() {
    if (typeof store.recoveryScan !== "function") return [];
    const scan = await store.recoveryScan();
    const out = [];
    for (const item of scan || []) {
      const execution = item.execution || item;
      const facts = execFacts(execution);
      if (item.action === "reverify_and_commit" || facts.state === "flushed" || facts.state === "verified") {
        out.push({ occurrenceId: facts.occurrenceId, action: "reverify_and_commit",
                   ...(await verifyAndCommit(execution, facts)) });
      } else if (item.action === "reenter_flush" || facts.state === "synthesized") {
        out.push({ occurrenceId: facts.occurrenceId, action: "reenter_flush",
                   ...(await reenterFlush(execution, facts)) });
      } else {
        out.push({ occurrenceId: facts.occurrenceId, action: item.action || "reconcile_hold", held: true });
      }
    }
    return out;
  }

  return { handleMessage, recover };
}
