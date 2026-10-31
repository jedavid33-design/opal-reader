// D6 WS-1 — pinned generation constants (CONTRACTS.md "Pins" +
// "generation/gen-constants.mjs"). Every value here is pinned by the
// D6 proposal as amended (Amendment A-1) and the PINS.md package —
// do not re-derive. Structural/financial constants only; no book data.

// The lane allowlist representation is pinned: membership in this
// frozen array is the ONLY lane check used by the service, the
// executor, and the coordinator patches.
export const D6_LANE_ALLOWLIST = Object.freeze(["standard"]);

// POLICY_BLOCK split ceilings (proposal §6.4, pinned in build):
// recursion depth ≤ 4 (≤ 16 leaf parts), minimum part floor 50 chars,
// ≤ 12 attempted calls per segment across split tree + repair chain.
export const SPLIT_MAX_DEPTH = 4;
export const SPLIT_MIN_PART_CHARS = 50;
export const SEGMENT_ATTEMPT_BUDGET = 12;
// REPAIR_MAX_RETRIES (pinned in CONTRACTS.md): retries per occurrence
// within one repair chain, retryable known failures only; every retry
// counts toward the 12-attempt segment budget.
export const REPAIR_MAX_RETRIES = 3;

// PROVIDER_ATTEMPT_DAILY_LIMIT (QUOTA-ADDENDUM §4): the daily cap on
// AUTHORIZED provider dispatches, counted by the quota guard
// (generation/quota-budget.mjs) per Pacific-Time day. This is an
// APP-SELECTED Reader policy cap — a number we chose, informed by
// published tier material at design time. It is NOT an independently
// verified Google limit: per Google's rate-limits documentation
// (https://ai.google.dev/gemini-api/docs/rate-limits), real limits
// are project-scoped, model/tier-dependent, may vary, and the
// authoritative values are shown in AI Studio. No surface may present
// this constant as a provider limit. It is a pinned constant, not a
// settings value (Rowan acceptance invariant: a settings value could
// drift silently; moving this cap takes a reviewed build). It counts
// a DIFFERENT thing from the coordinator's DAILY_QUOTA_LIMIT (grants
// per day): this one counts provider dispatches per day.
export const PROVIDER_ATTEMPT_DAILY_LIMIT = 100;

// Output format pin (PINS.md §2): WAV PCM 16-bit mono 24 kHz at a
// measured 3,012.6 bytes/char and 15.96 chars/sec.
export const BYTES_PER_CHAR = 3012.6;
export const CHARS_PER_SEC = 15.96;

// Storage fail-closed rule (PINS.md §3): R2 free tier is
// 10,000,000,000 bytes; retries/orphans allowance ×1.10 on projected
// new audio; refuse/stop when the projection reaches the boundary.
export const RETRIES_ORPHANS_ALLOWANCE = 1.10;
export const R2_FREE_TIER_BYTES = 10_000_000_000;

// The storage seed's cross-check base (ENRICHMENT-DESIGN §3.2(b);
// Rowan review 6504846855 Q2: ZERO drift tolerance). The recorded
// recount of the production bucket, taken twice on Oct 29, 2026 via
// the cursor-paginated management API with identical results, after
// Julie's authorized chapter-audio/ deletion: 5,942 objects /
// 5,736,481,302 bytes. In the halted state no legitimate writer to
// this bucket exists, so the seed's worker-side recount must equal
// this base EXACTLY; any delta refuses the seed and writes nothing.
export const RECORDED_STORAGE_BASE = Object.freeze({
  baseBytes: 5_736_481_302,
  objectCount: 5942,
});

// Queue pin (PINS.md §4): the new v2-dedicated queue. The v1 queue
// (opalreader-generation) is never resumed or shared.
export const QUEUE_NAME = "opalreader-generation-v2";
export const QUEUE_BINDING = "OPALREADER_GENERATION_V2";

// Ledger unit: micro-cents ($1 = 1,000,000). Intro rate $0.81 per
// audio hour = 225 micro-cents per audio second.
export const MICRO_CENTS_PER_AUDIO_SECOND = 225;

// Per-phase budgets (proposal §9, Amendment A-1 clarification 3):
// the Forever Pucked phase budget is $13.50 = 13,500,000 micro-cents,
// enforced from actual known-cost settlements. The $50 monthly cap in
// settings is only the outer backstop and is NOT a phase budget.
export const PHASE_BUDGET_MICRO_CENTS = Object.freeze({
  "forever-pucked": 13_500_000,
});

// Expected single-call cost estimate for `chars` characters at the
// measured realized rate: round(chars / 15.96 × 225).
export function expectedCostMicro(chars) {
  return Math.round(chars / CHARS_PER_SEC * MICRO_CENTS_PER_AUDIO_SECOND);
}

// Conservative UPPER-BOUND cost of one attempted call: seconds are
// bounded at chars / 10 (≥1.59× slower than the realized rate), so
// round(chars / 10 × 225).
export function upperBoundAttemptMicro(chars) {
  return Math.round(chars / 10 * MICRO_CENTS_PER_AUDIO_SECOND);
}

// Per-occurrence upper bound: the full 12-attempt segment ceiling at
// the per-attempt upper bound.
export function upperBoundOccurrenceMicro(chars) {
  return SEGMENT_ATTEMPT_BUDGET * upperBoundAttemptMicro(chars);
}

// Actual known cost of a call that produced `durationSec` of audio:
// round(durationSec × 225).
export function knownCostMicro(durationSec) {
  return Math.round(durationSec * MICRO_CENTS_PER_AUDIO_SECOND);
}
