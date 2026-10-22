// Opal Reader v2 — P3 executor (Case #5).
//
// The "hands" to the coordinator's "brain": consumes grant messages,
// claims them in the coordinator's acceptance ledger, spends ONLY
// behind the per-occurrence spend-intent fence, stores audio through
// putIfAbsent, verifies what it stored, and reports evidence back.
// The executor holds NO durable state of its own — every fact it acts
// on lives in the coordinator (claims, intents, batch maps) or is
// recomputable (the P1 fingerprint). A crash at any point is a
// restart, never a second spend.
//
// Contracts implemented: Case #5 design brief + contracts addendum +
// gate-2 conditions 1-2 (issue #10). Provider errors classify exactly
// as v1 taught us: an HTTP answer is a KNOWN outcome; anything else
// is ambiguity, and ambiguity is never resolved by spending again.
import { createHash } from "node:crypto";

// SHA-256 over the value's actual bytes. Strings hash as UTF-8 (the P3
// fake-cache contract); byte arrays hash as themselves, so a real
// provider adapter returning Uint8Array audio reports the digest of the
// stored bytes, not of a decimal-string rendering of them. (Part 1
// integration fix; string behavior is byte-identical to before.)
export function sha256Of(value) {
  const h = createHash("sha256");
  if (typeof value === "string") h.update(value, "utf8");
  else if (value instanceof Uint8Array) h.update(value);
  else if (value instanceof ArrayBuffer) h.update(new Uint8Array(value));
  else if (ArrayBuffer.isView(value))
    h.update(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
  else h.update(String(value), "utf8");
  return h.digest("hex");
}

// The P1-pinned fingerprint: cache_key = sha256(rawText + cfgJson),
// cfgJson = {provider, voice, model, rate: 1, style} in that order.
export function fingerprintFor(payload) {
  const cfgJson = JSON.stringify({
    provider: payload.provider || "gemini",
    voice: payload.voice,
    model: payload.model || "gemini-3.8-flash-tts",
    rate: 1,
    style: payload.styleDirection || "",
  });
  return createHash("sha256").update(String(payload.text) + cfgJson).digest("hex");
}

// v1's deterministic Batch display name pattern, grant-scoped:
// a lookup hint for reconciliation, never an idempotency key.
export function displayNameFor(grantId, occurrenceId) {
  return `opalreader-${String(grantId).slice(0, 16)}-${occurrenceId}`;
}

// workSource(jobId, occurrenceId) -> the occurrence's content payload
// {text, voice, provider, model, styleDirection, mode}. The
// coordinator is deliberately content-blind (P2's state plane holds
// no book text); content travels from the content plane, injected
// here — in production, the book-content store behind the API.
export function createExecutor({ coordinator, providers, cache, consumerId, workSource }) {
  const cid = consumerId || "executor-1";
  if (typeof workSource !== "function")
    throw new Error("createExecutor requires a workSource(jobId, occurrenceId)");

  async function reportResults(grantId, jobId, results) {
    if (!results.length) return null;
    const view = coordinator.jobView(jobId);
    return coordinator.handleReport({ grantId, jobRevision: view.revision, results });
  }

  // Post-write verification (design Q4, both modes): the object must
  // exist under its content key, carry a format, and have a plausible
  // duration — at least a second, and no more than ~1 char/sec of
  // text (a generous bound that catches truncation and corruption
  // without second-guessing real speech rates). A failed verification
  // is reported as a failure, never dressed up as playable audio.
  function verifyStored(key, payload) {
    const obj = cache.get(key);
    if (!obj) return { ok: false, reason: "missing_after_write" };
    if (!obj.format) return { ok: false, reason: "no_format" };
    const chars = String(payload.text).length;
    if (!(obj.durationSec > 0) || obj.durationSec > Math.max(60, chars))
      return { ok: false, reason: "implausible_duration" };
    return { ok: true, object: obj };
  }

  async function storeVerifyReport(grantId, jobId, occ, audio) {
    const key = fingerprintFor(occ.payload);
    cache.putIfAbsent(key, { audio: audio.audio, format: audio.format, durationSec: audio.durationSec });
    const v = verifyStored(key, occ.payload);
    if (!v.ok) {
      await reportResults(grantId, jobId, [{
        occurrenceId: occ.occurrenceId, outcome: "provider_error",
        detail: { code: "cache_verification_failed", reason: v.reason } }]);
      return { reported: "verification_failed" };
    }
    // The digest of the bytes actually stored — the coordinator's
    // binding gate requires a verified digest for every new recording
    // (P2 round 3) and checks it against the cache's write-time record.
    const sha256 = sha256Of(v.object.audio);
    await reportResults(grantId, jobId, [{
      occurrenceId: occ.occurrenceId, outcome: "success",
      revisionKey: key, cacheKey: key, sha256 }]);
    return { reported: "success" };
  }

  // An intent whose KNOWN success was recorded but whose report may
  // not have landed (crash between the provider call and the report):
  // the audio is recomputable by fingerprint and already paid for, so
  // re-report from the cache — verification first — with NO new call.
  async function reReportFromIntent(grantId, jobId, occ) {
    const key = fingerprintFor(occ.payload);
    const v = verifyStored(key, occ.payload);
    if (!v.ok) return { skipped: true, reason: "intent_success_cache_unverified" };
    const sha256 = sha256Of(v.object.audio);
    await reportResults(grantId, jobId, [{
      occurrenceId: occ.occurrenceId, outcome: "success",
      revisionKey: key, cacheKey: key, sha256 }]);
    return { reported: "success", via: "intent_recovery" };
  }

  async function runStandard(grantId, jobId, occ) {
    const intent = coordinator.acquireSpendIntent(
      { grantId, jobId, occurrenceId: occ.occurrenceId, consumerId: cid });
    if (!intent.acquired) {
      if (intent.intent && intent.intent.outcome === "success")
        return reReportFromIntent(grantId, jobId, occ);
      // Known failure was reported by its owner; unknown outcome stays
      // with the outcome-unknown machinery. Either way: no second call.
      return { skipped: true, reason: intent.reason || "intent_exists",
               outcome: intent.intent ? intent.intent.outcome : null };
    }
    let audio;
    try {
      audio = await providers.synthesize(occ);
    } catch (err) {
      if (err && err.httpStatus) {
        coordinator.noteSpendOutcome({ jobId, occurrenceId: occ.occurrenceId,
          outcome: "failed_known", detail: `HTTP ${err.httpStatus}` });
        await reportResults(grantId, jobId, [{
          occurrenceId: occ.occurrenceId, outcome: "provider_error",
          detail: { httpStatus: err.httpStatus } }]);
        return { reported: "provider_error" };
      }
      // Ambiguous: no outcome note, no report — a report would claim
      // knowledge we do not have. The lease expiry surfaces it as
      // outcome-unknown; the intent blocks any re-spend meanwhile.
      return { ambiguous: true };
    }
    coordinator.noteSpendOutcome({ jobId, occurrenceId: occ.occurrenceId, outcome: "success" });
    return storeVerifyReport(grantId, jobId, occ, audio);
  }

  async function pollBatch(grantId, jobId, occ, providerName) {
    let st;
    try { st = await providers.getBatch(providerName); }
    catch { return { pending: true, pollError: true }; } // polling is free; try again later
    if (!st.done) return { pending: true, state: st.state };
    if (st.state === "BATCH_STATE_SUCCEEDED" && st.audio) {
      coordinator.noteSpendOutcome({ jobId, occurrenceId: occ.occurrenceId, outcome: "success" });
      return storeVerifyReport(grantId, jobId, occ, st);
    }
    coordinator.noteSpendOutcome({ jobId, occurrenceId: occ.occurrenceId,
      outcome: "failed_known", detail: st.state });
    await reportResults(grantId, jobId, [{
      occurrenceId: occ.occurrenceId, outcome: "provider_error",
      detail: { batchState: st.state } }]);
    return { reported: "provider_error" };
  }

  async function runBatch(grantId, jobId, occ) {
    const existing = coordinator.workView(jobId).batchMaps
      .find(m => m.occurrence_id === occ.occurrenceId);
    // A SUPERSEDED map (a generation closed by an evidenced
    // never-accepted resolution) is history, not a fence: fall
    // through to a fresh intent + fence at the next generation. The
    // original permit is never reused — the coordinator mints a new
    // one, audited, only because the old generation was superseded.
    if (existing && !existing.superseded_at) {
      if (existing.state === "submitted") return pollBatch(grantId, jobId, occ, existing.provider_name);
      if (existing.state === "ambiguous") return { ambiguous: true, state: "submitting_ambiguous" };
      if (existing.state === "rejected" || existing.state === "closed")
        return { skipped: true, state: existing.state };
      // "fenced" with no recorded outcome: a POST may or may not have
      // happened (crash between fence and note). Contract 2: treat as
      // ambiguous — NEVER post again on a fence alone.
      coordinator.noteBatchAmbiguous({ jobId, occurrenceId: occ.occurrenceId,
        detail: "fence_without_outcome" });
      return { ambiguous: true, state: "submitting_ambiguous" };
    }
    const intent = coordinator.acquireSpendIntent(
      { grantId, jobId, occurrenceId: occ.occurrenceId, consumerId: cid });
    if (!intent.acquired)
      return { skipped: true, reason: intent.reason || "intent_exists",
               outcome: intent.intent ? intent.intent.outcome : null };
    const displayName = displayNameFor(grantId, occ.occurrenceId);
    const fence = coordinator.fenceBatchSubmit(
      { grantId, jobId, occurrenceId: occ.occurrenceId, displayName, consumerId: cid });
    if (!fence.fenced) return { skipped: true, reason: fence.reason || "fence_exists" };
    let res;
    try {
      res = await providers.submitBatch(occ, displayName);
    } catch (err) {
      if (err && err.httpStatus) {
        coordinator.noteBatchRejected({ jobId, occurrenceId: occ.occurrenceId,
          detail: `HTTP ${err.httpStatus}` });
        coordinator.noteSpendOutcome({ jobId, occurrenceId: occ.occurrenceId,
          outcome: "failed_known", detail: `batch rejected HTTP ${err.httpStatus}` });
        await reportResults(grantId, jobId, [{
          occurrenceId: occ.occurrenceId, outcome: "provider_error",
          detail: { httpStatus: err.httpStatus, batch: true } }]);
        return { reported: "provider_error" };
      }
      coordinator.noteBatchAmbiguous({ jobId, occurrenceId: occ.occurrenceId,
        detail: "submit_transport_unknown" });
      return { ambiguous: true, state: "submitting_ambiguous" };
    }
    coordinator.noteBatchSubmitted({ jobId, occurrenceId: occ.occurrenceId, providerName: res.name });
    return pollBatch(grantId, jobId, occ, res.name);
  }

  // Reconciliation of an ambiguous Batch submission (contract 2 +
  // gate-2 condition 2): enumeration is a HINT. A match adopts the
  // job; no match — or an incomplete list — changes nothing, spends
  // nothing, and proves nothing.
  async function reconcileBatch(grantId, jobId, occurrenceId) {
    const map = coordinator.workView(jobId).batchMaps
      .find(m => m.occurrence_id === occurrenceId);
    if (!map || map.state !== "ambiguous") return { resolved: false, reason: "not_ambiguous" };
    const matches = await providers.listBatchesByDisplayName(map.display_name);
    if (!matches || !matches.length)
      return { resolved: false, reason: "no_match_not_terminal" };
    coordinator.adoptBatchByLookup({ jobId, occurrenceId,
      providerName: matches[0].name, evidence: `display_name:${map.display_name}` });
    const payload = await workSource(jobId, occurrenceId);
    const occ = { occurrenceId, payload };
    const r = await pollBatch(grantId, jobId, occ, matches[0].name);
    return { resolved: true, ...r };
  }

  // One queue message = one dispatch payload {grantId, jobId,
  // occurrences:[ids]}. Claim first; terminal claims drop the
  // message; another consumer's claim stands us down. Occurrences no
  // longer granted (reported by an earlier partial pass, deferred,
  // settled) are skipped — reports are per-pass and the coordinator's
  // grant-closed deferral returns unfinished work to pending for the
  // next grant, where the occurrence-keyed fences meet it again.
  async function handleMessage(msg) {
    const claim = coordinator.claimGrant({ grantId: msg.grantId, consumerId: cid });
    if (claim.status === "completed" || claim.status === "closed" || claim.status === "unknown_grant")
      return { dropped: claim.status };
    if (claim.status === "already_claimed" && claim.claim.consumer_id !== cid)
      return { stoodDown: true };
    const out = {};
    for (const oid of msg.occurrences) {
      // Fresh state read per occurrence: a partial report earlier in
      // THIS pass may have deferred a sibling back to pending — acting
      // on a pass-start snapshot would spend against a stale grant.
      const row = coordinator.jobView(msg.jobId).occurrences
        .find(o => o.occurrence_id === oid);
      if (!row || row.state !== "granted") {
        out[oid] = { skipped: true, state: row ? row.state : "missing" };
        continue;
      }
      const payload = await workSource(msg.jobId, oid);
      if (!payload) { out[oid] = { skipped: true, state: "no_content" }; continue; }
      const occ = { occurrenceId: oid, payload };
      out[oid] = payload.mode === "batch"
        ? await runBatch(msg.grantId, msg.jobId, occ)
        : await runStandard(msg.grantId, msg.jobId, occ);
    }
    return { claimed: claim.status, occurrences: out };
  }

  return { handleMessage, reconcileBatch };
}
