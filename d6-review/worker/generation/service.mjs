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
  R2_FREE_TIER_BYTES,
} from "./gen-constants.mjs";

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

export function createGenerationService({ coord, env = {}, store = null, sources = {} }) {
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

  async function submitIntent(input) {
    const {
      commandId = null, bookId, scope, chapterIndex = null,
      occurrenceId = null, keepGoing = false, phase = null,
      lane = "standard",
    } = input || {};
    if (!D6_LANE_ALLOWLIST.includes(lane || "standard"))
      return { outcome: "rejected", reason: "lane_not_allowed" };
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
    const intentKey = sha256Hex(canonicalJson({
      bookId, scope,
      chapterIndex: chapterIndex ?? null,
      occurrenceId: occurrenceId ?? null,
      eligibleIds,
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
        planId, intentKey, bookId, scope, keepGoing ? 1 : 0, phase ?? null,
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

  return { submitIntent, driveOnce, planStatus, recover };
}
