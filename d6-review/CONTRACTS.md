# D6 Build — Shared Contracts (all workstreams build against this)

Build root: `~/workspace/d6-build/impl/`
- `worker/` — copy of the v2 worker source (deployed pin 1bee2490…). Files from
  the source tree stay byte-identical EXCEPT the two flag-gated coordinator
  patches owned by WS-1 (below). New code lives in `worker/generation/`.
- `tests/` — copy of the repo test tree, imports re-pointed to `../worker/`.
  New D6 suites are `tests/d6-*.test.mjs`. Harness: `tests/helpers/do-harness.mjs`
  (REAL node:sqlite, production `.one()` semantics — throws on empty).
- `client/` — copy of the accepted UI3 publish tree (63 paths). Successor
  files only; shared modules are never edited in place.
- RULES: no spoilers (structural metadata only; synthetic fixture text only —
  never real segment text anywhere, including logs); free tier only; the
  frozen Shelf bridge (`client/modules/vendor/client/shelf-bridge.js`,
  SHA-256 bc0a5879fbf4a6f455170ead8e0fbe1aa19d82126df4eb631bd0ebad9112ec8e)
  stays byte-identical; GENERATION_HALT stays "1" in every config; a battery
  is green only with a complete run's full log + exit code on the final tree.

## Pins (from PINS.md / proposal Amendment A-1 — do not re-derive)

- Output format: WAV PCM 16-bit mono 24 kHz; 3,012.6 bytes/char; 15.96 chars/sec.
- Split ceilings: depth ≤ 4 (≤16 leaf parts), floor 50 chars, ≤ 12 attempted
  calls per segment across split tree + repair chain combined.
- REPAIR_MAX_RETRIES = 3 (pinned here): retries per occurrence within one
  repair chain, for retryable known failures only; every retry counts toward
  the 12-attempt segment budget.
- Quota 100 attempts/day (coordinator DAILY_QUOTA_LIMIT, PT day).
- Monthly cap $50 (settings backstop; existing machinery).
- FP phase budget $13.50. Ledger unit: micro-cents, $1 = 1,000,000
  (coordinator: capMicro = cap × 100 × 10000). $13.50 = 13,500,000.
- Cost model: intro rate $0.81/audio-hour = 810,000 micro-cents/hour =
  225 micro-cents/sec. knownCost(durationSec) = round(durationSec × 225).
  Expected single-call est. for `chars`: round(chars / 15.96 × 225).
  UPPER-BOUND seconds for budget accounting: chars / 10 (≥1.59× slower than
  realized — conservative). Per-attempt upper = round(chars/10 × 225).
  Per-occurrence upper = 12 × per-attempt upper (the attempt ceiling).
- Storage: R2 free tier 10,000,000,000 bytes; retries/orphans allowance ×1.10;
  projection = baseBytes + committedD6Bytes + Σ(eligible chars × 3012.6 × 1.10).
  Fail-closed: refuse/stop when projection ≥ 10,000,000,000.
- Queue: name `opalreader-generation-v2`; binding `OPALREADER_GENERATION_V2`;
  producer = v2 coordinator outbox drain; consumer = v2 worker (D6 entry);
  3 ops/message; free allowance 10,000 ops/day.
- Lane allowlist representation (pinned): `export const D6_LANE_ALLOWLIST =
  Object.freeze(["standard"])` in `worker/generation/gen-constants.mjs`;
  membership test is the only lane check used by service, executor, and the
  coordinator patches.
- Voice mappings (recorded only): Emmett→Gemini Charon, Reese→Gemini Kore,
  Tucker→Gemini Puck (match unverified), Sabrina→Gemini Aoede.

## Coordinator patches (WS-1 owns; the ONLY edits to copied source files)

