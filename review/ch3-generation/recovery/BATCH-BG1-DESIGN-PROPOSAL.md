# B-G1 — BATCH DESIGN PROPOSAL (Workstream 2, design gate 1)

_Design only. Drafted by Wren 2026-11-06 under Rowan's turn-on scoping
ruling (§5; local record `ROWAN-TURNON-SCOPING-RULING.md`; scoping
package pin `a6e5dd380eed9ad6edc4331c163eb22e588fdcfe`). This proposal
implements nothing, deploys nothing, calls no provider, and changes no
allowlist. It settles — at design strength, for Rowan's ruling — the
five questions the ruling assigns to B-G1: submission and polling
quota semantics, ambiguity accounting, retry behavior, latency and
stall classification, and rollback disposition. It also designs the
B-2 staging parity check and answers the B-3 prepay question from the
local record. B-1 (provider Batch pricing) remains OPEN throughout:
nothing in this proposal assumes a Batch discount, and the ledger cost
model stays lane-blind._

_Every mechanistic claim is cited to the deployed build source (the
composed tree, `containment-v4/composed-tree/v2/`) or to the design
record by file and line. Design choices are labeled PROPOSAL with
their reasons; parameters Rowan is asked to fix are labeled
PARAMETER. Steps are tagged EXISTING / TO-BUILD / TO-DESIGN._

---

## 1. The D6 Batch flow as designed, end to end

### 1.0 The cardinality fact that shapes everything

The carried-over provider adapter submits **exactly one occurrence
per provider batch job**: `submitBatch(occ, displayName)` builds a
batch whose `requests` array holds a single request, keyed
`seg-<occurrenceId>` (host/adapters.mjs:364-407), and `getBatch`
extracts the audio from **exactly one** inlined response, treating
any other shape as failure (adapters.mjs:425-439). The coordinator's
mapping contract is likewise occurrence-keyed: one `batch_maps` row
per (job, occurrence, generation) (coordinator.mjs:546-556).

**DESIGN SETTLEMENT (assembly):** Batch assembly on the D6 path is
the per-occurrence fence-and-submit unit. There is no multi-segment
grouping step to design, because grouping does not exist in any
contract the path would speak. Grouping is rejected for this program,
with reasons: (a) the adapter's terminal extraction is
exactly-one-record — a grouped submission's results could not be
retrieved through it; (b) `batch_maps` and the spend intent are
occurrence-keyed fences, and they are the exactly-once mechanism —
one POST whose ambiguity spans many segments would break
per-segment attempt accounting and per-segment fences; (c) a grouped
adapter plus a grouped map schema is a new design gate, not B-G2
build scope. If throughput ever demands grouping, it returns as its
own design. What "Batch" buys in this design is therefore the
provider's asynchronous execution window per segment — temporal, not
aggregational — matching the design record's own description
(scoping §4.2).

### 1.1 The flow, step by step

**S1 — Intent admission.** A client submits a generation intent with
lane `batch`. Admission consults the frozen allowlist
(`D6_LANE_ALLOWLIST`, generation/gen-constants.mjs:9) at
service.mjs:857 and rejects `lane_not_allowed` while Batch is not
admitted. Plan and job creation carry the lane on the job row
(coordinator `_submitJob`). **EXISTING** — the only change is the
B-G4 allowlist flip, which is not B-G1's act and is not designed
here beyond §6's disposition rules.

**S2 — Grant issuance.** The drive pass (`driveOnce`,
generation/service.mjs:1008) selects non-terminal plans and issues
grants under the standing grant guards (phase projection, quota
cohort reservation, storage projection — generation/grant-guards.mjs;
generation/quota-budget.mjs). A batch plan is driven by the same
driver; nothing about grant issuance is lane-specific except the
work source's mode stamp (S3). **EXISTING.**

