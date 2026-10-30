// gen-pkg-1 — the generation surface's client logic (DESIGN BRIEF
// v2 §2/§4/§5). Authored for gen-pkg-1; imported by app-268.js and
// by entry-genpkg1.js.
//
// Discipline (Rowan design review 6510730060 + sign-off
// 6510767252):
//   * EVERY number the confirmation shows comes from the server's
//     eligibility quote; every settled amount comes from the
//     server's plan list / capabilities (the ledger). The client
//     computes NO eligibility and NO costs of its own.
//   * Lane admission comes from the server's capabilities surface,
//     never from settings and never from a failed submission.
//   * Submission rides POST /v2/commands with a SubmitJob whose
//     payload carries data.d6Intent — the exact contract the D6
//     entry forwards to the generation service. The command_id is
//     minted once per confirmation sheet; the server's intent
//     identity makes any retry converge on the same plan.
//   * This module authors NO binding payloads (publication is the
//     server's projection), writes NOTHING to any storage, and the
//     token lives only in this closure's memory — the same posture
//     as the shell's other transports.

export const TERMINAL_PLAN_STATES = Object.freeze(
  ["complete", "partial", "failed", "cancelled", "superseded"]);

export function isTerminalPlanState(state) {
  return TERMINAL_PLAN_STATES.includes(state);
}

// Plain-language renderings of the server's stable stop-reason
// strings. Unknown reasons render as themselves — state is never
// invented, only translated.
const STOP_REASON_TEXT = Object.freeze({
  quota_estimate_exhausted: "today's quota is used up — it will continue tomorrow",
  quota_parked: "today's quota is used up — it will continue tomorrow",
  spending_cap: "the budget was reached",
  phase_budget: "the book's budget was reached",
  storage_boundary: "storage is nearly full",
  phase_halted_unknown_billing: "a charge needs checking before it can continue",
  unknown_billing: "a charge needs checking before it can continue",
  nothing_eligible: "there was nothing left to generate",
  incomplete: "some segments did not finish",
});
export function stopReasonText(reason) {
  if (!reason) return null;
  return STOP_REASON_TEXT[reason] ?? String(reason).replaceAll("_", " ");
}

export function planStatusText(plan) {
  if (!plan) return "Status unavailable";
  const t = plan.totals ?? { eligible: 0, done: 0, failed: 0, blocked: 0, prompts: 0 };
  const reason = stopReasonText(plan.stopReason);
  switch (plan.state) {
    case "active": return `Working — ${t.done} of ${t.eligible} done`;
    case "complete": return t.eligible === 0 ? "Done — nothing was left to generate" : "Done";
    case "partial": return `Stopped — ${t.done} of ${t.eligible} done${reason ? ` (${reason})` : ""}`;
    case "failed": return `Stopped — something went wrong${reason ? ` (${reason})` : ""}`;
    case "cancelled": return "Stopped — cancelled";
    case "superseded": return "Replaced by a newer plan";
    case "parked_quota": return `Stopped — ${reason ?? "today's quota is used up"}`;
    case "parked_cap": return `Stopped — ${reason ?? "the budget was reached"}`;
    case "parked_budget": return `Stopped — ${reason ?? "the book's budget was reached"}`;
    case "parked_storage": return `Stopped — ${reason ?? "storage is nearly full"}`;
    case "halted_unknown": return `Stopped — ${reason ?? "a charge needs checking"}`;
    default: return `Status: ${String(plan.state ?? "unknown").replaceAll("_", " ")}`;
  }
}

// The lanes the picker may offer, in display order, from the
// server's capabilities — Batch carries its server reason verbatim
// in kind (translated, never hidden).
const LANE_REASON_TEXT = Object.freeze({
  batch_not_armed: "Batch isn't enabled yet — it needs its own decision",
  lane_not_admitted: "This lane isn't enabled on the server",
  generation_halted: "Generation is paused on the server",
});
export function laneOptions(capabilities) {
  const lanes = capabilities?.lanes ?? {};
  return ["standard", "batch"].map((lane) => {
    const info = lanes[lane] ?? { admitted: false, reason: "lane_not_admitted" };
    return {
      lane,
      label: lane === "standard" ? "Standard" : "Batch",
      admitted: !!info.admitted,
      reason: info.admitted ? null : (LANE_REASON_TEXT[info.reason] ?? stopReasonText(info.reason)),
    };
  });
}

