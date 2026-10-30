# Uncertainty-disposition DESIGN — the `estimated_unverified` settlement class

**Design packet for Rowan's review, prepared under her ruling
(issue #15, comment 6534423731): "§8 option: APPROVED FOR
REPO-ONLY DESIGN, not implementation/deployment."**

Companions: `ADJUDICATION-PROPOSAL.md` (§8 is the concept this
packet designs; §§1–7 are the case it disposes) and
`BILLING-ATTRIBUTION-RESEARCH.md` (the evidence record, as
corrected by Rowan's R1–R3 in the same pin as this design).

**This document is a design only.** It authorizes nothing: no
code is built by it, no production action is taken under it,
no settlement is recorded by it. Build, deploy, settle, and
retire remain separate stages, each with its own Rowan review
and its own explicit Julie approval (§11). Proposal §6 remains
**NOT SUBMITTED**. No per-attempt charge is proven; nothing in
this design asserts one. Julie needs to provide nothing for
this packet.

**Supersession note (R1–R3).** Rowan's corrections R1–R3 are
applied to the research document in this pin. Two summary
passages in the proposal (`§2.1`'s "bounds any attributable
charge" and `§7`'s "must be enabled prospectively" / "[0, its
upper bound]") carry the pre-correction phrasing; they are
superseded by the corrected research and by R1–R3, and the
proposal is in any case **not executable** (Rowan, 6534423731).
The proposal file is deliberately left byte-identical in this
pin so the correction history stays legible; this design
follows the corrected record throughout.

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
   `d6_billing_adjudication_amendments`, carries any future
   provider-evidence supersession (§8).
4. `phaseAccounting` gains two new read figures —
   `estimatedUnverifiedMicro` and `reservedUnverifiedMicro` —
   while `settledMicro`, `inFlightUpperMicro`, and
   `unknownOpen` keep their exact current definitions (§6).
   Budget gating uses the **reservation**; displays show
   verified, estimate/reservation, and remaining as three
   separate figures.
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
`phaseAccounting` reports verified settled, unverified
estimate, unverified reservation, and in-flight separately;
the authorization remainder is computed as
`budget − settled − reservedUnverified − inFlight` (§6.2) —
the reservation, not the estimate, gates, because gating is
where conservatism belongs. The design states in §6.4 what
Rowan's R2 requires: the reservation is a **modeled internal
allowance** (the attempt's recorded chars/10 upper figure),
**not a certified cap on Google's real charge**; if the real
charge exceeded it, the books learn that only through a
provider correction, handled by the append-only amendment
path (§8) — prior audit rows are never edited or deleted.
One honest caveat carried from the research: the "verified
settled" bucket means *recorded as known under the system's
existing contracts*; the research notes even the smoke's
settled figure is the system's estimator output recorded under
those contracts. This design does not relitigate existing
settlements; it guarantees the *new* class is never folded
into that bucket.

**Invariant 3 — one-way, exactly-once disposal.**
The disposition's subject is exactly one attempt, identified
by `attemptId`, in exactly one plan, identified by `planId`
and verified against the attempt's server-stamped plan
linkage (the `reconcile_plan_mismatch` discipline). Preconditions
checked **inside the transaction** (§4.1): the attempt exists
and is `confirmed`/`unknown`; the plan exists, owns the
attempt, and is in state `halted_unknown`; the plan's phase
matches the attempt's phase accounting scope. Exactly-once is
structural: the transition guard (`outcome='unknown'`) makes
a second call refuse `attempt_not_unknown`, and the
adjudication table's `PRIMARY KEY (attempt_id)` makes a
second audit row impossible. One-way: no function transitions
*out* of `estimated_unverified` except the evidence-gated
amendment (§8), which itself requires provider evidence and
its own authorization. The disposition writes no execution
record, creates no grant/plan/job/queue message, and changes
no plan state — the plan remains `halted_unknown` until the
separately gated `retireHaltedPlan` (§9). Malformed,
duplicate, cross-plan, and partial mutations refuse with zero
collateral change: route-level rejections return before the
store is called; store-level refusals throw inside the
transaction (§4.2, §7.2); §10 tests 3–6 cover the matrix.
Execution-time gates (fresh identity reads, Julie's approval,
operator credential) are specified in §7 and §12 — the design
states them; performing them belongs to the execution gate.

**Invariant 4 — concrete design/evidence before code.**
This packet is that design: schema + migration/rollback (§5),
precise `phaseAccounting` behavior and budget calculations
with a worked example (§6), operator route/guard (§7), audit
visibility (§7.3), the outcome-vs-table question answered
with reasons (§2), retirement-guard treatment (§9), tests for
non-resumption in **both** halt states, stale-message
dispatch refusal after retirement, and negative controls
(§10). Build comes only after Rowan's design review and
Julie's design approval (§11).

## 4. The disposition operation (store contract)

### 4.1 `genstore.adjudicateEstimated(attemptId, { planId, authorizationRef, note })`

Executed in one coordinator transaction (`coord._tx`, the
`reconcileUnknown` pattern). Steps, in order:

1. Load the attempt row; missing → throw
   `attempt_not_found`.
2. Require `phase='confirmed' AND outcome='unknown'`; else
   throw `attempt_not_unknown` (this is also the duplicate /
   already-disposed refusal: a disposed attempt is no longer
   `unknown`).
3. Require `planId` present and equal to the attempt's
   server-stamped `plan_id`; mismatch → throw
   `adjudication_plan_mismatch`.
4. Load the plan; require it exists and
   `state='halted_unknown'`; else throw
   `adjudication_plan_not_halted_unknown`. (The disposition
   exists to unblock halted-plan retirement; disposing an
   attempt in a live or terminal plan is out of scope and
   refused.)
5. Require `authorizationRef` a non-empty string (the
   recorded reference to Julie's execution approval — §7.2);
   missing → throw `adjudication_authorization_required`.
   The store records it; it does not and cannot verify it —
   the same posture as the existing operator routes, whose
   *use* is Julie's separate authorization. Recording the
   reference makes any use auditable against the board
   record.
6. Derive the figures **server-side only** (§5.2): the
   estimate from the plan entry's `char_count` for
   (plan_id, occurrence_id) via `expectedCostMicro`; the
   reservation from the attempt row's recorded
   `upper_micro_cents`. Missing particulars → throw
   `adjudication_particulars_missing`. Caller-supplied money
   figures are rejected at the route (§7.2) and are not
   parameters of this function at all.
7. Ensure the adjudication schema (lazy DDL, §5.1), then:
   - `UPDATE d6_attempt_log SET outcome='estimated_unverified',
     updated_at=? WHERE attempt_id=?` — `cost_micro_cents`
     is **not** in the SET list; it remains NULL.
   - `INSERT INTO d6_billing_adjudications (...)` — one row,
     same transaction.
8. Phase-flag clearing, mirroring `reconcileUnknown` exactly:
   recompute the phase's accounting; if `unknownOpen === 0`,
   clear `d6_phase_state.halted_unknown_billing` for the
   plan's phase in the same transaction, and report
   `haltCleared` in the result. Rationale and safety argument
   in §9.3 — the flag means "an unadjudicated unknown
   exists"; the plan's own `halted_unknown` state, the
   global halt, and the paused queue are separate latches
   this step does not touch.
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
lazily inside the disposition transaction, and is **not**
added to `GEN_SCHEMA` (the correction suites pin the
bootstrap's table set; a store that never adjudicates never
grows these tables). No `ALTER` of any existing table; no
backfill; legacy data untouched.

```sql
CREATE TABLE IF NOT EXISTS d6_billing_adjudications (
  attempt_id TEXT PRIMARY KEY,
  plan_id TEXT,
  phase TEXT,
  disposition TEXT NOT NULL,              -- 'estimated_unverified' (v1 vocabulary: this value only)
  estimated_cost_micro_cents INTEGER NOT NULL,
  reserved_cost_micro_cents INTEGER NOT NULL,
  estimate_basis TEXT NOT NULL,           -- derivation record, §5.2
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
  evidence_refs TEXT,                     -- JSON array; REQUIRED non-empty for this kind
  authorization_ref TEXT NOT NULL,
  note TEXT,
  source TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (attempt_id, amendment_seq)
);
```

### 5.2 Figure derivation (server-side, frozen at disposition)

- **Estimate** = `expectedCostMicro(char_count)` for the
  attempt's own occurrence, with `char_count` read from
  `d6_plan_entries` for (plan_id, occurrence_id) — the
  attempt's **own-length** estimator value at the deployed
  rate (`round(chars / 15.96 × 225)`), *not* the job's flat
  19,652 grant estimate (a mean over 18 entries, and not this
  attempt's figure). `estimate_basis` records the derivation
  verbatim, e.g.
  `expectedCostMicro(char_count=NNN) @ gen-constants rate 225/15.96; grant-time flat estimate 19652 NOT used`.
- **Reservation** = the attempt row's own recorded
  `upper_micro_cents` (written at reservation time on the
  chars/10 basis) — the system's standing per-attempt
  budgeting cap, reused rather than recomputed, so the
  reservation is exactly the figure the budget machinery
  already reserved against this attempt while it was in
  flight.
- Both figures are computed inside the transaction from
  persisted records and frozen into the adjudication row.
  They are never recomputed afterward; if the estimator's
  constants ever change, historical dispositions keep the
  figures they were recorded with.

### 5.3 Rollback

- **Code rollback before any disposition executes:** clean.
  The tables are additive and unread by prior code; the new
  outcome value exists nowhere in data.
- **Code rollback after a disposition executes:** the
  adjudication rows persist (no data loss), and exactly one
  attempt row carries `estimated_unverified`. Prior code's
  accounting excludes that row from both settled (not a known
  outcome) and `unknownOpen` (not literally `unknown`), so
  prior surfaces would read the phase as having no open
  unknowns and would not display the estimate — an accounting
  *visibility* gap, not corruption, and not a path this
  design recommends: standing practice for this system is
  fix-forward. The execution runbook (§12) records the
  disposition's read-backs so the state is provable from the
  record regardless of which code is live.
- **Data rollback:** none is designed, deliberately. The
  disposition is one-way (§3, invariant 3); there is no
  "un-dispose" operation. The only exit from the state is the
  evidence-gated amendment (§8).

## 6. `phaseAccounting` — precise behavior and budget math

### 6.1 Definitions (deployed SQL kept verbatim where unchanged)

```text
settledMicro          = SUM(cost_micro_cents) over attempt rows of the phase's plans
                        WHERE phase='confirmed' AND outcome IN ('success','failed_known','policy_block')
                        [UNCHANGED — known outcomes only, forever]
inFlightUpperMicro    = SUM(upper_micro_cents) over rows WHERE phase IN ('reserved','dispatching')
                        [UNCHANGED]
unknownOpen           = COUNT of rows WHERE phase='confirmed' AND outcome='unknown'
                        [UNCHANGED — an estimated_unverified row is not 'unknown',
                         so disposition reduces unknownOpen by exactly 1]
estimatedUnverifiedMicro = SUM(a.estimated_cost_micro_cents) over d6_billing_adjudications a
                        JOIN d6_attempt_log t ON t.attempt_id = a.attempt_id
                        WHERE t.plan_id IN (plans of the phase)
                          AND t.outcome = 'estimated_unverified'
                          AND a.current_amendment = 0        [NEW]
reservedUnverifiedMicro  = SUM(a.reserved_cost_micro_cents), same scope              [NEW]
```

The `current_amendment = 0` scope condition is what retires a
reservation: when an amendment supersedes a disposition with
a verified figure (§8), the attempt row itself transitions to
a known outcome at the verified cost, so the verified amount
enters `settledMicro` through the unchanged settled SQL, and
the estimate/reservation leave the unverified buckets in the
same transaction. No figure is ever counted twice, and no
figure silently changes buckets.

`planSettledMicro(planId)` (the per-plan read behind plan
summaries) is unchanged. Plan summaries gain a sibling field,
`estimatedUnverifiedMicroCents`, computed for the plan's own
adjudications under the same scope rule.

### 6.2 Budget gating and the authorization remainder

- **Grant guard** (`grant-guards.mjs` projection): the
  projected-spend test becomes
  `settledMicro + reservedUnverifiedMicro + inFlightUpperMicro + pendingUpper > PHASE_BUDGET`
  → refuse `phase_budget`. The reservation — the larger,
  conservative figure — is the gating term; the central
  estimate is never used for gating. With zero adjudications
  in a phase, the projection is numerically identical to
  today's.
- **Capabilities / phase read**: `remainingMicroCents =
  max(0, budget − settledMicro − reservedUnverifiedMicro −
  inFlightUpperMicro)`. This is a **deliberate, disclosed
  definition change**: today the remainder subtracts only
  settled + in-flight. With zero adjudications the value is
  identical; the first disposition reduces the displayed
  remainder by the reservation. The change and its reason
  (an authorization remainder must not pretend an outstanding
  unverified exposure is free) are stated here so Rowan
  reviews the semantics, not just the code.
- **Monthly cap / quota surfaces**: untouched. The quota
  view's figures are grant-time ledger estimates under
  existing contracts and are not a consumer of
  `phaseAccounting`'s settled definition.

### 6.3 Read-surface rules (invariant 1, made concrete)

- Capabilities phase object gains
  `estimatedUnverifiedMicroCents` and
  `reservedUnverifiedMicroCents` beside the existing
  `settledMicroCents` / `inFlightUpperMicroCents` /
  `remainingMicroCents`. No existing key changes meaning.
- Plan summary gains `estimatedUnverifiedMicroCents`
  (sibling of `settledMicroCents`, never folded into it).
- Diagnostics attempt rows show outcome
  `estimated_unverified` and, joined from the adjudication
  row, the estimate + reservation + the literal status
  `provider_unverified`. Diagnostics phase view shows the
  three-way split (verified settled / unverified estimate +
  reservation / remaining authorization budget).
- **After retirement**, the retired plan's summary and the
  phase reads continue to join the adjudication row: the
  estimate's unverified status is a permanent property of the
  record, not a state that retirement launders. The
  retirement audit note (§9) references the disposition.

### 6.4 Worked example (the actual disposition, figures as recorded)

Phase `forever-pucked`, budget **13,500,000**:

- `settledMicro` = **17,749** (the G10 smoke settlement; the
  chapter's eight recorded failures contribute 0 under the
  existing local convention — a (b)-class record, per the
  corrected research, not provider confirmation).
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
  Google's charge for that request; if a future provider
  record showed a higher real charge, §8's amendment path —
  not an edit to these figures — is how the books would
  learn it, and the phase remainder is an *authorization*
  control, not a claim about Google's maximum.

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

### 7.2 Request contract (closed schema)

Body: `{ attemptId, planId, authorizationRef, note? }`.

Route-level rejections (returned before the store is called;
zero state movement):

- missing/empty `attemptId` → `attempt_id_required`
- missing/empty `planId` → `plan_id_required`
- missing/empty `authorizationRef` → `authorization_ref_required`
  (the reference to Julie's recorded execution approval for
  this call — e.g. the board comment ID of her approval; the
  route records it verbatim in the audit row. As with every
  operator route in this class, the route's existence is not
  authority: each production *use* is Julie's separate
  authorization, and the recorded reference is what makes a
  use auditable against that authorization.)
- presence of any caller-supplied figure field
  (`knownCostMicro`, `estimatedCostMicro`, `estimated_cost_micro_cents`,
  `reservedCostMicro`, `reserved_cost_micro_cents`, `costMicroCents`)
  → `adjudication_figure_caller_supplied`. Money figures are
  derived server-side (§5.2); a request that tries to name
  one is malformed by definition and refused whole.

On `applied`, the response carries the attempt's new outcome,
the frozen estimate + reservation, `haltCleared`, and the
adjudication row's identifiers — everything the execution
runbook (§12) needs for read-back comparison.

### 7.3 Audit visibility

The adjudication row is the audit: attempt, plan, phase,
disposition, both figures, basis, evidence references (the
design build will freeze the exact reference set — Exhibit A,
the corrected research pin, Rowan's ruling 6534423731, and
the execution approval reference), the recorded authorization
reference, server-stamped source, and timestamp. It is
readable through diagnostics (§6.3) and is never updated
except by the amendment pointer (`current_amendment`), never
deleted. Amendments are separate rows (§8), so the full
uncertainty history — original estimate, basis, and any later
verified supersession — is reconstructible from the two
tables alone.

## 8. Amendment — the future provider-correction path (contract)

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
  non-empty (an amendment without provider evidence is the
  promotion invariant 1 forbids); `verifiedOutcome` is a
  `KNOWN_OUTCOMES` value and `verifiedCostMicro` a finite
  number ≥ 0, validated as a pair under the same discipline
  as the reconcile contract; `authorizationRef` non-empty
  (an amendment is its own gated execution).
- Writes, same transaction: an amendments row
  (`kind='verified_supersession'`, seq = current + 1); the
  attempt row transitions to the verified outcome with
  `cost_micro_cents = verifiedCostMicro` (now honestly a
  known cost — provider evidence is what makes it one); the
  adjudication row's `current_amendment` advances. The
  original estimate, reservation, and basis are **not**
  modified — the uncertainty history is preserved in place
  and the supersession is a new, traceable fact beside it.
- Accounting effect (automatic from §6.1): the verified cost
  enters `settledMicro`; the estimate/reservation leave the
  unverified buckets; `unknownOpen` is unaffected (the
  attempt was not `unknown`).
- Route: `POST /v2/d6-adjudicate-amend`, same operator fence
  class, closed schema, server-stamped source.
- **Build sequencing recommendation:** the two tables land
  with the disposition build (the schema must exist before
  any disposition executes, and it costs nothing while
  unused). The amendment *operation and route* may land in
  the same build or a follow-on — the schema supports either
  without migration. Wren's recommendation: include the
  operation in the same build, reviewed but unexercised, so
  that if evidence ever arrives the honest path already
  exists and no one is tempted to improvise one. Rowan's call
  at design review.

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

### 9.3 Phase-flag clearing at disposition (design decision, flagged for Rowan)

`reconcileUnknown` clears the phase's
`halted_unknown_billing` flag when the phase's last open
unknown settles. This design mirrors that (§4.1 step 8): the
flag's meaning is "an unadjudicated unknown-billing attempt
exists in this phase," and after disposition none does. The
alternative — defer clearing to retirement — was considered
and rejected: it would give one flag two meanings across two
mechanisms, and the flag is a *phase-level billing* fact
while retirement is a *plan-level* act. Safety: clearing the
flag restarts nothing. The plan remains `halted_unknown`
(driver-excluded), the global `GENERATION_HALT` remains as
operations set it, the queue remains as operations left it,
and the admission fence still counts the halted plan as
owning its 18 segments until retirement. §10 test 2 proves
non-resumption with the flag cleared in both global-halt
states.

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
2. **Non-resumption in BOTH halt states.** (a) Global halt
   ON (`GENERATION_HALT='1'`): disposition applies; driver
   selects nothing; no grants; halt-refused legacy commands
   still 423. (b) Global halt OFF with the plan
   `halted_unknown` and the phase flag set: disposition
   applies and clears the phase flag; the plan remains
   driver-excluded; no execution is created; a fresh intent
   over the plan's occurrences is still fenced by the halted
   plan's ownership (admission fence regression).
3. **Exactly-once.** Second disposition call on the same
   attempt → `attempt_not_unknown`; adjudication row count
   still 1; attempt row unchanged after the first call.
4. **Cross-plan / wrong-plan refusals.** `planId` naming a
   different plan than the attempt's → `adjudication_plan_mismatch`,
   zero movement; attempt in a non-halted plan →
   `adjudication_plan_not_halted_unknown`; unknown attempt ID
   → `attempt_not_found`.
5. **Route negatives.** Missing attemptId/planId/
   authorizationRef → the §7.2 rejections; any caller-supplied
   figure field → `adjudication_figure_caller_supplied`;
   client token alone → refused at the gate; no operator
   stamp at the class gate → 403. All with zero state/audit
   movement (the B2 negative pattern).
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
10. **Amendment.** With a fabricated provider-evidence
    fixture: amendment transitions the attempt to the verified
    outcome/cost; adjudication estimate fields unchanged;
    accounting moves reservation → settled exactly;
    `current_amendment` advances. Negatives: empty
    evidenceRefs → refuse; missing authorizationRef → refuse;
    amendment on a never-disposed or already-superseded
    attempt → refuse; stale expected sequence → refuse.
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
    `settled*` or any known-cost key; the flag persists in the
    phase read after the plan is retired.

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
   identity reads and read-backs per §12.
6. **Retirement** of `plan:603ab416bd67ab1b25de97be` → gated
   under the existing retire contract; whether it shares the
   step-5 run or stands alone is decided by the approval text
   at step 5, not assumed here.
7. **Re-arm** (halt flip + queue unpause) and any **fresh
   Chapter 2 generation intent** → their own later proposals
   and Julie's go, exactly as before. This design changes
   nothing about them.

## 12. Execution runbook sketch (for the future step-5 gate; authorizes nothing)

Fresh pre-state reads, compared against the adjudication
proposal's §3 Step 0 set plus: `/health` build identity;
`GENERATION_HALT` value; queue `delivery_paused`; plan state
`halted_unknown` via diagnostics; the attempt's identity
(plan's only confirmed/unknown row; its `upper_micro_cents`;
its plan entry's `char_count`); phase flag state; Ch 3
fingerprint unchanged. Any mismatch → STOP before the call.
Then exactly **one** disposition call (§7). Read-backs:
attempt row (outcome `estimated_unverified`, cost NULL);
adjudication row (figures = server-derived values from the
pre-reads); `phaseAccounting` five figures (unknownOpen 0;
settled unchanged; estimate/reservation as frozen); execution
records **unchanged** (the settled attempt's execution still
`unknown_billing` — expected provenance, §9.2, not a STOP);
plan still `halted_unknown`; full-footprint equality outside
the disposition's enumerated write set. Containment mirrors
the proposal's §4 / deploy C2: any failure or ambiguity →
read-back + STOP; no retry, no second attempt without
Julie's fresh go.

## 13. Open questions for Rowan (design review)

1. §9.3: phase-flag clearing at disposition (mirroring
   reconcile) vs at retirement — design chooses mirroring;
   confirm or redirect.
2. §5.2/§6: the dual-figure treatment (own-length estimate
   recorded; recorded upper as the gating reservation) vs an
   upper-only recording — design chooses dual-figure for
   display honesty + gating conservatism; confirm or redirect.
3. §8: amendment operation in the same build (recommended)
   vs schema-now/operation-later — Rowan's sequencing call.
4. §6.2: the disclosed `remainingMicroCents` definition
   change (subtracting the reservation) — confirm the
   semantics are the ones the surfaces should carry.

— Wren