**S3 — Dispatch stamping.** The D6 work source stamps each
occurrence's payload `mode: view.lane === "batch" ? "batch" :
"standard"` (generation/d6-work-source.mjs:114; the same stamp in
host/adapters.mjs:806). Today this produces messages the D6 executor
refuses wholesale. **EXISTING** (and the reason admission must stay
closed until S4 exists — scoping R-B1).

**S4 — Executor batch branch.** On an admitted build, a queue
dispatch for a batch job enters a batch branch of the D6 executor in
place of today's refusal layers 1 and 3 (generation/d6-executor.mjs:
677-684, :841-842); refusal layer 2 — the job-lane allowlist check
(:688-689) — remains, as the allowlist remains the only lane law.
The branch mirrors the Standard branch's discipline exactly, in this
order:
1. `claimGrant` first; the standing claim outcomes (completed /
   closed / unknown → drop; another consumer's claim → stand down).
2. The pre-claim fences the Standard branch runs (quarantine hold,
   plan resolution, plan-state fence) — unchanged, lane-blind.
3. Per occurrence, fresh state re-read; then the batch sequence
   (§1.2) under the coordinator's existing `batch_maps` contract.
**TO-BUILD** (the branch and its quota hook, S5); the claim/fence
scaffolding is **EXISTING** and shared.

**S5 — The per-occurrence batch sequence** (the heart of the build;
the legacy executor's `runBatch`/`pollBatch`,
executor.mjs:140-209, is the behavioral reference — the D6 branch
reproduces its contract discipline and adds the genstore/quota
recording the legacy path predates):
1. Read the occurrence's latest `batch_maps` row
   (coordinator `workView(jobId).batchMaps`). If a live
   (non-superseded) row exists, act on its state — `submitted` →
   poll (S6); `ambiguous` → no action, the job is blocked (§3.3);
   `rejected` / `closed` → terminal for this job, skip;
   `fenced` with no recorded outcome → convert to `ambiguous`
   (`noteBatchAmbiguous`, detail `fence_without_outcome`) and
   **never post on a fence alone**. **EXISTING contract**
   (coordinator.mjs:3746-3800); the D6 branch's state dispatch is
   **TO-BUILD**.
2. No live row: `acquireSpendIntent` (the shared exactly-once spend
   fence; if an intent already carries a known outcome, no second
   call is made — the legacy Standard discipline, executor.mjs:
   120-138). **EXISTING.**
3. Compute the display name — `displayNameFor(grantId,
   occurrenceId)` = `opalreader-<grantId[0:16]>-<occurrenceId>`
   (executor.mjs:49-52). It is a reconciliation lookup hint,
   **never an idempotency key** (the source says so in terms);
   exactly-once comes from the fence rows, not the name.
   **EXISTING.**
4. `fenceBatchSubmit` — the durable mapping row is written, state
   `fenced`, **before** any billable POST, and requires the
   consumer-matched spend intent (coordinator.mjs:3746-3763).
   **EXISTING.**
5. **Quota recording bound to the fence step**: the submission's
   provider-dispatch ledger row and genstore attempt record are
   written as part of the fence step, before the POST is attempted
   (§2.2 gives the rule and its reasons). **TO-BUILD** (the legacy
   path has no quota hook; `applyDispatchQuota`,
   generation/quota-budget.mjs:737, is the Standard-side mechanism
   whose ledger the batch write must join).
6. `submitBatch(occ, displayName)` — the provider POST
   (host/adapters.mjs:364-407; Gemini-only, model-gated to Gemini
   3.8 TTS at :372). Outcomes:
   - Accepted with a valid `batches/…` name → `noteBatchSubmitted`
     persists the provider name at once (coordinator.mjs:3779-3782),
     then an immediate first poll (S6) in the same pass.
   - HTTP error (a KNOWN outcome) → `noteBatchRejected` +
     `noteSpendOutcome(failed_known)` + report `provider_error`
     (§4.1).
   - Transport-unknown error (no HTTP answer) →
     `noteBatchAmbiguous` (`submit_transport_unknown`); nothing is
     reported; the occurrence's uncertainty surfaces through the
     ambiguity machinery (§3). The legacy branch's shape is
     preserved exactly: an ambiguous outcome claims no knowledge.
   - Accepted but no valid job name in the response → the adapter
     itself throws a 502 marked `noRetry` ("Manual reconciliation
     required", adapters.mjs:403-406): a KNOWN-ambiguous hybrid —
     the provider accepted *something* we cannot name. Design
     treatment: `noteBatchAmbiguous` with detail
     `accepted_unnamed` (it joins the ambiguity path, never the
     rejected path — a rejection claim would license a resubmission
     that could double-submit). **TO-DESIGN → TO-BUILD.**
   **Adapter + coordinator methods EXISTING; the D6 wiring TO-BUILD.**

**S6 — Polling.** Polls ride drive passes (§5.2 designs the driver
and cadence): for each `submitted` map of a driven job, at most one
`getBatch(providerName)` per pass (host/adapters.mjs:409-439):
- Poll throws → pending, `pollError` noted on the pass outcome, **no
  state changes** (the legacy rule: "polling is free; try again
  later", executor.mjs:141-143).
- Not done → pending; the provider state string is recorded on the
  pass outcome (it is the stall test's progress signal, §5.3).
- Done + terminal failure state (`BATCH_STATE_FAILED` /
  `BATCH_STATE_CANCELLED` / `BATCH_STATE_EXPIRED`, or a done response
  whose single record carries an error or no audio) →
  `noteSpendOutcome(failed_known, detail: batchState)` + report
  `provider_error` with the batch state (§4.2), subject to the
  error-classification surface in §4.3.
- Done + `BATCH_STATE_SUCCEEDED` with audio → S7.
**Adapter EXISTING; the drive-pass poll hook TO-BUILD.**

**S7 — Commit through the shared machinery.** A successful poll's
audio (WAV bytes + parsed duration — the format pin already matches)
enters the D6 executor's existing terminal path: execution record →
flush to R2 → verify → `store.commitVerified` →
`coord.validateAndBind` + binding projection
(generation/binding-projection.mjs), with `noteSpendOutcome(success)`
— the identical flush-before-commit discipline Standard uses
(generation/d6-executor.mjs header; commit sites :640-675 area).
Successes are never re-reported through `handleReport` (the standing
D6 rule). **Machinery EXISTING; the connection from a batch-sourced
result TO-BUILD.**

**S8 — Completion accounting.** `handleReport` closes the grant;
`settleReservationsForGrant` settles the grant's quota reservations
at report (coordinator.mjs:2502-2509); settled cost is computed from
the produced audio's actual duration under the lane-blind model
(225 units per audio second, gen-constants.mjs:64-65) — identical to
Standard, because B-1 is open and no differential is asserted.
**EXISTING.**

**S9 — Reconciliation (ambiguity adjudication).** The legacy
`reconcileBatch` (executor.mjs:224-240) — enumeration by display
name, adoption on match, nothing on no-match — exists but has **no
caller in any entry of the tree** (verified by search: no call site
outside its own definition). The D6 design wires adjudication as an
operator-invoked procedure (§3.4), not as an automatic executor
behavior. **Procedure EXISTS as code; its wiring TO-BUILD.**

**S10 — Halt behavior.** Every adapter method begins with
`assertGenerationEnabled(env)` (adapters.mjs:365, :410, :443): with
`GENERATION_HALT = "1"`, submissions, polls, and enumerations all
throw before any provider contact. A halt therefore freezes batch
progress in place — maps durable, no spend, no state corruption —
and progress resumes from the durable rows when the halt lifts.
**EXISTING**, and load-bearing for §6.

---

## 2. Quota semantics — the B-G1 settlement

The ruling requires B-G1 to settle what Batch calls count against
the provider-attempt cap. The cap itself: `PROVIDER_ATTEMPT_DAILY_LIMIT
= 100` authorized provider dispatches per Pacific-Time day
(generation/gen-constants.mjs:20-31) — an app-selected Reader policy
cap, pinned as a constant, explicitly **not** a verified Google
limit. It counts a different thing from the coordinator's
grants-per-day quota. Day totals are *derived* from the
`d6_provider_dispatches` ledger (generation/quota-budget.mjs), which
is what makes the count reconcilable after the fact: the reconcile
surface recomputes consumption from dispatch rows, so any call class
that must count must write a dispatch row, and any class that writes
none is verifiably uncounted.

### 2.1 What the cap protects (the principle the rules follow)

The cap exists to bound (a) provider-side synthesis volume the
account can be billed for in a day, and (b) spend authorization —
the rate at which the system may commit Julie's prepay. It does not
exist to bound read traffic. The counting rule therefore keys on
**authorized segment-syntheses, not HTTP calls**:

### 2.2 The rules (PROPOSAL — decision D-1 for Rowan)

- **R-Q1 — A batch submission counts as its segment count.** The
  POST that submits a batch authorizes the synthesis of every
  segment in it. Under the current adapter the segment count is
  exactly 1 (§1.0), so a submission counts as **1 dispatch** —
  precisely parallel to a Standard `synthesize` call, which is 1
  call authorizing 1 segment. The rule is stated in segment terms so
  it survives any future grouped adapter unchanged: dispatches
  counted = segments submitted. The submission also consumes **1
  unit of the segment's 12-attempt budget**
  (`SEGMENT_ATTEMPT_BUDGET`, gen-constants.mjs:13-14: "≤ 12 attempted
  calls per segment across split tree + repair chain") and one slot
  of its grant's cohort reservation — the reservation machinery
  (`reserveForGrant` / cohort bounding in quota-budget.mjs) is
  already lane-blind and needs no change.
- **R-Q2 — The count is recorded at the fence step, before the
  POST.** The dispatch-ledger row and the genstore attempt record
  (reserved → dispatching) are written bound to `fenceBatchSubmit`,
  ahead of the provider call. Reasons: (a) the fence is the last
  durable moment before the one paid action — it exists precisely
  to cover the crash window after it (coordinator.mjs:3743-3745);
  counting there means every possibly-executed submission is
  counted, including one whose POST outcome is never learned;
  (b) the failure direction is safe — a crash between fence and
  POST over-counts by at most 1 (a dispatch recorded that may never
  have happened), while counting after the POST under-counts in
  exactly the ambiguous cases the cap most needs to see; (c) it
  makes the invariant *every live-or-ambiguous batch map has exactly
  one counted dispatch* mechanically checkable by the reconcile
  surface. The alternative (count at POST attempt, Standard-style)
  was considered and rejected for (b): Standard can afford
  dispatch-time counting because its unknown outcomes are surfaced
  by the lease machinery against an attempt row written at the same
  moment; Batch's ambiguity can persist indefinitely (§3), so its
  count must be durable *before* the uncertainty begins.
- **R-Q3 — Polls count 0.** `getBatch` authorizes no synthesis and
  moves no spend; the legacy code already treats polling as free
  (executor.mjs:142). Polls are instead bounded *structurally*: at
  most one poll per submitted map per drive pass (§5.2), and every
  poll's outcome is recorded on the pass outcome — so poll volume is
  fully observable even though uncounted, and if observed volume
  ever argues for a count, that is a new ruling on evidence, not a
  silent change.
- **R-Q4 — Retrieval counts 0, because there is no retrieval
  call.** In this adapter the successful poll *is* the retrieval:
  the audio rides the terminal `getBatch` response
  (adapters.mjs:425-439). Generalized rule, stated for any future
  adapter that splits retrieval out: a call that only moves
  already-authorized results counts 0 — it authorizes nothing.
- **R-Q5 — Reconciliation enumerations count 0.**
  `listBatchesByDisplayName` (adapters.mjs:441-457) is a read. It is
  bounded procedurally instead: enumerations run only inside the
  adjudication procedure (§3.4), at most once per ambiguous map per
  adjudication run, and each run is recorded.
- **R-Q6 — Known-rejected submissions stay counted.** A submission
  the provider refuses with an HTTP answer was still an authorized
  dispatch attempt (the provider processed a synthesis request and
  refused it); its dispatch row stands, exactly as a Standard
  dispatch that returns an HTTP error stays counted. Only the
  segment's *cost* settles to its evidenced outcome (§3.2); the
  day-cap count does not refund. (This matches the cap's purpose:
  it bounds attempts, not successes.)

### 2.3 Reconcile verifiability

Under R-Q1..R-Q6, the existing reconcile derivation needs no new
concepts: batch dispatch rows join `d6_provider_dispatches` under
the same schema (attempt/grant/occurrence/plan/execution/day keys),
`derivedDayTotals` counts them identically, and the §2.2 invariant
(one counted dispatch per fence generation) is a checkable
reconciliation assertion for B-G2's accounting tests (§8). No
batch-specific counter exists anywhere in the design — deliberately:
a second counter is a second thing to drift.

---

## 3. Ambiguity accounting

Batch's defining risk is the submission whose outcome is unknown.
The design treats ambiguity as an *accounting state with a governed
lifecycle*, built entirely on machinery that already exists.

### 3.1 How ambiguity arises (complete enumeration)

1. **Transport loss on the POST** — no HTTP answer:
   `noteBatchAmbiguous(submit_transport_unknown)` (legacy shape,
   executor.mjs:203-206).
2. **Crash between fence and outcome note** — a row found `fenced`
   with no outcome on a later pass is converted:
   `noteBatchAmbiguous(fence_without_outcome)` (executor.mjs:
   174-180). The POST may or may not have happened.
3. **Accepted but unnamed** — the provider accepted, but returned no
   valid job name (adapter throws `noRetry` 502, adapters.mjs:
   403-406): `noteBatchAmbiguous(accepted_unnamed)` per §1.1 S5.
4. **Crash between provider acceptance and `noteBatchSubmitted`** —
   externally indistinguishable from (2); same treatment. (Cases 2
   and 4 are one case to every later observer; the design does not
   pretend to separate them.)

In all cases: the fence stands, the map is `ambiguous`, the spend
intent stays open with no outcome noted, and **the map may never be
resubmitted** (coordinator.mjs:3784-3788, in terms).

### 3.2 How an ambiguous submission is ledgered

- **Day-cap:** already counted — exactly 1 dispatch, recorded at the
  fence step (R-Q2). Ambiguity never creates a second count and
  never erases the first.
- **Cost:** the attempt's cost is held at its **upper-bound
  estimate** (`upperBoundAttemptMicro(chars)` =
  `round(chars/10 × 225)`, gen-constants.mjs:78-84) under the
  existing unknown-billing accounting class — the same posture as a
  Standard attempt whose billing is unknown: the phase projection
  carries it as unverified exposure (the `estimated_unverified`
  accounting the genstore maintains and the operator dispositions
  through `reconcileUnknown` / `adjudicateEstimated`,
  generation/genstore.mjs:521, :594-600, exposed at the operator
  route with an `authorizationRef`). An ambiguous batch attempt is
  therefore *visible in every accounting surface at its worst-case
  value* from the moment it fences — never invisible, never
  settled-at-a-guess.
- **Segment budget:** the fenced submission has consumed 1 of the
  segment's 12 attempts (R-Q1). It stays consumed while ambiguous —
  the budget, like the cap, fails closed.

### 3.3 The fail-closed block (PROPOSAL — decision D-2)

While **any** `batch_maps` row of a job is `ambiguous`, that job
makes **no further batch submissions**. Other occurrences of the job
already `submitted` continue to poll and commit normally (their
spend is already fenced and counted); no *new* spend is authorized
under unresolved uncertainty. Reasons: the job is the chapter-scope
unit of work; ambiguity is a statement that the account may already
have been charged for work we cannot see, and compounding it
segment after segment converts a one-segment unknown into a
chapter-sized one. The block is per-job, never global: other jobs —
and the entire Standard lane — are unaffected. An ambiguous map
whose age exceeds the adjudication-surfacing parameter (§5.4,
PARAMETER P-AMB) is reported on drive outcomes under the
classification **BATCH-AMBIGUITY-OPEN** — an enduring, named,
observable state in the spirit of `halted_unknown`, not a silent
stall.

### 3.4 Adjudication — the only exits from `ambiguous`

1. **Adoption (the designed exit).** An operator-invoked
   adjudication run (the wiring of S9: an authorizationRef-carrying
   operator act, mirroring the `/v2/d6-reconcile-unknown`
   discipline) enumerates the provider's batches by the map's
   display name. On a match, `adoptBatchByLookup` transitions the
   map to `submitted` with the provider name and the evidence
   string `display_name:<name>` (coordinator.mjs:3795-3800), the
   dispatch's day attribution is confirmed against the fence
   timestamp under the quota ledger's existing straddler discipline
   (a day is assigned only where the surviving evidence proves it;
   never guessed — quota-budget.mjs bootstrap/straddler law), and
   normal polling resumes. The adopted job's eventual completion
   settles its cost from actual audio duration exactly like any
   success (§1.1 S8); a terminal failure on the adopted job
   adjudicates its cost to the evidenced known-failure outcome
   through the same operator machinery. No-match changes **nothing**
   — no state, no spend, no count (executor.mjs:224-240 contract:
   "a missing match proves nothing").
   **Multiple matches (flagged, decision D-6):** the legacy
   procedure adopts `matches[0]`. All matches share one display
   name — one grant, one occurrence — so any match is the same
   logical submission's audio; but the adapter returns only
   `{name, displayName}` per match, with no creation time
   (adapters.mjs:450-457), so "first" is enumeration order, not
   proven earliest. B-G1 records the residual honestly: if the
   provider executed the POST twice (the only way two live matches
   exist), adopting either yields this segment's audio and the
   other becomes an orphaned provider job whose cost, if any, is
   inside the one upper-bound exposure already ledgered only if it
   equals one job's cost — a second executed job could exceed it.
   Rowan is asked to fix the rule: adopt-first as legacy does, or
   require B-G2 to extend the adapter to return creation timestamps
   and adopt-earliest. B-G1 proposes adopt-first **with the
   exposure note carried on the adjudication record**, because the
   double-execution precondition itself requires a provider-side
   retry invisible to us — but this is Rowan's call, not settled
   here.
2. **Never-accepted resolution — NOT available, by design.**
   `resolveBatchNeverAccepted` exists in the coordinator
   (coordinator.mjs:3801-3855) but its evidence gate cannot be
   satisfied: the adapter's `verifyNeverAcceptedEvidence` throws
   unconditionally, because no public provider API proves
   non-acceptance (adapters.mjs:459-469), the route is not exposed
   over HTTP, and Rowan's Part 1 decisions record accepts the
   fail-closed posture for dark staging only and requires it be
   "addressed explicitly before Batch rescue is enabled or any flow
   depends on a 'never accepted' assertion" (gen-pkg-1
   part1-decisions.md, item 3). **B-G1 therefore designs no
   dependency on it:** a never-matched ambiguous map has no
   designed exit other than a future evidence ruling outside this
   gate's scope. The job stays blocked (§3.3), the exposure stays
   ledgered at upper bound (§3.2), and the state stays named and
   observable (§5.4). This is stated plainly because it is the
   strongest argument for the fence discipline and the per-job
   block: under current evidence law, **ambiguity can be terminal
   for a job**, and the design's job is to make that outcome cheap,
   bounded, visible, and non-contagious — which §§3.2-3.3 do.

---

## 4. Retry behavior

### 4.1 The three retry questions, kept separate

"Retry" conflates three unlike things; the design rules each on its
own:

**(a) Re-submitting the same submission — NEVER.** A fenced
submission is never posted twice (coordinator.mjs:3784-3788;
executor.mjs:174-180). There is no retry of a POST whose outcome is
unknown, at any layer, under any flag. Adoption (§3.4) is a
continuation, not a retry.

**(b) A known-rejected submission.** The provider's HTTP refusal is
a known outcome: map `rejected`, intent `failed_known`, occurrence
reported `provider_error` (executor.mjs:193-202). The `rejected`
map is terminal *within its job and generation* — a later pass
skips it (executor.mjs:170-171). Any further attempt at the
occurrence happens the way known failures are retried everywhere in
D6: as a **new job in the server-owned repair chain** (§4.3), whose
fresh job scope carries fresh intent and fence rows keyed to the
new job — no mutation of the rejected map, no reuse of its permit.
Retryability classification follows the existing repair law:
retryable known failures (the HTTP 5xx class and stage failures)
return repair markers; the chain is bounded by `REPAIR_MAX_RETRIES
= 3` within the shared 12-attempt segment budget
(gen-constants.mjs:12-18; d6-executor.mjs:52-58).

**(c) A submitted batch that reaches a terminal provider state.**
`BATCH_STATE_FAILED` / `BATCH_STATE_EXPIRED` / `BATCH_STATE_CANCELLED`
(adapters.mjs:422) are known outcomes: intent `failed_known`,
occurrence reported `provider_error` with the batch state (legacy
pollBatch, executor.mjs:144-152). Retry, if any, is again
chain-level only: a repair job may make a *fresh* batch submission
for the occurrence (new fence, new counted dispatch, new
attempt-budget unit) — the dead provider job is never polled again
and never "resumed". CANCELLED is treated identically: no cancel
method exists in the adapter (nothing in this system cancels a
provider batch), so a cancelled state can only arrive from outside
this system; it is known-terminal for the submission and
chain-retryable like FAILED. EXPIRED likewise — expiry is the
provider's own latency bound doing its work, and the stall design
(§5) deliberately never pre-empts it with a local guess.

### 4.2 Partial results

Under the settled cardinality (§1.0), a provider batch holds
exactly one segment, so whole-batch and per-item outcomes coincide;
there is no partial batch to design for in this program. The
general rule is stated so a future grouped adapter inherits it:
per-item successes commit independently through the shared
machinery; per-item errors classify per item (§4.3); a batch-level
failure with no per-item records classifies every uncommitted item
as `provider_error` (known) — never as ambiguous, because the
submission's outcome is not in doubt, only its products are.

### 4.3 POLICY_BLOCK and the repair chain (PROPOSAL — decision D-3)

A Standard POLICY_BLOCK enters the F3 design: recursive splitting
without voice substitution (generation/policy-split.mjs —
`synthesizeSegment` / `synthesizeLongSegment`, split ceilings
`SPLIT_MAX_DEPTH 4`, `SPLIT_MIN_PART_CHARS 50`, gen-constants.mjs:
11-14), and occurrences that remain blocked are advanced by the
server-owned repair chain — repair jobs (kind `repair`) whose
completion spawns follow-on repair jobs server-side
(coordinator.mjs:2516-2550).

For Batch, two facts gate the design:

1. **The classification does not currently survive the adapter.**
   `getBatch` collapses a done response whose single record carries
   an error — of any kind — into `BATCH_STATE_FAILED`
   (adapters.mjs:431-436). A provider policy block and a provider
   fault are indistinguishable at the terminal poll today.
   **TO-BUILD (B-G2):** the terminal poll must surface the item
   error's classification on the attempt's terminal record (at
   minimum: policy-block vs other), without changing any success
   shape. Until that surface exists, a batch item failure can only
   be `provider_error`, and F3 entry for Batch is impossible — this
   is a hard prerequisite, named here so B-G2 cannot silently skip
   it.
2. **Repair follow-ons inherit the parent lane.**
   coordinator.mjs:2536 creates the follow-on repair job with
   `lane: jobRow.lane`. Followed literally, a Batch job's blocked
   occurrence would spawn Batch repair jobs.

**PROPOSAL:** a batch occurrence reported `policy_block` (via the
new classification surface) enters the *same* server-owned chain,
but the repair job for a batch-blocked occurrence is created on the
**Standard lane**, as an explicit, designed deviation from lane
inheritance at coordinator.mjs:2536 (a TO-BUILD change, fenced to
the batch-parent case). Reasons: (a) F3's split machinery is an
inline split-and-synthesize loop in the Standard executor path —
it has no batch analog, and a ≤16-leaf split tree on the Batch lane
would be ≤16 separate fenced submissions, each carrying its own
ambiguity surface, for work whose entire virtue is being small and
immediately verifiable; (b) repair volume is rare and small by
construction (bounded by REPAIR_MAX_RETRIES inside the 12-attempt
budget), so Batch's asynchrony buys nothing there; (c) one repair
semantics for both lanes keeps the chain's accounting — one budget,
one retry bound, one commit path — single and auditable. The
alternative (batch-resubmit the split leaves) was considered and
rejected for (a) and (c). Repairs on the Standard lane count
against the same day cap and segment budget as any Standard
dispatch — the accounting never forks by lane (§2.3).

### 4.4 Exactly-once commit discipline for retries

Retries are safe because commit is fenced at four independent
layers, all EXISTING: the spend intent (primary key (job,
occurrence, generation); a known-outcome intent is never re-spent —
executor.mjs:120-138); the batch fence (§3.1 — an occurrence's
re-grant polls its existing map, never a second submission,
coordinator.mjs:3743-3745); generation supersession (a succeeded
generation requires an explicitly audited superseding resolution —
the original permit is never reused, coordinator.mjs:3830-3843);
and the binding gate itself (commit runs `validateAndBind` with
create-if-absent semantics and revision-key validation — a second
commit for the same occurrence meets the conflict gate and never
overwrites, coordinator.mjs binding section; flush-before-commit
means bytes are verified in R2 before any binding exists). A repair
job in a new job scope therefore *cannot* double-commit an
occurrence the original job already bound; the worst case is a
conflict row, which is visible, not silent.

---

## 5. Latency and stall classification

### 5.1 What the record does and does not say

No document in the local record states a provider batch latency
figure, window, or SLA — the design record's only characterization
is the client's own wording, "Batch waits for a batch window"
(scoping §4.2). B-G1 invents none. Everything below is parametric:
thresholds are Reader-side operational choices, proposed as
PARAMETERs for Rowan to fix, and the classification works for any
values chosen.

### 5.2 The polling driver (PROPOSAL)

Polls ride **drive passes** — the coordinator alarm's pass, which
runs `driveOnce` (worker-entry-prod-d6.js:1939-1962; the pass is
recorded per pass in `d6_drive_passes`). There is no second engine:
no cron, no per-batch queue messages, no polling loop inside a
request. Rules:

- A non-terminal batch plan is selected by `driveOnce` like any
  non-terminal plan (service.mjs:1047-1049); each pass polls each
  `submitted` map of the driven job **at most once** (R-Q3's
  structural bound).
- The pass cadence while work is outstanding is the coordinator's
  schedule cadence (production-observed at roughly ten minutes
  across the S1 window and the post-resume watch — recorder
  evidence, not a provider fact). The latency floor of any batch
  completion is therefore one pass interval; the design accepts
  this rather than adding a poller.
- **W-4 degradation, designed-in:** every clock in §5.3 counts
  *observed passes* (recorder rows) and wall-clock since the last
  observed pass — never assumed passes. If alarm delivery fails
  (the W-4 class: registration standing, delivery unobserved), no
  polls occur, no spend occurs, no stall clock advances, and no
  timeout fires: batch work is *inert, not endangered*, while the
  chain is silent. On chain recovery, polling resumes from the
  durable map rows exactly where it left off. Batch correctness
  never depends on alarm punctuality — only on durable rows — which
  is the W-4 lesson applied as a design constraint.

### 5.3 Progress signals

Per submitted map, each pass records: the provider state string
(from `getBatch`'s `metadata.state`), whether the map transitioned,
and the poll outcome class (pending / poll-error / terminal). A
map's `updated_at` (coordinator.mjs batch_maps) and the per-pass
recorder rows are the durable evidence. "Movement" for the stall
test means: a provider-state change, a map transition, or a
terminal outcome — recorded on an observed pass.

### 5.4 Classifications (PROPOSAL — parameters are decision D-4)

- **BATCH-IN-FLIGHT** — map `submitted`, non-terminal provider
  state, age below P-EXT. Normal; no action, no reporting beyond
  pass outcomes.
- **BATCH-LATENCY-EXTENDED** — age ≥ **P-EXT** (PARAMETER; Wren
  proposes 1 hour) without a terminal state. Informational: named
  on drive outcomes so normal Batch latency is never misread as an
  anomaly by normal-ops observation (the scoping package's R-B5
  concern, answered by naming the normal case).
- **BATCH-STALLED** — no movement (§5.3) across **P-STALL-PASSES**
  consecutive *observed* passes (PARAMETER; Wren proposes 12) AND
  wall-clock age ≥ **P-STALL-AGE** (PARAMETER; Wren proposes 6
  hours). Effect: escalation to observation (the normal-ops watch
  surfaces it to Julie + Rowan); the plan is **not** auto-halted,
  the job is **not** failed, and the provider job is **not**
  abandoned — EXPIRED is the provider's own bound and remains the
  only latency-driven terminal. Standard operations are untouched.
  A stalled classification clears on any subsequent movement.
- **BATCH-AMBIGUITY-OPEN** — an `ambiguous` map aged ≥ **P-AMB**
  (PARAMETER; Wren proposes 24 hours) without adoption. The §3.3
  job block made visible at program level; adjudication (§3.4) is
  the only action it calls for.
- **NO-PASS-OBSERVED** — no drive pass recorded in the observation
  window while batch work is outstanding. Explicitly **not** a
  provider stall and not a batch classification failure: it is the
  alarm-chain class (W-4 family), handled by the chain's own
  observation, and batch clocks provably do not advance under it
  (§5.2). Naming it here prevents the category error of blaming
  the provider — or the batch design — for a silent chain.

---

## 6. Rollback disposition

"Roll back" means something different at each stage, and one fact
constrains all of them: **a submitted provider batch job cannot be
un-submitted.** There is no cancel method in the adapter, and a
submission the provider accepted will run (or expire) provider-side
regardless of what any Reader build does. Rollback design is
therefore about Reader-side state and future behavior, never about
recalling spend already authorized.

### 6.1 Per-stage disposition

- **B-G1 (this design)** — paper. Rollback is deletion of the
  proposal. Nothing live exists.
- **B-G2 (local build)** — the build is discarded or simply never
  deployed. Production is untouched by construction.
- **B-G3 (staging)** — rollback is redeployment of the prior staging
  build under the staging build-identity discipline. Staging's
  batch state lives in staging's own coordinator store and under
  the `smoke-p8/` R2 key prefix (host/adapters.mjs key-namespace
  note): it is abandoned in place, never migrated, never read by
  production. Provider jobs submitted from staging run to
  completion or expiry provider-side; their audio is simply never
  retrieved. Their cost lands wherever §7.3 attests the staging
  credential points, bounded by the B-G3 test budget — the rollback
  record states the count and upper-bound exposure of any
  outstanding staging submissions.
- **B-G4, before the flip** (Batch-capable build live, allowlist
  still `["standard"]`) — ordinary build rollback under the
  standing law (pre-holds — halt + queue pause — before any
  rollback; the `6a73d962…` floor; separate Julie authorization).
  The batch code paths never ran; the gate's own inertness proof is
  the evidence. Nothing batch-shaped exists in the store.
- **B-G4, after the flip** (Batch admitted; batch work may be in
  flight) — rollback has two independent halves, and they must not
  be conflated:
  1. **Admission rollback** — the allowlist returns to
     `["standard"]`, by redeploy of the prior build or a flip-only
     build, with a capabilities read-back proving `batch_not_armed`
     again. From that moment: new batch intents refuse at admission
     (service.mjs:857); any batch dispatch that somehow arrives
     meets the Standard-only build's three refusal layers
     (d6-executor.mjs:677-689, :841-842) and is refused without
     provider contact; in-flight batch plans stop advancing — they
     park by refusal, they do not corrupt, because every state they
     hold is a durable row the current build simply declines to
     act on.
  2. **In-flight provider jobs** — the standing disposition,
     proposed here for the arming gate to adopt *in advance*
     (decision D-5): **INVENTORY-AND-HOLD**. At admission rollback,
     every non-terminal `batch_maps` row is inventoried into the
     rollback record (job, occurrence, provider name, state,
     counted dispatch, upper-bound exposure). The rows are
     **retained, never deleted** — the audit discipline of the
     whole program. Nothing polls them under the rolled-back build
     (§1.1 S10's halt logic has its build-level analog: an absent
     batch branch makes no provider calls). Their spend exposure is
     already fully counted and bounded — one dispatch each, at the
     §3.2 upper bound — and is reported in the rollback record in
     the three-line form. If a Batch-capable build is later
     restored, polling resumes from the durable maps and the work
     completes or expires on its own evidence; **no map is ever
     re-submitted** (§4.1(a) survives rollback). Retrieval under
     the rolled-back build does not happen, by any route.
     The alternative — an explicit terminal `abandoned` transition
     for maps — does not exist in the current state machine
     (`closed` is reserved to the never-accepted resolution,
     coordinator.mjs:552-556), and B-G1 does not invent it:
     whether B-G2 should add one is **decision D-5's second half**
     for Rowan. Absent that ruling, INVENTORY-AND-HOLD is complete
     without it: an unpolled `submitted` row is inert, counted, and
     resumable, which is everything a disposition needs to be.

### 6.2 The standing rule

**A Batch failure never rolls back Standard.** Admission rollback
touches only the batch lane: Standard plans, jobs, bindings, and
accounting are lane-independent rows, and the Standard lane's
admission, executor path, and history are exactly as they were
before the flip. The arming gate's rollback plan may not include
any act on Standard state, and a Batch incident is never, by
itself, grounds to re-hold Standard (Julie's general re-hold
authority and the WS1 emergency re-hold triggers are separate
instruments, governed by the WS1 design, not by this proposal).

---

## 7. B-2 parity and B-3 prepay

### 7.1 Why parity gates interpretation (B-2)

The staging worker's wiring materially differs from production's in
the source tree: the tree's `worker-entry.js` imports and wires the
**legacy** executor (`createExecutor`, worker-entry.js:55, :258),
while production's `worker-entry-prod-d6.js` imports only the D6
executor (worker-entry-prod-d6.js:271, :1824). A staging Batch pass
on the legacy entry would prove the adapter and the coordinator
contract — which are not in doubt — and nothing about the D6
integration, which is the entire build. The scoping package carries
this as OPEN ITEM B-2; the ruling requires parity be established
*before* staging proof is interpreted. B-G1 designs the check; the
check itself runs at B-G3, on B-G3's evidence.

### 7.2 The parity checklist (PROPOSAL — produces evidence, fails closed)

- **P-1 Entry identity.** For both scripts, record the deployed
  entry module (from the script's module set) and the `/health`
  build marker. Parity requires staging's entry to be the *same
  entry file* as production's (`worker-entry-prod-d6.js`) in the
  candidate build, or every difference enumerated and ruled on
  before any staging result is interpreted. **Fail-closed:** if
  staging's entry is `worker-entry.js` (the legacy wiring), the
  checklist FAILS and no D6 claim may be drawn from staging —
  component claims only, labeled as such.
- **P-2 Import-graph comparison.** From the candidate tree, produce
  the entry's transitive import list with per-file SHA-256 — the
  established manifest method (the Grant 1 build's 31-part
  manifest) — for the staging-deployed build and the production
  build. The code sets must be identical except an enumerated
  allowlist. Environment bindings are not code: scope, halt,
  key-prefix, and token bindings differ by design and are listed
  as binding differences, never counted as code drift.
- **P-3 Consumer wiring.** Staging's queue consumer must resolve to
  the D6 executor constructed by the same entry (P-1's substance,
  verified at the wiring seam, not just the import list).
- **P-4 Build-marker discipline.** Each deployed build's `/health`
  build must equal the pinned review commit for the exact tree
  deployed (the standing build-marker rule), for both scripts,
  recorded in the B-G3 evidence package.
- **P-5 Behavioral spot-parity (no spend).** Against staging:
  capabilities shape matches the production build's shape; a batch
  intent is admitted or refused exactly as the candidate build's
  allowlist dictates; a Standard intent behaves identically to
  production's. No provider call is made by any parity step.
- **Output.** A parity evidence record (entry identities, markers,
  manifest hashes, the difference list) filed with the B-G3
  package. Every staging result in B-G3's evidence must cite it;
  an uncited result is uninterpretable by design.

### 7.3 B-3 — the prepay question, answered as far as the record allows

**Established locally, verified by Wren's read-only reads
2026-11-06:** the staging script `opalreader-api-v2` (build
`2fe71b5f…`, scope `staging-smoke`, generation halted) carries
**no `GEMINI_API_KEY` binding at all**. Its binding set (names and
types only — secret values are never exposed by the API and none
was read) is: `ALLOWED_ORIGIN`, `COORDINATOR` (DO namespace),
`GENERATION_HALT "1"`, `OPALREADER_ACCESS_TOKEN` (secret),
`OPALREADER_GENERATION` (queue), `OPALREADER_STORAGE` (R2),
`OPALREADER_V2_SCOPE`, `R2_KEY_PREFIX "smoke-p8/"`. Production
`opalreader-api-v2-prod` carries `GEMINI_API_KEY` as a `secret_text`
binding alongside its own token secrets.

Consequences, stated at their exact strength:

1. **As deployed today, staging cannot make a provider call.** Any
   Gemini path would throw `ProviderNotConfiguredError` before any
   network contact. The question "do staging and production share
   the prepay" is therefore, for the current deployment, answered
   structurally: there is no staging credential to share anything.
2. **The sharing question becomes real at exactly one moment:**
   when a `GEMINI_API_KEY` secret is provisioned onto the staging
   script for B-G3. Secret values are write-only through the API,
   so *which* key was set can never be verified after the fact from
   any read surface. The verification step that settles B-3 without
   spending is therefore procedural and must happen at provisioning
   time, inside the B-G3 gate: (a) the binding read-back (names
   only) proving the secret exists; (b) a provisioning attestation
   recorded in the B-G3 evidence naming the key's source in
   non-secret terms — "the same AI Studio project as production"
   or "a distinct project/key" — made by whoever performs the
   provisioning, at the moment of provisioning; (c) absent or
   ambiguous attestation, the **fail-safe default applies: staging
   spend is treated as drawing on Julie's production prepay**, and
   the bounded test budget (below) is charged against it.
3. **The bounded test-budget shape B-G3 will request** (PARAMETERs
   for the B-G3 GO to fix): a segment-count ceiling **P-TEST-SEGS**
   (Wren proposes 12 synthetic segments — enough for the §8-forced
   cases: success, known failure, policy block, ambiguity, adoption)
   and a unit ceiling **P-TEST-UNITS** computed at the lane-blind
   upper bound (`upperBoundAttemptMicro` summed over the test
   segments, so the ceiling is honest before any provider fact
   exists), drawn — under the fail-safe default — against the
   production prepay balance and reported in the B-G3 record in the
   three-line form. No staging provider call of any kind occurs
   before that GO. (Staging's `GENERATION_HALT` also stands at "1";
   B-G3's deploy act must handle staging's own halt under its own
   authorization — production's holds are not staging's and are
   never touched by a staging act.)

---

## 8. B-G2 test list (preview — named intents, not code)

The ruling names B-G2's required families: throw-safe, crash-window,
reconciliation, accounting, repair, and Standard regression. B-G1
enumerates the intents B-G2 must discharge; the battery itself is
B-G2's deliverable. (Standing caveat, carried from the program's
lessons: the DO test harness is no evidence for empty-result paths —
real DO SQLite `.one()` throws where fakes may not — so throw-safe
coverage of batch read paths is explicit, not assumed.)

**Throw-safe family**
- T-1: Every new batch read path (map lookup, workView batch
  projection, terminal-record read) behaves correctly on
  empty-result throws — no null-fallback assumptions.
- T-2: Fence transaction atomicity: a throw inside the fence step
  (including the R-Q2 quota write) leaves neither a map row nor a
  dispatch row — both or neither.
- T-3: Every `note*` transition against a missing, superseded, or
  wrong-state map refuses cleanly and writes nothing.
- T-4: Adapter throws at every stage (submit transport, submit
  HTTP, poll, enumeration) leave coordinator state exactly as the
  relevant §3/§4 rule prescribes.

**Crash-window family**
- C-1: Crash between fence insert and POST → next pass converts
  `fence_without_outcome` to ambiguous; a POST is provably never
  attempted on the fence alone.
- C-2: Crash during the POST (transport ambiguity) → ambiguous;
  zero reports filed; spend intent open; block in force (§3.3).
- C-3: Crash between provider acceptance and `noteBatchSubmitted`
  → indistinguishable from C-1 by construction, and resolved only
  by adoption (§3.4) — the test proves no other exit is taken.
- C-4: Crash between terminal poll and commit → recovery resumes
  from the execution record; the map is not re-polled into a
  second commit and the submission is never repeated.
- C-5: Crash between commit and report → binding stands; report
  recovery does not double-bind (§4.4's conflict gate).

**Reconciliation family**
- R-1: Enumeration match → adoption with evidence string; polling
  resumes; cost settles from actual duration on completion.
- R-2: Enumeration no-match → byte-identical state before/after
  (state, spend, counts, exposure) — absence proves nothing,
  enforced as a test, not a hope.
- R-3: Multiple matches → the D-6 rule as Rowan fixes it (adopt-
  first, or adopt-earliest if the adapter is extended) is the
  behavior pinned; the adjudication record carries the exposure
  note either way.
- R-4: Never-accepted resolution remains non-callable: no route,
  no flow in the build can invoke `resolveBatchNeverAccepted`
  with satisfiable evidence; the fail-closed throw is exercised.

**Accounting family**
- A-1: One submission writes exactly one dispatch row, consumes
  exactly one segment-attempt unit and one reservation slot,
  recorded before the POST (R-Q1/R-Q2 ordering asserted from the
  ledger, not from logs).
- A-2: N polls and M enumerations move no counter (R-Q3/R-Q5),
  while every poll outcome is present on pass outcomes.
- A-3: An ambiguous fence ledgers at upper bound in the
  unverified-exposure surfaces from the moment it fences (§3.2).
- A-4: Mixed Standard+Batch day: derived day totals equal the
  stored counters; reconcile is clean; the PT day-boundary case
  (fence minutes before midnight, POST after) attributes the
  dispatch to the fence's day under R-Q2, with the straddler
  discipline applying at adoption (§3.4).
- A-5: A known-rejected submission's dispatch stays counted
  (R-Q6) while its cost adjudicates to the evidenced outcome.

**Repair family**
- F-1: A batch item failure carrying the policy-block
  classification (the §4.3 TO-BUILD surface) reports `policy_block`
  and enters the server-owned chain; without the classification it
  reports `provider_error` only — the prerequisite is tested, not
  assumed.
- F-2: The repair job for a batch-blocked occurrence is created on
  the Standard lane (the D-3 deviation), its split leaves commit
  through the inline split machinery, and the occurrence reaches
  ready.
- F-3: The shared 12-attempt budget and REPAIR_MAX_RETRIES bound
  hold across the lane crossing (batch submission + repair
  attempts counted in one budget).
- F-4: A chain that exhausts its budget leaves the occurrence
  blocked and visible — never silently dropped, never resubmitted
  on the batch lane by the chain itself.

**Standard regression family**
- S-1: The standing batteries (containment, P2 instrumentation,
  R5A, V-3 cold-restart shapes) pass unchanged on the candidate
  tree.
- S-2: Standard end-to-end (intent → grant → dispatch → commit →
  binding → settle) is behaviorally identical with the batch
  branch present.
- S-3: On a Standard-only build of the same tree, the three
  refusal layers refuse batch dispatches exactly as today — the
  B-G4 inertness proof, rehearsed in harness before it is claimed
  in production.
- S-4: Halt mid-flight: with `GENERATION_HALT` flipped to "1"
  while maps are `submitted`, no provider call of any class occurs
  (S10), maps wait durably, and progress resumes on lift with no
  re-submission.

---

## 9. Decisions requested of Rowan

- **D-1** — The quota counting rules R-Q1..R-Q6 (§2.2): submissions
  count as their segment count (today: 1), recorded at the fence
  step; polls, retrievals, and enumerations count 0 and are bounded
  structurally/procedurally instead.
- **D-2** — The ambiguity settlement (§3): upper-bound ledgering,
  the per-job fail-closed submission block, adoption as the only
  designed exit, and no dependency on never-accepted resolution.
- **D-3** — The repair-lane deviation (§4.3): batch-blocked
  occurrences repair on the Standard lane despite lane inheritance
  at coordinator.mjs:2536 — plus confirmation that the §4.3
  error-classification surface is a B-G2 prerequisite.
- **D-4** — The stall parameters (§5.4): P-EXT (proposed 1 h),
  P-STALL-PASSES (proposed 12 observed passes), P-STALL-AGE
  (proposed 6 h), P-AMB (proposed 24 h).
- **D-5** — The rollback standing disposition (§6.1):
  INVENTORY-AND-HOLD for in-flight maps, adopted in advance at the
  arming gate; and whether B-G2 should additionally design an
  explicit terminal map state for abandoned submissions.
- **D-6** — The multiple-match adoption rule (§3.4): adopt-first
  (legacy behavior, exposure note carried) vs adopt-earliest
  (requires extending the adapter's match shape in B-G2).

---

## 10. What B-G1 does NOT do

No implementation. No allowlist change — `D6_LANE_ALLOWLIST` stands
at `["standard"]` and this proposal never touches it. No staging
deployment, no staging secret provisioning, no provider call of any
kind, no production read beyond the read-only binding/health checks
cited in §7.3. No GO is presented to Julie by this document; B-G1's
own acceptance is Rowan's design ruling, and B-G2's build, B-G3's
staging proof (with its own GO and test budget), and B-G4's arming
act each remain separately gated under the ruling. **B-1 remains
OPEN:** provider Batch pricing is nowhere assumed, the cost model
stays lane-blind, and if pricing is ever to be settled it is
settled at B-G3 on evidence gathered under the bounded test budget
— or it remains open, and Batch's case continues to rest on its
execution shape, not on savings.

— Wren (drafted 2026-11-06; B-G1 design only)