// Exclusion lines for the confirmation sheet, from the quote's
// server tallies — plain words, server numbers.
export function exclusionLines(quote) {
  const ex = quote?.exclusions ?? {};
  const lines = [];
  if (ex.bound_already > 0)
    lines.push(`${ex.bound_already} already ${ex.bound_already === 1 ? "has" : "have"} audio — never re-made, never re-charged`);
  if (ex.parked > 0)
    lines.push(`${ex.parked} ${ex.parked === 1 ? "is" : "are"} parked — parked work resumes only on your explicit word, and this won't touch it`);
  if (ex.voice_prompt > 0)
    lines.push(`${ex.voice_prompt} need${ex.voice_prompt === 1 ? "s" : ""} a voice choice first — not included`);
  if (ex.other > 0)
    lines.push(`${ex.other} can't be generated right now — not included`);
  return lines;
}

// $ formatting for micro-cents (the ledger unit). Display only.
export function formatMicroCents(mc) {
  if (!Number.isSafeInteger(mc)) return "—";
  const dollars = mc / 1_000_000;
  return `$${dollars.toFixed(2)}`;
}

// The phase (budget envelope) a book's submissions ride, looked up
// in the server's capabilities — never hard-coded client-side.
// Round 1 (6511518715, B1): this value is a HINT. The server
// derives the admissible phase from its own book policy and
// rejects a submission whose hint is missing or disagrees — see
// rejectionText; the client never overrides the server's answer.
export function phaseForBook(capabilities, bookId) {
  const phases = capabilities?.phases ?? [];
  const hit = phases.find((p) => p.bookId === bookId);
  return hit ? hit.phase : null;
}

// Plain language for a submission REJECTION. The intent route
// answers HTTP 200 with the service result, so a rejection comes
// back as data ({outcome:"rejected", reason}) with no planId —
// callers must treat a missing planId as "not started", and these
// words say exactly that. Reasons are the server's stable strings
// (service.mjs admission + the lane gate).
const REJECTION_TEXT = Object.freeze({
  phase_required: "The server didn't accept that start: this book has a budget phase and the request didn't carry it. Nothing was started.",
  phase_mismatch: "The server didn't accept that start: the budget phase in the request doesn't match this book's. Nothing was started.",
  phase_not_budgeted: "The server didn't accept that start: that budget phase isn't one the server has for this book. Nothing was started.",
  phase_bound_to_other_book: "The server didn't accept that start: that budget phase belongs to a different book on the server. Nothing was started.",
  phase_unbound: "The server didn't accept that start: that budget phase has no book assigned to it on the server yet. Nothing was started.",
  plan_overlap_conflict: "The server didn't accept that start: another plan is already running over some of the same segments. Nothing was started.",
  lane_not_allowed: "The server didn't accept that start: that lane isn't enabled. Nothing was started.",
  scope_invalid: "The server didn't accept that start. Nothing was started.",
});
export function rejectionText(reason) {
  return REJECTION_TEXT[reason]
    ?? "The server didn't accept that start. Nothing was started.";
}

// A plan's immutable execution semantics, in plain words (Rowan
// round 1, B2): whenever the UI routes to, recovers, or lists an
// existing plan it names the plan's OWN lane and continuation, so
// the settings actually in force are never misrepresented as the
// ones the user just chose. keepGoing is a book-scope concept;
// chapter and segment plans always run to their own end only.
export function planLaneText(plan) {
  return plan?.lane === "batch" ? "Batch lane" : "Standard lane";
}
export function planContinuationText(plan) {
  if (!plan) return "";
  if (plan.scope === "book")
    return plan.keepGoing
      ? "continues through the rest of the book"
      : "does not continue on its own";
  if (plan.scope === "chapter") return "this chapter only";
  return "this segment only";
}
export function planSemanticsText(plan) {
  if (!plan) return "";
  return `${planLaneText(plan)} · ${planContinuationText(plan)}`;
}

