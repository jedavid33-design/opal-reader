# B-G2 — BATCH IMPLEMENTATION SPECIFICATION AND OFFLINE TEST PLAN

_Workstream 2, design gate 2. Specification only. Drafted by Wren
2026-11-06 under Rowan's combined design ruling (local record
`ROWAN-COMBINED-DESIGN-RULING.md`, Part 2; B-G1 proposal pin
`9ef371debcc06e2d7db72e8bc84d735c102f943e`)._

**Status of this document.** This specification defines the B-G2
build at contract level: what a future, separately reviewed build
must do, file by file and state by state, and the offline tests that
must prove it. It is **not code**, not a build authorization by
itself, not a staging or production deployment authorization, not a
provider-call authorization, and not a Batch allowlist change. The
candidate build specified here **will ship with
`D6_LANE_ALLOWLIST` still `["standard"]`** (generation/gen-constants
.mjs:9). Arming remains B-G4, separately gated.

**Tense discipline.** Statements about the deployed tree are present
tense and cited to `containment-v4/composed-tree/v2/` (the live
build source, build `fdb02395b3775dc945baa395591a73060ab146c4`).
Everything the B-G2 build must do is future tense ("the build
will…") and is a **specification**, not a claim about current code.
Where an ordering or mechanism is this specification's own choice
rather than a fact of the current source, the text says
**SPECIFICATION CHOICE** explicitly.

**Decision trace.** This specification implements Rowan's rulings
D-1 (conditional pass — fence-time counting, crash-safe consistency
to be proven), D-2 (pass — per-job ambiguity block), D-3 (pass with
conditions — Standard-lane repair for Batch `POLICY_BLOCK`; the
provider-error classification surface is a **mandatory
prerequisite**), D-4 (pass — parameters fixed: extended latency
1 hour; stalled = ≥12 consecutive observed passes without progress
AND age ≥6 hours; ambiguity escalation 24 hours; no observed pass =
chain non-observation, never provider stall), D-5 (conditional pass
— INVENTORY-AND-HOLD; no `abandoned` map state), and D-6 as amended
(automatic adopt-first on multiple matches is **rejected**), plus
prerequisites B1 (atomic or recoverably consistent fence +
accounting protocol, partial-write crash windows enumerated), B2
(multiple-match handling and duplicate-exposure accounting without
automatic adoption), and B3 (rollback/restoration and Standard-
repair tests). B-1 pricing remains **OPEN**; the cost model stays
lane-blind. B-2 staging parity and B-3 credential provenance are
carried as B-G3 predicates (§8).

---

## 1. Build outcome and non-goals

When built to this specification, the candidate tree **will**:

1. Execute one Batch submission per occurrence through the D6
   executor — dispatch → atomic fence + accounting bundle → provider
   POST → durable map lifecycle → drive-pass polling → classified
   terminal handling → the shared flush/verify/commit machinery —
   with exactly the accounting D-1 settled: one counted dispatch per
   submission, recorded durably **before** the POST; polls,
   retrievals, and enumerations counted zero.
2. Classify terminal Batch errors through a new classification
   surface so a provider policy block is distinguishable from a
   provider fault **before** any Batch failure can enter the repair
   machinery (D-3's prerequisite).
3. Hold ambiguity fail-closed per job, with operator adjudication —
   including the D-6 multiple-match block with full identifier
   preservation and duplicate-exposure reporting — as the only
   designed exits.
4. Poll submitted maps on drive passes under the fixed D-4
   parameters, with chain non-observation classified separately
   from provider stall.
5. Preserve INVENTORY-AND-HOLD rollback: no map deletion, no
   `abandoned` state, no silent settlement, no resubmission on
   restoration.
6. Remain **inert in production terms**: with the allowlist still
   `["standard"]`, no Batch intent is admitted, no Batch dispatch
   executes, and Standard behavior is regression-proven unchanged.

The build **will not**: change the allowlist; group multiple
segments into one provider batch (the adapter's cardinality is one
occurrence per provider job — B-G1 §1.0, host/adapters.mjs:364-407);
add a client surface of any kind (§5.4); cancel or recall a provider
batch (no cancel method exists in the adapter); depend on
never-accepted resolution (`resolveBatchNeverAccepted` remains
unreachable by any wired flow — §3.10.4); or assume any Batch price
differential (B-1 open).

---

## 2. Current source baseline (present tense, cited)

The components the build touches, as they stand in the deployed
tree:

| Component | Current fact |
|---|---|
| Lane law | `D6_LANE_ALLOWLIST = Object.freeze(["standard"])` (generation/gen-constants.mjs:9); consulted at intent admission (generation/service.mjs:857, refusal `lane_not_allowed`), capabilities (service.mjs:1317-1322, Batch reason `batch_not_armed`), the executor's job-lane check, and the coordinator grant patch. Settings is not a lane control. |
| D6 executor refusals | `generation/d6-executor.mjs` refuses Batch at three layers: layer 1, a batch dispatch payload before any claim (:677-684); layer 2, the job's own lane not in the allowlist (:688-689); layer 3, a batch work payload inside the occurrence loop (:841-842) — all `{refused: "lane_not_allowed"}`. The file header states: "This executor has no submitBatch call anywhere." |
| Work source | `generation/d6-work-source.mjs:114` stamps payload `mode: view.lane === "batch" ? "batch" : "standard"`. |
| Coordinator transactions | `GenerationCoordinator._tx(fn)` (coordinator.mjs:717-721) is re-entrant: a nested `_tx` joins the outer transaction; the outer call runs `state.storage.transactionSync(fn)`. Synchronous SQL helpers called inside an outer `_tx` callback therefore commit or roll back as one unit. |
| Spend intent | `spend_intents` (coordinator.mjs:533-545): acquired atomically exactly once; the only permit for a provider call; an intent with no recorded outcome is spent-or-unknown and never re-acquirable. `noteSpendOutcome` records known outcomes only; an ambiguous outcome is recorded by **not** calling it. |
| Batch maps | `batch_maps` DDL (coordinator.mjs:546-556), primary key (job_id, occurrence_id, generation). State law: `fenced` → `submitted \| ambiguous \| rejected`; `ambiguous` → `submitted` (lookup adoption) \| `closed` (evidenced never-accepted resolution only). Methods at coordinator.mjs:3740-3855: `fenceBatchSubmit` (refuses an existing non-superseded map; requires a live, consumer-matched intent), `_batchTransition` (refuses `no_map` / `superseded` / `state_<current>`), `noteBatchSubmitted`, `noteBatchAmbiguous` ("this mapping may NEVER be resubmitted"), `noteBatchRejected`, `adoptBatchByLookup` (evidence string ≤240 chars), `resolveBatchNeverAccepted` (closes + supersedes map and intent atomically; voids a still-open fencing dispatch; re-advances the job). `workView(jobId)` returns latest-generation intents and maps. |
| Genstore | `generation/genstore.mjs`: execution states `granted → attempted → synthesized → flushed → verified → committed`, with `failed` / `unknown_billing` exits; `createExecution` never creates a second live execution for (job, occurrence); attempt phases `reserved → dispatching → confirmed \| released`; **`markDispatching` is the only path that may precede a provider call** and runs inside `coord._tx`; `confirmAttempt` outcomes are `success \| failed_known \| policy_block \| unknown` (known outcomes must carry a numeric cost; `unknown` must carry cost NULL); `segmentAttemptsUsed` counts `dispatching + confirmed` phases (the shared 12-attempt budget, `SEGMENT_ATTEMPT_BUDGET = 12`, gen-constants.mjs:16); `commitVerified` runs inside `coord._tx` (validateAndBind → occurrence update + `report_success` → `committed`) and is idempotent on (occurrenceId, executionId); `recoveryScan()` classifies non-terminal executions — an `attempted` execution with a `dispatching` attempt is `reconcile_hold`. Phase accounting counts `reserved + dispatching` attempts at their upper bound as in-flight exposure. |
| Quota | `generation/quota-budget.mjs`: two ledgers — `d6_provider_dispatches` (one row per dispatch, attempt_id primary key) and `d6_grant_reservations` (reservation_id `qres:<grantId>:<occurrenceId>:<dayKey>`). `applyDispatchQuota` is called from `markDispatching` inside the transaction: it proves an open current-day reservation for the exact grant+occurrence (atomically re-reserving on Pacific-Time day rollover), enforces slots and the day cap (`PROVIDER_ATTEMPT_DAILY_LIMIT = 100`, gen-constants.mjs:36 — an app-selected policy cap, not a verified provider limit), writes exactly one dispatch row, and increments `slots_consumed`. Any `QuotaBudgetRefusal` (reasons in `QUOTA_REFUSALS`: `provider_attempt_budget`, `…_day_rollover`, `…_bootstrap_incomplete`, `…_unreserved`, `…_counter_drift`, `…_schema_inconsistent`, `…_day_over_limit`) rolls the whole transaction back. `reconcileQuota` derives drift from rows (`slots_consumed_mismatch`, `slots_over_consumed`, `dispatch_row_unmatched`, `stamped_attempt_without_dispatch_row`, `day_over_limit`, bootstrap exceptions); `ok` requires empty drift and no current-day block. Enforcement is armed exactly when the durable bootstrap record exists. |
| Adapter | `host/adapters.mjs`: every method begins `assertGenerationEnabled(env)` — under `GENERATION_HALT = "1"` submissions, polls, and enumerations all throw before provider contact. `submitBatch` (:364-407) is Gemini-only, model-gated to `gemini-3.8-flash-tts` / `flash-lite` (regex at :372), POSTs one request keyed `seg-<occurrenceId>`, and on an accepted response with a missing/invalid `batches/…` name throws a 502 marked `noRetry` ("Manual reconciliation required"). `getBatch` (:409-439) returns `{done, state}` shapes; at :422-423 a batch-level error collapses to the metadata state or `BATCH_STATE_FAILED`, and at :430 a done response whose single record carries an error, or carries no audio, collapses to `BATCH_STATE_FAILED` — **a policy block and a provider fault are indistinguishable today**. `listBatchesByDisplayName` (:441-469) returns only `{name, displayName}` per match, page size 100. `verifyNeverAcceptedEvidence()` throws unconditionally. The synchronous Gemini path's policy evidence standard lives at :233-335: `contentBlocked` is set only on clear structured policy signals (finish/block/status fields, prompt feedback), never on missing audio alone. |
| Legacy executor | `executor.mjs` (tree root): `runBatch` (:158-209) is the behavioral reference — existing map dispatch (`submitted` → poll; `ambiguous` → block; `rejected`/`closed` → skip; `fenced` → `noteBatchAmbiguous(fence_without_outcome)`, never post on a fence alone); `pollBatch` (:141-156; a poll throw is pending with no state changes). `reconcileBatch` (:224-240) requires an `ambiguous` map, returns `{resolved:false, reason:"no_match_not_terminal"}` on no match, and **adopts `matches[0]`** on any match. Grep-verified: `reconcileBatch` has **no caller** in any entry of the tree. Its adopt-first behavior is what D-6 rejects. |
| Repair inheritance | `coordinator.mjs:2536`: when a `kind:"repair"` job's report completes with `detail.followOn.occurrences`, the follow-on job is created with `lane: jobRow.lane` and granted in the same transaction. |
| Grants and leases | Grants lease for `LEASE_MS = 15 * 60 * 1000` (coordinator.mjs:463). The lease handler (:3319-3405) transitions still-`granted` occurrences of an expired, delivered grant to `outcome_unknown` and the job to `unknown`. `handleReport` closes its grant: occurrences the report does not mention return to `pending` at grant closure, and `settleReservationsForGrant` runs there. §3.7 specifies the Batch-custody consequence. |
| Production entry | `worker-entry-prod-d6.js` imports `createD6Executor` (:271) and constructs it only inside `_execute` (:1824). `alarm()` (:1939+) runs the base coordinator alarm, then the containment gate, then `service.recover()` + `service.driveOnce()`; drive-pass outcomes are recorded in `d6_drive_passes` through a scalar allowlist projection (:464-476). Operator routes follow one house pattern: public gate skips the client token only for the migration-operator credential; the class gate re-checks the `x-opalreader-operator-admitted: "1"` stamp (missing stamp ⇒ HTTP 403 `migration_operator_required`); bodies are closed allowlists with a required nonblank `authorizationRef` where the act is auditable (e.g. `/v2/d6-reconcile-unknown`, `/v2/d6-adjudicate-estimated`, `/v2/d6-quota-reconcile` at entry :2065-2102 and their internal handlers). |
| Drive selection | `service.driveOnce` (:1008) selects plans whose state is NOT IN (`complete`, `partial`, `retired`, `halted_unknown`); its grant step refuses to grant a job while any pending occurrence has a non-terminal execution (`execution_in_flight`). |
| Cost model | Lane-blind: 225 units per audio second (gen-constants.mjs:64-65 region; `MICRO_CENTS_PER_AUDIO_SECOND = 225`); expected cost `round(chars / 15.96 × 225)`; per-attempt upper bound `upperBoundAttemptMicro(chars) = round(chars/10 × 225)` (:78-84). Ledger units behave as micro-dollars despite the `MicroCents` naming (standing correction). |
| Test harnesses | `containment-v4/tests/harness.mjs`: real SQLite via `node:sqlite`; its `SqlCursor.one()` **throws** on 0 or >1 rows ("Expected exactly one result, got N") — production Durable Object semantics, deliberately not the null-returning fake of the older do-harness lineage; `transactionSync` is BEGIN/COMMIT/ROLLBACK; a statement-matching fault injector and `crash()` (new instance over the same storage) are built in. Standing batteries: containment `containment-v4/tests/containment-battery.test.mjs` (42 tests), P2 `instrumentation-spec/tests/battery.test.mjs` (32), R5A `r5a-revision/tests/r5a-battery.test.mjs` (23), V-3 `v3-harness/v3-cold-restart.test.mjs` (5). |

---

## 3. Build scope, component by component

File map (the complete set of production files the build may
touch; anything else changing is a scope finding at review):

| File | Change |
|---|---|
| `host/adapters.mjs` | §3.2 classification surface inside `getBatch`; §3.5 accepted-unnamed marker; §3.10 enumeration match hardening. `submitBatch`'s request shape and success shape do not change. |
| `generation/d6-executor.mjs` | §3.3 Batch branch replacing refusal layers 1 and 3 for admitted lanes (layer 2 unchanged); §3.4 fence bundle invocation; §3.5 submit-outcome handling; §3.6 shared poll/terminal handling and the drive-pass poll method; §3.8 shared commit tail. |
| `generation/genstore.mjs` | §3.6 terminal-receipt writer; §3.6 poll-observation storage (lazily ensured beside its writer, never added to the pinned bootstrap schema set). |
| `generation/quota-budget.mjs` | No conceptual change. The fence bundle will reuse `applyDispatchQuota` through `markDispatching`, and `reconcileQuota` unchanged. (A Batch-specific counter is forbidden — §4.4, invariant I-6.) |
| `coordinator.mjs` | §3.7 lease-custody predicate; §3.9 repair follow-on lane partition at :2536; §3.10 adjudication tables and transitions (lazily ensured beside their writer, presence-checked on reads). Map state law itself does not change. |
| `generation/service.mjs` | §3.10/§3.11 operator service methods (reconcile, adjudicate, inventory); capabilities and admission logic do not change. |
| `generation/gen-constants.mjs` | The four fixed D-4 parameters as pinned constants (§3.6.3). The allowlist line does not change. |
| `worker-entry-prod-d6.js` | §3.6 drive-pass poll invocation in `alarm()`; §5 operator routes (public classification + internal handlers). `_execute` wiring otherwise unchanged. |
| `executor.mjs` (legacy) | §3.10.5 multiple-match hardening of `reconcileBatch` only. It gains no caller and no D6 role. |
| Client (any file) | **No change.** §5.4. |

### 3.1 Sequencing constraint that governs all of §3

The error-classification surface (§3.2) **will be built and tested
first**. Until it exists and its family (§6, BG2-E) is green, no
Batch terminal failure may be wired to any report, repair, or
settlement path. The fence + accounting protocol (§3.4/§4) **will
be built before** the execution path's submit wiring (§3.5). The
multiple-match adjudicator (§3.10) **will be built before** any
enumeration caller is wired (§3.11's route is that caller).

### 3.2 The error-classification surface (D-3 prerequisite)

**Where it lands.** A pure classifier inside `host/adapters.mjs`,
used only by `getBatch`, exported for offline tests. It takes the
decoded provider batch object and returns a classification object;
it performs no I/O, reads no coordinator state, and never throws
for a terminal shape. `getBatch`'s success return
(`{done:true, state:"BATCH_STATE_SUCCEEDED", audio, format:"wav",
durationSec}`) **will not change**. The not-done return
(`{done:false, state}`) **will not change**.

**What it will produce.** For every terminal (done) non-success
response, `getBatch` will return
`{done:true, state, classification}` where `state` keeps today's
vocabulary (`BATCH_STATE_FAILED` / `BATCH_STATE_CANCELLED` /
`BATCH_STATE_EXPIRED`, or the metadata state) and `classification`
is exactly:

```
{
  kind:        "policy_block" | "provider_error" | "batch_terminal"
             | "response_shape" | "provider_error_unclassified",
  outcome:     "policy_block" | "failed_known",
  blockReason: <bounded token or null>,
  finishReason:<bounded token or null>,
  providerCode:<bounded token or null>,
  retryable:   <boolean>,        // chain-level eligibility only
  source:      "batch_error" | "item_error" | "item_finish"
             | "metadata_state" | "missing_audio" | "record_count"
             | "audio_decode"
}
```

**Extraction rules** (conservative by construction; the evidence
standard mirrors the synchronous path at adapters.mjs:233-335):

1. Tokens are extracted only from structured fields: a batch-level
   `error` object's `code` / `status`; the single item's `error`
   object's `code` / `status`; the item candidate's `finishReason`;
   `promptFeedback.blockReason`. Each token is normalized
   (uppercase; non-`[A-Z0-9_]` runs collapsed to `_`; max 64 chars).
   **Raw provider message text will never be persisted, returned,
   or copied into any record** — free text is not evidence and may
   carry content this system does not store.
2. `kind:"policy_block"`, `outcome:"policy_block"` **only** on
   clear structured policy evidence: a normalized token equal to
   `PROHIBITED_CONTENT` or `POLICY_BLOCK`, or a block-reason token
   containing `PROHIBITED_CONTENT`. Missing audio alone, a generic
   failure state alone, and refusal-sounding free text are **not**
   policy evidence on this surface.
3. Batch-level or item-level error with an HTTP-like code/status:
   `kind:"provider_error"`, `outcome:"failed_known"`;
   `retryable:true` only for the transient class (5xx / `INTERNAL`
   / `UNAVAILABLE`); a 429-class code is `provider_error` with
   `retryable:false` (it is a terminal poll result, not a dispatch
   response; the day-cap consequence was already settled at the
   fence).
4. Metadata terminal states `FAILED` / `CANCELLED` / `EXPIRED`
   with no error object: `kind:"batch_terminal"`,
   `outcome:"failed_known"`, `retryable:true` (chain-level fresh
   submission eligibility per B-G1 §4.1(c); the dead provider job
   itself is never re-polled once its terminal bundle lands, §3.6).
5. Done-response shape failures: zero or >1 inlined records
   (`source:"record_count"`); exactly one record with no error and
   no audio and no policy signal (`source:"missing_audio"`);
   undecodable audio payload (`source:"audio_decode"`) —
   `kind:"response_shape"`, `outcome:"failed_known"`. Per B-G1
   §4.2, a named, terminal provider job whose product is unusable
   is a **known** failure of that submission, never an ambiguity:
   the submission's outcome is not in doubt. (This deliberately
   differs from the synchronous no-audio rule, where no durable
   provider job exists.)
6. Any other terminal error shape: `kind:
   "provider_error_unclassified"`, `outcome:"failed_known"`,
   `retryable:false`. Unclassified never means policy, and never
   means ambiguous.

**Landing in the attempt record.** The executor will copy only the
classification's bounded scalar fields into (a) the genstore
terminal bundle (§3.6.4) — attempt outcome `policy_block` iff
`classification.outcome === "policy_block"`, else `failed_known`;
(b) the execution detail receipt, using the diagnostics-whitelisted
keys (`code`, `reason`, `detail`, `blockReason`, `finishReason` —
service.mjs:1544-1547) so the existing operator diagnostics surface
can show them with no new read path; and (c) the report detail
(`{batchState, classificationKind, providerCode, blockReason,
finishReason, retryable}` — scalars only).

**Acceptance evidence.** Family BG2-E (§6): every rule above has a
synthetic-fixture test, including the negative pins — no-audio
without policy signal is never `policy_block`; an error object
with an unrecognized shape is never `policy_block`; success and
not-done returns are byte-identical in shape to today's.

### 3.3 The D6 Batch execution path (queue dispatch)

**Entry shape.** `createD6Executor` will gain a Batch branch inside
`handleMessage`. Refusal layer 2 (job lane not in
`D6_LANE_ALLOWLIST`, d6-executor.mjs:688-689) **will remain
verbatim** — it is the lane law. Layers 1 and 3 will change from
unconditional refusal to a lane check: a batch payload on a job
whose lane is **not** admitted still returns
`{refused:"lane_not_allowed"}` before any claim or provider
contact; a batch payload on an admitted batch job enters the
branch. (On the B-G2 candidate as shipped — allowlist
`["standard"]` — every batch dispatch still refuses; §3.13.)

**Shared scaffolding (unchanged, lane-blind).** Claim first
(`claimGrant`); completed / closed / unknown grants drop the
message; another consumer's claim stands down. The Workstream A
pre-claim fences (strict plan resolution, quarantine hold,
plan-state fence) run exactly as for Standard, before the branch
diverges. Per occurrence, state is re-read fresh.

**Per-occurrence state dispatch.** For each granted occurrence of
a batch job, the branch will act on durable state, in this order:

1. **Existing non-terminal execution** in `synthesized` /
   `flushed` / `verified` → the existing recovery tail
   (`verifyAndCommit` / `reenterFlush`), shared with Standard.
   Never a poll, never a submission.
2. **Live (non-superseded) batch map** for (job, occurrence):
   - `submitted` → the shared poll step (§3.6.4), at most once in
     this message.
   - `ambiguous` → no action; the occurrence is blocked (§3.10.1).
   - `rejected` / `closed` → skip; terminal for this job and
     generation.
   - `fenced` → convert with `noteBatchAmbiguous(detail:
     "fence_without_outcome")`; **never post on a fence alone**.
3. **No live map** → the ambiguity gate, then the fence bundle:
   - If **any** latest-generation map of this job is `ambiguous`
     (including one with an open multiple-match adjudication,
     §3.10), the branch will make **no new submission** for this
     job in this message: outcome
     `{skipped:true, reason:"batch_ambiguity_open"}`. Already-
     `submitted` siblings were handled at step 2 and are
     unaffected.
   - Otherwise, the fence + accounting bundle (§3.4) runs; on
     success the POST follows (§3.5).

**Preflight (before any fence write).** The branch will refuse,
with no execution, intent, map, attempt, or dispatch row written:
payload provider not `gemini` → outcome
`{skipped:true, reason:"batch_provider_unsupported"}`; model not
matching the adapter's gate regex → `{skipped:true,
reason:"batch_model_unsupported"}`. (The adapter is Gemini-only for
Batch; a non-Gemini voice on a batch job is a configuration fact,
not a provider rejection, and must never be fenced or counted.)

**Cohort report rule (SPECIFICATION CHOICE, Batch only).** The
Standard message-end rule — report whenever results or commits
exist — will **not** apply to a Batch grant while any occurrence
of that grant's cohort (the durable outbox payload's occurrence
list) still holds a live `fenced` / `submitted` / `ambiguous`
map. Terminal outcomes are staged durably (§3.6.4) and reported
only when the cohort completes (§3.6.5). Reason: `handleReport`
returns unreported `granted` occurrences to `pending` at grant
closure; a deferred `submitted` occurrence would lose the granted
state `commitVerified` requires, orphaning a live provider job.
Standard messages are untouched by this rule.

**Acceptance evidence.** Families BG2-X and BG2-S: state-dispatch
coverage for every row above; the preflight refusals write zero
rows; the cohort rule is proven by a two-occurrence grant in which
one occurrence terminals while the other's map is `submitted`
(no report, no deferral, sibling still pollable).

### 3.4 The fence + accounting bundle (D-1 / B1)

The full protocol is §4. In brief: the bundle is **one synchronous
`coord._tx` callback** (SPECIFICATION CHOICE — the coordinator's
re-entrant transaction, coordinator.mjs:717-721, is the grouping
the source already provides) containing, in order: execution
create/reuse and `attempted` transition; spend-intent acquisition;
attempt reservation (upper bound `upperBoundAttemptMicro(chars)`);
`fenceBatchSubmit`; and `markDispatching` — whose existing
transaction body runs `applyDispatchQuota` (dispatch-ledger row,
reservation slot increment, possible day-rollover re-reservation)
and stamps the attempt `dispatching` with its Pacific-Time day
key. No `await` and no provider call may occur inside the
callback. Any refusal returned by a step (intent not acquired,
fence refused) will be converted by the bundle into a thrown
refusal so the whole bundle rolls back; quota refusals propagate
as thrown `QuotaBudgetRefusal`s, as today. The bundle will
additionally require `quotaArmed(coord)` to be true before the
first write: on an unarmed store it will refuse
`batch_quota_unarmed` and write nothing — a Batch submission may
never exist without its dispatch ledger (D-1). The POST may be
attempted only after the bundle's transaction returns committed.

**Acceptance evidence.** Families BG2-F and BG2-C: statement-level
fault injection at every write inside the bundle proves all-or-
nothing; the ledger assertion (exactly one dispatch row, one
consumed slot, one `dispatching` attempt, one `fenced` map, one
open intent, all sharing one fence timestamp's day key) is read
back from the tables, never from logs.

### 3.5 Submit-outcome handling

After the bundle commits, the branch will call
`providers.submitBatch(occ, displayName)` exactly once for that
fence generation, and handle the outcome as follows:

| Outcome | Durable response | Report |
|---|---|---|
| Accepted, valid `batches/…` name returned | `noteBatchSubmitted` (persists the provider name at once), then one immediate shared poll (§3.6.4) in the same message | Per poll result |
| HTTP error (a response was received) | Known-outcome bundle (§3.6.4's transaction shape): `noteBatchRejected` + `noteSpendOutcome(failed_known)` + attempt confirmed `failed_known` cost 0 + execution failed at stage `submit` | `provider_error` with `{httpStatus, batch:true}`; if the error carries the adapter's quota marker (Gemini 429), `daily_limit` with `{quotaExceeded:true, httpStatus}` and the message stops, mirroring Standard; `retryable` marker for HTTP 500/502/503 |
| Accepted but no valid name (adapter's 502 `noRetry` throw) | The adapter will mark this error distinctly (`batchAcceptedUnnamed: true`, code `batch_accepted_unnamed`) and the branch will check that marker **before** the HTTP branch: `noteBatchAmbiguous(detail:"accepted_unnamed")`; attempt stays `dispatching`; intent stays open | None |
| Transport-unknown throw (no HTTP status, no marker) | `noteBatchAmbiguous(detail:"submit_transport_unknown")`; attempt stays `dispatching`; intent stays open | None |
| `GenerationHaltedError` from the adapter's halt assert | No map transition, no outcome note; the message stops. (The fence stands; a later pass treats a still-`fenced` map under the `fence_without_outcome` rule — conservative, bounded to one counted dispatch, and visible. See §8, open item O-4.) | None |

A known-outcome bundle that fails validation (e.g. the map is no
longer `fenced`) will roll back whole; the occurrence then takes
the ambiguity path on its durable state rather than claiming
knowledge from memory.

**Acceptance evidence.** Family BG2-X: one test per table row,
asserting map state, intent outcome, attempt phase/outcome/cost,
execution state, and provider-call count from the stub's record.

### 3.6 The poll driver

#### 3.6.1 Placement and authority

The build will add a `pollBatchPass({passToken})` method to the
D6 executor. The production entry's `alarm()` will construct the
executor with the same dependencies `_execute` uses
(providers, flush store, cache, work source, consumer id) and
invoke `pollBatchPass` **once**, after the containment gate and
`service.recover()`, before `service.driveOnce()`. The entry will
generate one pass token per alarm invocation and merge the poll
outcomes into the recorded pass outcomes as plan-shaped entries
using only the recorder's existing allowlisted scalar keys
(`planId`, `state`, `stopReason`, `grantId`) — per-map evidence
lives in the poll-observation records (§3.6.3) and the inventory
surface (§3.12), not in the recorder.

Authority: the poll step is a **continuation of an already-fenced
submission**, not a new dispatch. It will act only on a map whose
original grant is not `reported` / `voided` / `superseded` and
whose claim row stands `claimed` by this executor's consumer id.
It never acquires an intent, never fences, and never submits —
except the bounded submission continuation of §3.6.6. While
`GENERATION_HALT` is not `"0"`, or while containment suppresses
the drive, `pollBatchPass` will not be invoked at all (the entry's
existing gates stand in front of it), and the adapter's own halt
assert remains as the second layer.

#### 3.6.2 Selection

Per pass, in deterministic order (map `updated_at`, job id,
occurrence id), the driver will consider every latest-generation,
non-superseded map where:

- the job's lane is `batch` and the job is not in a terminal,
  cancelled, superseded, or `parked_policy` state;
- a linked plan, if any, is not `complete` / `partial` /
  `retired` / `halted_unknown` and is not quarantine-held (a read
  fault on the hold check excludes the map for this pass, D8-1
  discipline);
- the linked execution is non-terminal and the linked attempt is
  in phase `dispatching` (a map without this linkage is not
  polled; it is classified `batch_poll_linkage_missing` on the
  inventory surface — a corruption signal, never silently
  adopted into the driver);
- the occurrence state is `granted` (custody, §3.7).

Each selected `submitted` map is polled **at most once per pass**.
A map whose attempt is already confirmed, or whose execution is
`committed` / `failed`, is terminally consumed (§3.6.4) and is
never polled again, whatever the map state says — the map state
machine gains no terminal-success state, so terminal consumption
is **derived** from attempt + execution + occurrence state.

#### 3.6.3 Observation records and the D-4 parameters

Poll history must be durable: pass-recorder rows are bounded and
pruned (retention 288), so they cannot carry a 12-pass stall
count. The build will therefore keep, in the genstore, two lazily
ensured tables beside their only writer (the house pattern of the
reconcile-audit and adjudication schemas — never part of the
pinned bootstrap set):

- `d6_batch_poll_state` — one row per (job, occurrence,
  generation): `provider_name`, `submitted_observed_at` (first
  observation of the `submitted` state), `last_pass_token`,
  `last_observed_at`, `last_provider_state`,
  `consecutive_no_progress_passes`, `classification`,
  `classification_since`, `ambiguity_since`.
- `d6_batch_poll_observations` — one row per (pass token, job,
  occurrence, generation): `phase` (`started` / `completed`),
  provider state, outcome class, progress flag, classification,
  poll-error name. A `started` row is written in its own
  transaction **before** the provider GET; the completion update
  and the poll-state counter advance in one transaction after
  it. A crash during the GET leaves a `started` row: the pass
  counts as attempted, the no-progress counter does **not**
  advance, and no accounting state has moved.

The pinned parameters (gen-constants.mjs, new constants):
`BATCH_EXTENDED_LATENCY_MS = 3_600_000` (1 hour),
`BATCH_STALL_PASSES = 12`, `BATCH_STALL_AGE_MS = 21_600_000`
(6 hours), `BATCH_AMBIGUITY_ESCALATION_MS = 86_400_000`
(24 hours) — exactly D-4's fixed values.

Classifications, computed per map per completed pass:

- **BATCH-IN-FLIGHT** — `submitted`, non-terminal, age below the
  extended-latency bound. No outcome beyond the poll record.
- **BATCH-LATENCY-EXTENDED** — age ≥1 hour without a terminal
  state. Informational; named on the pass outcome.
- **BATCH-STALLED** — ≥12 consecutive observed passes without
  progress **and** age ≥6 hours. Progress means: a provider-state
  change, a map transition, or a terminal outcome, recorded on an
  observed pass. Effect: escalation visibility only (pass outcome
  + inventory). The plan is not auto-halted, the job is not
  failed, the provider job is not abandoned. Any later progress
  clears the classification.
- **BATCH-AMBIGUITY-OPEN** — an `ambiguous` map aged ≥24 hours.
  The driver records the classification (no provider call — an
  ambiguous map has no name to poll); adjudication (§3.10) is the
  only action it calls for.
- **NO-PASS-OBSERVED** — never emitted by the driver itself (a
  driver cannot observe its own absence). The inventory surface
  (§3.12) will report `lastDrivePassAt` (from `d6_drive_passes`)
  alongside outstanding maps so the observation layer can name
  chain non-observation; no D-4 threshold attaches to it, and it
  is never classified as a provider stall. While no pass is
  observed, no poll occurs, no spend occurs, and no stall clock
  advances — Batch correctness rests on durable rows, not alarm
  punctuality.

Duplicate invocation with the same pass token will not double-
count: the observation primary key makes the second invocation a
no-op for that map.

#### 3.6.4 Poll result handling and terminal bundles

The shared poll step (used by the queue branch's immediate poll,
by continuation polls, and by the drive-pass driver — one
implementation, three callers):

1. `providers.getBatch(providerName)` throws → pending,
   `pollError` recorded on the observation; **no** map, intent,
   attempt, or execution state changes.
2. Not done → pending; the provider state string is recorded
   (the stall test's progress signal).
3. Done + success → the terminal-success bundle, then the shared
   commit tail (§3.8).
4. Done + terminal failure → classification first (§3.2), then
   the terminal-failure bundle.

A **terminal bundle** is one synchronous `coord._tx` containing:
validation that the map is still `submitted` with the same
provider name and generation, the attempt still `dispatching`,
the execution still `attempted`; `confirmAttempt` (success →
outcome `success`, cost `knownCostMicro(durationSec)`,
providerRequestId = provider name; policy → outcome
`policy_block`, cost 0; other failure → outcome `failed_known`,
cost 0); `noteSpendOutcome` (success → `success`; failure →
`failed_known` with the batch state + classification kind as
detail); the genstore terminal-receipt write (execution detail:
provider name, batch state, classification scalars, duration,
cache key — idempotent on an identical receipt, refusing
`batch_terminal_receipt_conflict` on a differing one); and, for
failures, `failExecution` at stage `batch_policy_block` or
`batch_provider_error`. The map state does not change — terminal
consumption is derived (§3.6.2). If the bundle finds the attempt
already confirmed with the **same** outcome, it returns
`already_applied` and the caller proceeds from the receipt; a
different confirmed outcome is `batch_accounting_conflict` and
fails closed.

#### 3.6.5 Cohort completion and reporting

After processing its maps, the driver (and the queue branch, at
message end) will, for each touched grant, test cohort
completion: every occurrence in the grant's durable outbox
payload is in a durable terminal state (occurrence `ready` with
execution `committed`; or occurrence still `granted` with a
terminal bundle landed — attempt confirmed and execution
`failed`). If the cohort is incomplete, nothing is reported
(§3.3's cohort rule). If complete, the driver will call
`handleReport` **once** for that grant with the reconstructed
non-success results in cohort order (successes are never
re-reported, per the standing D6 rule); `handleReport` then
closes the grant, completes the claim, settles reservations,
derives job completion, and runs the repair follow-on seam
(§3.9) exactly as for Standard. A crash between a terminal
bundle and this report is recovered at the next pass: the driver
re-derives the same results from attempt + execution rows
(`terminal_unreported` recovery) and reports without polling.

#### 3.6.6 Submission continuation

Adoption (§3.10) can unblock a job mid-flight. On each pass,
after submitted-map polls and ambiguity classification, the
driver will, for each job whose original grant claim still
stands with this consumer, which has **no** `ambiguous` map, and
which has `granted` occurrences with no live map, run those
occurrences through the same queue-branch path (preflight →
fence bundle → POST → immediate poll), staging outcomes under
the cohort rule. This is a continuation of the existing claimed
grant, not a new grant: no `requestGrant`, no new reservation
cohort (the fence bundle's `applyDispatchQuota` consumes the
grant's existing reservations, re-reserving only on day
rollover, exactly as a first dispatch would).

**Acceptance evidence (§3.6 overall).** Families BG2-X, BG2-P,
BG2-C: poll cadence (≤1 per map per pass, proven from the stub's
call log across simulated passes); classification boundaries at
exactly the D-4 values on a fake clock; the terminal-bundle
atomicity cases; cohort completion and `terminal_unreported`
recovery; continuation after adoption with zero duplicate
submissions.

### 3.7 Lease custody (source-derived prerequisite)

**The problem, from source.** A grant leases for 15 minutes
(coordinator.mjs:463). Batch's normal latency exceeds that: the
extended-latency parameter alone is 1 hour. Under the current
lease handler, a still-`granted` occurrence of an expired,
delivered grant transitions to `outcome_unknown` — which would
destroy every long-running Batch submission's custody before its
second poll, and `commitVerified` cannot commit an
`outcome_unknown` occurrence. B-G1's drive-pass polling design
is unbuildable without answering this; the answer is specified
here and flagged for Rowan's review as a source-derived addition
to the B-G1 flow (open item O-2).

**The specified change (coordinator lease handler only).** Before
applying `lease_expired` to an occurrence, the handler will test
a **Batch-custody predicate**: the occurrence's latest map is
non-superseded in state `fenced` / `submitted` / `ambiguous`,
its generation's attempt is in phase `dispatching`, its
execution is non-terminal, and the map's grant is this grant.
A custody occurrence is **excluded** from the newly-unknown set.
If a grant has at least one custody occurrence and no
non-custody occurrence became unknown, the handler will
reschedule the lease at `now + LEASE_MS` (exactly one pending
lease row — the processed row is consumed, never duplicated)
and leave the grant and occurrences untouched. Mixed grants keep
today's behavior for their non-custody occurrences exactly.
No Standard occurrence can satisfy the predicate (it requires a
batch map), so Standard lease behavior is unchanged by
construction. Custody tolling performs no provider call and is
therefore safe in every halt and containment state; it preserves
custody through a silent chain (W-4) exactly as it does through
a live one.

**Acceptance evidence.** Family BG2-P: lease expiry with a
`submitted` map leaves occurrence, job, grant, attempt, and
reservation byte-identical except the rescheduled lease row;
a Standard grant in the same store expires exactly as today;
a map whose attempt is confirmed (terminally consumed) does
**not** toll.

### 3.8 The shared commit tail

A terminal-success poll's audio will enter the executor's
existing post-synthesis tail — the same code path Standard uses
after `runFresh` obtains audio: transition `synthesized` →
flush via `flushStore.flushAndVerify` → transition `flushed` →
transition `verified` → `store.commitVerified` → binding-
projection note. The build will factor that tail so the Batch
path calls it with `{audio, format, durationSec, payload}` rather
than duplicating binding logic. Discipline:

- The payload is re-read through the work source at commit time;
  its fingerprint is the cache key, exactly as Standard. If the
  work source cannot produce the payload, the receipt stands,
  the outcome is classified `batch_terminal_payload_unavailable`,
  and no report is staged — the next pass retries from the
  receipt (re-polling the same provider job to re-obtain the
  audio is retrieval, not resubmission; the terminal bundle is
  already landed and returns `already_applied`).
- A crash before the flush: execution still `attempted` with a
  landed receipt → re-poll and proceed (above). A crash after
  the object is durable: the execution's recorded state
  (`synthesized` / `flushed` / `verified`) drives the existing
  recovery tails; the provider job is **not** re-polled into a
  second commit, and `commitVerified`'s idempotence is the
  second layer.
- A `FlushError` fails the execution at its stage and stages a
  `provider_error` report with `{stage, code}` — a local stage
  failure, exactly as Standard stages it; the attempt's known
  success cost stands (the provider did synthesize).

**Acceptance evidence.** Family BG2-X: success commit produces
exactly one binding, one projection, one settled cost from the
actual duration; crash points CW-18…CW-22 (§4.3) each recover
with no second binding and no second submission.

### 3.9 Standard-lane repair for Batch POLICY_BLOCK (D-3)

**The change (coordinator.mjs:2536, narrow).** When
`handleReport` creates follow-on repair jobs for a parent job
whose lane is `batch`, the follow-on occurrences will be
**partitioned by this report's results**: occurrences whose
result outcome is `policy_block` go to a follow-on job created
with `lane: "standard"` and data carrying `chainParent`,
`parentLane: "batch"`, `laneDeviation:
"batch_policy_block_standard"`, `followOnClass: "policy_block"`;
all other follow-on occurrences keep the inherited parent lane
exactly as today (`followOnClass: "other"`). Follow-on ids are
allocated deterministically in that order (policy subset first)
from the existing `${jobId}:follow:` sequence; each applied
follow-on is granted in the same transaction, and a grant
refusal leaves that follow-on queued without affecting the
other — precisely today's per-follow-on behavior. For a
non-batch parent, the code path is byte-equivalent to today's:
one follow-on, inherited lane, no new data keys asserted by
tests beyond the absence of the deviation marker.

**Boundaries.** This seam governs follow-on creation from an
existing `kind:"repair"` parent — the only place :2536 acts. It
does not change `RequestRepair` admission, does not create the
first repair job for an original job, and does not alter the
shared budget accounting: batch submission and Standard repair
attempts count in one `segmentAttemptsUsed` derivation over the
same plan linkage the existing chain uses, bounded by
`SEGMENT_ATTEMPT_BUDGET = 12` and `REPAIR_MAX_RETRIES = 3`
(gen-constants.mjs:16-20). The deviation introduces no new
budget check and bypasses none. Only a `policy_block` report
result can route an occurrence to the Standard subset — a
`provider_error` result from a batch parent can never take the
deviation. F3 entry itself happens on the Standard lane: the
follow-on job's dispatch runs the existing inline
`synthesizeSegment` / `synthesizeLongSegment` split machinery
(generation/policy-split.mjs; depth ≤4, floor 50 chars) in the
Standard executor path.

**Scope note (flagged, §8 O-3).** The cited seam creates
follow-ons from repair parents. If Rowan intends B-G2 to also
originate the *first* repair job for an original batch job's
blocked occurrence, that origination point is not :2536 and is
not specified here; the classification surface (§3.2) and the
`policy_block` report it feeds are specified either way.

**Acceptance evidence.** Family BG2-R: a batch repair parent
reporting one `policy_block` and one `provider_error` follow-on
produces exactly two follow-on jobs with the lanes and data
above; a standard parent produces exactly today's shape; the
Standard follow-on's split leaves commit through the shared
machinery with exactly one binding for the occurrence; the
combined attempt count across lanes never exceeds 12.

### 3.10 Ambiguity, multiple matches, and adjudication (D-2 / D-6 / B2)

#### 3.10.1 The block

While any latest-generation map of a job is `ambiguous`, that
job makes no further Batch submissions (§3.3 step 3). Already-
`submitted` maps of the job continue to poll and commit. The
block is per-job; Standard and other jobs are unaffected. The
spend intent of an ambiguous map stays open with no outcome
noted; its attempt stays `dispatching`, so phase accounting
carries it at upper bound as in-flight exposure from the moment
it fenced; its dispatch stays counted exactly once.

#### 3.10.2 Adjudication records

The build will add two lazily ensured tables beside their writer
in coordinator.mjs, presence-checked on every read with the
house discipline (both absent → no adjudications; exactly one
present → throw `batch_adjudication_schema_inconsistent`; reads
never create them):

- `d6_batch_adjudication_runs` — one row per enumeration run:
  run id, job, occurrence, generation, at, `authorization_ref`,
  outcome (`no_match` / `adopted` / `multiple_match_block` /
  `single_match_name_invalid`), match count, **every returned
  provider identifier** (JSON array, verbatim), an
  `enumeration_may_be_incomplete` flag (set when the adapter's
  100-row page is full), and the duplicate-exposure report
  (§3.10.3) for multi-match runs.
- `d6_batch_adjudications` — at most one **open** record per
  (job, occurrence, generation): adjudication id, status
  (`open` / `adopted`), latest run id, the preserved identifier
  set, the exposure report, and on resolution the selected
  provider name, resolution `authorization_ref`, evidence
  reference, and timestamp. Unselected identifiers are retained
  permanently; no code path deletes either table's rows.

#### 3.10.3 Duplicate-exposure report (shape)

For a run returning `n ≥ 2` matches against one fence:

```
{
  providerJobsObserved: n,
  countedDispatches: 1,
  ledgeredUpperMicroCents: <the fence attempt's upper bound>,
  maximumProviderJobsUpperMicroCents: n × <upper bound>,
  unledgeredDuplicateUpperMicroCents: (n − 1) × <upper bound>,
  basis: "upper_bound_scenario_not_a_charge_claim"
}
```

The report is an upper-bound **scenario**, recorded verbatim on
the run and the open adjudication. It writes no dispatch row,
moves no counter, and settles nothing. If the fence attempt or
its upper bound cannot be read, the run is recorded with the
exposure fields null and reason
`batch_exposure_unavailable` — never zero-filled.

#### 3.10.4 The adjudication procedure (the only exits)

Exits from `ambiguous` are exactly: **adoption** (below) — and
nothing else. Never-accepted resolution is not wired:
`verifyNeverAcceptedEvidence` continues to throw, no route
exposes `resolveBatchNeverAccepted`, and no flow in the build
may depend on a never-accepted assertion.

The shared adjudicator (coordinator-side, called only by the
operator route of §3.11) will:

1. Load the map; if it is not `ambiguous`, return its current
   disposition (`already_submitted` with the provider name,
   `not_ambiguous` otherwise) — no enumeration, no run record.
   Repeated calls are therefore idempotent in effect.
2. Enumerate once via `listBatchesByDisplayName(map.display_name)`.
   The adapter's match shape will be hardened: every returned
   match carries its name **verbatim** plus a `nameValid` flag
   (the existing `^batches/[A-Za-z0-9_-]+$` test); an invalid
   name is preserved, counted, and never adoptable.
3. Process the result in **one** `coord._tx` (run record +
   any adoption + any adjudication update commit or roll back
   together):
   - **0 matches** → run recorded `no_match`; nothing else
     changes. Return `{resolved:false,
     reason:"batch_no_match_not_terminal"}` (the legacy reason,
     retained). A no-match never establishes non-acceptance.
   - **1 match, valid name, no open adjudication** →
     `adoptBatchByLookup` with evidence
     `display_name:<displayName>`; run recorded `adopted`.
     Polling resumes on the next pass; the attempt remains the
     same `dispatching` attempt; no new dispatch is counted.
   - **1 match, invalid name** → run recorded
     `single_match_name_invalid`; map stays `ambiguous`; an
     open adjudication is created carrying the preserved
     (invalid) identifier; only §3.10.5's route can move it,
     and it cannot select an invalid name — the record stands
     as the visible terminal-for-now state.
   - **≥2 matches** → run recorded `multiple_match_block`; the
     open adjudication is created or updated with **all**
     identifiers and the exposure report; the map stays
     `ambiguous`; **nothing is adopted**. Creation-time ordering
     is not consulted (the adapter returns no creation time,
     and ordering would not be proof in any case — D-6).
   - **An open adjudication already exists** → no automatic
     adoption on any later enumeration, even a single-match
     one; the run updates the record's latest evidence and the
     case proceeds only through §3.10.5.

#### 3.10.5 The adjudication decision route's store act

A separate operator act (§5) resolves an open adjudication:
in one `coord._tx`, it will validate that the record is open,
the map is still `ambiguous` at the same generation, and the
selected provider name is a member of the preserved identifier
set and `nameValid`; then `adoptBatchByLookup` with evidence
`batch_adjudication:<adjudicationId>`, and the record is marked
`adopted` with the selection, the call's `authorizationRef`,
and the caller's evidence reference. Repeating the act with the
same selection after success returns `already_applied`;
attempting a different selection returns
`batch_adjudication_already_resolved`. The act records an
operator decision and its stated basis; it does not assert
that the selected job is provably the original submission —
that distinction stays visible on the record.

**Acceptance evidence (§3.10 overall).** Family BG2-M: no-match
byte-identical state; single-match adoption and poll resumption;
multiple-match block with every identifier preserved and the
exposure report exact; no code path — including a direct call
of the legacy export — adopts on multiple matches; the block
lifts only through the decision route; a caller-supplied name
outside the preserved set is refused with zero writes.

### 3.11 Operator reconciliation wiring

The legacy `reconcileBatch` procedure gains its operator entry
as specified in §5: `POST /v2/d6-batch-reconcile` invoking the
shared adjudicator of §3.10.4 for exactly one (jobId,
occurrenceId), and `POST /v2/d6-batch-adjudicate` invoking
§3.10.5. Both follow the house operator pattern (§2): migration-
operator credential at the public gate, operator-admitted stamp
re-checked at the class gate, closed-allowlist bodies with a
required nonblank `authorizationRef`, the recorded source
stamped server-side (`"operator-route"`), and an audit row (the
run record) written in the act's own transaction. Both are
idempotent (§3.10.4 step 1; §3.10.5). Neither route performs a
halt check of its own — the adapter's `assertGenerationEnabled`
is the halt law for the enumeration read, exactly as S10 of
B-G1 designs; while halted, enumeration throws before provider
contact and the route surfaces `generation_halted`. Exercising
either route against production remains a separate authorization
per act, as with every operator route in this system.

### 3.12 Inventory and rollback support (D-5)

**Read surface.** `GET /v2/d6-batch-inventory` (operator-only,
§5) will be SELECT-only: it performs no provider call, writes
nothing, and creates no table (adjudication presence is checked,
never ensured, on this path). It returns, keyset-paginated by
(job_id, occurrence_id, generation) with exact totals and an
explicit truncation/next-cursor discipline mirroring the quota-
reconcile route:

- Per map row (all generations): job, occurrence, grant,
  generation, display name, provider name, state, detail,
  `updated_at`, `superseded_at`; the linked intent outcome; the
  linked execution state; the linked attempt (id, phase,
  outcome, upper bound, settled cost, dispatch day key); the
  dispatch row's identity; the reservation (id, state,
  slots total/consumed); any open adjudication id; and the
  derived `custody` class: `provider_custody` (non-superseded
  `fenced` / `submitted` / `ambiguous` with a `dispatching`
  attempt), `terminal_consumed`, or `closed_history`.
- Summary over **all** rows, not the page: counts by state;
  `countedDispatches` (distinct dispatch rows joined to map
  generations); `outstandingUpperMicroCents` (upper bounds of
  `provider_custody` rows); `duplicateUnledgeredUpperMicroCents`
  (summed from open adjudications); `knownSettledMicroCents`
  (confirmed costs of terminally consumed maps);
  `lastDrivePassAt` and the outstanding-map count (§3.6.3's
  chain-non-observation facts).

**Rollback invariants (what the code must NOT do).** The build
will contain: no deletion of `batch_maps`, `spend_intents`,
attempt, dispatch, reservation, execution, transition, poll, or
adjudication rows; no `abandoned` map state and no transition
that manufactures one; no rollback, restore, or inventory code
path that calls `submitBatch`, `getBatch`,
`listBatchesByDisplayName`, or `resolveBatchNeverAccepted`; no
settlement of a map's exposure by any act except the terminal
bundle (§3.6.4) and the existing operator accounting machinery.
A rolled-back (Standard-only) build leaves maps untouched
because it has no batch branch; a restored Batch-capable build
resumes from the durable rows — `submitted` → poll, `ambiguous`
→ block, `fenced` → `fence_without_outcome` conversion, never a
resubmission (§3.3). One boundary is stated plainly: after any
Batch map exists, a rollback target **without** the §3.7 custody
predicate and this inventory surface (e.g. the permanent floor
build `6a73d962…`) does not preserve Batch custody semantics —
its lease handler can move a custody occurrence to
`outcome_unknown` (visible, never silent, and the map and
exposure rows survive), so B-G4's rollback plan must name a
custody-aware target or rule on that consequence explicitly.
This specification does not claim the floor build is a safe
Batch rollback target.

**Acceptance evidence.** Family BG2-B: inventory before and
after a simulated rollback + restoration is identity- and
accounting-equivalent (observation timestamps excepted);
restoration submits nothing; every NOT-do invariant is pinned
by a source-level test (the candidate tree is searched for the
forbidden call/delete shapes on the named paths) plus the
behavioral tests.

### 3.13 The allowlist flip is NOT in this build (inertness)

`D6_LANE_ALLOWLIST` will remain `Object.freeze(["standard"])`.
The build's inertness property, which §6 family BG2-S must
prove on the candidate tree as shipped: with the candidate code
in place, (a) a Batch intent is refused `lane_not_allowed` at
admission and capabilities report `batch_not_armed`; (b) a
Batch dispatch message, a Batch-lane job, and a Batch work
payload are each refused `lane_not_allowed` with zero provider
calls, zero map rows, zero attempt rows, and zero dispatch rows;
(c) the new operator routes exist but, against a store with no
Batch maps, every act is a no-op refusal (`not_ambiguous` /
`batch_adjudication_not_found`) and the inventory reads empty;
(d) the poll driver, invoked on a store with no Batch maps,
polls nothing and writes nothing. Batch behavior is exercised
in tests only by seeding Batch-lane jobs directly in the store
(bypassing admission), never by editing the constant in the
candidate tree.

---

## 4. The fence + accounting protocol (B1)

### 4.1 The ordered writes and their grouping

At the fence, "accounting" is four durable objects that must
agree: the **fence row** (`batch_maps`, state `fenced`), the
**dispatch ledger row** (`d6_provider_dispatches`), the
**attempt record** (`segment_attempts`, phase `dispatching`), and
the **quota reservation** (`d6_grant_reservations`,
`slots_consumed` incremented) — with the **spend intent** as
their common permit and the **execution record** as the commit
carrier. The grouping available today is the coordinator's
re-entrant `_tx` (nested calls join the outer transaction) over
`state.storage.transactionSync`; the protocol below is
**SPECIFICATION CHOICE**: the fence will be executed as one
outer transaction, using the existing synchronous helpers, in
this order:

| # | Write (existing helper) | Table / effect |
|---|---|---|
| W1 | `createExecution` (or reuse the live execution) | execution `granted`, attempt budget stamped |
| W2 | execution transition | execution → `attempted` |
| W3 | `acquireSpendIntent` | intent row, exactly-once permit |
| W4 | `reserveAttempt` | attempt `reserved`, upper bound recorded |
| W5 | `fenceBatchSubmit` | map `fenced`, `display_name`, grant provenance |
| W6 | `markDispatching` → `applyDispatchQuota` (may create the day-rollover reservation first) | dispatch row; reservation `slots_consumed` +1; attempt → `dispatching` with day key |

Rules of the bundle: no `await` inside; a refusal returned by
W1–W5 is converted to a throw so the bundle cannot half-apply;
quota refusals (including the segment-budget refusal surfaced
through the reservation check) propagate as thrown
`QuotaBudgetRefusal`s; the bundle requires `quotaArmed(coord)`
before W1 and refuses `batch_quota_unarmed` otherwise; the POST
is attempted only if the bundle's callback returns normally.

**Day-boundary rule.** The dispatch row, the slot, and the
attempt's day stamp all take the Pacific-Time day key computed
inside `applyDispatchQuota` at fence time. A submission POSTed
seconds after midnight PT still belongs to its fence day. That
is the B-G1 §2 decision made mechanical, and it matches how
Standard attributes a dispatch (the stamp is written at
`markDispatching` there too).

### 4.2 Why this order

W3 before W5 is forced by the source: `fenceBatchSubmit`
requires the latest spend intent to exist, be un-superseded, and
be consumer-matched. W5 before W6 is the D-1 rule: the durable
submission record precedes the act it counts. W6 last means the
only write that can refuse on budget grounds (the quota step)
is also the one whose refusal most cleanly aborts the whole
fence — a quota-refused fence leaves **no** map, intent,
attempt, or dispatch row, which is exactly the Standard
property the ruling's B1 asks B-G2 to match ("reconciles
identically", §4.4 I-6).

### 4.3 Crash-window enumeration

A **window** is a point where a process death (or an injected
fault with the same durable effect) can leave the system between
two specified steps. Recovery is always by a named actor on
durable state: the next drive pass, the next queue message, the
lease handler, the operator routes, or the inventory surface.
Twenty-nine windows are specified: CW-01…CW-23 (main flow),
AW-01…AW-05 (adjudication), FW-01 (repair follow-on).

| Window | Durable state at the window | Detection | Recovery rule |
|---|---|---|---|
| CW-01 | Claim committed; no fence bundle yet | Next message / pass sees the granted occurrence with no execution, intent, or map | Run the bundle from the top (nothing to reconcile) |
| CW-02 | Inside bundle, after W1 | — (uncommitted) | Transaction rolls back: no execution row survives. Next pass = CW-01 |
| CW-03 | Inside bundle, after W2 | — | Rolls back to the pre-bundle execution state (or absence) |
| CW-04 | Inside bundle, after W3 | — | Rolls back: no intent survives; the permit was never spent |
| CW-05 | Inside bundle, after W4 | — | Rolls back: no attempt survives |
| CW-06 | Inside bundle, after W5 | — | Rolls back: no map survives; nothing was counted |
| CW-07 | Inside bundle, at the rollover-reservation creation inside W6 | — | Rolls back with the bundle; the new-day reservation is recreated atomically on retry |
| CW-08 | Inside bundle, after the dispatch-row insert, before the slot increment | — | Rolls back both; `reconcileQuota` sees no drift because neither half survives |
| CW-09 | Inside bundle, after the slot increment, before the attempt's day stamp | — | Rolls back all three W6 effects together |
| CW-10 | Bundle committed; POST not started | Next pass/message: map `fenced`, attempt `dispatching`, no outcome | **Convert, never post**: `noteBatchAmbiguous("fence_without_outcome")`; adjudication is the only exit. The dispatch stays counted (D-1's ≤1 over-count, self-identifying: §4.4 I-3) |
| CW-11 | POST in flight; provider outcome unknown | Same durable shape as CW-12 | Indistinguishable from CW-10/CW-12 by construction → the ambiguous path (CW-12 rule) |
| CW-12 | Provider accepted; `noteBatchSubmitted` not yet written | Map still `fenced` with a counted dispatch and no provider name | Never resubmit. Convert to `ambiguous` (as CW-10); adoption by enumeration is the exit. The counted dispatch is *not* an over-count here — the provider job exists — but the system cannot tell CW-10 from CW-12, so both take the conservative path and the inventory exposes the ambiguity, not a guess |
| CW-13 | HTTP rejection received; known-outcome bundle not yet written | Map `fenced`, attempt `dispatching`, no outcome in memory survives | The known result died with the process. Recovery treats the fence as CW-10/CW-12 (ambiguous path) — fail-closed: a rejection the system can no longer prove is never claimed as known |
| CW-14 | Map `submitted`; no poll yet in this pass | Poll-state row absent/stale | Next pass polls (≤1 per pass). No accounting state can move |
| CW-15 | Poll GET in flight | Observation `started` row without completion | Pass counts as attempted; no-progress counter does not advance; no business state changed |
| CW-16 | Terminal response received; terminal bundle not yet written | Map `submitted`, attempt still `dispatching` | Next pass re-polls the same provider job (retrieval, not resubmission) and lands the bundle then |
| CW-17 | Inside the terminal bundle | — (one transaction) | All-or-nothing: map/intent/attempt/receipt/execution move together or not at all |
| CW-18 | Terminal success landed; flush not started | Receipt present; execution `attempted` | Re-poll to re-obtain the audio (bundle returns `already_applied`), then the commit tail |
| CW-19 | Flush object durable; execution transitions incomplete | Execution `synthesized` (or object present, state behind) | Existing recovery tails (`reenterFlush` / `verifyAndCommit`); never re-synthesize, never re-poll into a second commit |
| CW-20 | Execution `verified`; commit not yet run | Execution `verified` | `commitVerified` runs from recorded state; idempotent |
| CW-21 | Inside `commitVerified` | — (existing transaction) | All-or-nothing, as today |
| CW-22 | Commit landed; binding-projection note not yet written | Binding row present; projection pending | The existing projection sweep publishes it (idempotent, self-healing); no Batch action |
| CW-23 | Cohort terminal; `handleReport` not yet sent | Attempts confirmed + executions terminal; grant unreported | Next pass's `terminal_unreported` recovery reconstructs the report from durable rows and sends it once — no re-poll, no re-bind |
| AW-01 | Enumeration response received; run-record transaction not yet written | No run row | Nothing durable moved; the operator re-runs the act (idempotent) |
| AW-02 | Inside the single-match run + adoption transaction | — | Atomic: adoption and its evidence record land together or not at all |
| AW-03 | Inside the multiple-match run + adjudication transaction | — | Atomic: the block, all identifiers, and the exposure report land together or not at all |
| AW-04 | Inside the adjudicate transaction | — | Atomic: selection record and adoption land together or not at all |
| AW-05 | Adoption committed; next poll not yet run | Map `submitted` with the adopted name | Next pass polls normally; the attempt was never re-counted |
| FW-01 | Inside `handleReport`'s follow-on creation (existing single transaction) | — | The whole report rolls back; the message is redelivered and re-reported from durable state; no partial follow-on set can exist |

### 4.4 The invariant set (what the tests must prove)

- **I-1 — No executed submission is ever uncounted.** Every POST
  is preceded by a committed bundle containing exactly one
  dispatch row. (Proven structurally: the POST call site is
  reachable only after the bundle returns; and behaviorally:
  the stub's POST count never exceeds the dispatch-row count.)
- **I-2 — One fence, one count.** Per (job, occurrence,
  generation): at most one dispatch row, one consumed slot, one
  `dispatching` attempt. Polls, retrievals, and enumerations
  write zero dispatch rows.
- **I-3 — Over-count ≤1 per crash, and self-identifying.** The
  only over-count shapes are CW-10/CW-13 (counted, provably
  unsubmitted — indistinguishable from CW-12, hence the set is
  *suspects*, bounded by the number of crashed fences). A
  suspect is identifiable on sight: a non-superseded `fenced` or
  `ambiguous` map whose attempt is `dispatching` and which has
  no provider name. The inventory lists exactly these.
- **I-4 — Known-rejected stays counted.** A `rejected` map's
  dispatch row and slot are never released by any Batch act;
  the reservation closes only through the existing close
  vocabulary at grant settlement.
- **I-5 — Ambiguity never settles silently.** An `ambiguous`
  map's attempt remains `dispatching` and its exposure remains
  at upper bound in phase accounting until adoption + terminal
  bundle, or an operator accounting act outside this build.
  No Batch code path writes a cost, an outcome, or a settlement
  for an ambiguous map.
- **I-6 — Reconcile derives Batch identically to Standard.**
  `reconcileQuota` runs unchanged over Batch rows (there is no
  Batch-specific counter to drift): a clean Batch day reconciles
  `ok:true` exactly as a Standard day does, and each injected
  drift class is detected with the same names.
- **I-7 — Exactly-once commit.** Per occurrence, at most one
  binding row and one settled cost, across any interleaving of
  queue messages, drive passes, re-polls, and recoveries.
- **I-8 — The block is total per job.** While any map of a job
  is `ambiguous`, the count of new fence bundles for that job is
  zero; submitted siblings' polls and commits continue.
- **I-9 — Custody is preserved or loudly lost, never silently
  settled.** Under the candidate build, a custody occurrence
  never transitions to `outcome_unknown` while its map is live;
  under any build, no transition writes a cost or outcome for a
  provider job that may still be running beyond what the
  existing lease law already does (and that law's effect is
  visible in job state).

---

## 5. Interfaces and refusals

### 5.1 New operator routes (the only new surface)

Both POSTs and the GET follow the §2 house pattern exactly:
public predicates beside the existing operator routes in
`worker-entry-prod-d6.js`; admission on the migration-operator
credential alone; internal handlers under `/internal/d6/…`
re-checking the operator-admitted stamp; closed-allowlist JSON
bodies; `authorizationRef` required nonblank (≤2000 chars);
`note` optional (≤2000 chars); refusals returned as structured
`{ok:false, reason}` bodies with HTTP 200 unless noted, matching
the house style; the recorded source stamped server-side.

| Route | Body (closed allowlist) | Returns | Notes |
|---|---|---|---|
| `POST /v2/d6-batch-reconcile` | `{jobId, occurrenceId, authorizationRef, note?}` | `{ok:true, resolved, mapState, providerName?, runId, matches, exposure?}` or refusal | Invokes §3.10.4 for one occurrence. Idempotent (§3.10.4 step 1). While halted, the enumeration's halt assert surfaces `generation_halted` (403-class, house style) before any provider contact |
| `POST /v2/d6-batch-adjudicate` | `{adjudicationId, jobId, occurrenceId, selectedProviderName, authorizationRef, evidenceRef, note?}` | `{ok:true, adopted:true, providerName}` / `already_applied` / refusal | `evidenceRef` required nonblank (the operator's stated basis pointer). Invokes §3.10.5 |
| `GET /v2/d6-batch-inventory` | Query: `limit?` (default 50, max 100), `cursor?` | `{ok:true, rows:[…], summary:{…}, nextCursor, truncated}` | SELECT-only (§3.12). Refuses like the quota-reconcile route on a schema-inconsistent adjudication pair (`batch_adjudication_schema_inconsistent`, HTTP 500, house style) |

Key discipline, mirroring the adjudicate-estimated route:
caller-supplied keys outside the allowlist refuse
(`batch_reconcile_request_key_not_allowed` /
`batch_adjudication_request_key_not_allowed`); a caller-supplied
**provider identity** on the reconcile route refuses
`batch_provider_identity_caller_supplied` (identities come from
enumeration only); figure-shaped keys on either POST refuse in
the house style (`batch_figure_caller_supplied`). There is no
route — and no parameter on any route — that closes a map,
marks a map never-accepted, clears an exposure, or deletes a
record.

### 5.2 New and changed refusal / outcome names

New names introduced by this build (all others are existing
vocabulary, §2): `batch_quota_unarmed` (fence-bundle refusal,
§3.4); `batch_accounting_conflict` (linkage/outcome conflicts
at the terminal bundle and inventory, §3.5/§3.6.4);
`batch_terminal_receipt_conflict` (§3.6.4);
`batch_terminal_payload_unavailable` (commit-tail retry class,
§3.8); `batch_poll_linkage_missing` (inventory classification,
§3.6.2); `batch_provider_unsupported` /
`batch_model_unsupported` (preflight outcomes, §3.3);
`batch_ambiguity_open` (per-job submission block outcome,
§3.3); `batch_accepted_unnamed` (adapter error marker, §3.5);
`batch_no_match_not_terminal` (retained from the legacy
procedure, §3.10.4); `batch_duplicate_match_block` (route-level
outcome for a multiple-match run, §3.10.4);
`batch_adjudication_not_found` /
`batch_adjudication_already_resolved` /
`batch_adjudication_selection_not_enumerated` /
`batch_adjudication_schema_inconsistent` (§3.10);
`batch_reconcile_request_key_not_allowed` /
`batch_adjudication_request_key_not_allowed` /
`batch_provider_identity_caller_supplied` /
`batch_figure_caller_supplied` (§5.1). Changed behavior, same
name: `lane_not_allowed` (§3.3 — still the refusal whenever the
lane is not admitted, including every Batch case on the shipped
candidate).

### 5.3 Read-surface additions

Exactly one: `GET /v2/d6-batch-inventory` (§3.12). The existing
diagnostics surface gains the classification scalars through the
already-whitelisted detail keys (§3.2) — no new diagnostics
shape. Capabilities, health, quota, and sync surfaces do not
change.

### 5.4 Client impact

**None.** The client is capability-driven (§2): the Generate
button already renders from server admission, the click handler
already selects Batch when admitted, and the submission already
carries `lane`. No client file changes in this build, and no
client-visible contract changes: capabilities still report
`batch_not_armed` on the shipped candidate. Device verification
of the Batch-ready client belongs to B-G4's admission gate, not
to B-G2.

---

## 6. Offline test plan

### 6.0 Harness law (applies to every family)

- **Home:** a new suite `containment-v4/tests/batch-bg2-battery
  .test.mjs`, run with `node --test` from `containment-v4/tests/`
  against the candidate tree, built on
  `containment-v4/tests/harness.mjs` — the real-SQLite harness
  whose `SqlCursor.one()` **throws** on zero or multiple rows
  (production Durable Object semantics). The null-returning
  `.one()` fake of the older do-harness lineage is **forbidden**:
  no test in this suite may introduce, wrap, or tolerate a
  null-returning `one()`. Every new read path in §3 is exercised
  against empty result sets under throwing semantics (the P8
  lesson: harness-green over a null fake is no evidence for
  empty-result paths).
- **Extensions (test-only, enumerated):** a scripted provider
  stub implementing `submitBatch` / `getBatch` /
  `listBatchesByDisplayName` / `synthesize` with a durable call
  log and per-call scripted outcomes (accept+name, HTTP error
  by status, transport throw, accepted-unnamed, terminal shapes
  for §3.2's matrix) — it never touches the network; an R2 stub
  with object durability across `crash()`; the harness's fake
  clock and pass-token source; a counting write-fault injector
  layered on the harness's statement matcher, able to fail the
  *n*-th matching statement inside a named bundle.
- **Crash** means the harness's `crash()`: a fresh instance over
  the same storage. Assertions are made from table rows and the
  stub's call log, never from console output.
- **Fixtures are synthetic.** No book text, no production ids,
  no production payloads anywhere in the suite.
- **Exit rule (standing battery rule):** B-G2's evidence is one
  complete runner invocation on the final candidate tree
  executing every family below plus the four standing batteries
  (containment, P2, R5A, V-3), exit code 0, full logs captured,
  tree manifest hashed. The known P2/R5A identity-fixture
  staleness on composed trees must be cured in the scaffolding
  as part of this build's test work — a B-G2 exit may not rest
  on "behavioral-only" partial passes.

### 6.1 Families

**BG2-H — Throw-safe and harness semantics.** Intents: every new
§3 read on empty tables returns its specified empty/refusal
shape under throwing `.one()`; every `note*` / transition refusal
(`no_map`, `superseded`, `state_<current>`, intent refusals)
writes zero rows; the adjudication presence discipline (both
absent → empty; one present → `batch_adjudication_
schema_inconsistent`) under all four combinations; adapter-level
throws (halt, not-configured, unsupported) at every stage leave
exactly the §3.5-prescribed durable state. *Proves:* the new
code is safe on the empty and refusal paths that production
hits first. *Cannot prove:* real DO storage error behavior
beyond the harness's SQLite fidelity.

**BG2-F — Fence atomicity (B1).** Intents: fault injected at
each of W1…W6 (including the rollover-reservation sub-step)
leaves the store snapshot-equal to the pre-bundle baseline
(a pre-existing execution keeps its prior state); a quota
refusal (segment budget, day budget, counter drift seeded) rolls
back the whole bundle with no partial rows; `batch_quota_unarmed`
on an unarmed store writes nothing; a successful bundle yields
exactly the §4.1 ledger set, all sharing one day key. *Proves:*
the bundle is atomic or recoverably consistent at every
internal boundary the source supports. *Cannot prove:* platform
transaction behavior under a real DO eviction mid-callback —
the harness models rollback, not the platform.

**BG2-C — Crash windows.** Intents: one test per window in
§4.3 (CW-01…CW-23, AW-01…AW-05, FW-01 — 29 windows), each:
drive to the window, `crash()`, run the named recovery actor,
assert the specified end state from rows (including "no second
POST" from the stub log and "no second binding" from the
binding table). *Proves:* every torn state the protocol can
produce has the specified detection and recovery. *Cannot
prove:* that a real platform crash leaves storage in exactly
the modeled states (in-flight provider calls in particular are
modeled, not observed).

**BG2-A — Accounting.** Intents: fence-time counting (the
dispatch row exists before the stub records the POST — asserted
by interleaving the stub log with a ledger read); known-rejected
counted forever (I-4); polls and enumerations move no counter
(I-2); the ≤1 over-count bound with its self-identifying shape
(I-3); a fence straddling the PT day boundary attributes to the
fence day; a mixed Standard + Batch day reconciles `ok:true`
and each injected drift class is caught with the Standard names
(I-6); phase accounting carries an ambiguous map at upper bound
from its fence moment (I-5). *Proves:* D-1's counting law
mechanically. *Cannot prove:* the provider's own billing — the
ledger is estimates, as everywhere in this system.

**BG2-E — Error classification.** Intents: the §3.2 matrix over
synthetic provider shapes — structured policy evidence →
`policy_block`; item error 5xx → provider_error retryable;
batch error 429-class → provider_error non-retryable; metadata
FAILED/CANCELLED/EXPIRED without error → batch_terminal;
record-count and missing-audio and bad-audio shapes →
response_shape `failed_known`; unrecognized error shape →
`provider_error_unclassified` `failed_known`; negatives: no
shape without structured policy evidence ever yields
`policy_block`; success and not-done returns are shape-identical
to today's adapter. *Proves:* F3's entry condition (D-3) — a
Batch failure reaches repair only with a proven class.
*Cannot prove:* the real provider's error payload shapes; the
classifier is conservative precisely because B-G3 is where real
shapes are first observed.

**BG2-X — Execution, poll, and commit.** Intents: the §3.3
state-dispatch table end-to-end (each map state, each execution
state); §3.5's five submit outcomes; immediate poll after
acceptance; terminal-bundle atomicity and receipt idempotence
(same receipt → `already_applied`; differing receipt →
`batch_terminal_receipt_conflict`, zero extra writes); shared
commit tail produces exactly one binding/projection/settled
cost (I-7); cohort rule (no early report; `terminal_unreported`
recovery reports once). *Proves:* the execution path's contract
against the stub. *Cannot prove:* real provider latency,
real R2 behavior, or DO alarm delivery.

**BG2-P — Poll driver, D-4 parameters, lease custody.** Intents:
≤1 poll per map per pass across many simulated passes; duplicate
pass token is a no-op; classification boundaries at exactly
1 h / 12 passes / 6 h on the fake clock (11 passes ≠ stalled;
12 passes at 5 h 59 m ≠ stalled; both conditions → stalled;
progress resets the counter); poll-error passes count as
observed without progress; a `started`-only observation does not
advance the counter; ambiguity classification at 24 h with zero
provider calls; halt and containment suppression invoke nothing;
lease tolling (§3.7) across repeated expiries and across a
simulated silent chain; a terminally consumed map does not toll.
*Proves:* D-4's observation parameters and the custody rule
mechanically. *Cannot prove:* alarm delivery, alarm cadence,
or any platform timing — NO-PASS-OBSERVED remains an
observation-layer derivation, as designed.

**BG2-M — Ambiguity and multiple matches (B2).** Intents: the
per-job block (I-8) with submitted siblings unaffected; no-match
leaves byte-identical state and returns
`batch_no_match_not_terminal`; single-match adoption resumes
polling on the same attempt with no new dispatch; multiple
matches adopt **nothing** — including via a direct call of the
hardened legacy export — preserve every identifier verbatim,
and produce the exact §3.10.3 exposure report; an open
adjudication blocks later single-match auto-adoption; the
decision route adopts only a preserved, valid selection
(wrong selection, invalid selection, different selection after
resolution, and non-operator callers all refuse with zero
writes); no wired flow can invoke never-accepted resolution
with satisfiable evidence (the adapter throw stands; no route
exposes it). *Proves:* D-6/B2 in full against the stub.
*Cannot prove:* real enumeration completeness — the 100-row
page cap is a provider fact the suite can only flag, which is
why the run record carries `enumeration_may_be_incomplete`.

**BG2-R — Repair (B3, Standard-repair half).** Intents: a batch
repair parent reporting mixed follow-ons partitions exactly as
§3.9 (policy subset → Standard lane with the deviation data;
other subset → inherited lane); a Standard parent's follow-on
shape is byte-equivalent to today's; the Standard follow-on's
F3 split chain commits exactly one binding for the occurrence;
the shared budget across the lane crossing never exceeds
`SEGMENT_ATTEMPT_BUDGET` (12) and `REPAIR_MAX_RETRIES` (3) —
a chain that exhausts leaves the occurrence blocked and visible,
never silently dropped; a `provider_error` batch result never
takes the Standard deviation. *Proves:* D-3's conditions
(shared budget, repair ceiling, accounting chain, exactly-once
binding). *Cannot prove:* policy behavior of the real provider
on split parts — that is B-G3 observation.

**BG2-B — Rollback and restoration (B3).** Intents: inventory
captured over a populated Batch store; the candidate build is
"rolled back" (Standard-only code path / prior build fixture)
and restored; inventory before/after matches on identity and
accounting fields; restoration polls `submitted`, blocks on
`ambiguous`, converts `fenced`, and submits **zero** times
(stub log); no row of any §3.12 table is deleted or settled by
any act in the suite; source-level pins for the NOT-do
invariants (no forbidden call or delete shape on the named
paths; no `abandoned` state string anywhere in the tree delta).
*Proves:* D-5's inventory-and-hold obligations as far as offline
evidence can. *Cannot prove:* a real rollback's operational
safety — that remains a B-G4 gate act with its own predicates.

**BG2-S — Standard regression and inertness.** Intents: the
four standing batteries re-run on the candidate tree (exit rule,
§6.0); Standard end-to-end (submit → dispatch → commit → report
→ follow-on) is behaviorally identical to the pre-build tree on
a shared scenario suite; with the shipped allowlist
`["standard"]`, §3.13's inertness properties (a)–(d) hold,
including zero provider calls on every Batch refusal layer.
*Proves:* the build changes nothing for Standard and nothing at
all while unarmed. *Cannot prove:* device-side client behavior
(the client is unchanged; its Batch readiness is a B-G4 device
verification).

**BG2-O — Operator surfaces.** Intents: both POSTs and the GET
refuse without the operator credential and without the admitted
stamp (the two-layer fence), refuse a client credential, refuse
extra keys / caller-supplied identities / caller-supplied
figures by their §5 names with zero writes, require nonblank
`authorizationRef` (and `evidenceRef` on adjudicate), and are
idempotent under repetition; the inventory performs no writes
and no cache flush (read purity asserted from a write counter).
*Proves:* the new surface is operator-only, audited, and
minimal. *Cannot prove:* anything about production credential
handling — no production act is in scope.

---

## 7. Sequencing inside B-G2

| Phase | Work | Checkpoint |
|---|---|---|
| 0 | Harness extensions (§6.0): provider stub, R2 stub, write-fault injector; cure the P2/R5A identity-fixture staleness in the scaffolding. No production code. | CP-0: extension manifest + standing batteries green on the *unmodified* composed tree in one run |
| 1 | §3.2 classification surface (adapter-only) + BG2-E | **CP-1 (D-3 prerequisite):** BG2-E green; no other Batch code exists yet |
| 2 | §3.4/§4 fence bundle + accounting helpers + BG2-F, BG2-A | CP-2: fence families green; submit still unwired (no call site can POST) |
| 3 | §3.3 Batch branch, §3.5 submit outcomes, §3.6.4 terminal bundles, §3.8 commit tail, §3.7 lease custody, §3.6.5 cohort reporting + BG2-X, BG2-C (main-flow windows) | CP-3: execution + crash families green |
| 4 | §3.6 poll driver + observation tables + BG2-P | CP-4: poll family green |
| 5 | §3.10 adjudication tables + adjudicator, §3.10.5 store act, legacy multiple-match hardening — **then** §5 routes + BG2-M, BG2-O | CP-5: no enumeration caller exists before this phase; ambiguity families green |
| 6 | §3.9 repair partition + BG2-R | CP-6: repair family green |
| 7 | §3.12 inventory + rollback invariants + BG2-B | CP-7: rollback family green |
| 8 | §3.13 inertness + BG2-S + BG2-H completion; **the single complete exit run** (§6.0) on the final tree | **Exit:** full logs + exit code 0 + tree manifest hash, presented for the B-G3 readiness package |

Each checkpoint's evidence is a source-diff manifest plus that
phase's family logs; no checkpoint involves a deployment, a
staging act, or a provider call. A phase that cannot reach green
stops the sequence — later phases are not started on a red
earlier phase, and a checkpoint failure is reported at its true
strength (the standing rule: counts and claims verified against
the run's own log, never from memory).

**Exit criteria for presenting B-G2's result toward B-G3:**
(1) the §6.0 exit run is green in one invocation on the final
tree; (2) the crash-window suite covers all 29 §4.3 windows;
(3) the candidate tree still carries `D6_LANE_ALLOWLIST =
["standard"]` (verified from the tree, not asserted); (4) the
diff manifest shows changes only in §3's file map; (5) open
items §8 are carried into the B-G3 package unchanged. Meeting
these criteria authorizes nothing by itself — B-G3 remains a
separately reviewed, separately authorized gate.

---

## 8. Boundaries and open items

**What this specification is not.** Not code. Not a build
authorization (the build itself is "subject to the next
reviewed build scope", per the ruling). Not a deployment
authorization for staging or production. Not a provider call,
a Batch submission, or an allowlist change. Nothing in it
amends the production hold: generation halted, queue paused,
containment NORMAL.

**Open items carried (not resolved by this specification):**

- **B-1 (pricing) — OPEN.** The lane-blind cost model stands;
  no Batch price differential is assumed, designed around, or
  claimed anywhere in §3–§6.
- **B-2 (staging parity) — B-G3 predicate.** The B-G1 §7
  checklist (P-1…P-5) must produce its evidence before any
  staging result is interpreted; this specification's offline
  suite is not a substitute for it.
- **B-3 (prepay provenance) — B-G3 predicate.** Staging carries
  no `GEMINI_API_KEY` binding as deployed (verified November 6,
  2026); provisioning it is a B-G3 act requiring its own
  authorization, a bounded test budget, and the fail-safe
  default (staging spend treated as production prepay).
- **O-1 — D-4 parameters are observation parameters.** They
  classify and escalate; they authorize no automatic halt,
  failure, abandonment, or termination anywhere in §3.
- **O-2 — Lease custody (§3.7) is a source-derived addition**
  beyond B-G1's named flow, required by the 15-minute lease in
  the deployed source. It is specified at full strength and
  flagged for Rowan's explicit review.
- **O-3 — The §3.9 seam's scope.** :2536 governs follow-ons
  from `kind:"repair"` parents only (verified in source). If
  initial repair-job origination for an original batch job is
  expected in B-G2, it needs its own specification point;
  nothing here silently extends the seam.
- **O-4 — The halted-fence corner (§3.5, last row).** A fence
  whose POST is refused by the adapter's halt assert converts
  to `ambiguous` on a later pass under the existing
  `fence_without_outcome` rule — conservative and bounded to
  one counted dispatch, but it spends operator attention on a
  fence that provably never POSTed (the halt assert fires
  before any fetch). A narrower rule (a durable "halt-refused"
  fence marker permitting a clean re-post after the halt lifts)
  is possible but adds a state to the map law; this
  specification does **not** adopt it and flags the trade-off
  for Rowan.
- **O-5 — Provider error shapes are unverified.** §3.2's
  taxonomy is built from the synchronous path's evidence
  standard and the adapter's current collapse; real Batch error
  payloads are first observable at B-G3. Any token learned
  there that should classify as policy requires a new reviewed
  change — the classifier must not be "tuned" informally.
- **O-6 — Platform-unverified behaviors stand:** alarm delivery
  and cadence, Durable Object runtime adoption of a deployed
  build, post-retry-exhaustion alarm semantics, and the
  racing-wake recheck. No part of §3 or §6 claims them.

---

## 9. B-G3 predicates this build must hand forward

For the record (predicates, not authorizations): the §6.0 exit
run's logs and tree manifest; the B-2 staging parity evidence
(P-1…P-5) produced against the candidate build; the B-3
provisioning decision (credential provenance, bounded test
budget parameters — B-G1 proposed `P-TEST-SEGS` 12 at the
lane-blind upper bound — and the shared-prepay fail-safe); the
first real provider error shapes observed under the bounded
test budget, reviewed against §3.2 before any production
interpretation; and Julie's separate authorization for the
staging deploy and provider testing itself.

---

## Appendix A — Refusal and outcome index (delta only)

New: `batch_accepted_unnamed`, `batch_accounting_conflict`,
`batch_adjudication_already_resolved`,
`batch_adjudication_not_found`,
`batch_adjudication_request_key_not_allowed`,
`batch_adjudication_schema_inconsistent`,
`batch_adjudication_selection_not_enumerated`,
`batch_ambiguity_open`, `batch_duplicate_match_block`,
`batch_exposure_unavailable`, `batch_figure_caller_supplied`,
`batch_model_unsupported`, `batch_no_match_not_terminal`
(retained), `batch_poll_linkage_missing`,
`batch_provider_identity_caller_supplied`,
`batch_provider_unsupported`, `batch_quota_unarmed`,
`batch_reconcile_request_key_not_allowed`,
`batch_terminal_payload_unavailable`,
`batch_terminal_receipt_conflict`. Reused unchanged:
`lane_not_allowed`, `generation_halted`,
`migration_operator_required`, the `QUOTA_REFUSALS` set, the
map-transition refusals (`no_map`, `superseded`,
`state_<current>`), `already_noted`, `no_spend_intent`,
`claimed_by_other`, `adjudication_schema_inconsistent` (the
Standard estimated-cost pair — distinct from the Batch pair
above), and `handleReport`'s existing outcome vocabulary.

## Appendix B — Parameter index

Existing: `LEASE_MS` 15 min; `SEGMENT_ATTEMPT_BUDGET` 12;
`REPAIR_MAX_RETRIES` 3; `PROVIDER_ATTEMPT_DAILY_LIMIT` 100
(app-selected policy cap). New (D-4, fixed by the ruling):
`BATCH_EXTENDED_LATENCY_MS` 3,600,000 (1 h);
`BATCH_STALL_PASSES` 12; `BATCH_STALL_AGE_MS` 21,600,000 (6 h);
`BATCH_AMBIGUITY_ESCALATION_MS` 86,400,000 (24 h).
