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
                                          recountBucket = undefined }) {
  if (!coord) throw new Error("createGenerationService requires a coordinator");
  store = store || createGenStore(coord);
  store.ensureSchema();
  const builder = sources.buildEligibleSet || realBuildEligibleSet;

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
  // 6511518715): the phase a plan rides is SERVER authority, never
  // caller trust. The budgeted-phase universe is the registry
  // (PHASE_BUDGET_MICRO_CENTS — a phase string outside it is an
  // invention, not a budget). A book's binding to a budgeted phase
  // is server state: the phase of the plans this service has
  // already admitted for that book (the same record capabilities()
  // reads its phase→book link from). Rules, evaluated before any
  // plan or ledger state moves:
  //   * a book already bound to a budgeted phase may only ever
  //     submit under that exact phase — a missing/null phase is
  //     rejected (phase_required) and any different phase is
  //     rejected (phase_mismatch), so no plan for a budgeted book
  //     can be created outside its phase accounting and hard stop;
  //   * an unbound book presenting a phase outside the registry
  //     is rejected (phase_not_budgeted);
  //   * an unbound book presenting a registry phase establishes
  //     its binding with the plan this submission creates; an
  //     unbound book with no phase runs unbudgeted (phase null).
  // The admitted phase — derived here, not the caller's raw
  // value — is what the plan stores and what intent identity (B2)
  // binds.
  function admitPhase(bookId, callerPhaseRaw) {
    const callerPhase = callerPhaseRaw ?? null;
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
    const planId = `plan:${intentKey.slice(0, 24)}`;
    const t = coord._now();
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
    const plans = coord._all(
      `SELECT * FROM d6_plans WHERE state NOT IN ('complete', 'partial')
        ORDER BY created_at, plan_id`);
    for (const plan of plans) {
      const out = { planId: plan.plan_id };
      outcomes.push(out);
      // Unknown-billing halt for the plan's phase: no granting.
      if (plan.phase && d6PhaseHalt(coord, plan.phase)) {
        setPlanState(plan.plan_id, "halted_unknown", "phase_halted_unknown_billing");
        out.state = "halted_unknown"; out.stopReason = "phase_halted_unknown_billing";
        continue;
      }
      if (plan.state === "halted_unknown")
        setPlanState(plan.plan_id, "active", null);
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
      const plan = coord._oneOrNull(
        `SELECT book_id FROM d6_plans WHERE phase = ?
          ORDER BY created_at DESC LIMIT 1`, phase);
      phases.push({
        phase, bookId: plan ? plan.book_id : null,
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
           listPlans, capabilities, eligibilityQuote, attemptDiagnostics };
}