// A plan's money line, in the server's own vocabulary (Rowan
// round 1, money/status accuracy):
//   * the quote's expected cost is an ESTIMATE (the sheet labels
//     it "(estimate)");
//   * a phase's in-flight figure is the RESERVED upper bound (the
//     Generation view shows it as "reserved up to …");
//   * settledMicroCents is KNOWN-SETTLED accounting — the
//     attempt-log sum over outcomes whose cost is confirmed —
//     shown as "Settled $X". It is never the grant-time ledger
//     debit (that estimated figure is server-internal and no
//     client surface displays it), and never a provider bill.
// For a halted_unknown plan at least one charge is UNCONFIRMED
// and sits outside the settled figure: the line says so, and the
// figure is never presented as the final total.
export function planMoneyText(plan) {
  if (!plan) return "";
  const settled = `Settled ${formatMicroCents(plan.settledMicroCents ?? 0)}`;
  if (plan.state === "halted_unknown")
    return `${settled} so far — plus a charge that isn't confirmed yet`;
  return settled;
}

// An in-flight (non-terminal) plan for the same book + scope (+
// chapter for chapter scope) — the reroute target that keeps two
// devices / two taps from ever starting the same work twice. The
// server's intent identity is the authority; this is the UI's
// courtesy check on top of it.
export function findActivePlan(plans, { bookId, scope, chapterIndex = null }) {
  if (!Array.isArray(plans)) return null;
  return plans.find((p) =>
    p && p.bookId === bookId && p.scope === scope &&
    !isTerminalPlanState(p.state) &&
    (scope !== "chapter" || p.chapterIndex === chapterIndex)) ?? null;
}

// The API client for the generation surfaces. One transport, the
// shell's header discipline (token/scope/instance in headers only).
export function createGenerationClient({ baseUrl, token, scope, instance, fetchFn } = {}) {
  if (!baseUrl) { const e = new Error("generation client baseUrl required"); e.code = "generation_base_url_required"; throw e; }
  const base = String(baseUrl).replace(/\/+$/, "");
  const fetchImpl = fetchFn ?? ((...args) => globalThis.fetch(...args));
  const headers = (extra = {}) => ({
    "x-opalreader-token": token ?? "",
    "x-opalreader-scope": scope,
    "x-opalreader-instance": instance,
    ...extra,
  });
  async function request(path, { method = "GET", body } = {}) {
    const res = await fetchImpl(base + path, {
      method,
      headers: body ? headers({ "content-type": "application/json" }) : headers(),
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    if (!res.ok) {
      const err = new Error(data?.error || `HTTP ${res.status}`);
      err.code = data?.error || `http_${res.status}`;
      err.status = res.status;
      err.body = data;
      throw err;
    }
    return data;
  }
  return {
    capabilities: () => request("/v2/generation/capabilities"),
    listPlans: ({ limit = 50, cursor = null } = {}) => {
      const q = new URLSearchParams();
      q.set("limit", String(limit));
      if (cursor) q.set("cursor", cursor);
      return request(`/v2/d6-plans?${q.toString()}`);
    },
    // Page through the plan list (bounded) and return every plan.
    async listAllPlans({ maxPages = 4, pageSize = 50 } = {}) {
      const out = [];
      let cursor = null;
      for (let i = 0; i < maxPages; i++) {
        const page = await this.listPlans({ limit: pageSize, cursor });
        out.push(...(page.plans ?? []));
        cursor = page.nextCursor ?? null;
        if (!cursor) break;
      }
      return out;
    },
    getPlan: (planId) => request(`/v2/d6-plans/${encodeURIComponent(planId)}`),
    quote: ({ bookId, scope, chapterIndex = null, occurrenceId = null }) => {
      const q = new URLSearchParams();
      q.set("bookId", bookId);
      q.set("scope", scope);
      if (chapterIndex !== null && chapterIndex !== undefined) q.set("chapterIndex", String(chapterIndex));
      if (occurrenceId) q.set("occurrenceId", occurrenceId);
      return request(`/v2/d6-eligibility?${q.toString()}`);
    },
    // The one write: a SubmitJob command carrying the D6 intent.
    // commandId is supplied by the caller (minted once per sheet).
    submitIntent: ({ commandId, bookId, lane, intent }) => request("/v2/commands", {
      method: "POST",
      body: {
        command_id: commandId,
        type: "SubmitJob",
        payload: { bookId, lane, data: { d6Intent: intent } },
      },
    }),
  };
}
