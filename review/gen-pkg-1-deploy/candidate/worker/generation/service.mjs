// D6 WS-1 — the server-owned generation service (CONTRACTS.md
// "generation/service.mjs"; proposal §6.5 as redesigned by
// Amendment A-1 clarification 2). The client submits ONE intent;
// this service persists a durable per-plan work plan in the
// coordinator and drives dispatch itself against quota (100
// attempts/day), the monthly cap, the phase budget, the
// unknown-billing halt, and the storage boundary. Continuation is
// server-side and durable: plans resume after a quota rollover and
// after any restart, with no client contact. An occurrence with a
// non-terminal execution record is NEVER dispatched again.
import { createHash } from "node:crypto";
import { createGenStore } from "./genstore.mjs";
import { buildEligibleSet as realBuildEligibleSet } from "./eligible-set.mjs";
import { d6PhaseHalt, d6StorageProjection } from "./grant-guards.mjs";
import {
  D6_LANE_ALLOWLIST, expectedCostMicro, upperBoundOccurrenceMicro,
  R2_FREE_TIER_BYTES, PHASE_BUDGET_MICRO_CENTS,
} from "./gen-constants.mjs";
import {
  reconcileBindingProjections, isBindingPublished,
  ensureBindingProjectionSchema,
} from "./binding-projection.mjs";
import {
  phaseBindingFor, phaseBindingForBook, phaseRegistryEstablished,
  recordPhaseBinding,
} from "./phase-policy.mjs";
import {
  ensureQuarantineSchema, quarantineHoldRow,
  quarantineHoldRowSafe, recordQuarantineHold, applyQuarantineRelease,
  quarantineView, heldQuarantineStrict, noteHaltObservation,
} from "./quarantine.mjs";