Both in `worker/coordinator.mjs`, both gated on `this.env.d6StandardOnly`
(set only by the D6 entry's hostEnv; absent ⇒ byte-equivalent behavior):

1. `_submitJob`: if the flag is on and `(p.lane || "standard")` is not in
   D6_LANE_ALLOWLIST → `{ outcome: "rejected", reason: "lane_not_allowed" }`.
2. `_issueGrant`: after the existing monthly-cap check, if the flag is on,
   call `d6GrantGuard(this, job)` from `worker/generation/grant-guards.mjs`;
   a non-ok result returns `{ ok: false, reason }` (reasons: "phase_budget",
   "phase_halted_unknown_billing", "storage_boundary"). The guard looks up
   the job's plan (d6_plan_jobs → d6_plans); jobs with no plan are not
   plan-guarded. If the flag is on but the d6 tables are missing, the guard
   throws (fail closed, loud) — the D6 service ensures schema at construction.

## generation/gen-constants.mjs (WS-1)

Exports: D6_LANE_ALLOWLIST, SPLIT_MAX_DEPTH=4, SPLIT_MIN_PART_CHARS=50,
SEGMENT_ATTEMPT_BUDGET=12, REPAIR_MAX_RETRIES=3, BYTES_PER_CHAR=3012.6,
CHARS_PER_SEC=15.96, RETRIES_ORPHANS_ALLOWANCE=1.10,
R2_FREE_TIER_BYTES=10_000_000_000, QUEUE_NAME, QUEUE_BINDING,
PHASE_BUDGET_MICRO_CENTS = { "forever-pucked": 13_500_000 },
MICRO_CENTS_PER_AUDIO_SECOND=225, and helpers
`expectedCostMicro(chars)`, `upperBoundAttemptMicro(chars)`,
`upperBoundOccurrenceMicro(chars)`, `knownCostMicro(durationSec)`.

## generation/gen-schema.mjs (WS-1)

`export const GEN_SCHEMA` (DDL string) + `ensureGenSchema(sql)`.
Tables (all `IF NOT EXISTS`):
- d6_plans(plan_id PK, intent_key UNIQUE, book_id, scope, keep_going INT,
  phase TEXT NULL, lane TEXT, state TEXT, stop_reason TEXT NULL,
  eligible_digest TEXT, created_at, updated_at)
- d6_plan_jobs(plan_id, job_id PK, chapter_index INT NULL, seq INT)
- d6_plan_entries(plan_id, occurrence_id, book_id, chapter_id,
  chapter_index INT, position INT, pov_key TEXT, char_count INT,
  upper_micro_cents INT, disposition TEXT, job_id TEXT NULL,
  PK(plan_id, occurrence_id))
  disposition ∈ eligible | voice_prompt | excluded_ch3 | excluded_parked |
  bound_already — every enumerated occurrence gets a row (no silent skips).
- d6_execution_records(execution_id PK, plan_id, job_id, occurrence_id,
  grant_id, state, stage TEXT NULL, cache_key, object_key, etag,
  size_bytes INT, sha256, detail_json, created_at, updated_at)
  state ∈ granted | attempted | synthesized | flushed | verified |
  committed | failed | unknown_billing
- d6_attempt_log(attempt_id PK, execution_id, plan_id, occurrence_id,
  seq INT, phase TEXT, outcome TEXT NULL, cost_micro_cents INT NULL,
  upper_micro_cents INT, provider_request_id TEXT NULL, detail_json,
  created_at, updated_at)
  phase ∈ reserved | dispatching | confirmed | released
  outcome ∈ success | failed_known | policy_block | unknown (NULL until
  confirmed; a `released` row has outcome NULL and cost 0 — it provably
  never dispatched). Rows are never deleted.
- d6_phase_state(phase PK, halted_unknown_billing INT DEFAULT 0,
  halt_detail TEXT NULL, updated_at)
- d6_storage_state(id PK CHECK(id=1), base_bytes INT, updated_at;
  CORRECTION 2 adds object_count INT NULL, seeded_at INT NULL,
  provenance_json TEXT NULL — fresh stores are born with them via the
  CREATE; pre-existing stores (the deployed build's 3-column table)
  gain them through guarded, idempotent ALTERs in ensureGenSchema —
  the only swallowed failure is SQLite's duplicate-column error;
  rows/values are never touched)
- d6_voice_prompts(plan_id, occurrence_id, character_name, provider,
  recorded_mapping TEXT NULL, created_at, PK(plan_id, occurrence_id))

## generation/genstore.mjs (WS-1) — createGenStore(coord)

Uses coord.sql / coord._tx / coord._one / coord._oneOrNull / coord._all and
coord._now(). Methods:
- ensureSchema()
- createExecution({planId, jobId, occurrenceId, grantId}) → {executionId,
  created} — if a non-terminal execution exists for (job_id, occurrence_id),
  returns it with created:false (never a second live execution).
- executionFor(jobId, occurrenceId) → row | null (latest)
- transitionExecution(executionId, to, detail) — validates the state machine:
  granted→attempted→synthesized→flushed→verified→committed;
  any non-terminal → failed | unknown_billing. Illegal → throw.
- reserveAttempt(executionId, {upperMicroCents}) → attemptId (phase reserved)
- markDispatching(attemptId) — reserved→dispatching; the ONLY path that may
  precede a provider call.
- confirmAttempt(attemptId, {outcome, costMicroCents, providerRequestId}) —
  dispatching→confirmed. costMicroCents MUST be a number for known outcomes
  (success | failed_known | policy_block), MUST be null for unknown.
- releaseAttempt(attemptId) — reserved→released (never dispatched).
- attemptsForOccurrence(planId, occurrenceId) → rows (budget counting:
  confirmed + dispatching count; released does not).
- segmentAttemptsUsed(planId, occurrenceId) → count of attempts that count
  toward the 12-budget = rows in phase dispatching|confirmed.
- commitVerified({executionId, jobId, occurrenceId, revisionKey, cacheKey,
  sha256, provenance}) → runs INSIDE coord._tx: (1) coord.validateAndBind
  (throws/returns bound:false → abort by throwing Error with reason),
  (2) occurrences.cache_key update + coord.applyOccEvent report_success,
  (3) execution record → committed. All-or-nothing. Returns {bound:true}.
  Caller (executor) completes the grant claim via coord machinery after.
- failExecution(executionId, stage, detail) → state failed, stage recorded.
- markUnknownBilling(executionId, detail) → state unknown_billing AND sets
  d6_phase_state.halted_unknown_billing=1 for the plan's phase (if any) in
  the same transaction.
- phaseAccounting(phase) → {settledMicro (SUM cost of confirmed rows with
  known outcomes for the phase's plans), inFlightUpperMicro (SUM upper of
  rows in phase reserved|dispatching for the phase), unknownOpen (count of
  confirmed rows with outcome unknown not yet reconciled)}
- reconcileUnknown(attemptId, {knownCostMicro | null}) — operator mechanism:
  sets outcome failed_known/success with the given known cost (or
  failed_known with cost 0 for a proven no-charge), and clears the phase
  halt when no unknown attempts remain open for the phase.
- storageAccounting() → {baseBytes, d6Bytes} where d6Bytes = SUM(size_bytes)
  over execution records in flushed|verified|committed.
- seedStorageBase({baseBytes, objectCount?, recountedAt?, source?}) →
  storageSeedState() + {changed, idempotent} (CORRECTION 2): the
  production seed for the storage guard's base. Throws on any value
  that is not a non-negative safe integer. A re-seed with the SAME
  (baseBytes, objectCount) writes nothing and reports
  idempotent:true; a re-seed with different values replaces the base
  and APPENDS a provenance entry (new values + the previous ones) to
  provenance_json — a silent overwrite is impossible by construction.
- storageSeedState() → {seeded, baseBytes, objectCount, seededAt,
  provenance[]} read from d6_storage_state (seeded:false + baseBytes 0
  when no row exists).
- recoveryScan() → [{execution, action}] with action ∈
  reverify_and_commit (flushed|verified) | reenter_flush (synthesized) |
  reconcile_hold (attempted with a dispatching attempt, or unknown_billing) |
  release_and_fail (attempted/granted with no dispatching attempt →
  release reserved attempts, mark failed).

## generation/eligible-set.mjs (WS-3) — pure functions

Input shape (content-plane view, structural only):
```
plane = { books: [{ bookId, chapters: [{ chapterId, chapterIndex,
  segments: [{ occurrenceId, povKey, charCount, blockHistory: bool,
               blockRootId?: string|null }] }],
  povs: [{ key, name, provider, voiceId }] }],
  boundOccurrenceIds: Set<string>,
  parkedJob: { jobId, bookId, chapterIndex,
    entries: Map<occurrenceId, "parked-pending"|"parked-ready"> } | null }
```
Adapter planes (generation/content-plane-adapter.mjs) carry
`blockRootId` through from the content entity (CORRECTION 2): proof 5
consumes it to name the POLICY_BLOCK lineage root; the eligible-set
builder ignores it. Adapter POV resolution (CORRECTION 2): a segment/
chapter `pov` VALUE on live data is a cast NAME; it resolves by exact
id match, else by exact name match against exactly one cast entry,
else null (ambiguous/absent names never guess, and a named-but-
unresolvable speaker is never reassigned to the default voice); the
(provider, voice_id) default-voice fallback applies only when neither
segment nor chapter names a speaker. Adapter charCount (CORRECTION 2):
speechChars only when a number > 0 (live The Goal carries
speechChars 0 with the real count in textChars), else textChars when
numeric, else the text length.
`buildEligibleSet(plane, bookId)` →
`{ entries: [{occurrenceId, bookId, chapterId, chapterIndex, position,
povKey, charCount, disposition, reason}], digest }` in reading order.
Rules: bound → bound_already; in parkedJob.entries → excluded_parked;
same (bookId, chapterIndex) as the parked job → excluded_ch3;
POV resolves to a removed-provider voice (provider ∈ azure|fish|speechify|
elevenlabs) → voice_prompt; otherwise eligible. Digest = sha256 of the
canonical entry list (ids + dispositions).

## generation/proofs.mjs (WS-3) — runProofs(plane, census)

census = { bookId → { occurrenceIds: [..], eligibleCount, povKeys: [..] },
ch3: { structuralIds: [27 ids in order], parkedEntries: Map } }
Returns { completeness, idStability, povResolution, noSilentSkips,
ch3Reconciliation: { rows: [{occurrenceId, censusDisposition,
parkedDisposition, liveParkedDisposition, resolution}] (exactly 27),
absentOccurrenceId, policyBlockOccurrenceId, parkedAccounting:
{ censusParkedCount, liveParkedCount, liveOnlyRows, censusOnlyRows },
pass }, pass } — every proof
reports named offenders, never just a boolean. Disposition vocabulary:
bound | parked-pending | parked-ready | other-with-reason.
CORRECTION 2: policyBlockOccurrenceId is the blockRootId LINEAGE ROOT
(the self-referential root, or the target the other block-rooted
occurrences chain to) — never the last block-history segment in scan
order; planes without lineage ids fall back to the occurrence
carrying the POLICY_BLOCK failure record, then the first blocked
segment in structural order. parkedAccounting states the parked job
on BOTH sides (the live job's rows vs the census's parked entries)
and names every live-only row and census-only entry with both
dispositions; naming is reportage, not an offender — a live-only row
is excluded from generation on both accounts.

## generation/service.mjs (WS-1) — createGenerationService({coord, env, store, sources})

sources = { eligiblePlane(bookId) → plane } (WS-3's builder adapts the
coordinator content plane in production wiring; tests inject fixtures).
- submitIntent({commandId, bookId, scope, chapterIndex?, occurrenceId?,
  keepGoing, phase, lane, submittedOccurrences?}) →
  lane check (allowlist; reject `lane_not_allowed`); build eligible set via
  buildEligibleSet (imported from eligible-set.mjs — WS-3 owns the file;
  WS-1 tests inject a stub builder through `sources.buildEligibleSet` if
  the real module is not yet present, integration wires the real one);
  intentKey = sha256(canonical {bookId, scope, chapterIndex, occurrenceId,
  eligibleIds}); existing plan with intentKey → return it (duplicate
  intent = one plan); else create plan + entries + voice prompt rows;
  create the FIRST chapter job (or segment job) via coord.handleCommand
  SubmitJob with jobId `${planId}:ch<idx>` / `${planId}:seg`, occurrences
  = that chapter's eligible entries as {occurrenceId, revisionKey},
  data {estMicroCents: per-occurrence expected cost (chapter average,
  rounded up), d6PlanId: planId}. revisionKey comes from the plane input
  (entries carry revisionKey through — see eligible-set: segments include
  revisionKey).
  Returns {planId, created, state}.
- driveOnce() → for each plan in an active state: if plan phase is halted
  for unknown billing → state halted_unknown; storage guard for the plan
  (projection incl. plan's remaining eligible chars) → parked_storage;
  if current job has pending occurrences and no live grant → 
  coord.requestGrant(jobId) (the grant gate enforces quota/cap/phase
  budget; refusal reasons map: quota_estimate_exhausted|quota_parked →
  parked_quota; spending_cap → parked_cap; phase_budget → parked_budget;
  storage_boundary → parked_storage; phase_halted_unknown_billing →
  halted_unknown); then coord.drainOutbox(env.sendGrant) when env.sendGrant
  exists. If current job complete → create next chapter job (book scope,
  keepGoing) or finish (plan complete|partial from entry outcomes).
  Returns per-plan outcome list. driveOnce NEVER dispatches an occurrence
  with a non-terminal execution record (the executor enforces too).
- planStatus(planId) → {planId, state, stopReason, totals {eligible, done,
  failed, blocked, prompts}, entries:[...]} (plain data; the client words
  it).
- seedStorageBase(input) → async (G2 HARDENING, ENRICHMENT-DESIGN
  §3.2; supersedes the CORRECTION 2 caller-figures contract):
  {outcome: "applied", recounted, ...seedState, changed, idempotent} |
  {outcome: "rejected", reason, ...seedState}. The invocation is
  FIGURELESS. Fences in order: HALT — refused `generation_not_halted`
  unless env GENERATION_HALT is exactly "1" (missing flag fails
  closed; seeding is a pre-arming act only; the executor/driver
  never seed implicitly); FIGURELESS — a body presenting baseBytes
  or objectCount is refused `caller_figures_refused`; CONFIGURATION
  — the expected base (construction input `expectedStorageBase`;
  production wiring pins RECORDED_STORAGE_BASE from
  gen-constants.mjs) must be configured, else
  `seed_expected_base_not_configured`; RECOUNT — the worker recounts
  the bucket itself (construction input `recountBucket`, defaulting
  to env.OPALREADER_STORAGE) via list() fully paginated, refusing
  errored/incomplete pages (`recount_failed`) and a missing bucket
  (`recount_unavailable`), writing nothing; COMPARE — zero
  tolerance: recounted != expected refuses `recount_mismatch` with
  both figures reported. On equality the store seeds the BUCKET'S
  OWN figures with source "worker-recount"; Correction 2 provenance
  semantics unchanged. The store-level seedStorageBase (below) is
  unchanged — it still takes explicit figures from this one caller.
- recover() → runs store.recoveryScan() classifications and performs the
  non-spending actions (release_and_fail); returns the scan for the
  executor to continue reverify_and_commit items (executor owns R2).

## generation/d6-executor.mjs (WS-2) — createD6Executor({coord, store, providers, flushStore, cache, workSource, consumerId})

Mirrors executor.mjs's claim discipline (claimGrant; already_claimed by
another consumer → stand down; completed/closed/unknown grant → drop).
Per granted occurrence:
1. Lane: job lane (coord.jobView) not in allowlist → refuse the whole
   message ({refused: "lane_not_allowed"}), zero provider contact.
2. Existing non-terminal execution → resume per recovery classification
   (flushed|verified → reverify + commit, NO synthesis; synthesized →
   re-enter flush with the recorded bytes? — bytes are not durable
   outside R2; a `synthesized` record has no object key guarantee: if
   flushStore.head finds the object at the recorded key, treat as
   flushed; else mark failed stage=flush_interrupted — NEVER re-synthesize
   within the same execution).
3. Fresh: store.createExecution (state granted) → coord.acquireSpendIntent
   (existing fence; if intent exists with outcome → mirror executor.mjs
   behavior: success → re-report path via commit if object verifies;
   else skip).
4. workSource(jobId, occurrenceId) — WS-2's createD6WorkSource(coord,
   {cache}) in generation/d6-work-source.mjs: like createContentWorkSource
   but returns {status:"ok", payload} | {status:"no_content"} |
   {status:"removed_provider", povName, provider, recordedMapping} |
   {status:"unmapped_pov"}. removed_provider → record voice prompt
   (d6_voice_prompts), occurrence reported as prompt, ZERO synthesis.
   G2 (ENRICHMENT-DESIGN Part 2): the cast is read `cast` first with
   `povs` fallback (the live entity key first — the adapter's
   dual-read mirrored); styleDirection resolves cast voice →
   defaultVoice fallback → segment (the fallback voice's recorded
   style_direction is read, so the defaultVoice title segment
   synthesizes with its voice's style); a segment NAMING a speaker
   the cast cannot resolve is unmapped_pov — the defaultVoice
   fallback applies only when no speaker is named (never a silent
   substitution). No chapter-pov fallback (deliberate non-fix:
   entities carry no chapter pov). Proven by tests/d6-work-source.test.mjs.
5. Synthesis via generation/policy-split.mjs's synthesizeSegment
   (budget = SEGMENT_ATTEMPT_BUDGET − store.segmentAttemptsUsed): every
   provider call is wrapped: reserve attempt (upper from part chars) →
   markDispatching → call → confirm with outcome/cost. POLICY_BLOCK →
   split path inside synthesizeSegment. Known HTTP failure → outcome
   failed_known cost 0. Success → cost knownCostMicro(durationSec).
   Non-HTTP throw → outcome unknown (cost null), execution →
   unknown_billing (phase halts), STOP the whole message (fail-closed).
   Quota error (err.quotaExceeded) → confirm failed_known, report
   daily_limit semantics by stopping the message and letting the driver
   park (return {quotaExhausted: true}).
6. Success audio → execution synthesized → flush-store flushAndVerify →
   flushed (record objectKey/etag/size/sha) → head-verify + prime digest
   → verified → store.commitVerified → committed. Then complete the
   grant bookkeeping the way handleReport does for a full-success
   message (grant reported + claim completed via coord internals —
   WS-2 documents exactly which coord methods it calls).
7. Flush/verify failure → execution failed with stage (flush|verify),
   occurrence stays unbound; object (if any) preserved + flagged in the
   returned report by key. Retryable known failures → return
   {repair: {occurrenceId, reason}} markers for the service's repair
   chain (service creates the follow-up repair job; executor never loops).
handleMessage returns a per-occurrence outcome map (same spirit as
executor.mjs). Batch payloads (payload.mode === "batch") are REFUSED
({refused: "lane_not_allowed"}) — the executor never calls submitBatch.

## generation/flush-store.mjs (WS-2) — createFlushStore(bucket, {keyPrefix})

- objectKeyFor(cacheKey, format) = `${keyPrefix}audio/${cacheKey}.${format}`
- flushAndVerify(cacheKey, bytes, format, durationSec) →
  conditional PUT (onlyIf etagDoesNotMatch "*"), customMetadata
  {sha256, identity: cacheKey, duration_seconds}; capture created.etag +
  created.size; then bucket.head: exists + head.size === bytes.byteLength
  + head.etag === created.etag; then prime digest: bucket.get + sha256 ===
  sha256(bytes). Returns {objectKey, etag, sizeBytes, sha256}.
  If PUT returns null (lost race) → head + GET digest compare against the
  synthesized digest: equal → adopt (return with winner's etag/size);
  differ → throw FlushError(stage "flush", code "winner_digest_mismatch").
  PUT throws → FlushError(stage "flush", code "flush_indeterminate") —
  never an unconditional retry.
- headVerify(objectKey, {sizeBytes, etag}) → bool (recovery path).
- primeDigest(cacheKey) → {sha256, etag, sizeBytes} | null via GET.

## generation/policy-split.mjs (WS-2)

- splitText(text, floor=50) → [part, part] | null: split at the sentence
  boundary nearest the midpoint (fallback: word boundary, then char
  midpoint); both parts ≥ floor when text.length ≥ 2×floor; concat(parts)
  === text exactly.
- synthesizeSegment({synthesize, payload, budget}) where budget =
  {remaining} (mutable counter object shared with the executor's attempt
  accounting — the executor wraps `synthesize` so each call reserves/
  confirms an attempt; synthesizeSegment itself only orchestrates):
  try whole → on err.contentBlocked: if depth ≥ 4 or unsplittable →
  throw TerminalBlock; else split + recurse (depth+1) → returns
  {parts: [{audio, format, durationSec}], attemptsUsed} with voice/model/
  style passed through UNCHANGED on every call. stitchWav(parts) → one
  WAV Uint8Array (all parts must be WAV 24kHz/16bit/mono; PCM concat +
  rewrap; throws on format mismatch).
- TerminalBlock error: {code: "policy_block_terminal", depth}.

## Entry + config (WS-1)

- `worker/worker-entry-prod-d6.js`: like worker-entry-prod.js, PLUS
  hostEnv adds `d6StandardOnly: true` and sendGrant (from
  env.OPALREADER_GENERATION_V2.send) when GENERATION_HALT === "0";
  DO class OpalReaderCoordinatorProd — the EXISTING production
  class name (CORRECTION 6501450683: NOT a newly named subclass;
  the D6 entry exports its D6-carrying class under the same name
  the live script binds, and its constructor bootstraps the
  generation schema in place via ensureGenSchema):
  internal routes POST /internal/d6/intent (→ service.submitIntent) and
  GET /internal/d6/plan (→ service.planStatus); _execute override using
  createD6Executor; alarm override: super.alarm() → service.recover() +
  service.driveOnce(). Public fetch: SubmitJob commands whose payload
  carries data.d6Intent are forwarded to /internal/d6/intent instead of
  /v2/commands; GET /v2/d6-plans/<id> forwarded to /internal/d6/plan;
  a `queue` handler (production scope/instance fences) → /internal/execute.
  GENERATION_HALT still gates queue + execute via assertGenerationEnabled.
  CORRECTION 2 adds the storage-seed route: internal
  POST /internal/d6/seed-storage (→ service.seedStorageBase) and its
  public forward POST /v2/d6-seed-storage, behind the same production
  gate chain as every other public route (scope config → scope header
  → client token → instance header; the entry itself sets the
  internal header; the class fetch requires it plus the production
  scope). An internal route was chosen over a coordinator command
  type deliberately: the seed lives entirely in D6-owned files (the
  coordinator's pinned two-hunk gated diff is untouched — on the
  /v2/commands path the coordinator's env carries no D6 marker, so a
  command-type fence could not distinguish this surface), and it is
  fenced equivalently to the existing D6 routes.
  G2 HARDENING: the seed route additionally requires the
  MIGRATION-OPERATOR credential through the entry's existing
  operator admission block (fail-closed 503
  migration_operator_not_configured when the operator secret is
  unset or equals the access token; 403 migration_operator_required
  when the header does not match) — the client gate still runs in
  full, so the client token is necessary but NOT sufficient. The
  entry stamps x-opalreader-operator-admitted on the forward
  (overwritten unconditionally — unforgeable through public
  routing), and the class fetch for /internal/d6/seed-storage
  requires the stamp "1" on top of the internal header + scope.
  SEED-FIX CORRECTION (Rowan design pass 6509192325): the seed
  route's admission changes to the migration-operator credential
  ALONE — the production gate skips its client-token check for
  POST /v2/d6-seed-storage only (scope config → scope header →
  instance header checks unchanged), exactly like the two Option D
  operator routes. Rationale: the credential-exchange transport
  refuses any request carrying two credential surrogates (HTTP 403
  credential_ambiguity), so the G2 dual-credential shape could
  never reach the Worker — the same wall that stopped the
  Oct 23, 2026 D4 pilot, and the Oct 29, 2026 arming attempt's
  seed call. Every other fence is unchanged: the operator
  admission block (fail-closed 503 when unset/equal, 403 when the
  header does not match — its configuration check still requires
  the access token to be SET and distinct, though no presented
  client token is consulted for this route), the unforgeable
  admitted stamp, the class gate, the halt fence, figurelessness,
  the worker recount, and the zero-tolerance cross-check. All
  other routes keep their existing admission.
- `worker/p8/deploy-spec-prod-d6.json`: prod spec + queue producer/consumer
  for opalreader-generation-v2; GENERATION_HALT remains "1"; secret names
  only (GEMINI_API_KEY listed as a name, never a value). CORRECTION
  6501450683: the COORDINATOR binding keeps the existing class name
  OpalReaderCoordinatorProd and the spec applies NO new DO class and
  NO new-class migration (the generation schema evolves in place).
- `worker/generation/wrangler-queues.md`: the wrangler-style queue config
  block (producers/consumers bindings) mirroring the deploy spec.

## Client (WS-4) — successors on the ui-pkg-3 base in client/

- app-267.js (from app-266.js): build marker d5b-v2-generation-client-1,
  packaging gen-pkg-1. Changes ONLY in the generation surface:
  the confirm sheet becomes live — offnote replaced with the truthful
  live wording; Standard selected; Batch button stays DISABLED with the
  reason shown ("Batch isn't enabled yet — it needs its own decision")
  and cannot be selected programmatically (state cannot be set);
  "Keep going" toggle enabled and functional (intent scope); Start
  enabled when the scope has unbound segments; Start submits ONE intent
  via the transport sendCommand as a SubmitJob whose payload carries
  data.d6Intent {intentKey, scope, keepGoing, phase} + lane "standard" +
  the eligible occurrences (from the local store: unbound segments in
  reading order, Ch 3 of Forever Pucked excluded client-side too) with
  their revisionKeys from the local projection; after submit, the sheet
  shows the accepted state and the book view shows plan status (polled
  from GET /v2/d6-plans/<planId>) in plain words (working / stopped:
  quota / stopped: budget / done / needs a voice choice). Per-segment +
  and chapter Generate open the same sheet scoped. Voice sheet stays as
  accepted (auditions are a separate surface; NOT wired by D6).
  Everything else byte-identical behavior: W-4 hook, drain, headings,
  W-5 — composition-ui3.js and all other shared modules reused unchanged.
- modules/constants-gen1.js (from constants-ui3.js): new build/bundle/
  styles/cache identities: app-267.js, styles-154.css, cache
  opalreader-shell-gen1.
- modules/entry-gen1.js (from entry-ui3.js): re-exports composition-ui3
  unchanged + constants-gen1.
- sw-gen1.js (from sw-ui3.js): cache opalreader-shell-gen1, SHELL list
  updated to the gen1 identities, purge [].
- styles-154.css = styles-153.css + appended generation-status section
  (only if styling is needed; otherwise reuse styles-153 and say so).
- index.html successor handling follows the ui3 pattern (the package's
  index points at app-267.js?v=gen-pkg-1 + styles-154.css?v=gen-pkg-1 +
  the new build marker in the failure note).
- Batteries: adapt copies of the ui3 tests to run against the gen1 tree
  (unit, cast census, chromium, phone-width, w4) — all must stay green —
  plus a new gen-client proof: (a) Batch cannot be selected (DOM +
  programmatic), (b) Start submits exactly one SubmitJob with lane
  standard + d6Intent and the right occurrences, (c) zero submissions
  from any other affordance, (d) plan status renders the server's words,
  (e) state byte-stability apart from the submission (the accepted
  batteries' discipline).
