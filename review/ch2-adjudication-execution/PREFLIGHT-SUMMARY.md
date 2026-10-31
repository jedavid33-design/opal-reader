# PREFLIGHT SUMMARY — gate-5 adjudication execution proposal

Fresh **read-only** reads taken for this proposal on
**2026-10-31T00:56:25Z** (capture `pf1`), via the v2 client
connector (routine reads), the operator connector
(`GET /v2/d6-diagnostics`, operator-gated read), and Cloudflare
GETs (script `/settings`, script-settings, script download
headers, queue). **No mutation of any kind was performed; the
adjudication route was NOT called.** Raw captures are held
locally at `~/workspace/ch2-program/adjudication-execution/preflight/`;
this summary is the scrubbed record (identifiers and figures
only — no credentials, no book text).

## Live build / containment

- `/health`: build **`6a73d9622e1b4eac00c58e289de1c674ed6b3d6b`**,
  generation **"halted"**, coordinator "armed", scope
  "production", version "2.0.0".
- Script GET headers: etag
  **`a9a4c0c40ceefa6138c1cc8ebb3f0ab5b2205e7b7a057b865c8c312cbb13c39e`**
  (identical to the deploy's D2 PUT etag).
- `/settings` bindings: exactly the 10 expected names;
  `GENERATION_HALT "1"`, `OPALREADER_PHASE_POLICY "enforce"`;
  observability enabled + logs enabled + persist true.
- Queue `opalreader-generation-v2`:
  `delivery_paused == true`, sole consumer
  `f260f2188d80426bb0588685e9d084eb` (`opalreader-api-v2-prod`).
- Settings: revision **1** (lane standard, monthly cap $50).
  Quota view: attemptsToday 0 / spentMicroCents 371485 /
  ledgerSeq 19 (grant-time estimates, not provider spend).
  Watermarks: content 18 / bindings 1800.
  `/v2/conflicts`: exactly the two recorded `schedule_dead` rows.

## The one attempt (diagnostics, plan-scoped read, operator connector)

Across the plan's 9 executions / 51 attempts, **exactly one**
attempt row is `phase='confirmed' AND outcome='unknown'`:

| Field | Value |
|---|---|
| attemptId | `att-37d63768-db4b-447d-8150-580b7c6ee257` |
| planId (server-stamped) | `plan:603ab416bd67ab1b25de97be` |
| occurrenceId | `59acff00-d6a4-4e2b-9734-34d50f4f59f0` |
| executionId | `exec-6a9c4e14-2223-4806-9694-90cd140cbd8e` (state `unknown_billing`) |
| seq | 7 |
| phase (lifecycle) | `confirmed` |
| outcome | `unknown` |
| **costMicroCents** | **null** |
| upperMicroCents (attempt row, recorded) | **5,648** |
| providerRequestId | null |
| createdAt / updatedAt | 1793315781213 / 1793315781250 |

## Matched plan entry (plan read, client connector)

Exactly one entry in the plan matches the attempt's
occurrenceId:

| Field | Value |
|---|---|
| occurrenceId | `59acff00-d6a4-4e2b-9734-34d50f4f59f0` |
| **charCount** | **1,349** |
| disposition | `eligible` |
| position | 50 |
| chapterIndex | 1 |
| jobId | `plan:603ab416bd67ab1b25de97be:ch1` |
| occurrenceState / executionState | `granted` / `unknown_billing` |

Derived figures (source formulas, gen-constants; JS
`Math.round` semantics, recomputed for this proposal):

- **Estimate** = `expectedCostMicro(1349)`
  = `round(1349 / 15.96 × 225)` = **19,018** — the figure the
  server will derive from the entry's `char_count` inside the
  disposition transaction (§5.2).
- **Reservation** = the attempt row's recorded
  `upper_micro_cents` = **5,648** — the figure the server will
  freeze as `reserved_cost_micro_cents`.
- Plan-entry `upper_micro_cents` (store column, validated
  in-transaction at §4.1 step 6 and recorded in the basis
  string): not exposed on any deployed read surface. By the
  source's plan-build formula it is
  `upperBoundOccurrenceMicro(1349) = 12 × round(1349 / 10 × 225)
  = 12 × 30,353 = 364,236`. This is a **source-derived
  expectation, not a read-back**; the disposition itself
  validates the stored value (safe integer ≥ 0) before
  deriving anything, and refuses without mutation if it is
  defective.
- Disclosed relationship: the estimate (19,018) **exceeds**
  the reservation (5,648) for this attempt. That is what the
  reviewed source computes: the estimate derives from the
  plan entry's full-occurrence length (1,349 chars), while the
  reservation is this attempt row's own recorded upper — this
  attempt was seq 7 within a split execution, and its recorded
  upper (5,648) is the per-attempt upper for the part actually
  dispatched, not the full occurrence. Budget gating uses the
  reservation (design §6.2); both figures are reported
  separately and neither is a provider charge. (Design §6.4's
  worked example used mean-length approximations; this
  attempt's actual recorded figures govern.)

## Plan state

`plan:603ab416bd67ab1b25de97be` — bookId
`5c589095-f812-48a2-8ab2-03ba2791f2b2`, scope chapter,
chapterIndex 1, lane standard, phase `forever-pucked`,
state **`halted_unknown`**, stopReason
`phase_halted_unknown_billing`; 38 entries (20 `bound_already`
+ 18 `eligible`); totals eligible 18 / done 0 / failed 8;
plan-level settledMicroCents **179,991**;
`estimatedUnverifiedMicroCents: 0`; **no**
`estimatedUnverifiedStatus` key. The smoke plan
(`plan:3183ecbf2ac4bf50bbc6166e`) is `complete`, settled
19,674, estimate 0, no status key. Chapter 3 job
`1832c21fcf0425454227c4736048a8a632f422abca4a2685ddb775bb1681406a`
still `parked_policy`, fingerprint
`b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`
exact, 27 rows (3 ready / 24 pending), grants [].

## Phase state + capabilities

Phase `forever-pucked` (the only budgeted phase), identical
from capabilities and from both diagnostics views:

- budgetMicroCents **13,500,000**
- settledMicroCents **199,665**
  (`settledBasis: "recorded_known_existing_ledger"` —
  ledger-recorded, **not** provider-verified)
- estimatedUnverifiedMicroCents **0**
- reservedUnverifiedMicroCents **0**
- inFlightUpperMicroCents **0**
- **unknownOpen 1**
- remainingMicroCents **13,300,335**
- `unverifiedStatus: "provider_unverified"` (diagnostics)
- Capabilities: generationState "halted"; lane standard
  admitted; batch not armed.

## Rollback-floor baseline + zero-disposition evidence

**Floor (design §5.3):** build
`6a73d9622e1b4eac00c58e289de1c674ed6b3d6b` + deployed etag
`a9a4c0c40ceefa6138c1cc8ebb3f0ab5b2205e7b7a057b865c8c312cbb13c39e`
— recorded in the deploy execution record (pin
`6c8285411efbd0c2293aae416913363cbabd861f`) and re-verified
live above. While zero adjudication rows exist, rollback to
the pre-disposition build `28850807…` remains available only
as a separately Julie-authorized halted deploy; **from the
first disposition onward, the floor build + etag is the
oldest build that may ever run**, under §5.3's holds and exit
gate.

**Zero adjudication rows — the pre-adjudication evidence.**
Surfaces demonstrating it, all read fresh above:

1. Capabilities: the only budgeted phase shows
   estimated/reserved **0/0**.
2. Plan list + both plan summaries: estimate **0** and **no**
   `estimatedUnverifiedStatus` key on either plan (the status
   key exists only when a plan has an adjudication).
3. Diagnostics for **both** plans: the `phaseAccounting`
   block shows estimated/reserved **0/0**, and across all 58
   attempts account-wide (51 Ch 2 + 7 smoke) **no attempt row
   carries outcome `estimated_unverified`**; the one unknown
   attempt is still `unknown` with cost NULL (an adjudication
   against it is exactly what would have changed it).

**Stated limit, honestly:** no deployed read surface
enumerates `d6_billing_adjudications` directly, and the reads
cannot distinguish "tables absent" from "tables present but
empty." What they *do* prove is the operative fact: any
unamended adjudication row anywhere in the store would join
an attempt in a plan of the only budgeted phase and would
surface as a non-zero estimate/reservation on the surfaces
above (§5.4/§6.1 scope rules); all read exactly zero, and the
sole candidate attempt is demonstrably undisposed. Zero
adjudication rows is therefore established to the full extent
the deployed read surfaces can demonstrate it — and the
execution gate (§5 of the proposal) re-takes this same
evidence fresh before the call.

— Wren