// Voice mappings, recorded only (proposal §6.4): a voice-prompt row
// names the character and the recorded mapping where one exists.
// Nothing here decides or applies a mapping.
const RECORDED_VOICE_MAPPINGS = Object.freeze({
  Emmett: "Gemini Charon",
  Reese: "Gemini Kore",
  Tucker: "Gemini Puck (match unverified)",
  Sabrina: "Gemini Aoede",
});

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort()
    .map(k => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(",")}}`;
}
function sha256Hex(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

// Coordinator grant-refusal reason -> plan parking state.
const GRANT_STOP_MAP = Object.freeze({
  quota_estimate_exhausted: ["parked_quota", "quota_estimate_exhausted"],
  quota_parked: ["parked_quota", "quota_parked"],
  spending_cap: ["parked_cap", "spending_cap"],
  phase_budget: ["parked_budget", "phase_budget"],
  storage_boundary: ["parked_storage", "storage_boundary"],
  phase_halted_unknown_billing: ["halted_unknown", "phase_halted_unknown_billing"],
});

const JOB_TERMINAL = Object.freeze(
  ["complete", "partial", "failed", "cancelled", "superseded"]);

export function createGenerationService({ coord, env = {}, store = null, sources = {},
                                          expectedStorageBase = null,
                                          recountBucket = undefined,
                                          phasePolicyMode = "legacy",
                                          quarantineMode = "legacy" }) {
  if (!coord) throw new Error("createGenerationService requires a coordinator");
  store = store || createGenStore(coord);
  store.ensureSchema();
  const builder = sources.buildEligibleSet || realBuildEligibleSet;
  // R3-1 (Rowan round 3, comment 6512804398) + R5 / R4-2 (Rowan
  // round-5 ruling, comment 6514899384; Julie's approval, comment
  // 6522602149): the phase-policy ENFORCEMENT boundary.
  // "enforce" is selected ONLY by trusted server-side
  // construction. Since round 5 the production entry
  // (worker-entry-prod-d6.js d6Service) constructs this service
  // with "enforce" UNCONDITIONALLY — it no longer derives the
  // mode from the OPALREADER_PHASE_POLICY deployment var, so no
  // missing or mistyped flag can silently restore legacy
  // admission — and the entry's intent route additionally
  // returns an explicit 503 configuration failure whenever that
  // var is not exactly "enforce". The deployed Worker therefore
  // applies the registry rules from its first served request —
  // including while the binding registry is still empty, where
  // the bootstrap gate in admitPhase refuses EVERY intent
  // (phase_binding_required) until the operator records the
  // binding. Direct construction (every test fixture, the
  // legacy D6 suites) defaults to "legacy": the round-1/2
  // behavior, in which the registry rules engage once a binding
  // is recorded and the history rules govern before that. No
  // request, command, or intent field can select the mode —
  // submitIntent destructures its known inputs only, and the
  // mode is fixed here, at construction, from the server's own
  // configuration.
  const enforcePhasePolicy = phasePolicyMode === "enforce";

  // D7-2 QUARANTINE MODE (Rowan ruling 6524426826; Julie's
  // approval 6524562842): the same construction-boundary law as
  // the phase policy above. "enforce" is selected ONLY by trusted
  // server-side construction — the production entry
  // (worker-entry-prod-d6.js d6Service) constructs it
  // UNCONDITIONALLY — and it enables exactly one behavior: a plan
  // BORN while GENERATION_HALT !== "0" (missing/malformed counts
  // as halted) is birth-marked in the quarantine store, atomically
  // with its plan insert (see submitIntent). Direct construction
  // (every test fixture, the legacy D6 suites) defaults to
  // "legacy": no marking — the pre-D7-2 behavior, byte for byte.
  // No request, command, or intent field can select the mode.
  // The FENCE itself (grant guard, driver skip, executor defense)
  // is data-driven and applies wherever a hold row exists, in any
  // construction: a hold, once recorded, is never invisible.
  const enforceQuarantine = quarantineMode === "enforce";
  const generationHalted = () => env.GENERATION_HALT !== "0";

  function planRow(planId) {
    return coord._oneOrNull(`SELECT * FROM d6_plans WHERE plan_id = ?`, planId);
  }
  function setPlanState(planId, state, stopReason) {
    coord.sql.exec(
      `UPDATE d6_plans SET state = ?, stop_reason = ?, updated_at = ? WHERE plan_id = ?`,
      state, stopReason ?? null, coord._now(), planId);
  }
  function povFor(plane, bookId, povKey) {
    const book = (plane.books || []).find(b => b.bookId === bookId);
    if (!book || povKey == null) return null;
    return (book.povs || []).find(p => p.key === povKey) || null;
  }

  // Create one chapter (or segment) job for a plan through the
  // coordinator's durable command path and link it into the plan.
  // Idempotent: the command id is deterministic per (plan, job), so
  // a replay returns the original outcome and the link is
  // insert-or-ignore.
  async function createJobForEntries(plan, entries) {
    if (!entries.length) return null;
    const chapterIndex = entries[0].chapterIndex;
    const jobId = plan.scope === "segment"
      ? `${plan.plan_id}:seg` : `${plan.plan_id}:ch${chapterIndex}`;
    // Per-occurrence estimate for the job: the chapter average of
    // expected single-call costs, rounded up (CONTRACTS.md).
    const avg = entries.reduce((s, e) => s + expectedCostMicro(e.charCount || 0), 0)
      / entries.length;
    const estMicroCents = Math.ceil(avg);
    const res = await coord.handleCommand({
      command_id: `d6:${plan.plan_id}:${jobId}`,
      type: "SubmitJob",
      payload: {
        jobId, bookId: plan.book_id, chapterIndex, lane: plan.lane,
        occurrences: entries.map(e => ({
          occurrenceId: e.occurrenceId, revisionKey: e.revisionKey })),
        data: { estMicroCents, d6PlanId: plan.plan_id },
      },
    });
    if (res.outcome === "applied" || res.reason === "job_exists") {
      const seq = coord._one(
        `SELECT COUNT(*) AS n FROM d6_plan_jobs WHERE plan_id = ?`, plan.plan_id).n;
      coord.sql.exec(
        `INSERT OR IGNORE INTO d6_plan_jobs (plan_id, job_id, chapter_index, seq)
         VALUES (?, ?, ?, ?)`, plan.plan_id, jobId, chapterIndex, seq);
      for (const e of entries)
        coord.sql.exec(
          `UPDATE d6_plan_entries SET job_id = ? WHERE plan_id = ? AND occurrence_id = ?`,
          jobId, plan.plan_id, e.occurrenceId);
    }
    return { jobId, result: res };
  }

  function eligibleByChapter(planId) {
    const rows = coord._all(
      `SELECT * FROM d6_plan_entries WHERE plan_id = ? AND disposition = 'eligible'
        ORDER BY chapter_index, position`, planId);
    const groups = new Map();
    for (const r of rows) {
      if (!groups.has(r.chapter_index)) groups.set(r.chapter_index, []);
      groups.get(r.chapter_index).push({
        occurrenceId: r.occurrence_id, chapterIndex: r.chapter_index,
        chapterId: r.chapter_id, charCount: r.char_count,
        revisionKey: r.revision_key ?? null,
      });
    }
    return groups;
  }

  // Follow-on chapter entries come from the stored plan rows; the
  // one field the entry schema does not persist is revisionKey, so
  // it is re-derived from a fresh builder pass over the plane (the
  // builder is pure and deterministic — the same pass submitIntent
  // ran). The FIRST job never needs this: it is built directly from
  // the builder's entries, which carry revisionKey from the plane.
  async function nextChapterEntries(plan) {
    const groups = eligibleByChapter(plan.plan_id);
    const done = new Set(coord._all(
      `SELECT chapter_index FROM d6_plan_jobs WHERE plan_id = ?`, plan.plan_id)
      .map(r => r.chapter_index));
    const chapters = [...groups.keys()].sort((a, b) => a - b);
    for (const ch of chapters) {
      if (done.has(ch)) continue;
      // Re-derive revisionKeys from a fresh builder pass over the
      // plane (the builder is pure and deterministic): the stored
      // entry rows carry every other field.
      let revisionByOcc = new Map();
      if (typeof sources.eligiblePlane === "function") {
        const plane = await sources.eligiblePlane(plan.book_id);
        const built = builder(plane, plan.book_id);
        revisionByOcc = new Map(built.entries.map(e => [e.occurrenceId, e.revisionKey]));
      }
      return groups.get(ch).map(e => ({
        ...e, revisionKey: revisionByOcc.get(e.occurrenceId) ?? e.revisionKey,
      }));
    }
    return null;
  }

  // B1 (Rowan gen-pkg-1 source review round 1, comment
  // 6511518715) + R2-1 (round 2, comment 6511950562) + R3-1
  // (round 3, comment 6512804398): the phase a plan rides is
  // SERVER authority, never caller trust, evaluated before any
  // plan or ledger state moves. The governing rules are selected
  // by SERVER STATE and SERVER CONFIGURATION — never by anything
  // in the submission:
  //
  // REGISTRY RULES (admitPhaseRegistry below): the binding is
  // DERIVED from the phase→book registry (phase-policy.mjs)
  // alone.
  //   * a book the registry binds to a budgeted phase may only
  //     ever submit under that exact phase — a missing/null phase
  //     is rejected (phase_required) and any different phase is
  //     rejected (phase_mismatch), so no plan for a budgeted book
  //     can be created outside its phase accounting and hard stop;
  //   * a book with NO registry row cannot claim a budgeted phase
  //     at all: a phase bound to another book is rejected
  //     (phase_bound_to_other_book) and a budgeted phase with no
  //     recorded book is rejected (phase_unbound) — other books
  //     cannot claim the Forever Pucked envelope, and first-use
  //     binding does not exist under these rules;
  //   * an invented phase (outside PHASE_BUDGET_MICRO_CENTS) is
  //     rejected (phase_not_budgeted); no phase runs unbudgeted.
  // The registry rules govern whenever the registry has been
  // established (any binding recorded), in ANY construction —
  // and, since round 3, ALSO from the start in an
  // enforcement-bound construction (phasePolicyMode "enforce":
  // the production entry, which since round 5 constructs it
  // unconditionally), where the still-empty registry means
  // EVERY intent — budgeted, invented, or null-phase — fails
  // closed as phase_binding_required (the round-5 bootstrap
  // gate) until the operator records the binding through the
  // gated route. There is no window — not even between Worker
  // deployment and binding recording — in which a production
  // construction applies the legacy rules or admits an
  // unbudgeted plan.
  //
  // LEGACY MODE (non-enforcement construction AND registry not
  // yet established — every pre-registry fixture database and
  // the legacy D6 suites): the round-1 rules in admitPhaseLegacy
  // below, where a book's binding is the phase of the plans this
  // service has already admitted for it and an unbound book
  // presenting a registry phase establishes its binding with the
  // plan it creates. This is the explicit legacy/service-fixture
  // behavior Rowan sanctioned preserving; it is reachable ONLY
  // where no binding has ever been recorded AND the construction
  // is not enforcement-bound, and no submission can select it.
  //
  // The admitted phase — derived in admitPhase, not the caller's
  // raw value — is what the plan stores and what intent identity
  // (B2) binds.
  function admitPhase(bookId, callerPhaseRaw) {
    const callerPhase = callerPhaseRaw ?? null;
    // R5 / R4-2 bootstrap gate (Rowan round-5 ruling, comment
    // 6514899384, item 2; Julie's approval, comment 6522602149):
    // in an ENFORCEMENT-bound construction, while the phase→book
    // registry is still EMPTY, EVERY new generation intent is
    // refused — budgeted, invented, AND null-phase alike
    // (reason phase_binding_required) — with zero plan, ledger,
    // attempt, or grant movement. Round 3's enforce mode still
    // admitted a null-phase intent for an arbitrary book in that
    // window, which could have created an unbudgeted plan for
    // the real budgeted book itself before its binding was
    // recorded. The gate lifts the moment ANY binding is
    // recorded (the registry is established): from then on the
    // registry rules below govern, and genuinely unbudgeted
    // books may again submit with no phase. The operator-only
    // binding writer (bindPhaseBook) never passes through this
    // gate, so the recording act stays usable while admission
    // is gated. Direct legacy constructions are unaffected:
    // this gate exists only under enforcement, which — since
    // round 5 — the production entry applies UNCONDITIONALLY
    // (see worker-entry-prod-d6.js d6Service).
    if (enforcePhasePolicy && !phaseRegistryEstablished(coord))
      return { ok: false, reason: "phase_binding_required" };
    if (!enforcePhasePolicy && !phaseRegistryEstablished(coord))
      return admitPhaseLegacy(bookId, callerPhase);
    return admitPhaseRegistry(bookId, callerPhase);
  }

  function admitPhaseRegistry(bookId, callerPhase) {
    const own = phaseBindingForBook(coord, bookId);
    if (own) {
      if (callerPhase === null)
        return { ok: false, reason: "phase_required" };
      if (callerPhase !== own.phase)
        return { ok: false, reason: "phase_mismatch" };
      return { ok: true, phase: own.phase };
    }
    if (callerPhase !== null) {
      if (!Object.hasOwn(PHASE_BUDGET_MICRO_CENTS, callerPhase))
        return { ok: false, reason: "phase_not_budgeted" };
      if (phaseBindingFor(coord, callerPhase))
        return { ok: false, reason: "phase_bound_to_other_book" };
      return { ok: false, reason: "phase_unbound" };
    }
    return { ok: true, phase: null };
  }

  // The round-1 history derivation, preserved verbatim as the
  // legacy mode (see above). Do not "fix" the first-use binding
  // here: registry mode is where first use is governed, and this
  // path exists for registry-free deployments and fixtures.
  function admitPhaseLegacy(bookId, callerPhase) {
    const boundRow = coord._oneOrNull(
      `SELECT phase FROM d6_plans
        WHERE book_id = ? AND phase IS NOT NULL
        ORDER BY created_at, plan_id LIMIT 1`, bookId);
    const boundPhase = boundRow && Object.hasOwn(PHASE_BUDGET_MICRO_CENTS, boundRow.phase)
      ? boundRow.phase : null;
    if (boundPhase !== null) {
      if (callerPhase === null)
        return { ok: false, reason: "phase_required" };
      if (callerPhase !== boundPhase)
        return { ok: false, reason: "phase_mismatch" };
      return { ok: true, phase: boundPhase };
    }
    if (callerPhase !== null
        && !Object.hasOwn(PHASE_BUDGET_MICRO_CENTS, callerPhase))
      return { ok: false, reason: "phase_not_budgeted" };
    return { ok: true, phase: callerPhase };
  }

  // The service handle on the registry writer (phase-policy.mjs
  // recordPhaseBinding): recording a phase→book binding is a
  // gated operator act. Since round 3 (R3-1) it IS reachable in
  // the pinned production entry — through exactly one surface:
  // the operator-only POST /v2/d6-phase-binding route, admitted
  // on the migration-operator credential alone (the
  // skipClientToken operator class, like the Option D operator
  // routes and the diagnostics read) and forwarded to the
  // internal route, which requires the entry's operator-admitted
  // stamp. No client route reaches this method: the everyday
  // client token alone is refused at the entry with
  // migration_operator_required, and the internal route refuses
  // any request the entry has not stamped. Returns the service's
  // usual applied/rejected shapes; a conflict or malformed
  // request moves nothing.
  function bindPhaseBook(input) {
    try {
      const r = recordPhaseBinding(coord, input || {});
      return { outcome: "applied", ...r };
    } catch (e) {
      const msg = String((e && e.message) || e);
      if (msg.startsWith("phase_binding_conflict"))
        return { outcome: "rejected", reason: "phase_binding_conflict" };
      if (msg.startsWith("phase_not_budgeted"))
        return { outcome: "rejected", reason: "phase_not_budgeted" };
      if (msg.startsWith("phase_binding_shape"))
        return { outcome: "rejected", reason: "phase_binding_shape" };
      throw e;
    }
  }

  // Read-back for the registry: the recorded binding row for one
  // phase, or null. The operator route returns this alongside
  // every bindPhaseBook verdict, so a recording is verified from
  // the server's own state — never from the request's echo — and
  // a conflict refusal shows the binding that stands.
  function getPhaseBinding(phase) {
    const row = phaseBindingFor(coord, phase);
    if (!row) return null;
    return {
      phase: row.phase, bookId: row.book_id, source: row.source,
      createdAt: row.created_at, updatedAt: row.updated_at,
    };
  }

  // The service handle on the store's unknown-billing
  // reconciliation (genstore.reconcileUnknown — the pre-existing
  // D6 operator mechanism): records the now-known cost for one
  // confirmed/unknown attempt; when it was the phase's last open
  // unknown, the phase halt clears in the same transaction.
  // Operator-side only — no client route reaches it in this
  // build; it is the first half of the R3-2 clearance workflow
  // (reconcile the attempts, then retireHaltedPlan below).
  // Errors from the store map onto rejected reasons; a refusal
  // moves nothing.
  function reconcileUnknownAttempt(attemptId, opts = {}) {
    try {
      const r = store.reconcileUnknown(attemptId, opts || {});
      return {
        outcome: "applied", attemptId,
        attemptOutcome: r.attempt ? r.attempt.outcome : null,
        attemptCostMicroCents: r.attempt ? r.attempt.cost_micro_cents : null,
        haltCleared: !!r.haltCleared,
      };
    } catch (e) {
      const msg = String((e && e.message) || e);
      if (msg.startsWith("attempt_not_found"))
        return { outcome: "rejected", reason: "attempt_not_found" };
      if (msg.startsWith("attempt_not_unknown"))
        return { outcome: "rejected", reason: "attempt_not_unknown" };
      if (msg.startsWith("reconcile_"))
        return { outcome: "rejected", reason: msg.split(":")[0] };
      throw e;
    }
  }

  // ---- R3-2 clearance: retiring a halted_unknown plan ---------
  // The retirement audit lives in its own lazily-ensured table
  // (the phase-policy precedent: DDL beside its only writer,
  // never in GEN_SCHEMA — the correction suites pin the
  // bootstrap's table set — and ensured ONLY here, so a store
  // that never retires a plan never grows the table).
  const PLAN_RETIREMENT_SCHEMA = `
