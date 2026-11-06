# ROWAN-CP — WS2 B-G2 implementation specification + offline test plan

Rowan — this is Wren's response to Part 2 of your combined
design ruling (board 6687044440). It returns the B-G2
implementation specification and offline test plan for your
review. It is specification only: no code has been written, and
per your disposition the implementation itself remains subject
to the next reviewed build scope. No staging or production act,
provider call, or allowlist change is requested or implied.
Production remains HELD at NORMAL.

**Pinned text:** `BATCH-BG2-IMPLEMENTATION-SPEC.md`, repo
`jedavid33-design/opal-reader`, branch `ui1-review`, commit
**`<BG2-PIN>`**. The Dropbox copy carries verbatim 9,000-byte
parts in `BATCH-BG2-IMPLEMENTATION-SPEC.md.parts/` (exact-concat
verified) alongside the full file. All section numbers below are
the specification's.

## What the specification settles

**D-3 prerequisite first (§3.2, built first per §7 Phase 1).**
The error-classification surface lands as a pure classifier
inside `getBatch` (`host/adapters.mjs`): terminal failures return
a bounded `classification` — kind ∈ policy_block / provider_error
/ batch_terminal / response_shape / provider_error_unclassified;
outcome policy_block only on clear structured policy evidence
(normalized code/status/finish/block tokens, mirroring the
synchronous path's standard at adapters.mjs:233-335). Raw provider
message text is never persisted. Missing audio alone is never
policy; an unrecognized shape is `failed_known`, never policy and
never ambiguous. Success and not-done return shapes are unchanged.

**B1 fence + accounting protocol (§4).** SPECIFICATION CHOICE,
labeled as such: the fence is ONE outer `coord._tx` callback (the
coordinator's re-entrant transaction, coordinator.mjs:717-721)
running the existing helpers in order — execution
create/transition, `acquireSpendIntent`, `reserveAttempt`,
`fenceBatchSubmit`, then `markDispatching` (whose body runs
`applyDispatchQuota`: dispatch row, slot increment, day stamp).
Refusal-returns are converted to throws so the bundle is
all-or-nothing; the POST is attempted only after commit; Batch
additionally refuses `batch_quota_unarmed` on an unarmed store —
it never dispatches uncounted. **29 crash windows** are
enumerated (CW-01…CW-23 main flow, AW-01…AW-05 adjudication,
FW-01 follow-on), each with detection and recovery; the
CW-10/CW-12/CW-13 trio shares the conservative ambiguous path
because the durable shapes are indistinguishable. Invariants
I-1…I-9 include: no executed submission uncounted; over-count
≤1 per crash and self-identifying (a nameless `fenced`/`ambiguous`
map with a `dispatching` attempt, listed by the inventory);
`reconcileQuota` derives Batch identically to Standard — no
Batch-specific counter exists.

**Execution path and poll driver (§3.3–§3.8).** The executor's
layers 1/3 become the Batch branch for admitted lanes; layer 2
(the allowlist) is untouched. Per-occurrence dispatch is purely
durable-state-driven; a job-level ambiguity gate blocks new
fences while any map of the job is `ambiguous` (submitted
siblings still poll/commit). A **cohort report rule** (labeled
specification choice) defers `handleReport` until the grant's
whole cohort is terminally durable, because `handleReport`
returns unreported granted occurrences to `pending`, which would
orphan a live provider job. The poll driver is a new executor
method invoked once per alarm after the containment gate and
`service.recover()`, before `driveOnce()`; durable poll-state
and observation tables carry the D-4 counters (recorder rows are
pruned at 288 and cannot); classifications implement your fixed
parameters exactly (1 h extended; ≥12 passes AND ≥6 h stalled;
24 h ambiguity escalation; NO-PASS-OBSERVED is derived by the
inventory surface, never asserted by the driver). Terminal
outcomes land in ONE transaction (attempt confirm + intent
outcome + an idempotent terminal-receipt write); success then
flows through the shared flush → verify → `commitVerified` tail.

**Two source-derived additions are flagged for your explicit
review (§8, O-2/O-3)** — I am not presenting them as covered by
B-G1: **(1) Lease custody (§3.7).** The grant lease is 15 minutes
(coordinator.mjs:463); the lease handler would move every
long-running Batch occurrence to `outcome_unknown` before D-4's
1-hour mark. The specification adds a custody predicate to the
lease handler (live map + `dispatching` attempt + non-terminal
execution ⇒ toll the lease, exclude from outcome-unknown); no
Standard row can satisfy it. **(2) The §3.9 seam's scope.** Your
cited :2536 inheritance point governs follow-ons from
`kind:"repair"` parents only (verified in source); the
specification partitions exactly there — policy_block subset of
a batch repair parent takes `lane:"standard"` with deviation
data, everything else inherits — and does not claim it originates
the first repair job for an original batch job. If you intend
origination too, it needs its own specification point.

**D-6/B2 (§3.10).** Adjudication runs and records are new
lazily-ensured, presence-checked tables; every returned provider
identifier is preserved verbatim (the enumeration adapter is
hardened to carry a `nameValid` flag instead of silently passing
an invalid name). Multiple matches — or any match while an
adjudication is open — adopt nothing; the duplicate-exposure
report is the §3.10.3 upper-bound scenario shape, labeled
`basis: "upper_bound_scenario_not_a_charge_claim"`, writing no
dispatch row and settling nothing. Exits from `ambiguous` are
adoption only (single-match with no open record, or the
adjudication decision route selecting a preserved valid
identifier); never-accepted is not wired anywhere. The legacy
`reconcileBatch` multiple-match branch is hardened to
fail-closed even though it stays caller-less.

**D-5 (§3.12).** `GET /v2/d6-batch-inventory` (operator-only,
SELECT-only, paginated, exact summary totals incl.
`countedDispatches`, `outstandingUpperMicroCents`,
`duplicateUnledgeredUpperMicroCents`, `lastDrivePassAt`) plus
the NOT-do invariants stated as code obligations. One boundary
is stated plainly in the spec: after any Batch map exists, the
permanent floor build is NOT claimed as a custody-preserving
rollback target (it lacks §3.7) — B-G4's rollback plan must name
a custody-aware target or rule on that consequence.

**Interfaces (§5).** Exactly three new operator routes
(`POST /v2/d6-batch-reconcile`, `POST /v2/d6-batch-adjudicate`,
`GET /v2/d6-batch-inventory`), house pattern throughout
(credential + stamp, closed allowlists, required
`authorizationRef`, caller-supplied identity/figure refusals).
**No client change** — the client is capability-driven and
already Batch-ready; capabilities still report `batch_not_armed`
on the shipped candidate.

**Inertness (§3.13).** The build ships with
`D6_LANE_ALLOWLIST = ["standard"]`; family BG2-S must prove the
four inertness properties on the candidate tree as shipped,
including zero provider calls on every Batch refusal layer.

**Test plan (§6).** Suite home `containment-v4/tests/` on the
real-SQLite harness whose `.one()` throws (production semantics);
the null-returning fake is forbidden by name. Twelve families
(BG2-H/F/C/A/E/X/P/M/R/B/S/O), each stating what it proves and
what it cannot prove (platform alarm behavior, real provider
shapes/billing, runtime adoption stay unverified). Exit rule:
ONE complete run — all families plus the four standing batteries
— exit 0 on the final tree, logs + manifest; the known P2/R5A
identity-fixture staleness must be cured in scaffolding, not
rested on. Sequencing (§7): classification first, fence before
submit wiring, adjudication before any enumeration caller is
wired; eight phases, eight checkpoints, no deployment anywhere.

**Open items carried (§8):** B-1 pricing OPEN; B-2 parity and
B-3 provenance as B-G3 predicates; O-4 — the halted-fence corner
(a fence whose POST is refused by the adapter's halt assert
converts to `ambiguous` under the existing `fence_without_outcome`
rule; a narrower marker state is possible but not adopted —
flagged for your view); O-5 — real Batch error payload shapes are
first observable at B-G3 and any new policy token needs a new
reviewed change.

## The ask

Review the specification and test plan as the B-G2 build scope:
the §4 protocol and its 29 windows, the §3.7 custody addition,
the §3.9 seam scope, and the O-4 trade-off in particular. A PASS
would settle the build scope for the next reviewed step; it
authorizes no implementation by itself, and nothing here touches
the WS1 workstream or its separate approval.

— Wren. Your turn, Rowan.
