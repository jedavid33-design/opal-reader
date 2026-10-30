# Uncertainty-disposition DESIGN — the `estimated_unverified` settlement class

**Design packet for Rowan's review, prepared under her ruling
(issue #15, comment 6534423731): "§8 option: APPROVED FOR
REPO-ONLY DESIGN, not implementation/deployment."**

**Revision 2 — focused corrections to Rowan's design review
(issue #15, comment 6534952386).** Rowan gave the design a
principle PASS and a **FOCUSED DESIGN HOLD** on two safety
seams — **D1** (read-before-first-write bootstrap gap) and
**D2** (post-disposition rollback fence) — plus three
clarifications, and answered §13 Q1–Q4. This revision answers
all of it: D1 in §5.4 + §6.1 + tests 13–14; D2 in §5.3 +
§6.2 + §11 + §12 + test 15; clarification 1 (labels) in §3,
§6.3, §6.4 and the research §3.1; clarification 2
(ownership/particulars + closed schema) in §4.1, §5.2, §7.2;
clarification 3 (amendment evidence) in §8. Q1–Q4 are
recorded as **decided** in §13 and implemented where they
land. The correction map is collected in §13.5 for the
focused re-review.

Companions: `ADJUDICATION-PROPOSAL.md` (§8 is the concept this
packet designs; §§1–7 are the case it disposes) and
`BILLING-ATTRIBUTION-RESEARCH.md` (the evidence record, as
corrected by Rowan's R1–R3 and clarification 1).

**This document is a design only.** It authorizes nothing: no
code is built by it, no production action is taken under it,
no settlement is recorded by it. Build, deploy, settle, and
retire remain separate stages, each with its own Rowan review
and its own explicit Julie approval (§11). Proposal §6 remains
**NOT SUBMITTED**. No per-attempt charge is proven; nothing in
this design asserts one. Julie needs to provide nothing for
this packet.

**Supersession note (R1–R3).** Rowan's corrections R1–R3 are
applied to the research document. Two summary passages in the
proposal (`§2.1`'s "bounds any attributable charge" and
`§7`'s "must be enabled prospectively" / "[0, its upper
bound]") carry the pre-correction phrasing; they are
superseded by the corrected research and by R1–R3, and the
proposal is in any case **not executable** (Rowan, 6534423731).
The proposal file is deliberately left byte-identical so the
correction history stays legible; this design follows the
corrected record throughout.

---

## 1. Problem and exact scope

One attempt in one plan is financially unresolvable on the
evidence that exists or can be obtained:

- Plan `plan:603ab416bd67ab1b25de97be` (Forever Pucked,
  chapter scope, phase `forever-pucked`, lane `standard`),
  state `halted_unknown`.
- Exactly one of its attempt-log rows is `phase='confirmed',
  outcome='unknown', cost_micro_cents NULL` — the Oct 29, 2026
  attempt whose provider charge Google cannot attribute
  retroactively at per-request granularity (research, as
  corrected: Google's finest retroactive lens is day × SKU;
  every allocation consistent with the aggregate leaves the
  attempt's charge unfixed).
- The deployed settlement vocabulary
  (`genstore.reconcileUnknown`: `SETTLEMENT_OUTCOMES =
  success / failed_known / no_charge`, validated as a
  (cost, outcome) pair) can only record a **known** cost or a
  **proven** no-charge. Neither is available. Under the
  proposal's §2.4 the only justified branch is STOP — forever,
  on this evidence class.
- While the attempt stays `unknown`, `retireHaltedPlan`
  refuses (`unknown_billing_open` — it counts the plan's
  confirmed/unknown **attempt rows**), the plan stays
  `halted_unknown`, and the admission fence keeps the plan's
  18 Chapter 2 segments fenced: Chapter 2 cannot be
  regenerated.

**Design goal:** a disposition that closes the attempt for
plan-retirement purposes while recording its cost as what it
honestly is — an **estimate, permanently flagged
provider-unverified** — with budget accounting that stays
conservative, an audit trail that can never be mistaken for a
known-cost settlement, and zero change to the behavior of the
existing known/no-charge machinery.

**Out of scope, explicitly:** settling any other attempt;
any change to `reconcileUnknown`, `SETTLEMENT_OUTCOMES`,
`KNOWN_OUTCOMES`, or the confirm path; any generation, grant,
queue, or halt change; the re-arm; Chapter 3. The disposition
is mechanically capable of addressing one named attempt per
call, and its first (and, absent a future case, only) subject
is the attempt above.

## 2. Recommendation (headline)

**Adopt a distinct attempt outcome `estimated_unverified`,
written only by a new, separate disposition path, with the
estimate figures and full provenance in a separately linked
adjudication table. `cost_micro_cents` stays NULL. The
deployed reconcile machinery is not modified at all.**

Concretely:

1. A new store function, `genstore.adjudicateEstimated`, sits
   beside `reconcileUnknown` and shares its discipline
   (one transaction, server-verified plan ownership,
   same-transaction audit, refusals move nothing) but none of
   its vocabulary: it never writes `cost_micro_cents`, never
   produces a `KNOWN_OUTCOMES` value, and is the **only**
   writer of the new outcome.
2. The attempt row's outcome becomes `estimated_unverified`;
   its `cost_micro_cents` remains **NULL** — preserving the
   ledger's standing invariant that a numeric
   `cost_micro_cents` means a *known* cost (the confirm rule:
   known outcomes must carry a numeric cost; `unknown` must
   carry NULL; the new outcome joins the NULL side, by a
   separate explicit rule in the disposition function, **not**
   by extending `confirmAttempt` — see §4.3).
3. The estimate lives in a new table,
   `d6_billing_adjudications` (§5), keyed by `attempt_id`:
   the server-derived estimate, the server-derived budget
   reservation, the estimate basis, evidence references, the
   recorded authorization reference, and provenance. A
   companion append-only table,
   `d6_billing_adjudication_amendments`, ships in the same
   schema (§5.1) to carry any future provider-evidence
   supersession — but per Q3 (§13) the amendment **operation
   and route are deferred** to a later, separately reviewed
   package; this build ships the schema only (§8).
4. `phaseAccounting` gains two new read figures —
   `estimatedUnverifiedMicro` and `reservedUnverifiedMicro` —
   while `settledMicro`, `inFlightUpperMicro`, and
   `unknownOpen` keep their exact current definitions (§6).
   The new figures are read through the presence-checked,
   non-mutating absent-table discipline of §5.4, so every
   surface is safe on a deployment where no disposition has
   ever executed. Budget gating uses the **reservation**;
   displays show recorded/known settled, unverified
   estimate/reservation, and remaining authorization budget
   as three separate figures (§6.3, clarification 1).
5. A new operator route in the same fence class as the
   reconcile route (§7) is the only caller. The disposition
   creates no plan, grant, execution, or queue message, and
   never touches `d6_execution_records`.

### 2.1 Alternatives considered and rejected

**(a) Overload the deployed settlement path** — add
`estimated_unverified` to `SETTLEMENT_OUTCOMES` and pass the
estimate as `knownCostMicro`. *Rejected:* the pair validation
converts every numeric cost into a known cost by construction
(`final_cost_micro_cents INTEGER NOT NULL`; the attempt is
recorded under a `KNOWN_OUTCOMES` value at that cost). An
estimate passed through it becomes indistinguishable from a
proven charge in the attempt log, in `phaseAccounting`'s
settled sum, and in every downstream read. This is exactly
the promotion Rowan's invariant 1 forbids, and it would
change the semantics of machinery whose current behavior is
reviewed, pinned, and live.

**(b) Adjudication table only — attempt stays `unknown`.**
*Rejected:* the retire guard and `phaseAccounting.unknownOpen`
both key on the attempt row's outcome. Leaving it `unknown`
means retirement still refuses unless the guard is changed to
join the adjudication table ("unknown rows *without* an
adjudication row"). That weakens a guard whose simple,
attempt-row definition Rowan fixed in HOLD 2, and leaves the
phase's unknown-billing flag with no clean clearing rule.
The attempt row itself should tell the truth about the
attempt; a side table alone makes the ledger's primary record
the least honest surface in the system.

**(c) New outcome + estimate column on `d6_attempt_log` via
ALTER.** *Rejected as the estimate's home* (the outcome half
of this option is adopted): the codebase's proven
schema-evolution pattern for operator mechanisms is additive
lazy DDL for a **new table beside its only writer** —
`d6_reconcile_audit`, `d6_plan_retirements`,
`d6_quarantine_holds` — deliberately kept out of `GEN_SCHEMA`
because the correction suites pin the bootstrap's table set.
A new column on the core ledger table is a different,
heavier migration class, and a bare numeric column next to
`cost_micro_cents` invites exactly the misreading invariant 1
exists to prevent. The adjudication table carries richer
provenance (basis, evidence, authorization) than a column
should.

**(d) Record the estimate as `failed_known` at the upper
bound "to be conservative."** *Rejected:* it fabricates a
billing fact — the precise failure HOLD 1 corrected. Budget
conservatism is achieved by the reservation in the accounting
layer (§6), not by lying in the ledger.

## 3. Rowan's four invariants — compliance map

**Invariant 1 — never promote estimated into known.**
The estimate never enters `cost_micro_cents` (stays NULL),
never enters `settledMicro` (its SQL sums only
`success / failed_known / policy_block` rows — unchanged),
and is stored in a separate field of a separate table
(`estimated_cost_micro_cents` in `d6_billing_adjudications`,
§5). Every read surface that can show it — diagnostics,
capabilities, plan summary — must show it under its own key
with its unverified status (§6.3, §7.3); §10 test 12 makes
"no surface emits the estimate under a settled/known key" a
fixture assertion. The flag survives retirement because the
adjudication row is never deleted and the phase/plan reads
join it permanently (§6.3). Existing `known`/`no_charge`
contracts are untouched at the source level: no deployed
function changes behavior (§2.1a). Legacy data is unchanged:
the disposition writes exactly one attempt row's outcome and
one adjudication row.

**Invariant 2 — budget math explicitly provisional.**
`phaseAccounting` reports ledger-recorded known settled,
unverified estimate, unverified reservation, and in-flight
separately; the authorization remainder is computed as
`budget − settled − reservedUnverified − inFlight` (§6.2) —
the reservation, not the estimate, gates, because gating is
where conservatism belongs. **Label discipline (clarification
1, Rowan 6534952386):** the settled bucket is **recorded/known
under the existing ledger** — it is *not* provider-verified.
"Known" everywhere in this design is a ledger-contract status
(a figure the system's existing contracts recorded as a known
cost), never a claim that Google verified a per-call charge;
the research notes even the smoke's settled figure is the
system's estimator output recorded under those contracts, and
no per-attempt figure in the system is provider-verified.
The unverified bucket carries the literal status
`provider_unverified` on every surface that shows it —
diagnostics and plan/phase summaries included — **before and
after retirement** (§6.3). The design states in §6.4 what
Rowan's R2 requires: the reservation is a **modeled internal
allowance** (the attempt's recorded chars/10 upper figure),
**not a certified cap on Google's real charge**; if the real
charge exceeded it, the books learn that only through a
provider correction, handled by the append-only amendment
path (§8) — prior audit rows are never edited or deleted.
This design does not relitigate existing settlements; it
guarantees the *new* class is never folded into the recorded
bucket and never displayed as verified.

**Invariant 3 — one-way, exactly-once disposal.**
The disposition's subject is exactly one attempt, identified
by `attemptId`, in exactly one plan, identified by `planId`
and verified against the attempt's server-stamped plan
linkage (the `reconcile_plan_mismatch` discipline).
**Phase source of truth (clarification 2):** the attempt
row's `phase` column is a **lifecycle state** (`confirmed`),
not a budget phase name; the budget phase for the disposition
is resolved as `attempt.plan_id → d6_plans.phase`, and the
particulars (the plan entry carrying `char_count` and the
recorded upper figure) are validated exactly as §4.1 step 6
specifies, failing without mutation on any defect.
Preconditions are checked **inside the transaction** (§4.1).
Exactly-once is structural: the transition guard
(`outcome='unknown'`) makes a second call refuse
`attempt_not_unknown`, and the adjudication table's
`PRIMARY KEY (attempt_id)` makes a second audit row
impossible. One-way: no function transitions *out* of
`estimated_unverified` except the evidence-gated amendment
(§8) — which is **deferred** (Q3): it is not built with this
package, and enabling it later requires provider evidence,
human review of that evidence, and its own authorization
(clarification 3). As built, the disposition is strictly
one-way. The disposition writes no execution record, creates
no grant/plan/job/queue message, and changes no plan state —
the plan remains `halted_unknown` until the separately gated
`retireHaltedPlan` (§9). Malformed, duplicate, cross-plan, and
partial mutations refuse with zero collateral change:
route-level rejections return before the store is called;
store-level refusals throw inside the transaction (§4.2,
§7.2); §10 tests 3–6 cover the matrix. Execution-time gates
(fresh identity reads, Julie's approval, operator credential)
are specified in §7 and §12 — the design states them;
performing them belongs to the execution gate.

**Invariant 4 — concrete design/evidence before code.**
This packet is that design: schema + migration/rollback
(§5, incl. the D1 read discipline §5.4 and the D2 rollback
fence §5.3), precise `phaseAccounting` behavior and budget
calculations with a worked example (§6), operator route/guard
(§7), audit visibility (§7.3), the outcome-vs-table question
answered with reasons (§2), retirement-guard treatment (§9),
tests for non-resumption in **both** halt states, stale-message
dispatch refusal after retirement, cold pre-disposition reads,
rollback shape-fencing, and negative controls (§10). Build
comes only after Rowan's design review and Julie's design
approval (§11).

## 4. The disposition operation (store contract)

### 4.1 `genstore.adjudicateEstimated(attemptId, { planId, authorizationRef, note })`

Executed in one coordinator transaction (`coord._tx`, the
`reconcileUnknown` pattern). Steps, in order:

1. Load the attempt row; missing → throw
   `attempt_not_found`.
2. Require `phase='confirmed' AND outcome='unknown'`; else
   throw `attempt_not_unknown` (this is also the duplicate /
   already-disposed refusal: a disposed attempt is no longer
   `unknown`). (The `phase` tested here is the attempt's
   **lifecycle state** — see step 4 for the budget phase.)
3. Require `planId` present and equal to the attempt's
   server-stamped `plan_id`; mismatch → throw
   `adjudication_plan_mismatch`.
4. Load the plan; require it exists and
   `state='halted_unknown'`; else throw
   `adjudication_plan_not_halted_unknown`. (The disposition
   exists to unblock halted-plan retirement; disposing an
   attempt in a live or terminal plan is out of scope and
   refused.) **Resolve the budget phase as `plan.phase`**
   (clarification 2): the plan row reached via the attempt's
   server-stamped `plan_id` is the source of truth for the
   phase; require it to be a non-empty string, else throw
   `adjudication_particulars_missing`. The attempt row's own
   `phase` column is never read as a phase name anywhere in
   this operation.
5. Require `authorizationRef` a string that is **non-empty
   after trimming** (the recorded reference to Julie's
   execution approval — §7.2); missing/blank → throw
   `adjudication_authorization_required`. The store records
   the trimmed value; it does not and cannot verify it — the
   same posture as the existing operator routes, whose *use*
   is Julie's separate authorization. Recording the reference
   makes any use auditable against the board record.
6. **Particulars — validated before any figure is derived
   (clarification 2).** Load the plan entry for
   `(plan_id = attempt.plan_id, occurrence_id =
   attempt.occurrence_id)` from `d6_plan_entries`; require
   **exactly one** matching row (zero — or, defensively,
   more than one — → throw `adjudication_particulars_missing`).
   Require, of that entry and of the attempt row:
   - entry `char_count`: a finite **safe integer > 0**;
   - entry `upper_micro_cents`: a finite **safe integer ≥ 0**
     (the plan-build recorded upper for this occurrence);
   - attempt row `upper_micro_cents`: a finite **safe
     integer ≥ 0** (the reservation recorded at dispatch).
   Any defect → throw `adjudication_particulars_missing`,
   **without mutation**. Then derive the figures
   **server-side only** (§5.2): the estimate from the entry's
   `char_count` via `expectedCostMicro`; the reservation from
   the attempt row's recorded `upper_micro_cents`.
   Caller-supplied money figures are rejected at the route
   (§7.2) and are not parameters of this function at all.
   The audit row (§7.3) records the **source-row identities
   and bases**: attempt_id, plan_id, occurrence_id, the entry
   key `(plan_id, occurrence_id)`, `char_count`, the entry's
   recorded upper, the attempt's recorded upper, and the
   resolved `plan.phase`.
7. Ensure the adjudication schema (lazy DDL, §5.1 — both
   tables, one DDL batch, inside this transaction), then:
   - `UPDATE d6_attempt_log SET outcome='estimated_unverified',
     updated_at=? WHERE attempt_id=?` — `cost_micro_cents`
     is **not** in the SET list; it remains NULL.
   - `INSERT INTO d6_billing_adjudications (...)` — one row,
     same transaction.
8. Phase-flag clearing, mirroring `reconcileUnknown` exactly:
   recompute the phase's accounting; if `unknownOpen === 0`,
   clear `d6_phase_state.halted_unknown_billing` for the
   plan's phase in the same transaction, and report
   `haltCleared` in the result. This is **decided** (Q1,
   §9.3): the flag means "an unadjudicated unknown exists";
   clearing it is **not** re-arm authority — the plan's own
   `halted_unknown` state, the global halt, and the paused
   queue are separate latches this step does not touch, and
   the phase keeps its visible `provider_unverified`
   exposure (§6.3).
9. Return `{ attempt, adjudication, haltCleared }`.

The function writes nothing else: no execution record, no
grant, no plan row, no job row, no queue message, no settings.

### 4.2 Refusal vocabulary (store → service mapping)

Following `reconcileUnknownAttempt`'s pattern (errors map to
`{ outcome: "rejected", reason }`; a refusal moves nothing):

| Store throw | Service reason |
|---|---|
| `attempt_not_found` | `attempt_not_found` |
| `attempt_not_unknown` | `attempt_not_unknown` |
| `adjudication_plan_mismatch` | `adjudication_plan_mismatch` |
| `adjudication_plan_not_halted_unknown` | `adjudication_plan_not_halted_unknown` |
| `adjudication_authorization_required` | `adjudication_authorization_required` |
| `adjudication_particulars_missing` | `adjudication_particulars_missing` |
| `adjudication_schema_inconsistent` (§5.4; thrown by the accounting read) | surfaces as an error / guard refusal — never a settlement reason and never zeros |

### 4.3 Vocabulary placement

`estimated_unverified` is defined as a disposition outcome
constant beside the disposition function. It is **not** added
to `ATTEMPT_OUTCOMES` (so `confirmAttempt` continues to refuse
it — the dispatch path can never produce it), **not** added to
`KNOWN_OUTCOMES` (so no known-cost rule can ever claim it),
and **not** added to `SETTLEMENT_OUTCOMES` (the deployed
reconcile path is untouched). The build must audit every
consumer of attempt outcomes (accounting SQL, diagnostics,
plan status, executor bookkeeping) for exhaustive handling of
the new value; §10 test 11 pins the legacy behaviors.
(Grounding note: in the pinned source, `ATTEMPT_OUTCOMES` has
no consumers outside `genstore.mjs`; accounting reads use
literal outcome lists in SQL, each of which §6 addresses
explicitly.)

## 5. Schema — additive, lazy, no migration of existing tables

### 5.1 DDL (ensured by the disposition writer, the established pattern)

Following `d6_reconcile_audit` / `d6_plan_retirements`
precedent: the DDL lives beside its only writer, is ensured
lazily inside the disposition transaction (both tables in one
DDL batch), and is **not** added to `GEN_SCHEMA` (the
correction suites pin the bootstrap's table set; a store that
never adjudicates never grows these tables). No `ALTER` of
any existing table; no backfill; legacy data untouched.
**Sequencing (Q3, decided):** both tables ship **with the
disposition build** — the schema must exist before any
disposition executes, and it costs nothing while unused. The
amendment *operation and route* do **not** ship with it (§8).

```sql
CREATE TABLE IF NOT EXISTS d6_billing_adjudications (
  attempt_id TEXT PRIMARY KEY,
  plan_id TEXT,
  phase TEXT,
  disposition TEXT NOT NULL,              -- 'estimated_unverified' (v1 vocabulary: this value only)
  estimated_cost_micro_cents INTEGER NOT NULL,
  reserved_cost_micro_cents INTEGER NOT NULL,
  estimate_basis TEXT NOT NULL,           -- derivation record incl. source-row identities, §5.2
  evidence_refs TEXT,                     -- JSON array of evidence identifiers
  authorization_ref TEXT NOT NULL,        -- recorded Julie-approval reference for this execution
  note TEXT,
  source TEXT,                            -- stamped server-side ('operator-route'), never caller-supplied
  current_amendment INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS d6_billing_adjudication_amendments (
  attempt_id TEXT NOT NULL,
  amendment_seq INTEGER NOT NULL,         -- 1, 2, ... per attempt
  kind TEXT NOT NULL,                     -- 'verified_supersession' (v1 vocabulary: this value only)
  verified_outcome TEXT NOT NULL,         -- 'success' | 'failed_known' (a KNOWN_OUTCOMES value)
  verified_cost_micro_cents INTEGER NOT NULL,
  evidence_refs TEXT,                     -- JSON array; REQUIRED non-empty for this kind (necessary, not sufficient — §8)
  authorization_ref TEXT NOT NULL,
  note TEXT,
  source TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (attempt_id, amendment_seq)
);
```

### 5.2 Figure derivation (server-side, frozen at disposition)

- **Estimate** = `expectedCostMicro(char_count)` for the
  attempt's own occurrence, with `char_count` read from the
  validated `d6_plan_entries` row for (plan_id, occurrence_id)
  (§4.1 step 6) — the attempt's **own-length** estimator value
  at the deployed rate (`round(chars / 15.96 × 225)`), *not*
  the job's flat 19,652 grant estimate (a mean over 18 entries,
  and not this attempt's figure). `estimate_basis` records the
  derivation **and the source-row identities** verbatim, e.g.
  `expectedCostMicro(char_count=NNN) @ gen-constants rate 225/15.96; entry (plan:…, occ:…) upper_micro_cents=MMM validated; reservation = attempt-row upper_micro_cents=RRR (upperBoundAttemptMicro, recorded at reservation); grant-time flat estimate 19652 NOT used`.
- **Reservation** = the attempt row's own recorded
  `upper_micro_cents` (written at reservation time on the
  chars/10 basis, `upperBoundAttemptMicro`) — the figure the
  budget machinery actually held against this attempt while
  it was in flight (`phaseAccounting`'s in-flight sum reads
  attempt rows), reused rather than recomputed, so the
  disposition converts the in-flight hold into the permanent
  reservation with no gap and no double count. The plan
  entry's recorded upper for the same occurrence is validated
  (§4.1 step 6) and recorded in the basis alongside it; both
  derive from the same `upperBoundAttemptMicro` formula.
- Both figures are computed inside the transaction from
  persisted records and frozen into the adjudication row.
  They are never recomputed afterward; if the estimator's
  constants ever change, historical dispositions keep the
  figures they were recorded with.

### 5.3 Rollback and the post-disposition compatibility fence (D2)

- **Code rollback before any disposition executes:** clean.
  The tables are additive and unread by prior code; the new
  outcome value exists nowhere in data. No fence is needed
  because no exposure exists.
- **The hazard, stated plainly.** After a disposition
  executes, exactly one attempt row carries
  `estimated_unverified` and one adjudication row carries the
  reservation. A pre-disposition build's accounting excludes
  that row from both settled (not a known outcome) and
  `unknownOpen` (not literally `unknown`): its phase reads
  would omit the unverified reservation from the budget, omit
  the `provider_unverified` status from every surface, and
  could report a misleading remaining budget — and a re-arm
  on such a build would spend against a budget that has
  silently forgotten the exposure. "Fix-forward is preferred"
  is not a fence. This section is the fence, pinned as an
  **operator runbook decision**.

**Decision 1 — the rollback floor.** Once any disposition
has executed, the disposition build — identified by its exact
pin and script etag, recorded in the disposition execution
record (§12) — is the **rollback floor**: the oldest build
that may ever run against the store while any adjudication
row exists. Rollback targets are the floor build or any later
adjudication-aware build. **Rollback to any pre-disposition
build is prohibited** — not discouraged — for exactly as long
as an adjudication row exists (which is permanently, unless
the deferred amendment path ever supersedes it, and the floor
rule is re-evaluated under that package if it ever lands).

**Decision 2 — pre-rollback holds and read-back.** Before
*any* post-disposition code rollback (including to an
adjudication-aware target):

1. Capture an **external adjudication read-back** — the
   adjudication rows and the affected phase's full accounting
   (all five figures, §6.1) via the operator/diagnostics
   reads — and archive it **outside the worker** with the
   rollback record (board/runbook evidence). This archived
   copy is the exit gate's comparison baseline (Decision 3).
2. **Verify and hold `GENERATION_HALT=1`**: the script
   settings/bindings read-back shows `GENERATION_HALT` =
   `"1"` and `/health` reports generation halted. If the halt
   is not set, set it and read back before proceeding.
3. **Verify the queue is PAUSED**: `delivery_paused` = true
   on the generation queue (cf-api read-back).
4. **Generic re-arm is BLOCKED for the whole window**: from
   the first rollback step until the exit gate passes, no
   halt flip, no queue unpause, no grant, no generation, no
   spend — for any reason, including "test" unpauses.

**Decision 3 — the verifiable exit gate.** The rollback is
not complete, and the halt/queue posture may not change for
any reason, until **all** of the following are read back from
the live (rolled-back) build and match:

- `/health` build identity equals the intended target, and
  the target is at or above the rollback floor;
- the capabilities phase object for every phase holding
  adjudications exposes `estimatedUnverifiedMicroCents` and
  `reservedUnverifiedMicroCents` with values **exactly equal**
  to the archived pre-rollback read-back;
- the disposed plan's summary still shows its estimate with
  the `provider_unverified` status.

An absent key or a value mismatch means the live build cannot
account for the disposition: **re-arm remains BLOCKED and
spend remains prohibited**; the only exits are rolling
forward (or restoring) to an adjudication-aware build and
re-running the gate. No path through this gate — and no
rollback method of any kind — may turn unverified exposure
into apparent available funds: a rollback that would do so is
a prohibited operation under Decision 1, full stop.

**Sentinel candidates, evaluated.** Rowan's review prefers a
compatibility-safe rollback build or a persistent sentinel
check if feasible. (i) *Compatibility-safe build:* adopted —
that is the rollback floor (Decision 1). (ii) *Leaving
`d6_phase_state.halted_unknown_billing` set as a sentinel:*
rejected — pre-disposition builds do respect that flag at the
grant guard, but the flag's meaning is decided (Q1: "an
unadjudicated unknown exists"); leaving it set after
disposition would falsify it, and it would fence the phase on
**all** builds including adjudication-aware ones (the guard
check is not version-aware), permanently defeating the
disposition's purpose. (iii) *Reducing the settings monthly
cap by the reservation:* rejected — the cap is an outer
backstop under a different contract, is phase-invisible,
interacts with settings CAS revisions, and misstates Julie's
own settings to encode a phase fact. (iv) *A sentinel old code
checks:* impossible — pre-disposition code cannot read a
table or flag it was never written to read; any claim
otherwise would be a fake guarantee. (v) *Adopted detection
layer:* the adjudication row itself is the permanent in-data
trace (never deleted, amendment-superseded only under §8);
the exit gate's key/value comparison (Decision 3) is the
executable verification that a live build accounts for it,
and §10 test 15 pins both the consumer-side shape fence
(§6.2) and the exit-gate comparison. **Honest residual:** the
fence is procedural + verification-based. A rollback
performed in defiance of this runbook — to a pre-floor build,
followed by re-arm — would recreate the silent-omission
state; that is precisely why the floor is a standing operator
decision recorded in this design, in the disposition
execution record, and in the exit gate's archived read-back,
and why the halt/queue holds (Decision 2) **precede** any
rollback rather than follow it.

**Data rollback:** none is designed, deliberately. The
disposition is one-way (§3, invariant 3); there is no
"un-dispose" operation. The only exit from the state is the
evidence-gated amendment (§8), itself deferred (Q3).

### 5.4 Read-before-first-write — the absent-table discipline (D1)

**The gap.** The adjudication tables are created only inside
the first disposition transaction (§5.1), but §6 asks
`phaseAccounting`, capabilities (which calls
`phaseAccounting` for **every** budgeted phase, including on
an untouched deployment), plan summaries, and diagnostics to
read them. A direct SELECT/JOIN on a nonexistent table throws
("no such table") rather than returning zero — a first-run
behavior defect on every cold store, not a test nicety.

**The rule.** Adjudication reads follow the codebase's
standing D8-1 law (the quarantine store, Rowan 6525035570:
*only genuine absence reads as the empty state; every other
error is loud*). Concretely, the two new accounting sums and
the plan-summary sibling read (§6) are computed through a
single presence-checked read path:

1. **Presence check (non-mutating).** The reader first runs
   `SELECT name FROM sqlite_master WHERE type='table' AND
   name IN ('d6_billing_adjudications',
   'd6_billing_adjudication_amendments')` — a read-only
   catalog query (the suites' existing idiom for lazy tables).
   Read paths **never** run the adjudication DDL: a store
   that never adjudicates never grows these tables, and reads
   leave the store byte-identical (§10 test 13 asserts this).
2. **Both tables absent → the unverified figures are exactly
   zero.** This is exactness, not a default: adjudication rows
   are written only inside the disposition transaction, which
   ensures both tables in one DDL batch **before** the first
   write (§5.1). No table therefore *proves* no disposition
   has ever executed, and zero is the true value of both sums.
   The legacy figures (`settledMicro`, `inFlightUpperMicro`,
   `unknownOpen`) are computed exactly as today, so every cold
   surface returns today's payload plus zero-valued new keys.
3. **Both tables present → strict sums; errors propagate
   unmasked.** The sums are computed normally; **any** SQL
   error (corrupt shape, missing column, storage fault)
   propagates to the caller — read surfaces surface it as an
   error, and at the grant guard the propagation is a refusal
   (the guard calls `phaseAccounting` unguarded today, so a
   throw is a no-grant). A genuine error is **never** read as
   zero.
4. **Exactly one table present → throw
   `adjudication_schema_inconsistent`.** The writer ensures
   both tables in a single DDL batch inside one transaction,
   so a split state is unreachable through the system's own
   writes; it evidences out-of-band interference or
   corruption and must be loud on every surface — never zeros,
   never a partial read of the surviving table.

**Scope.** The discipline applies to every read of the
adjudication tables: `phaseAccounting`'s two new sums (§6.1)
and the plan-summary sibling read (§6.3) — so capabilities,
the grant guard, diagnostics, plan summaries, and the retire
path's accounting recompute all inherit identical cold
behavior. It is equally safe inside transactions (the
presence check is a non-mutating SELECT; in the disposition
transaction the ensure runs before any accounting recompute
in any case). In v1, read surfaces query only
`d6_billing_adjudications` (an attempt's amendment count
lives on its adjudication row as `current_amendment`); the
presence rule nonetheless covers the pair as a unit, because
the writer ensures them together and a split pair is the
corruption signal. **Why a presence check rather than
D8-1's error-text matching:** the principle is identical —
absence, and only absence, reads as empty — but
`phaseAccounting` runs in hot read paths and inside
transactions, where classifying the store *before* querying
is deterministic and independent of SQLite error strings.
The build may reuse the `isNoSuchTableError` helper's message
test as a belt-and-braces second layer inside the strict
branch, but the presence check is the specified mechanism.

## 6. `phaseAccounting` — precise behavior and budget math

### 6.1 Definitions (deployed SQL kept verbatim where unchanged)

```text
settledMicro          = SUM(cost_micro_cents) over attempt rows of the phase's plans
                        WHERE phase='confirmed' AND outcome IN ('success','failed_known','policy_block')
                        [UNCHANGED — ledger-recorded known outcomes only, forever;
                         "known" is a ledger-contract status, NOT provider
                         verification (clarification 1, §3 invariant 2)]
inFlightUpperMicro    = SUM(upper_micro_cents) over rows WHERE phase IN ('reserved','dispatching')
                        [UNCHANGED]
unknownOpen           = COUNT of rows WHERE phase='confirmed' AND outcome='unknown'
                        [UNCHANGED — an estimated_unverified row is not 'unknown',
                         so disposition reduces unknownOpen by exactly 1]
estimatedUnverifiedMicro = SUM(a.estimated_cost_micro_cents) over d6_billing_adjudications a
                        JOIN d6_attempt_log t ON t.attempt_id = a.attempt_id
                        WHERE t.plan_id IN (plans of the phase)
                          AND t.outcome = 'estimated_unverified'
                          AND a.current_amendment = 0        [NEW — via the §5.4
                         presence-checked read: both tables absent ⇒ exactly 0;
                         split state ⇒ throw; other errors propagate]
reservedUnverifiedMicro  = SUM(a.reserved_cost_micro_cents), same scope and discipline  [NEW]
```

The `current_amendment = 0` scope condition is what retires a
reservation: when an amendment supersedes a disposition with
a verified figure (§8 — deferred, Q3), the attempt row itself
transitions to a known outcome at the verified cost, so the
verified amount enters `settledMicro` through the unchanged
settled SQL, and the estimate/reservation leave the unverified
buckets in the same transaction. No figure is ever counted
twice, and no figure silently changes buckets.

`planSettledMicro(planId)` (the per-plan read behind plan
summaries) is unchanged. Plan summaries gain a sibling field,
`estimatedUnverifiedMicroCents`, computed for the plan's own
adjudications under the same scope rule and the same §5.4
presence discipline.

### 6.2 Budget gating and the authorization remainder

- **Grant guard** (`grant-guards.mjs` projection): the
  projected-spend test becomes
  `settledMicro + reservedUnverifiedMicro + inFlightUpperMicro + pendingUpper > PHASE_BUDGET`
  → refuse `phase_budget`. The reservation — the larger,
  conservative figure — is the gating term; the central
  estimate is never used for gating. With zero adjudications
  in a phase, the projection is numerically identical to
  today's.
- **Guard shape fence (D2 companion).** Before using the
  accounting, the guard validates that the object it consumed
  carries `estimatedUnverifiedMicro` and
  `reservedUnverifiedMicro` as finite safe integers; a
  missing or invalid field refuses the grant with reason
  `phase_accounting_incomplete` instead of coercing an absent
  value to 0. Under §5.4 `phaseAccounting` always returns
  both fields, so this fires only on a genuine shape
  regression or a legacy-shaped accounting source — exactly
  the silent read-gap D2 forbids (§10 test 15).
- **Capabilities / phase read**: `remainingMicroCents =
  max(0, budget − settledMicro − reservedUnverifiedMicro −
  inFlightUpperMicro)`. This is a **deliberate, disclosed
  definition change**: today the remainder subtracts only
  settled + in-flight. With zero adjudications the value is
  identical; the first disposition reduces the displayed
  remainder by the reservation. The change and its reason
  (an authorization remainder must not pretend an outstanding
  unverified exposure is free) are stated here so Rowan
  reviews the semantics, not just the code. **Decided (Q4):**
  Rowan accepted subtracting the unverified reservation,
  contingent on D1 and D2 — answered in §5.4 and §5.3 —
  with legacy behavior preserved where no dispositions exist
  (guaranteed exactly, per §5.4 rule 2).
- **Monthly cap / quota surfaces**: untouched. The quota
  view's figures are grant-time ledger estimates under
  existing contracts and are not a consumer of
  `phaseAccounting`'s settled definition.

### 6.3 Read-surface rules (invariant 1 + clarification 1, made concrete)

- Capabilities phase object gains
  `estimatedUnverifiedMicroCents` and
  `reservedUnverifiedMicroCents` beside the existing
  `settledMicroCents` / `inFlightUpperMicroCents` /
  `remainingMicroCents`. No existing key changes meaning. On
  an untouched deployment both new keys read exactly 0 (§5.4).
- Plan summary gains `estimatedUnverifiedMicroCents`
  (sibling of `settledMicroCents`, never folded into it) and,
  when the plan has any adjudication, the literal status
  `provider_unverified` carried beside the figure (e.g.
  `estimatedUnverifiedStatus: "provider_unverified"`).
- Diagnostics attempt rows show outcome
  `estimated_unverified` and, joined from the adjudication
  row, the estimate + reservation + the literal status
  `provider_unverified`. Diagnostics phase view shows the
  three-way split under the corrected labels:
  **recorded/known settled (existing ledger) / unverified
  estimate + reservation (`provider_unverified`) / remaining
  authorization budget**. No surface may label the settled
  bucket "verified" (clarification 1): the system's settled
  figures are ledger-recorded, not provider-verified.
- **After retirement**, the retired plan's summary and the
  phase reads continue to join the adjudication row: the
  estimate's unverified status is a permanent property of the
  record, not a state that retirement launders — visible in
  diagnostics and in plan/phase summaries alike. The
  retirement audit note (§9) references the disposition.

### 6.4 Worked example (the actual disposition, figures as recorded)

Phase `forever-pucked`, budget **13,500,000**:

- `settledMicro` = **17,749** — the G10 smoke settlement,
  **ledger-recorded known, not provider-verified**: per the
  research, this figure is the system's estimator output for
  its own length, recorded as settled under the existing
  contracts (the chapter's eight recorded failures contribute
  0 under the same local convention — a (b)-class record, per
  the corrected research, not provider confirmation).
  "Known" in this design never means Google verified a
  per-call charge (clarification 1).
- Disposition of the one unknown attempt adds:
  `estimatedUnverifiedMicro` = its **own-length**
  `expectedCostMicro`, frozen at execution (the job's flat
  grant estimate was 19,652 — a mean over the 18 entries; the
  recorded figure is this attempt's own-length value, close
  to 19,652 only to the extent its length is near the mean),
  and `reservedUnverifiedMicro` = its recorded
  `upper_micro_cents` (≈ 31,400 at the mean length; the
  attempt's own recorded value governs).
- `unknownOpen`: 1 → **0**. `inFlightUpperMicro`: 0.
- Authorization remainder after disposition ≈
  13,500,000 − 17,749 − ~31,400 ≈ **13,450,851** — the
  reservation is immaterial to the phase's practical
  capacity, which is precisely why reserving conservatively
  costs nothing here.
- **R2 honesty clause:** the reservation is a modeled
  internal allowance. It is **not** a certified ceiling on
  Google's charge for that request (Q2 records the same
  point: the upper figure is an internal modeled allowance,
  never a guaranteed provider billing ceiling); if a future
  provider record showed a higher real charge, §8's amendment
  path — not an edit to these figures — is how the books
  would learn it, and the phase remainder is an
  *authorization* control, not a claim about Google's maximum.

## 7. Operator route and guard design

### 7.1 Route

`POST /v2/d6-adjudicate-estimated` → DO-internal
`/internal/d6/adjudicate-estimated`, joining the **same
operator fence class** as `/v2/d6-reconcile-unknown`,
`/v2/d6-retire-halted-plan`, and `/v2/d6-release-quarantine`:

- production gate skips the client token for this route
  (admission on the operator credential alone); the everyday
  client token alone is refused;
- the operator admission block requires the migration-operator
  credential; the coordinator class gate re-requires the
  stamped admission (`x-opalreader-operator-admitted: 1`),
  else `403 migration_operator_required`;
- `source` is stamped server-side (`"operator-route"`), never
  taken from the caller's body;
- the service handle `adjudicateEstimatedAttempt` mirrors
  `reconcileUnknownAttempt`: store results map to
  `{ outcome: "applied", ... }` / `{ outcome: "rejected", reason }`.

### 7.2 Request contract (closed schema — an actual allowlist)

Body keys are **allowlisted**: the permitted key set is
exactly `{ attemptId, planId, authorizationRef, note }`.
Any other key refuses the **whole request** at the route,
before the store is called, with zero state movement:

- a caller-supplied figure key (`knownCostMicro`,
  `estimatedCostMicro`, `estimated_cost_micro_cents`,
  `reservedCostMicro`, `reserved_cost_micro_cents`,
  `costMicroCents`) → `adjudication_figure_caller_supplied`.
  Money figures are derived server-side (§5.2); a request
  that tries to name one is malformed by definition.
- any other non-allowlisted key →
  `adjudication_request_key_not_allowed`.

Field rules (route-level rejections, zero state movement):

- `attemptId`: required string, **nonblank after trimming**
  (the trimmed value is what is looked up) → else
  `attempt_id_required`.
- `planId`: required string, nonblank after trimming → else
  `plan_id_required`.
- `authorizationRef`: required string, **nonblank after
  trimming** (the reference to Julie's recorded execution
  approval for this call — e.g. the board comment ID of her
  approval; the trimmed value is recorded verbatim in the
  audit row) → else `authorization_ref_required`. As with
  every operator route in this class, the route's existence
  is not authority: each production *use* is Julie's separate
  authorization, and the recorded reference is what makes a
  use auditable against that authorization.
- `note`: optional string (length bound set by the build);
  a non-string `note` → `adjudication_request_key_not_allowed`
  class refusal (`note_invalid`).

On `applied`, the response carries the attempt's new outcome,
the frozen estimate + reservation, `haltCleared`, and the
adjudication row's identifiers — everything the execution
runbook (§12) needs for read-back comparison.

### 7.3 Audit visibility

The adjudication row is the audit: attempt, plan, phase,
disposition, both figures, basis (including the source-row
identities of §4.1 step 6), evidence references (the design
build will freeze the exact reference set — Exhibit A, the
corrected research pin, Rowan's ruling 6534423731 and design
review 6534952386, and the execution approval reference), the
recorded authorization reference, server-stamped source, and
timestamp. It is readable through diagnostics (§6.3) and is
never updated except by the amendment pointer
(`current_amendment`), never deleted. Amendments are separate
rows (§8), so the full uncertainty history — original
estimate, basis, and any later verified supersession — is
reconstructible from the two tables alone.

## 8. Amendment — the future provider-correction path (contract sketch; operation DEFERRED per Q3)

If provider evidence ever *does* attribute this attempt (the
research judges this unobtainable for Oct 29, 2026, but the
design must not paint the books into a corner), the correction
path is `genstore.amendAdjudication(attemptId, { verifiedOutcome,
verifiedCostMicro, evidenceRefs, authorizationRef, note })`:

- Preconditions, in one transaction: an adjudication row
  exists for the attempt; the attempt's outcome is still
  `estimated_unverified`; `current_amendment` is the expected
  value (the call names the amendment sequence it expects —
  a stale or duplicate amendment refuses); `evidenceRefs` is
  non-empty; `verifiedOutcome` is a `KNOWN_OUTCOMES` value
  and `verifiedCostMicro` a finite number ≥ 0, validated as
  a pair under the same discipline as the reconcile contract;
  `authorizationRef` non-empty (an amendment is its own
  gated execution).
- **Evidence means evidence (clarification 3).** A nonempty
  `evidenceRefs` array is a list of citations — it is **not**,
  by itself, evidence that Google verified an amount, and the
  non-emptiness check above is a necessary formality, not a
  verification. The word "verified" in an amendment may rest
  only on an underlying provider record that a **human has
  reviewed** and found to attribute the amount. Enabling the
  amendment route at all therefore requires, in addition to
  this contract: the provider evidence itself, separate human
  review of it, Rowan's source review of the amendment
  package, and **Julie's authorization** for the amendment
  execution. No build may treat the presence of reference
  strings as a verification signal.
- Writes, same transaction: an amendments row
  (`kind='verified_supersession'`, seq = current + 1); the
  attempt row transitions to the verified outcome with
  `cost_micro_cents = verifiedCostMicro` (now honestly a
  known cost — provider evidence, human-reviewed, is what
  makes it one); the adjudication row's `current_amendment`
  advances. The original estimate, reservation, and basis are
  **not** modified — the uncertainty history is preserved in
  place and the supersession is a new, traceable fact beside
  it.
- Accounting effect (automatic from §6.1): the verified cost
  enters `settledMicro`; the estimate/reservation leave the
  unverified buckets; `unknownOpen` is unaffected (the
  attempt was not `unknown`).
- Route (future): `POST /v2/d6-adjudicate-amend`, same
  operator fence class, closed allowlist schema,
  server-stamped source.
- **Build sequencing (Q3, decided):** the two tables land
  with the disposition build (§5.1). The amendment
  **operation and route do NOT** — they come later, only if
  provider evidence ever appears, as their own package under
  separate source review and their own Julie gate. This build
  deliberately ships **no unused money-reclassification
  operator entry point**: no `amendAdjudication` function, no
  route, no service handle (§10 test 10 asserts the absence).
  The schema supports the future package without migration,
  and the behavioral amendment tests are deferred with it —
  they are not part of this build's battery.

## 9. Retirement interplay

### 9.1 The guard's definition does not change

`retireHaltedPlan` refuses while the plan has any
`phase='confirmed' AND outcome='unknown'` attempt rows
(`unknown_billing_open`), and `phaseAccounting.unknownOpen`
counts the same rows phase-wide (HOLD 2's fixed definitions).
After disposition, the attempt row's outcome is
`estimated_unverified`: both counts fall by exactly one
**without any change to the guard's code or definition**.
Retirement then proceeds under its existing contract and its
own gate: plan state → `retired`, stop_reason
`retired_unknown_billing`, one `d6_plan_retirements` audit
row, same transaction. The retirement `note` will reference
the disposition (attempt ID + adjudication), keeping the
plan's history honest end-to-end.

### 9.2 The historical execution record is provenance

The attempt's execution sits in `d6_execution_records` in
state `unknown_billing`. Neither the disposition nor
retirement touches it (neither function writes that table —
verifiable in the deployed source today and pinned as a test
expectation, §10 test 1). After settlement and retirement it
**remains** `unknown_billing`, permanently: it records how
the execution ended (no usable response, billing unresolved
at execution time), which is true history. It is **not** an
open unknown for any guard: the retire guard and
`unknownOpen` count **attempt rows**, never execution states
(HOLD 2). A read-back that finds the execution still
`unknown_billing` after disposition/retirement is the
expected, correct result — explicitly **not** a STOP
condition. (This is the corrected proposal's Step 3/6
contract, carried into this design unchanged.)

### 9.3 Phase-flag clearing at disposition (DECIDED — Q1)

**Rowan's answer (6534952386): clearing is ACCEPTED** when
the last *unadjudicated* unknown in the phase has been
disposed, on two conditions, both met by this design:

1. **The phase keeps visible `provider_unverified`
   exposure.** Satisfied by §6.3: capabilities, diagnostics,
   and plan/phase summaries join the adjudication row
   permanently — the estimate and its unverified status stay
   on every surface after the flag clears and after
   retirement. The flag clears; the exposure does not hide.
2. **§10 proves halted-plan ownership / zero resumption with
   the global halt ON and OFF.** §10 test 2 is exactly that
   proof (disposition with the phase flag set and the global
   halt in each state; the plan remains driver-excluded; a
   fresh intent over its occurrences stays fenced).

Mechanics, mirroring `reconcileUnknown` (§4.1 step 8): the
flag's meaning is "an unadjudicated unknown-billing attempt
exists in this phase," and after disposition none does. (The
alternative — defer clearing to retirement — would give one
flag two meanings across two mechanisms, and the flag is a
*phase-level billing* fact while retirement is a *plan-level*
act.) Safety: clearing the flag restarts nothing. The plan
remains `halted_unknown` (driver-excluded), the global
`GENERATION_HALT` remains as operations set it, the queue
remains as operations left it, and the admission fence still
counts the halted plan as owning its 18 segments until
retirement. **Clearing the phase flag is not re-arm
authority** — re-arm remains its own later gate (§11 step 7).

## 10. Test plan (design-level; built with the package, run at the build gate)

Fixtures mirror live data shapes (the standing rule: the DO
harness is no evidence for empty-result paths; suite design
follows the ch2fix/genpkg1 patterns). Synthetic text only; no
production data in fixtures.

1. **Happy path + write-set exactness.** Disposition applies
   to a fixture `confirmed`/`unknown` attempt in a
   `halted_unknown` plan. Assert: attempt outcome
   `estimated_unverified`, `cost_micro_cents` still NULL; one
   adjudication row with server-derived figures (own-length
   estimate ≠ flat grant estimate in the fixture's numbers);
   phase flag cleared when it was the last unknown; plan
   state still `halted_unknown`; **zero** new rows in
   `d6_execution_records`, grants, plans, jobs; execution
   record byte-identical.
2. **Non-resumption in BOTH halt states (Q1's proof).**
   (a) Global halt ON (`GENERATION_HALT='1'`): disposition
   applies; driver selects nothing; no grants; halt-refused
   legacy commands still 423. (b) Global halt OFF with the
   plan `halted_unknown` and the phase flag set: disposition
   applies and clears the phase flag; the plan remains
   driver-excluded; no execution is created; a fresh intent
   over the plan's occurrences is still fenced by the halted
   plan's ownership (admission fence regression).
3. **Exactly-once.** Second disposition call on the same
   attempt → `attempt_not_unknown`; adjudication row count
   still 1; attempt row unchanged after the first call.
4. **Cross-plan / wrong-plan / particulars refusals.**
   `planId` naming a different plan than the attempt's →
   `adjudication_plan_mismatch`, zero movement; attempt in a
   non-halted plan → `adjudication_plan_not_halted_unknown`;
   unknown attempt ID → `attempt_not_found`; **particulars
   matrix** (clarification 2): no plan entry for the
   attempt's occurrence → `adjudication_particulars_missing`;
   entry with NULL / non-integer / negative `char_count` →
   same; entry with NULL / invalid `upper_micro_cents` →
   same; attempt row with invalid `upper_micro_cents` → same;
   plan with NULL/empty `phase` → same. All with zero state /
   audit movement.
5. **Route negatives (closed allowlist).** Missing/blank
   (whitespace-only) attemptId/planId/authorizationRef → the
   §7.2 rejections; a figure key present →
   `adjudication_figure_caller_supplied`; any other
   non-allowlisted key (e.g. `source`, `phase`) →
   `adjudication_request_key_not_allowed`; client token alone
   → refused at the gate; no operator stamp at the class gate
   → 403. All with zero state/audit movement (the B2 negative
   pattern).
6. **Partial-mutation fault injection.** Force a throw after
   the attempt UPDATE inside the transaction (fixture fault)
   → transaction rolls back whole: attempt still `unknown`,
   no adjudication row, phase flag unchanged.
7. **Accounting exactness.** Fixture phase with known +
   in-flight + estimated mix: all five `phaseAccounting`
   figures exact; grant-guard projection refuses when
   settled + **reservation** + in-flight + pending > budget
   and admits when under — including the discriminating case
   where the *estimate* would fit but the *reservation*
   refuses; capabilities remainder matches §6.2.
8. **Retirement after disposition.** `retireHaltedPlan` on
   the disposed plan → `applied`, audit row written, plan
   terminal; retire on a plan whose attempt is still
   `unknown` → `unknown_billing_open` (guard unchanged).
9. **Stale-message dispatch refusal after retirement.** A
   queue message naming the retired plan's job resolves via
   `resolvePlanForFence` → plan-state fence refusal, normal
   ACK (message consumed), zero provider contact, zero grants
   (extends the fence suite's retired-plan case to the
   post-disposition path).
10. **Amendment — schema only (Q3 decided).** After a
    disposition: both adjudication tables exist; the
    amendments table is **empty**; the adjudication row's
    `current_amendment` is 0; and the build exposes **no**
    amendment entry point — route-inventory assertion (no
    `d6-adjudicate-amend` path in the route table; no
    amendment handle on the service; no `amendAdjudication`
    export in the store). The behavioral amendment tests
    (supersession accounting, stale-sequence refusal, empty-
    evidence refusal) are **deferred** to the future amendment
    package (§8) and are not part of this battery.
11. **Legacy regression.** The full existing reconcile suite
    (ch2fix B2 negatives included), retire suite, fence suite,
    and grant-guard suite pass unmodified; `confirmAttempt`
    refuses `estimated_unverified` as an outcome;
    `KNOWN_OUTCOMES` / `SETTLEMENT_OUTCOMES` /
    `ATTEMPT_OUTCOMES` contents unchanged.
12. **Read-surface honesty.** Fixture assertions on
    diagnostics, capabilities, and plan-summary payloads: the
    estimate appears only under its own keys with
    `provider_unverified` status; no payload emits it under
    `settled*` or any known-cost key; **no surface labels the
    settled bucket "verified"** (clarification 1); the flag
    persists in the phase read **and** the retired plan's
    summary after the plan is retired.
13. **COLD pre-disposition integration (D1).** On a fresh
    store (GEN_SCHEMA only; no disposition has ever executed):
    - `capabilities()` returns every budgeted phase with
      `estimatedUnverifiedMicroCents` = 0 and
      `reservedUnverifiedMicroCents` = 0, and
      `remainingMicroCents` byte-equal to the legacy
      computation (budget − settled − inFlight);
    - `phaseAccounting` returns the two new fields exactly 0
      with the three legacy figures unchanged (including a
      phase with known + in-flight activity);
    - diagnostics renders with zero unverified figures;
    - plan summary shows the sibling field 0 and no
      `provider_unverified` status;
    - the grant guard admits and refuses on a legacy-identical
      projection (one admit case, one `phase_budget` refusal
      constructed on legacy figures alone);
    - **reads are non-mutating:** after all of the above,
      `sqlite_master` still contains **neither** adjudication
      table and the store is otherwise unchanged.
    Post-write leg: execute one disposition in the same
    fixture → all five surfaces show the frozen figures.
    Post-retirement leg: retire the plan → all surfaces still
    show them, with `provider_unverified` status.
14. **Presence discrimination — no masking (D1).**
    (a) Exactly-one-table state (fixture creates only
    `d6_billing_adjudications`): `phaseAccounting` throws
    `adjudication_schema_inconsistent`; capabilities surfaces
    the error (never zeros); the grant guard refuses.
    (b) Both tables present with a forced query fault
    (fixture-built adjudications table missing a summed
    column): reads throw the genuine SQL error — not zeros,
    not the inconsistency error; the grant guard refuses.
    (c) Both absent → test 13's exact zeros (cross-reference).
15. **Rollback fence (D2).** (a) *Shape fence:* the grant
    guard fed a legacy-shaped accounting object (the genstore
    test double **without** the unverified fields — the
    pre-disposition shape) refuses with
    `phase_accounting_incomplete`; zero grants, zero ledger
    movement. (b) *Exit-gate verification:* a capabilities
    payload captured from a legacy-shaped build (unverified
    keys absent) **fails** the §5.3 Decision-3 comparison
    against an archived post-disposition read-back, and a
    payload with mismatched values fails it; the matching
    adjudication-aware payload passes. (The §5.3 holds and
    floor themselves are runbook procedure, verified at
    operations time by the read-backs Decision 2/3 name.)

## 11. Gates — this design authorizes nothing

In order, each separately granted, none implied by the last:

1. **This design** → Rowan's design review (this packet).
2. **Julie's design approval** (after Rowan's review) →
   authorizes the repo-only build, nothing more.
3. **Repo-only build** → full battery (incl. §10) → Rowan
   source review.
4. **Halted deploy** of the built package, under its own
   operational plan in the Oct 30 pause-first pattern →
   Julie's approval for the deploy.
5. **Adjudication execution** (the single disposition call)
   → its own §6-style approval from Julie, with the approval
   recorded as the call's `authorizationRef`; fresh pre-state
   identity reads and read-backs per §12. The execution
   record also records the deployed build's identity as the
   **§5.3 rollback floor** and archives the external
   adjudication read-back.
6. **Retirement** of `plan:603ab416bd67ab1b25de97be` → gated
   under the existing retire contract; whether it shares the
   step-5 run or stands alone is decided by the approval text
   at step 5, not assumed here.
7. **Re-arm** (halt flip + queue unpause) and any **fresh
   Chapter 2 generation intent** → their own later proposals
   and Julie's go, exactly as before. This design changes
   nothing about them.

**Rollback governance (D2).** Any code rollback after gate 5
is an operator action governed by the §5.3 fence (floor,
pre-rollback holds + archived read-back, exit gate). It is
not a numbered gate because it authorizes nothing new — but
no rollback may proceed outside it. The **amendment package**
(§8) is likewise a separate future chain — source review,
build, deploy, execution, each with its own approvals — and
appears nowhere in gates 1–7.

## 12. Execution runbook sketch (for the future step-5 gate; authorizes nothing)

Fresh pre-state reads, compared against the adjudication
proposal's §3 Step 0 set plus: `/health` build identity;
`GENERATION_HALT` value; queue `delivery_paused`; plan state
`halted_unknown` via diagnostics; the attempt's identity
(plan's only confirmed/unknown row; its `upper_micro_cents`;
its plan entry's `char_count` **and** recorded
`upper_micro_cents` — the §4.1 step-6 particulars, verified
before the call, not discovered by it); phase flag state;
Ch 3 fingerprint unchanged. Any mismatch → STOP before the
call. Then exactly **one** disposition call (§7). Read-backs:
attempt row (outcome `estimated_unverified`, cost NULL);
adjudication row (figures = server-derived values from the
pre-reads); `phaseAccounting` five figures (unknownOpen 0;
settled unchanged; estimate/reservation as frozen);
capabilities phase object (the two new keys + remainder per
§6.2 — this read-back is archived externally as the §5.3
rollback baseline); execution records **unchanged** (the
settled attempt's execution still `unknown_billing` —
expected provenance, §9.2, not a STOP); plan still
`halted_unknown`; full-footprint equality outside the
disposition's enumerated write set. The execution record
pins the deployed build (pin + script etag) as the **§5.3
rollback floor**. Containment mirrors the proposal's §4 /
deploy C2: any failure or ambiguity → read-back + STOP; no
retry, no second attempt without Julie's fresh go.

## 13. Design choices — DECIDED by Rowan (6534952386), and the correction map

### 13.1 Q1 — phase-flag clearing: ACCEPTED (§9.3, §4.1 step 8, test 2)

Clearing `halted_unknown_billing` when the last
*unadjudicated* unknown is disposed is accepted, provided the
phase keeps visible `provider_unverified` exposure (§6.3) and
§10 proves halted-plan ownership / zero resumption with the
global halt ON and OFF (test 2). Clearing is **not** re-arm
authority.

### 13.2 Q2 — both figures: ACCEPTED (§5.2, §6)

The own-length estimate (disclosure) and the persisted upper
reservation (budget control) are both recorded. The upper is
an **internal modeled allowance, never a guaranteed provider
billing ceiling** (R2; §6.4).

### 13.3 Q3 — amendment sequencing: SCHEMA NOW, OPERATION LATER (§5.1, §8, test 10)

The schema ships with the disposition; the amendment
operation/route comes later, under separate source review and
gate, only if provider evidence ever appears. No unused
money-reclassification operator entry point ships now.

### 13.4 Q4 — remainder subtracts the reservation: ACCEPTED (§6.2)

Contingent on D1 and D2 — answered in §5.4 and §5.3.
Legacy behavior is preserved exactly where no dispositions
exist (§5.4 rule 2).

### 13.5 Correction map for the focused re-review

| Review item | Answered in |
|---|---|
| D1 (read-before-first-write) | §5.4 (presence-checked discipline), §6.1, §4.2, tests 13–14 |
| D2 (rollback fence) | §5.3 (floor + holds + exit gate, runbook-pinned), §6.2 (guard shape fence), §11 (rollback governance), §12 (floor recorded at execution), test 15 |
| Clarification 1 (labels) | §3 invariant 2, §6.1, §6.3, §6.4, test 12; research §3.1 |
| Clarification 2 (ownership/particulars, closed schema) | §3 invariant 3, §4.1 steps 4–6, §5.2, §7.2, test 4–5 |
| Clarification 3 (amendment evidence) | §8 (human review + Julie authorization before the route could ever be enabled) |
| Q1–Q4 | §13.1–13.4, implemented at §9.3 / §5.2+§6 / §5.1+§8+test 10 / §6.2 |

— Wren