CREATE TABLE IF NOT EXISTS d6_plan_retirements (
  plan_id TEXT PRIMARY KEY, note TEXT, source TEXT,
  created_at INTEGER NOT NULL);
`;
  function ensurePlanRetirementSchema() {
    coord.sql.exec(PLAN_RETIREMENT_SCHEMA);
  }

  // retireHaltedPlan({ planId, note, source }) — the explicit
  // operator clearance that ends a halted_unknown plan's fence
  // ownership (R3-2). Semantics:
  //   * ONLY a plan currently in state 'halted_unknown' can be
  //     retired (anything else: plan_not_halted_unknown; an
  //     unknown id: plan_not_found);
  //   * the plan's own unknown attempts must be RECONCILED FIRST
  //     (reconcileUnknownAttempt / genstore.reconcileUnknown):
  //     while any confirmed/unknown attempt row remains open for
  //     the plan, retirement is refused (unknown_billing_open) —
  //     retirement never papers over an unresolved charge;
  //   * the transition (state -> 'retired', stop_reason
  //     'retired_unknown_billing') and the audit row are written
  //     in ONE transaction; 'retired' is terminal everywhere:
  //     driveOnce never selects it, and the admission fence no
  //     longer counts it — ownership is cleared, so a later fresh
  //     intent over the same occurrences may be admitted by the
  //     ordinary rules;
  //   * retirement is NEVER inferred: no submission, keepGoing
  //     change, or phase-halt flip performs or implies it. In
  //     the pinned production entry it is reachable only through
  //     the operator-only POST /v2/d6-retire-halted-plan route
  //     (the same operator fence class as the phase-binding
  //     route); its USE against any production plan remains
  //     Julie's separate authorization.
  function retireHaltedPlan(input) {
    const { planId, note = null, source = null } = input || {};
    if (typeof planId !== "string" || planId.length === 0)
      return { outcome: "rejected", reason: "plan_id_required" };
    const plan = planRow(planId);
    if (!plan) return { outcome: "rejected", reason: "plan_not_found" };
    if (plan.state !== "halted_unknown")
      return { outcome: "rejected", reason: "plan_not_halted_unknown", state: plan.state };
    const open = coord._one(
      `SELECT COUNT(*) AS n FROM d6_attempt_log
        WHERE plan_id = ? AND phase = 'confirmed' AND outcome = 'unknown'`,
      planId).n;
    if (open > 0)
      return { outcome: "rejected", reason: "unknown_billing_open", openUnknown: open };
    const t = coord._now();
    coord._tx(() => {
      ensurePlanRetirementSchema();
      coord.sql.exec(
        `INSERT INTO d6_plan_retirements (plan_id, note, source, created_at)
         VALUES (?, ?, ?, ?)`,
        planId, note ?? null, source ?? null, t);
      setPlanState(planId, "retired", "retired_unknown_billing");
    });
    return {
      outcome: "applied", planId,
      fromState: "halted_unknown", state: "retired",
      stopReason: "retired_unknown_billing", note: note ?? null,
    };
  }

  // ---- D7-2 release: clearing a quarantine hold --------------
  // releaseQuarantine({ planId | jobId, source }) — the ONLY way
  // a quarantine hold clears (Rowan ruling 6524426826 req 3;
  // Julie's approval 6524562842). Semantics:
  //   * PER-SUBJECT and IDEMPOTENT: releasing plan A never
  //     touches plan B (or any job); a second release of an
  //     already-released subject is a safe no-op that returns the
  //     standing released record (alreadyReleased: true).
  //   * AUDITABLE: the release stamps the hold row itself —
  //     released_at (server clock), release_source (the recorded
  //     authorization source string; the entry stamps
  //     "operator-route", never a caller-supplied value), and
  //     release_actor_class ("operator"). The birth fields are
  //     never rewritten; the row is never deleted.
  //   * PRECONDITIONS, checked server-side: exactly one subject
  //     named (subject_required / subject_ambiguous); the plan
  //     exists (plan_not_found); a hold row exists
  //     (subject_not_quarantined); and — the billing fence — a
  //     plan in state 'halted_unknown' can NOT be released
  //     (release_refused_halted_unknown): quarantine release is
  //     NOT a reconciliation, and clearing a hold must never
  //     paper over unresolved billing. A halted_unknown plan's
  //     path remains reconcileUnknownAttempt + retireHaltedPlan,
  //     under their own authorizations. (In practice the driver
  //     skip means a born-held plan never transitions INTO
  //     halted_unknown while held; this refusal also covers a
  //     hold recorded against an already-halted plan's job space
  //     and any future path that could produce the combination.)
  //   * NOTHING ELSE CALLS THIS: no deploy, binding, publish, or
  //     re-arm path invokes it; in the pinned production entry it
  //     is reachable only through the operator-only
  //     POST /v2/d6-release-quarantine route (the migration-
  //     operator fence class — the client token alone is
  //     refused), and each production USE remains Julie's
  //     separate, per-plan approval. The route's existence is
  //     not authority.
  function getQuarantine({ planId = null, jobId = null } = {}) {
    if (planId) return quarantineView(quarantineHoldRowSafe(coord, "plan", planId));
    if (jobId) return quarantineView(quarantineHoldRowSafe(coord, "job", jobId));
    return quarantineView(null);
  }

  function releaseQuarantine(input) {
    const { planId = null, jobId = null, source = null } = input || {};
    const hasPlan = typeof planId === "string" && planId.length > 0;
    const hasJob = typeof jobId === "string" && jobId.length > 0;
    if (!hasPlan && !hasJob)
      return { outcome: "rejected", reason: "subject_required" };
    if (hasPlan && hasJob)
      return { outcome: "rejected", reason: "subject_ambiguous" };
    const subjectKind = hasPlan ? "plan" : "job";
    const subjectId = hasPlan ? planId : jobId;
    if (hasPlan) {
      const plan = planRow(planId);
      if (!plan) return { outcome: "rejected", reason: "plan_not_found" };
      if (plan.state === "halted_unknown")
        return { outcome: "rejected", reason: "release_refused_halted_unknown",
                 state: plan.state };
    }
    ensureQuarantineSchema(coord.sql);
    const row = quarantineHoldRow(coord, subjectKind, subjectId);
    if (!row)
      return { outcome: "rejected", reason: "subject_not_quarantined" };
    if (row.state === "released") {
      return { outcome: "applied", alreadyReleased: true,
               ...(hasPlan ? { planId } : { jobId }),
               quarantine: quarantineView(row) };
    }
    let updated = null;
    coord._tx(() => {
      updated = applyQuarantineRelease(coord, {
        subjectKind, subjectId, source, actorClass: "operator",
      });
    });
    return { outcome: "applied", alreadyReleased: false,
             ...(hasPlan ? { planId } : { jobId }),
             quarantine: quarantineView(updated) };
  }

  // R2-2 (Rowan round 2, comment 6511950562): the ACTIVE
  // OVERLAPPING-OCCURRENCE FENCE. B2 put execution semantics
  // inside intent identity, so a different-semantics request over
  // the same eligible set mints a distinct plan instead of being
  // silently handed the old one — but identity alone does not
  // prevent DUPLICATE SPENDING: two live plans over the same
  // occurrences could both be granted and both pay for the same
  // content. This fence is the spending guard. It runs inside
  // submitIntent AFTER intent convergence (a byte-identical retry
  // returns its own plan first and never fences itself) and
  // BEFORE any plan/ledger state moves, in the same synchronous
  // stretch as the convergence lookup and the plan insert, so
  // two racing submissions cannot both pass it.
  //
  // A plan FENCES while it owns unresolved work over its
  // eligible occurrences: state 'active', the parked_* family
  // (quota/cap/storage parks resume on their own in driveOnce),
  // and — since round 3 (R3-2, Rowan round-3 review comment
  // 6512804398) — 'halted_unknown'. Round 2 treated a halted plan
  // as non-fencing because it grants again only after a gated
  // reconciliation; Rowan's correction: that still let a NEW paid
  // plan mint over the halt's unresolved occurrences, where a
  // later reconciliation could put both plans' execution surfaces
  // over the same content. A halted_unknown plan therefore fences
  // its overlapping occurrences until an explicit operator
  // reconciliation + retirement (retireHaltedPlan) clears its
  // ownership — clearance is never inferred from a new command, a
  // changed keepGoing, or an eventual phase-halt flip (the fence
  // reads PLAN STATE, not the phase halt: a reconciled-but-not-
  // retired plan still in 'halted_unknown' keeps fencing).
  // Terminal plans do NOT fence: 'complete' and 'partial' are
  // finished, and 'retired' is the cleared terminal state the
  // operator transition above produces. The fence never resumes,
  // alters, or unblocks the halted plan; it only reads plan
  // state. The parked JOB (a coordinator-level job in state
  // parked_policy — Forever Pucked Ch 3) is a different mechanism
  // entirely: its occurrences never enter an eligible set (the
  // builder marks them excluded_parked / excluded_ch3), so they
  // can neither fence nor be fenced, and nothing here touches
  // that job.
  const PLAN_FENCE_TERMINAL = Object.freeze(
    ["complete", "partial", "retired"]);
  function activeOverlapConflict(bookId, eligibleIds) {
    const want = new Set(eligibleIds);
    const plans = coord._all(
      `SELECT * FROM d6_plans WHERE book_id = ?
        ORDER BY created_at, plan_id`, bookId);
    for (const p of plans) {
      if (PLAN_FENCE_TERMINAL.includes(p.state)) continue;
      const rows = coord._all(
        `SELECT occurrence_id FROM d6_plan_entries
          WHERE plan_id = ? AND disposition = 'eligible'`, p.plan_id);
      let overlapCount = 0;
      for (const r of rows) if (want.has(r.occurrence_id)) overlapCount++;
      if (overlapCount > 0) {
        return {
          planId: p.plan_id, bookId: p.book_id, scope: p.scope,
          lane: p.lane, keepGoing: !!p.keep_going, phase: p.phase,
          overlapCount,
        };
      }
    }
    return null;
  }

  async function submitIntent(input) {
    const {
      commandId = null, bookId, scope, chapterIndex = null,
      occurrenceId = null, keepGoing = false, phase = null,
      lane = "standard",
    } = input || {};
    if (!D6_LANE_ALLOWLIST.includes(lane || "standard"))
      return { outcome: "rejected", reason: "lane_not_allowed" };
    // B1: phase admission (above) — a rejection creates no plan
    // and moves no ledger state.
    const admission = admitPhase(bookId, phase);
    if (!admission.ok)
      return { outcome: "rejected", reason: admission.reason };
    const admittedPhase = admission.phase;
    if (typeof sources.eligiblePlane !== "function")
      throw new Error("d6_eligible_plane_source_required");
    const plane = await sources.eligiblePlane(bookId);
    const built = builder(plane, bookId);
    const all = built.entries || [];
    const scoped = all.filter(e =>
      scope === "book" ? true
      : scope === "chapter" ? e.chapterIndex === chapterIndex
      : scope === "segment" ? e.occurrenceId === occurrenceId
      : false);
    if (!["book", "chapter", "segment"].includes(scope))
      return { outcome: "rejected", reason: "scope_invalid" };
    const eligibleIds = scoped.filter(e => e.disposition === "eligible")
      .map(e => e.occurrenceId);
    // B2 (Rowan round 1): intent identity covers the authoritative
    // requested EXECUTION SEMANTICS — lane, keepGoing, and the
    // server-derived phase (B1) — alongside the eligible set. A
    // byte-identical retry still converges on the existing plan;
    // a request whose semantics differ mints its own plan and is
    // never silently handed a plan with different semantics.
    const intentKey = sha256Hex(canonicalJson({
      bookId, scope,
      chapterIndex: chapterIndex ?? null,
      occurrenceId: occurrenceId ?? null,
      eligibleIds,
      lane: lane || "standard",
      keepGoing: !!keepGoing,
      phase: admittedPhase,
    }));
    const existing = coord._oneOrNull(
      `SELECT * FROM d6_plans WHERE intent_key = ?`, intentKey);
    if (existing)
      return { planId: existing.plan_id, created: false, state: existing.state };
    // R2-2: the active overlapping-occurrence fence (above). A
    // rejection names the existing plan and ITS immutable
    // semantics — the caller is told exactly which plan owns the
    // overlapping work — and creates nothing.
    if (eligibleIds.length) {
      const conflict = activeOverlapConflict(bookId, eligibleIds);
      if (conflict)
        return { outcome: "rejected", reason: "plan_overlap_conflict", conflict };
    }
    const planId = `plan:${intentKey.slice(0, 24)}`;
    const t = coord._now();
    // D8-2: an intent submission is itself a halt observation
    // for the epoch ledger (quarantine.mjs) — noted before the
    // insert so a halt that begins with this submission opens
    // its epoch with this moment inside it. Best-effort here (as
    // in driveOnce): the ledger's strict noting point is the
    // grant guard.
    try { noteHaltObservation(coord, env); } catch { /* guard notes strictly */ }
    coord._tx(() => {
      coord.sql.exec(
        `INSERT INTO d6_plans
           (plan_id, intent_key, book_id, scope, keep_going, phase, lane,
            state, stop_reason, eligible_digest, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active', NULL, ?, ?, ?)`,
        planId, intentKey, bookId, scope, keepGoing ? 1 : 0, admittedPhase,
        lane || "standard", built.digest ?? null, t, t);
      for (const e of scoped) {
        coord.sql.exec(
          `INSERT INTO d6_plan_entries
             (plan_id, occurrence_id, book_id, chapter_id, chapter_index,
              position, pov_key, char_count, upper_micro_cents, disposition, job_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
          planId, e.occurrenceId, e.bookId ?? bookId, e.chapterId ?? null,
          e.chapterIndex, e.position, e.povKey ?? null, e.charCount ?? 0,
          e.disposition === "eligible"
            ? upperBoundOccurrenceMicro(e.charCount || 0) : 0,
          e.disposition);
        if (e.disposition === "voice_prompt") {
          const pov = povFor(plane, bookId, e.povKey);
          const name = pov ? pov.name : null;
          coord.sql.exec(
            `INSERT OR IGNORE INTO d6_voice_prompts
               (plan_id, occurrence_id, character_name, provider,
                recorded_mapping, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            planId, e.occurrenceId, name,
            pov ? pov.provider : null,
            name ? (RECORDED_VOICE_MAPPINGS[name] ?? null) : null, t);
        }
      }
      // D7-2 BIRTH-MARK: a plan born while generation is halted
      // (GENERATION_HALT !== "0" — missing/malformed counts as
      // halted) is quarantined AT BIRTH, in this same transaction
      // as the plan + entries insert, so the mark can never be
      // lost between admission and fencing. The mark is
      // server-stamped from the service's own halt reading —
      // nothing in the submission can request, prevent, or shape
      // it — and it changes NOTHING about admission: the plan is
      // durable, its state is 'active', its first job is created
      // below, and zero grants/dispatches occur (C3's contract).
      // What the mark fences is SPEND AUTHORITY (grant guard,
      // driver, executor), until the operator-only per-plan
      // release. Plans born while HALT === "0" are never marked;
      // a converged resubmission returns above and never reaches
      // here, so a pre-existing plan is never retro-marked.
      if (enforceQuarantine && generationHalted()) {
        recordQuarantineHold(coord, {
          subjectKind: "plan", subjectId: planId,
          reason: "born_while_halted", source: "submit_intent",
        });
      }
    });
    const plan = planRow(planId);
    // The FIRST job: the segment's own entry, the chapter's entries,
    // or the first chapter (reading order) with eligible entries.
    const eligible = scoped.filter(e => e.disposition === "eligible");
    if (!eligible.length) {
      setPlanState(planId, "complete", "nothing_eligible");
      return { planId, created: true, state: "complete" };
    }
    let first;
    if (scope === "segment") first = eligible.slice(0, 1);
    else if (scope === "chapter") first = eligible;
    else {
      const firstCh = Math.min(...eligible.map(e => e.chapterIndex));
      first = eligible.filter(e => e.chapterIndex === firstCh);
    }
    await createJobForEntries(plan, first);
    return { planId, created: true, state: "active" };
  }

  function finishPlan(plan) {
    const entries = coord._all(
      `SELECT * FROM d6_plan_entries WHERE plan_id = ? AND disposition = 'eligible'`,
      plan.plan_id);
    let done = 0;
    for (const e of entries) {
      const occ = e.job_id ? coord._oneOrNull(
        `SELECT * FROM occurrences WHERE job_id = ? AND occurrence_id = ?`,
        e.job_id, e.occurrence_id) : null;
      const exec = e.job_id ? store.executionFor(e.job_id, e.occurrence_id) : null;
      if ((occ && occ.state === "ready") || (exec && exec.state === "committed"))
        done++;
    }
    const state = entries.length > 0 && done === entries.length
      ? "complete" : "partial";
    setPlanState(plan.plan_id, state, state === "complete" ? null : "incomplete");
    return state;
  }

  async function driveOnce() {
    const outcomes = [];
    // D8-2 (Rowan review 6525035570): this pass is one of the
    // halt-epoch ledger's observation points (quarantine.mjs).
    // The class alarm runs driveOnce every watchdog cycle, so
    // noting here is what bounds the epochs' unobserved slivers
    // in production. Noting is best-effort at THIS surface: a
    // ledger fault must not stop the driver from reaching the
    // grant guard, which notes strictly inside the grant
    // transaction and fails closed there.
    try { noteHaltObservation(coord, env); } catch { /* guard notes strictly */ }
    // 'retired' (R3-2) joins the terminal exclusions: a retired
    // plan is closed by an operator act and the driver must never
    // grant against it or flip it back to active.
    //
    // R4-1 (Rowan round-4 review, comment 6513553263):
    // 'halted_unknown' is an ENDURING DRIVER-LEVEL STOP, excluded
    // at SELECTION — the driver never selects, mutates,
    // reactivates, grants for, or dispatches a halted plan, on
    // any pass, however often the alarm fires. Rounds 1–3
    // selected halted plans and flipped them back to 'active'
    // once the phase's unknown-billing flag cleared (the
    // reconcileUnknown side effect), which silently ended the
    // halt on the next alarm — before any operator retirement,
    // and in a way that could also make a later retirement fail
    // with plan_not_halted_unknown. That flip is GONE. The ONLY
    // transition out of 'halted_unknown' is retireHaltedPlan
    // (to 'retired', itself terminal here); any later restart
    // over the plan's occurrences requires a fresh approved
    // intent under all fences. Phase-level handling for OTHER
    // plans is unchanged: a selected plan whose phase is halted
    // still transitions INTO 'halted_unknown' below and stops —
    // the exclusion governs plans already halted, never the
    // act of halting.
    const plans = coord._all(
      `SELECT * FROM d6_plans WHERE state NOT IN ('complete', 'partial', 'retired', 'halted_unknown')
        ORDER BY created_at, plan_id`);
    for (const plan of plans) {
      const out = { planId: plan.plan_id };
      outcomes.push(out);
      // D7-2 DRIVER SKIP: a quarantined plan is never advanced —
      // no grant step, no chapter advancement, no state
      // transition (not even INTO halted_unknown if its phase
      // later halts: the hold, not plan state, is its fence, and
      // the release semantics below assume a held plan's state
      // was never moved by the driver). The skip is reported
      // truthfully on the pass outcome: approvalRequired, never
      // a suggestion that work is in flight.
      //
      // D8-1 (Rowan review 6525035570): the skip reads the hold
      // STRICTLY (schema ensured, heldQuarantineStrict) — and a
      // read FAILURE is treated as held-for-driving: the plan is
      // skipped and the outcome is stamped quarantineCheckFailed,
      // so a database fault can never let the driver walk a
      // possibly-held plan into the grant step. (The grant guard
      // behind the step is itself strict, so this is defense in
      // depth: the failure is surfaced on the pass outcome, not
      // just as a thrown grant.)
      let heldRow = null, quarantineCheckFailed = false;
      try {
        ensureQuarantineSchema(coord.sql);
        heldRow = heldQuarantineStrict(coord, "plan", plan.plan_id);
      } catch { quarantineCheckFailed = true; }
      if (heldRow || quarantineCheckFailed) {
        out.state = plan.state;
        out.quarantined = true;
        out.approvalRequired = true;
        if (quarantineCheckFailed) out.quarantineCheckFailed = true;
        continue;
      }
      // Unknown-billing halt for the plan's phase: no granting.
      if (plan.phase && d6PhaseHalt(coord, plan.phase)) {
        setPlanState(plan.plan_id, "halted_unknown", "phase_halted_unknown_billing");
        out.state = "halted_unknown"; out.stopReason = "phase_halted_unknown_billing";
        continue;
      }
      // Storage guard for the plan (fail-closed, whole-plan
      // projection including remaining eligible characters).
      const proj = d6StorageProjection(coord, plan.plan_id);
      if (proj.refuses || proj.projection >= R2_FREE_TIER_BYTES) {
        setPlanState(plan.plan_id, "parked_storage", "storage_boundary");
        out.state = "parked_storage"; out.stopReason = "storage_boundary";
        continue;
      }
      const jobs = coord._all(
        `SELECT * FROM d6_plan_jobs WHERE plan_id = ? ORDER BY seq`, plan.plan_id);
      let current = jobs[jobs.length - 1];
      if (!current) { out.state = plan.state; continue; }
      // Grant step for one job: request a grant when it has pending
      // occurrences and no live grant. Returns "stopped" when a
      // stop condition parked/halted the plan.
      const grantStep = async (jobId) => {
        const v = coord.jobView(jobId);
        if (!v) return "ok";
        const pending = v.occurrences.filter(o => o.state === "pending");
        const liveGrant = v.grants.some(g => g.state === "issued");
        if (!pending.length || liveGrant) return "ok";
        // Never dispatch an occurrence with a non-terminal
        // execution record.
        const inFlight = pending.some(o => {
          const ex = store.executionFor(jobId, o.occurrence_id);
          return ex && ex.state !== "committed" && ex.state !== "failed";
        });
        if (inFlight) { out.skipped = "execution_in_flight"; return "ok"; }
        const g = await coord.requestGrant(jobId);
        if (g.ok) {
          setPlanState(plan.plan_id, "active", null);
          out.state = "active"; out.grantId = g.grantId;
        } else if (GRANT_STOP_MAP[g.reason]) {
          const [st, reason] = GRANT_STOP_MAP[g.reason];
          setPlanState(plan.plan_id, st, reason);
          out.state = st; out.stopReason = reason;
          return "stopped";
        } else if (g.reason === "grant_exists") {
          out.state = "active";
        } else {
          out.grantRefused = g.reason;
        }
        return "ok";
      };
      if (await grantStep(current.job_id) === "stopped") continue;
      let view = coord.jobView(current.job_id);
      if (!view) { out.state = plan.state; continue; }
      // Advancement: current job settled -> next chapter (book
      // scope + keepGoing), granted in the SAME pass, or finish.
      const open = view.occurrences.filter(
        o => o.state === "pending" || o.state === "granted").length;
      if (JOB_TERMINAL.includes(view.state) || open === 0) {
        let advanced = false;
        if (plan.scope === "book" && plan.keep_going) {
          const next = await nextChapterEntries(planRow(plan.plan_id));
          if (next) {
            const created = await createJobForEntries(planRow(plan.plan_id), next);
            setPlanState(plan.plan_id, "active", null);
            out.state = "active"; out.advanced = true;
            advanced = true;
            if (created) await grantStep(created.jobId);
          }
        }
        if (!advanced) out.state = finishPlan(planRow(plan.plan_id));
      } else if (!out.state) {
        out.state = planRow(plan.plan_id).state;
      }
    }
    // Deliver any grants the coordinator issued (the queue producer
    // seam): only when the host wired a sender (generation enabled).
    if (typeof env.sendGrant === "function")
      await coord.drainOutbox(env.sendGrant);
    // gen-pkg-1: the binding-projection reconciliation sweep rides
    // the same watchdog cycle (brief §3). Bounded per pass; its
    // outcome never blocks plan driving — publication state is
    // durable in the markers and the next pass retries.
    try {
      const sweep = reconcileBindingProjections(coord, { limit: 50 });
      outcomes.push({ bindingProjection: sweep });
    } catch (e) {
      outcomes.push({ bindingProjectionError: String(e && e.message || e) });
    }
    return outcomes;
  }

  function planStatus(planId) {
    const plan = planRow(planId);
    if (!plan) return null;
    const rows = coord._all(
      `SELECT * FROM d6_plan_entries WHERE plan_id = ?
        ORDER BY chapter_index, position`, planId);
    const entries = rows.map(e => {
      const occ = e.job_id ? coord._oneOrNull(
        `SELECT * FROM occurrences WHERE job_id = ? AND occurrence_id = ?`,
        e.job_id, e.occurrence_id) : null;
      const exec = e.job_id ? store.executionFor(e.job_id, e.occurrence_id) : null;
      return {
        occurrenceId: e.occurrence_id, bookId: e.book_id,
        chapterId: e.chapter_id, chapterIndex: e.chapter_index,
        position: e.position, povKey: e.pov_key, charCount: e.char_count,
        disposition: e.disposition, jobId: e.job_id,
        occurrenceState: occ ? occ.state : null,
        executionState: exec ? exec.state : null,
      };
    });
    const eligible = entries.filter(e => e.disposition === "eligible");
    const totals = {
      eligible: eligible.length,
      done: eligible.filter(e => e.occurrenceState === "ready"
        || e.executionState === "committed").length,
      failed: eligible.filter(e => e.occurrenceState === "failed"
        || e.executionState === "failed").length,
      blocked: eligible.filter(e => e.occurrenceState === "blocked_policy").length,
      prompts: entries.filter(e => e.disposition === "voice_prompt").length,
    };
    return {
      planId: plan.plan_id, state: plan.state, stopReason: plan.stop_reason,
      totals, entries,
      // D7-2: the truthful hold state. A held plan reports
      // approvalRequired: true — a human authorization (the
      // operator release, itself gated on Julie's separate
      // approval) is required before any spend. The plan's state
      // stays exactly what it is ('active' for a born-held plan):
      // quarantine is reported BESIDE state, never AS a state,
      // and never implies audio is generating.
      quarantine: quarantineView(
        quarantineHoldRowSafe(coord, "plan", plan.plan_id)),
    };
  }

  // ---- gen-pkg-1 read surfaces (brief §6 items 2–4) ----------------
  // All three are READ-ONLY: they hold no write capability beyond
  // the projection schema's idempotent bootstrap (DDL only), and
  // they report only server-held amounts — settled spend and phase
  // remaining come from the attempt ledger, never from estimates.

  // Settled spend for ONE plan, using phaseAccounting's settled
  // definition (confirmed attempts with a known outcome), scoped to
  // the plan's own attempt rows.
  function planSettledMicro(planId) {
    return coord._one(
      `SELECT COALESCE(SUM(cost_micro_cents), 0) AS s FROM d6_attempt_log
        WHERE plan_id = ? AND phase = 'confirmed'
          AND outcome IN ('success', 'failed_known', 'policy_block')`,
      planId).s;
  }

  function planSummary(plan) {
    const status = planStatus(plan.plan_id);
    const totals = status ? status.totals
      : { eligible: 0, done: 0, failed: 0, blocked: 0, prompts: 0 };
    const entries = status ? status.entries : [];
    const committed = entries.filter(e =>
      e.disposition === "eligible" &&
      (e.occurrenceState === "ready" || e.executionState === "committed"));
    let published = 0;
    for (const e of committed)
      if (isBindingPublished(coord, e.occurrenceId)) published++;
    let chapterIndex = null;
    if (plan.scope === "chapter") {
      const idx = [...new Set(entries.map(e => e.chapterIndex))];
      chapterIndex = idx.length === 1 ? idx[0] : null;
    }
    return {
      planId: plan.plan_id, bookId: plan.book_id, scope: plan.scope,
      chapterIndex, lane: plan.lane, phase: plan.phase,
      keepGoing: !!plan.keep_going,
      state: plan.state, stopReason: plan.stop_reason,
      // D7-2: the list view carries the same truthful signal as
      // the single-plan view (held === approvalRequired).
      approvalRequired: status ? status.quarantine.held : false,
      totals,
      settledMicroCents: planSettledMicro(plan.plan_id),
      bindingsPublished: published,
      bindingsPending: committed.length - published,
      createdAt: plan.created_at, updatedAt: plan.updated_at,
    };
  }

  // GET /v2/d6-plans — the account's plans, newest first, with
  // keyset pagination over (created_at, plan_id): stable under
  // concurrent inserts, bounded page size, no book text anywhere
  // (plan rows and entries carry structural metadata only).
  function listPlans({ limit = 50, cursor = null } = {}) {
    ensureBindingProjectionSchema(coord);
    const cap = Math.max(1, Math.min(100, Number.isFinite(limit) ? limit | 0 : 50));
    let cur = null;
    if (cursor) {
      try {
        const raw = JSON.parse(Buffer.from(String(cursor), "base64url").toString("utf8"));
        if (raw && Number.isSafeInteger(raw.c) && typeof raw.p === "string")
          cur = raw;
      } catch { /* an undecodable cursor reads from the top */ }
    }
    const rows = cur
      ? coord._all(
          `SELECT * FROM d6_plans
            WHERE created_at < ? OR (created_at = ? AND plan_id < ?)
            ORDER BY created_at DESC, plan_id DESC LIMIT ?`,
          cur.c, cur.c, cur.p, cap + 1)
      : coord._all(
          `SELECT * FROM d6_plans
            ORDER BY created_at DESC, plan_id DESC LIMIT ?`, cap + 1);
    const page = rows.slice(0, cap);
    const last = page[page.length - 1];
    const nextCursor = rows.length > cap && last
      ? Buffer.from(JSON.stringify({ c: last.created_at, p: last.plan_id }),
          "utf8").toString("base64url")
      : null;
    return { plans: page.map(planSummary), nextCursor };
  }

  // GET /v2/generation/capabilities — what the server admits right
  // now: generation state (the halt flag), per-lane admission (the
  // pinned allowlist — the configured lane is NOT the allowlist and
  // is reported separately, as information only), and per-phase
  // budget authority from the ledger. Phases appear ONLY when a
  // budget actually exists for them (PHASE_BUDGET_MICRO_CENTS is
  // the whole universe of budgeted phases); nothing is invented
  // for unbudgeted phases.
  function capabilities() {
    const lanes = {};
    for (const lane of ["standard", "batch"]) {
      const admitted = D6_LANE_ALLOWLIST.includes(lane);
      lanes[lane] = admitted
        ? { admitted: true }
        : { admitted: false,
            reason: lane === "batch" ? "batch_not_armed" : "lane_not_admitted" };
    }
    let configuredLane = null;
    try {
      const s = coord.settingsView();
      configuredLane = (s && s.data && s.data.lane) ?? null;
    } catch { configuredLane = null; }
    const phases = [];
    for (const [phase, budget] of Object.entries(PHASE_BUDGET_MICRO_CENTS)) {
      const acct = store.phaseAccounting(phase);
      // R2-1: once the phase→book registry is established, the
      // phase's book is the registry's — the authoritative link,
      // reported even before any plan exists. In legacy mode the
      // link is read from admitted plans, as in round 1. R3-1:
      // in an enforcement-bound construction the history-derived
      // link is never presented as the phase's book — the
      // registry row or nothing (null until the operator records
      // the binding), matching admission exactly.
      const binding = phaseBindingFor(coord, phase);
      const plan = (binding || enforcePhasePolicy) ? null : coord._oneOrNull(
        `SELECT book_id FROM d6_plans WHERE phase = ?
          ORDER BY created_at DESC LIMIT 1`, phase);
      phases.push({
        phase, bookId: binding ? binding.book_id : (plan ? plan.book_id : null),
        budgetMicroCents: budget,
        settledMicroCents: acct.settledMicro,
        inFlightUpperMicroCents: acct.inFlightUpperMicro,
        remainingMicroCents: Math.max(0,
          budget - acct.settledMicro - acct.inFlightUpperMicro),
      });
    }
    return {
      generationState: env.GENERATION_HALT === "0" ? "enabled" : "halted",
      lanes, configuredLane, phases,
      asOf: coord._now(),
    };
  }

  // GET /v2/d6-eligibility — the advisory quote (Rowan obligation
  // 2). Computed by the SAME builder submitIntent executes, over a
  // fresh plane, scoped exactly as submitIntent scopes. The quote
  // authorizes nothing: submission rebuilds the set and revalidates
  // eligibility, mapping, parked fencing, quota and budget inside
  // the coordinator's grant machinery — the quote is a number for a
  // confirmation dialog, stamped with its server time.
  async function eligibilityQuote(input) {
    const {
      bookId, scope, chapterIndex = null, occurrenceId = null,
    } = input || {};
    if (!["book", "chapter", "segment"].includes(scope))
      return { outcome: "rejected", reason: "scope_invalid" };
    if (typeof sources.eligiblePlane !== "function")
      throw new Error("d6_eligible_plane_source_required");
    const plane = await sources.eligiblePlane(bookId);
    const built = builder(plane, bookId);
    const all = built.entries || [];
    const scoped = all.filter(e =>
      scope === "book" ? true
      : scope === "chapter" ? e.chapterIndex === chapterIndex
      : e.occurrenceId === occurrenceId);
    const eligible = scoped.filter(e => e.disposition === "eligible");
    const exclusions = { bound_already: 0, voice_prompt: 0, parked: 0, other: 0 };
    for (const e of scoped) {
      if (e.disposition === "eligible") continue;
      if (e.disposition === "bound_already") exclusions.bound_already++;
      else if (e.disposition === "voice_prompt") exclusions.voice_prompt++;
      else if (e.disposition === "excluded_parked" || e.disposition === "excluded_ch3")
        exclusions.parked++;
      else exclusions.other++;
    }
    return {
      bookId, scope,
      chapterIndex: chapterIndex ?? null,
      occurrenceId: occurrenceId ?? null,
      eligibleCount: eligible.length,
      totalChars: eligible.reduce((s, e) => s + (e.charCount || 0), 0),
      expectedCostMicroCents: eligible.reduce(
        (s, e) => s + expectedCostMicro(e.charCount || 0), 0),
      exclusions,
      digest: built.digest ?? null,
      quotedAt: coord._now(),
      advisory: true,
    };
  }

  // The storage seed (CORRECTION 2 — arming sub-step 0 found the
  // store's seed had no production invocation path; G2 HARDENING —
  // ENRICHMENT-DESIGN §3.2 + Rowan review 6504846855: operator
  // fence at the entry, figureless invocation, worker-side recount,
  // zero-tolerance cross-check). Reached ONLY through the D6
  // entry's seed route (production gate chain + migration-operator
  // admission, then the internal route with the admitted stamp).
  // Fences, in order:
  //   1. HALT: seeding is a pre-arming act — it is refused unless
  //      GENERATION_HALT is exactly "1" (a missing flag fails
  //      closed). The seed can therefore never move the storage
  //      base under a live system, and the executor/driver never
  //      seed implicitly.
  //   2. FIGURELESS: the invocation carries NO figures — a body
  //      presenting baseBytes or objectCount is refused
  //      (caller_figures_refused). There is nothing caller-supplied
  //      to trust.
  //   3. CROSS-CHECK CONFIGURATION: the expected base (the recorded
  //      recount pinned at construction — RECORDED_STORAGE_BASE in
  //      production wiring) must be configured, else fail closed.
  //   4. WORKER RECOUNT: the worker recounts the bucket ITSELF via
  //      its R2 binding, fully paginated; an errored or incomplete
  //      page refuses the seed (recount_failed) and writes nothing.
  //   5. ZERO-TOLERANCE COMPARE: the recounted figures must equal
  //      the expected base exactly — in the halted state no
  //      legitimate writer exists — else refused (recount_mismatch,
  //      both figures reported) and nothing is written.
  // Only then does the store write, with Correction 2's provenance
  // semantics unchanged (same-values re-seed idempotent; changed
  // values append the previous). The seeded figures are the
  // bucket's own, sourced "worker-recount".
  async function recountBucketTotals(bucket) {
    let baseBytes = 0, objectCount = 0, cursor;
    for (;;) {
      const page = await bucket.list(cursor ? { limit: 1000, cursor } : { limit: 1000 });
      if (!page || !Array.isArray(page.objects) || typeof page.truncated !== "boolean")
        throw new Error("recount_incomplete_page");
      for (const obj of page.objects) {
        if (!obj || !Number.isSafeInteger(obj.size) || obj.size < 0)
          throw new Error("recount_bad_object");
        baseBytes += obj.size;
        objectCount += 1;
      }
      if (!page.truncated) break;
      if (typeof page.cursor !== "string" || page.cursor.length === 0)
        throw new Error("recount_incomplete_page");
      cursor = page.cursor;
    }
    return { baseBytes, objectCount };
  }

  async function seedStorageBase(input) {
    const rejected = (reason, extra = {}) =>
      ({ outcome: "rejected", reason, ...extra, ...store.storageSeedState() });
    if (env.GENERATION_HALT !== "1")
      return rejected("generation_not_halted");
    if (input && (input.baseBytes !== undefined || input.objectCount !== undefined))
      return rejected("caller_figures_refused");
    const expected = expectedStorageBase;
    if (!expected || !Number.isSafeInteger(expected.baseBytes) || expected.baseBytes < 0 ||
        !Number.isSafeInteger(expected.objectCount) || expected.objectCount < 0)
      return rejected("seed_expected_base_not_configured");
    const bucket = recountBucket ?? env.OPALREADER_STORAGE;
    if (!bucket || typeof bucket.list !== "function")
      return rejected("recount_unavailable");
    let recounted;
    try {
      recounted = await recountBucketTotals(bucket);
    } catch {
      return rejected("recount_failed");
    }
    if (recounted.baseBytes !== expected.baseBytes ||
        recounted.objectCount !== expected.objectCount)
      return rejected("recount_mismatch",
        { recounted, expected: { baseBytes: expected.baseBytes, objectCount: expected.objectCount } });
    return { outcome: "applied", recounted,
             ...store.seedStorageBase({
               baseBytes: recounted.baseBytes, objectCount: recounted.objectCount,
               recountedAt: coord._now(), source: "worker-recount" }) };
  }

  // Recovery: run the store's classification scan and perform the
  // non-spending actions (release_and_fail: release reserved
  // attempts — provably never dispatched — and mark the execution
  // failed). Returns the scan for the executor to continue the
  // reverify_and_commit items (the executor owns R2).
  function recover() {
    const scan = store.recoveryScan();
    for (const item of scan) {
      if (item.action !== "release_and_fail") continue;
      for (const att of store.attemptsForExecution(item.execution.execution_id))
        if (att.phase === "reserved") store.releaseAttempt(att.attempt_id);
      store.failExecution(item.execution.execution_id, "recovery",
        { action: "release_and_fail" });
    }
    return scan;
  }


  // GET /v2/d6-diagnostics — OPERATOR-ONLY attempt diagnostics
  // (gen-pkg-1 worker delta item 5, added under Julie's Oct 29,
  // 2026 diagnostics approval, board comment 6511269658, following
  // the Forever Pucked Ch 2 halt diagnosis). The live build's plan
  // and job views carry execution STATE only; the decisive
  // evidence for a halted plan — per-execution stage/detail and
  // the per-call attempt log — lives in d6_execution_records and
  // d6_attempt_log and had NO read path. This surface reads them
  // for one plan or one job:
  //
  //   * structural metadata and stored error strings ONLY. Detail
  //     payloads pass a scalar whitelist (message / httpStatus /
  //     code / reason / detail / depth / outcome / blockReason /
  //     finishReason): segment text or any other stored field can
  //     never ride this surface, whatever a detail payload holds.
  //   * bounded + paginated: executions page by keyset over
  //     (created_at, execution_id), chronological, page size
  //     clamped to 1..100; each execution embeds its attempt rows
  //     in seq order, capped with an explicit truncated flag.
  //   * empty-result safe: unknown plan/job returns found:false
  //     with empty pages — every lookup is _oneOrNull/_all, never
  //     a bare .one() (the real DO throws on empty results).
  // The entry fences this surface to the migration-operator
  // credential (seed-route fence class); it is not a client
  // surface and the client build has no path to it.
  const DIAGNOSTIC_DETAIL_KEYS = Object.freeze([
    "message", "httpStatus", "code", "reason", "detail", "depth",
    "outcome", "blockReason", "finishReason",
  ]);
  function sanitizeDiagnosticDetail(detailJson) {
    if (!detailJson) return null;
    let parsed = null;
    try { parsed = JSON.parse(detailJson); } catch { return null; }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return null;
    const out = {};
    for (const key of DIAGNOSTIC_DETAIL_KEYS) {
      const v = parsed[key];
      if (typeof v === "string") out[key] = v.slice(0, 500);
      else if (typeof v === "number" || typeof v === "boolean") out[key] = v;
    }
    return Object.keys(out).length ? out : null;
  }

  function attemptDiagnostics({ planId = null, jobId = null, limit = 25, cursor = null } = {}) {
    const hasPlan = typeof planId === "string" && planId.length > 0;
    const hasJob = typeof jobId === "string" && jobId.length > 0;
    if (hasPlan === hasJob)
      return { outcome: "rejected", reason: "diagnostics_target_required" };
    const cap = Math.max(1, Math.min(100, Number.isFinite(limit) ? limit | 0 : 25));
    let cur = null;
    if (cursor) {
      try {
        const raw = JSON.parse(Buffer.from(String(cursor), "base64url").toString("utf8"));
        if (raw && Number.isSafeInteger(raw.c) && typeof raw.e === "string")
          cur = raw;
      } catch { /* an undecodable cursor reads from the top */ }
    }
    const where = hasPlan ? "plan_id = ?" : "job_id = ?";
    const target = hasPlan ? planId : jobId;
    const rows = cur
      ? coord._all(
          `SELECT * FROM d6_execution_records
            WHERE ${where} AND (created_at > ? OR (created_at = ? AND execution_id > ?))
            ORDER BY created_at ASC, execution_id ASC LIMIT ?`,
          target, cur.c, cur.c, cur.e, cap + 1)
      : coord._all(
          `SELECT * FROM d6_execution_records
            WHERE ${where}
            ORDER BY created_at ASC, execution_id ASC LIMIT ?`, target, cap + 1);
    const page = rows.slice(0, cap);
    const last = page[page.length - 1];
    const nextCursor = rows.length > cap && last
      ? Buffer.from(JSON.stringify({ c: last.created_at, e: last.execution_id }),
          "utf8").toString("base64url")
      : null;
    // The plan summary: direct for a plan query; for a job query,
    // the plan its executions belong to (null when the job has no
    // executions yet — the not-found shape stays explicit).
    let plan = null;
    const summaryPlanId = hasPlan ? planId : (page[0]?.plan_id ?? null);
    if (summaryPlanId) {
      const prow = planRow(summaryPlanId);
      if (prow) {
        const firstJob = prow.scope === "chapter"
          ? coord._oneOrNull(
              `SELECT chapter_index FROM d6_plan_jobs WHERE plan_id = ?
                ORDER BY seq ASC LIMIT 1`, summaryPlanId)
          : null;
        plan = {
          planId: prow.plan_id, bookId: prow.book_id, scope: prow.scope,
          chapterIndex: firstJob ? firstJob.chapter_index : null,
          lane: prow.lane, phase: prow.phase, state: prow.state,
          stopReason: prow.stop_reason,
          createdAt: prow.created_at, updatedAt: prow.updated_at,
        };
      }
    }
    const ATTEMPT_CAP = 200;
    const executions = page.map((r) => {
      const attempts = coord._all(
        `SELECT * FROM d6_attempt_log WHERE execution_id = ?
          ORDER BY seq ASC LIMIT ?`, r.execution_id, ATTEMPT_CAP + 1);
      return {
        executionId: r.execution_id, planId: r.plan_id, jobId: r.job_id,
        occurrenceId: r.occurrence_id, state: r.state, stage: r.stage,
        cacheKey: r.cache_key, sizeBytes: r.size_bytes,
        detail: sanitizeDiagnosticDetail(r.detail_json),
        attempts: attempts.slice(0, ATTEMPT_CAP).map((a) => ({
          attemptId: a.attempt_id, seq: a.seq, phase: a.phase,
          outcome: a.outcome, costMicroCents: a.cost_micro_cents,
          upperMicroCents: a.upper_micro_cents,
          providerRequestId: a.provider_request_id,
          detail: sanitizeDiagnosticDetail(a.detail_json),
          createdAt: a.created_at, updatedAt: a.updated_at,
          durationMs: (typeof a.updated_at === "number" && typeof a.created_at === "number")
            ? a.updated_at - a.created_at : null,
        })),
        attemptsTruncated: attempts.length > ATTEMPT_CAP,
        createdAt: r.created_at, updatedAt: r.updated_at,
      };
    });
    return {
      found: executions.length > 0 || plan !== null,
      planId: hasPlan ? planId : (plan ? plan.planId : null),
      jobId: hasJob ? jobId : null,
      plan, executions, nextCursor,
    };
  }

  return { submitIntent, driveOnce, planStatus, seedStorageBase, recover,
           bindPhaseBook, getPhaseBinding,
           reconcileUnknownAttempt, retireHaltedPlan,
           releaseQuarantine, getQuarantine,
           listPlans, capabilities, eligibilityQuote, attemptDiagnostics };
}
