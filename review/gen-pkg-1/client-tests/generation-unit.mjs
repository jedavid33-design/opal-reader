// gen-pkg-1 — generation-surface unit battery (node, no DOM).
// Exercises modules/generation-surface.js against a scripted
// fetch: request shapes + headers for every surface, the submit
// command's exact contract, and the pure renderers (lane options,
// exclusion lines, plan status text, active-plan matching, phase
// lookup, money formatting). Any failure exits nonzero.
import { createGenerationClient, laneOptions, exclusionLines, formatMicroCents,
  phaseForBook, findActivePlan, planStatusText, stopReasonText, isTerminalPlanState }
  from "../tree-a/modules/generation-surface.js";

const rows = [];
function row(id, name, fn) {
  return Promise.resolve().then(fn).then(
    () => { rows.push([id, "PASS"]); console.log("PASS", id, name); },
    (e) => { rows.push([id, "FAIL"]); console.log("FAIL", id, name, "-", e?.message ?? e); });
}
function assert(c, m) { if (!c) throw new Error(m); }
function eq(a, b, m) { if (a !== b) throw new Error(`${m}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); }

const calls = [];
let responder = () => ({ ok: true, status: 200, body: {} });
function fetchFn(url, opts = {}) {
  calls.push({ url, opts });
  const r = responder(url, opts);
  return Promise.resolve({
    ok: r.ok, status: r.status,
    json: async () => r.body,
  });
}
const client = createGenerationClient({ baseUrl: "http://stub/api-v2/", token: "tok-1", scope: "production", instance: "account", fetchFn });

await row("GU1", "capabilities request: path + gate headers, token in header only", async () => {
  calls.length = 0;
  responder = () => ({ ok: true, status: 200, body: { generationState: "enabled", lanes: {}, phases: [] } });
  await client.capabilities();
  eq(calls.length, 1, "one call");
  assert(calls[0].url.endsWith("/v2/generation/capabilities"), calls[0].url);
  eq(calls[0].opts.headers["x-opalreader-token"], "tok-1", "token header");
  eq(calls[0].opts.headers["x-opalreader-scope"], "production", "scope header");
  eq(calls[0].opts.headers["x-opalreader-instance"], "account", "instance header");
  assert(!calls[0].url.includes("tok-1"), "token never in the URL");
});

await row("GU2", "quote request: exact query params per scope", async () => {
  calls.length = 0;
  responder = () => ({ ok: true, status: 200, body: { eligibleCount: 0 } });
  await client.quote({ bookId: "b1", scope: "chapter", chapterIndex: 2 });
  assert(calls[0].url.includes("bookId=b1") && calls[0].url.includes("scope=chapter") && calls[0].url.includes("chapterIndex=2"), calls[0].url);
  assert(!calls[0].url.includes("occurrenceId"), "no occurrenceId for chapter scope");
  calls.length = 0;
  await client.quote({ bookId: "b1", scope: "segment", occurrenceId: "occ-9" });
  assert(calls[0].url.includes("occurrenceId=occ-9") && !calls[0].url.includes("chapterIndex"), calls[0].url);
});

await row("GU3", "submit: the exact SubmitJob command contract", async () => {
  calls.length = 0;
  responder = () => ({ ok: true, status: 200, body: { outcome: "applied", planId: "plan:x" } });
  const receipt = await client.submitIntent({
    commandId: "cmd-1", bookId: "b1", lane: "standard",
    intent: { scope: "book", keepGoing: true, phase: "forever-pucked" },
  });
  eq(receipt.planId, "plan:x", "receipt planId");
  eq(calls.length, 1, "one POST");
  eq(calls[0].opts.method, "POST", "method");
  const body = JSON.parse(calls[0].opts.body);
  eq(body.command_id, "cmd-1", "command_id");
  eq(body.type, "SubmitJob", "type");
  eq(body.payload.bookId, "b1", "payload bookId");
  eq(body.payload.lane, "standard", "payload lane");
  const di = body.payload.data.d6Intent;
  assert(di && di.scope === "book" && di.keepGoing === true && di.phase === "forever-pucked", `d6Intent ${JSON.stringify(di)}`);
  assert(!("eligibleIds" in di) && !("occurrences" in di), "client never ships an eligible set");
});

await row("GU4", "listAllPlans pages through cursors and stops", async () => {
  responder = (url) => {
    if (url.includes("cursor=CUR2")) return { ok: true, status: 200, body: { plans: [{ planId: "p2" }], nextCursor: null } };
    return { ok: true, status: 200, body: { plans: [{ planId: "p1" }], nextCursor: "CUR2" } };
  };
  const plans = await client.listAllPlans();
  eq(plans.map((p) => p.planId).join(","), "p1,p2", "both pages");
});

await row("GU5", "HTTP errors surface as coded errors (no silent success)", async () => {
  responder = () => ({ ok: false, status: 409, body: { error: "conflict_x" } });
  let err = null;
  try { await client.capabilities(); } catch (e) { err = e; }
  assert(err && err.code === "conflict_x" && err.status === 409, `error shape: ${err?.code}`);
});

await row("GU6", "laneOptions: batch carries its server reason; admitted lane has none", async () => {
  const opts = laneOptions({ lanes: { standard: { admitted: true }, batch: { admitted: false, reason: "batch_not_armed" } } });
  const bat = opts.find((o) => o.lane === "batch");
  eq(bat.admitted, false, "batch not admitted");
  assert(bat.reason.includes("Batch isn't enabled yet"), bat.reason);
  const std = opts.find((o) => o.lane === "standard");
  eq(std.admitted, true, "standard admitted");
  eq(std.reason, null, "no reason when admitted");
  const bare = laneOptions(null);
  assert(bare.every((o) => !o.admitted), "missing capabilities fail closed");
});

await row("GU7", "exclusionLines: plain words from server tallies only", async () => {
  const lines = exclusionLines({ exclusions: { bound_already: 2, voice_prompt: 1, parked: 3, other: 0 } });
  eq(lines.length, 3, "three lines");
  assert(lines[0].startsWith("2 already have audio"), lines[0]);
  assert(lines[1].startsWith("3 are parked"), lines[1]);
  assert(lines[2].startsWith("1 needs a voice choice first"), lines[2]);
  eq(exclusionLines({ exclusions: {} }).length, 0, "no tallies, no lines");
  eq(exclusionLines(null).length, 0, "null quote safe");
});

await row("GU8", "planStatusText: states and stop reasons in plain words", async () => {
  eq(planStatusText({ state: "active", totals: { eligible: 5, done: 2 } }), "Working — 2 of 5 done", "active");
  eq(planStatusText({ state: "complete", totals: { eligible: 0, done: 0 } }), "Done — nothing was left to generate", "empty complete");
  assert(planStatusText({ state: "parked_quota", stopReason: "quota_estimate_exhausted" }).includes("quota is used up"), "quota");
  assert(planStatusText({ state: "halted_unknown", stopReason: "unknown_billing" }).includes("charge needs checking"), "unknown billing");
  eq(stopReasonText("some_new_reason"), "some new reason", "unknown reasons pass through, never invented");
  assert(isTerminalPlanState("complete") && !isTerminalPlanState("active") && !isTerminalPlanState("parked_quota"), "terminal set");
});

await row("GU9", "findActivePlan: scope/chapter matching, terminal plans ignored", async () => {
  const plans = [
    { planId: "a", bookId: "b1", scope: "chapter", chapterIndex: 1, state: "complete" },
    { planId: "b", bookId: "b1", scope: "chapter", chapterIndex: 2, state: "active" },
    { planId: "c", bookId: "b1", scope: "book", state: "parked_quota" },
    { planId: "d", bookId: "b2", scope: "book", state: "active" },
  ];
  eq(findActivePlan(plans, { bookId: "b1", scope: "chapter", chapterIndex: 1 }), null, "terminal chapter plan ignored");
  eq(findActivePlan(plans, { bookId: "b1", scope: "chapter", chapterIndex: 2 })?.planId, "b", "active chapter plan found");
  eq(findActivePlan(plans, { bookId: "b1", scope: "book" })?.planId, "c", "parked (non-terminal) plan counts as in-flight");
  eq(findActivePlan(plans, { bookId: "b1", scope: "segment" }), null, "no cross-scope match");
  eq(findActivePlan(null, { bookId: "b1", scope: "book" }), null, "null safe");
});

await row("GU10", "phaseForBook + formatMicroCents: server data only", async () => {
  const caps = { phases: [{ phase: "forever-pucked", bookId: "FP" }, { phase: "other", bookId: "ZZ" }] };
  eq(phaseForBook(caps, "FP"), "forever-pucked", "phase by book");
  eq(phaseForBook(caps, "gb"), null, "unbudgeted book -> null phase");
  eq(phaseForBook(null, "FP"), null, "null caps safe");
  eq(formatMicroCents(17749), "$0.02", "smoke amount");
  eq(formatMicroCents(13500000), "$13.50", "phase budget");
  eq(formatMicroCents(0), "$0.00", "zero");
  eq(formatMicroCents(1.5), "—", "non-integer refused");
});

const failed = rows.filter((r) => r[1] !== "PASS");
console.log(`\nGENERATION UNIT BATTERY: ${rows.length - failed.length}/${rows.length} PASS`);
process.exit(failed.length ? 1 : 0);
