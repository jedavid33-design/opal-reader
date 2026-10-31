# EXECUTION PROPOSAL — gate 5: the one §8 uncertainty disposition

**Repo-only proposal for Rowan's review. This document
authorizes nothing and performs nothing: no adjudication call
is made by it, and none may be made until (a) Rowan reviews
this proposal and (b) Julie gives her distinct explicit
approval naming this adjudication (design §11 gate 5).**

Prepared under Rowan's execution-record PASS (roundtable
issue #15, comment 6536797045), which directed this proposal's
contents; Wren ack 6536812261. Design of record:
`UNCERTAINTY-DISPOSITION-DESIGN.md` Rev 2 (pin
`d2daa2e544bc2588573d1777c303c9cb9c433fc8`, Rowan DESIGN PASS
6535393656). Build of record: SOURCE PASS pin
`6a73d9622e1b4eac00c58e289de1c674ed6b3d6b` (6536181155),
deployed halted under Julie's approval 6536597179 and Rowan's
OPERATIONAL-PLAN PASS 6536365406; deploy execution record pin
`6c8285411efbd0c2293aae416913363cbabd861f`, Rowan
EXECUTION-RECORD PASS 6536797045.

**The subject, in one line:** dispose exactly one attempt —
`att-37d63768-db4b-447d-8150-580b7c6ee257` in plan
`plan:603ab416bd67ab1b25de97be` — as `estimated_unverified`
via the already-deployed operator route, recording an
estimate of **19,018** and a reservation of **5,648**
(micro-cents, i.e. ≈ $0.0190 / ≈ $0.0056 in the ledger's
units), with `cost_micro_cents` staying **NULL** and the
provider charge remaining **`provider_unverified`** forever.
No known cost is asserted; no settlement is invented;
proposal §6 (known-cost reconciliation) remains
**NOT SUBMITTED** and is not used.

Companions in this package: `PREFLIGHT-SUMMARY.md` (the fresh
read-only preflight, §1 below) and `evidence/` (the scrubbed
deploy-verification attachments Rowan's housekeeping note
requested, §6 below).

---

## 1. Preflight — the exact attempt, the plan, the live state

Fresh read-only reads, 2026-10-31T00:56:25Z; full record in
`PREFLIGHT-SUMMARY.md`. Headline values:

**The one attempt.** Across the plan's 9 executions / 51
attempts there is exactly one `phase='confirmed' AND
outcome='unknown'` row:

- attemptId `att-37d63768-db4b-447d-8150-580b7c6ee257`, seq 7,
  occurrenceId `59acff00-d6a4-4e2b-9734-34d50f4f59f0`,
  execution `exec-6a9c4e14-2223-4806-9694-90cd140cbd8e` (state
  `unknown_billing` — historical provenance, §9.2 of the
  design; expected to remain so after disposition, **not** a
  STOP condition);
- **`cost_micro_cents` = NULL** (read as `costMicroCents: null`);
- attempt-row recorded **`upper_micro_cents` = 5,648** → the
  reservation the server will freeze;
- matched plan entry: exactly one entry for the occurrence,
  **`char_count` = 1,349**, disposition `eligible`;
- **estimate the server will derive** =
  `expectedCostMicro(1349) = round(1349 / 15.96 × 225)` =
  **19,018** (own-length; the flat 19,652 grant estimate is
  NOT used — the basis string the store writes says so);
- entry `upper_micro_cents` is validated in-transaction
  (source-formula expectation 364,236 =
  `upperBoundOccurrenceMicro(1349)`; not exposed on read
  surfaces — stated as an expectation, not a read-back, in
  the preflight summary).

Disclosed plainly (preflight summary, §figures): for this
attempt the estimate (19,018) exceeds the reservation
(5,648), because the estimate derives from the full
occurrence length while the reservation is this attempt's own
recorded per-attempt upper (seq 7 of a split execution).
Budget gating uses the reservation (design §6.2). Neither
figure is a provider charge.

**The plan.** `plan:603ab416bd67ab1b25de97be`: Forever Pucked,
chapter scope (chapterIndex 1), lane standard, phase
`forever-pucked`, state **`halted_unknown`**, stopReason
`phase_halted_unknown_billing`; 38 entries (20
`bound_already` + 18 `eligible`); totals eligible 18 / done 0
/ failed 8; plan settledMicroCents 179,991.

**Phase + capabilities.** Phase `forever-pucked` (only
budgeted phase): budget 13,500,000; settled **199,665**
(recorded/known under the existing ledger — **not**
provider-verified); estimated **0**; reserved **0**; in-flight
0; **unknownOpen 1**; remaining **13,300,335**;
`unverifiedStatus: "provider_unverified"` present on
diagnostics. Generation halted; standard lane admitted;
batch not armed.

**Build + floor baseline.** `/health` build
**`6a73d9622e1b4eac00c58e289de1c674ed6b3d6b`**, generation
"halted"; script etag
**`a9a4c0c40ceefa6138c1cc8ebb3f0ab5b2205e7b7a057b865c8c312cbb13c39e`**
(fresh GET, identical to the deploy PUT etag);
`GENERATION_HALT "1"`; policy "enforce"; queue
`delivery_paused == true`, sole consumer
`f260f2188d80426bb0588685e9d084eb`; settings revision 1;
observability enabled + persisted.

**Rollback floor (design §5.3), recorded as the baseline:**
build `6a73d962…` + etag `a9a4c0c4…` is the rollback floor
**from the first disposition onward**. Pre-adjudication
zero-disposition evidence (fresh, this preflight): zero
adjudication rows demonstrated across the store by
capabilities 0/0 on the only budgeted phase, both plan
summaries at estimate 0 with no `estimatedUnverifiedStatus`
key, and both diagnostics views at 0/0 with no
`estimated_unverified` attempt among all 58 account-wide
attempts — with the stated limit (no read surface enumerates
the adjudication table directly; tables-absent vs
tables-present-but-empty is indistinguishable by reads, and
either state proves the operative fact: no disposition has
ever executed). Full statement in `PREFLIGHT-SUMMARY.md`.

## 2. The call — exactly one operator-credential invocation

**Route (deployed source, worker-entry-prod-d6.js):**
`POST /v2/d6-adjudicate-estimated` → DO-internal
`/internal/d6/adjudicate-estimated` → service handle
`adjudicateEstimatedAttempt` → `genstore.adjudicateEstimated`.
Operator fence class, identical to reconcile/retire/release:
production gate skips the client token for this route; the
operator admission block requires the migration-operator
credential; the coordinator class gate re-requires the
stamped admission (`x-opalreader-operator-admitted: 1`), else
403 `migration_operator_required`. `source` is stamped
server-side (`"operator-route"`); the evidence references are
stamped server-side from the frozen
`ADJUDICATION_EVIDENCE_REFS` (Exhibit A identifier; research
pin `06c66d45…`; Rowan ruling 6534423731; design review
6534952386; design PASS 6535393656) — neither is
caller-supplied.

**Invocation (the execution gate runs exactly this, once):**

```text
v2prod-operator-api POST /v2/d6-adjudicate-estimated \
  --header 'X-OpalReader-Scope: production' \
  --header 'X-OpalReader-Instance: account' \
  --body '{"attemptId": "att-37d63768-db4b-447d-8150-580b7c6ee257",
           "planId": "plan:603ab416bd67ab1b25de97be",
           "authorizationRef": "<JULIE-APPROVAL-COMMENT-ID>",
           "note": "Gate-5 adjudication execution: section-8 estimated_unverified disposition of the one Chapter 2 unknown attempt; provider charge unverified; approval recorded at authorizationRef."}'
```

- **Request schema (closed allowlist, design §7.2, enforced
  at the route before the store is called):** keys exactly
  `{ attemptId, planId, authorizationRef, note }`. A figure
  key refuses the whole request as
  `adjudication_figure_caller_supplied`; any other extra key
  as `adjudication_request_key_not_allowed`; blank-after-trim
  attemptId/planId/authorizationRef refuse as
  `attempt_id_required` / `plan_id_required` /
  `authorization_ref_required`; a non-string or >2,000-char
  note refuses as `note_invalid`. All route refusals move
  zero state.
- **`authorizationRef` placeholder rule:** the value is the
  GitHub comment ID of **Julie's gate-5 execution approval**
  on roundtable issue #15 — the distinct explicit approval
  naming this adjudication (this attempt, this plan), given
  after Rowan's review of this proposal and recorded on the
  board by Wren before execution. The trimmed ID string is
  used verbatim. It is filled in **only at the execution
  gate**; this proposal deliberately carries the placeholder,
  and an execution without that approval on record is a STOP
  (§5, step E1). The store records the reference; per the
  design it cannot and does not verify it — the gate
  procedure (§5) is what binds the call to the approval.
- **`note`:** the fixed text above (no figures in it — the
  figures are server-derived and frozen by the store, never
  caller-named).

**Expected response (HTTP 200, from the service handle's
applied shape):**

```json
{ "outcome": "applied",
  "attemptId": "att-37d63768-db4b-447d-8150-580b7c6ee257",
  "attemptOutcome": "estimated_unverified",
  "attemptCostMicroCents": null,
  "estimatedCostMicroCents": 19018,
  "reservedCostMicroCents": 5648,
  "adjudication": { "attemptId": "att-37d63768-db4b-447d-8150-580b7c6ee257",
                    "planId": "plan:603ab416bd67ab1b25de97be",
                    "phase": "forever-pucked",
                    "disposition": "estimated_unverified" },
  "haltCleared": true }
```

`haltCleared: true` is the expected value: this attempt is
the phase's last unadjudicated unknown, so the in-transaction
accounting recompute yields `unknownOpen === 0` and clears
`d6_phase_state.halted_unknown_billing` (design §4.1 step 8,
§9.3 / Q1). A rejected response
(`{ outcome: "rejected", reason }`), a non-200, or an applied
response whose figures differ from §1's derived values is
**not** a partial success — it is a STOP (§4).

**What the call does (source, §4.1 steps 1–9, one
transaction):** validates the attempt exists, is
confirmed/unknown, and carries cost **precisely NULL** (S1
guard: `adjudication_cost_inconsistent` otherwise); verifies
plan ownership against the attempt's server-stamped
`plan_id`; requires the plan `halted_unknown` and resolves
the budget phase from the plan row; requires the non-blank
authorization reference; validates the particulars (exactly
one plan entry; `char_count` safe integer > 0; entry and
attempt uppers safe integers ≥ 0) **before** deriving any
figure; derives estimate + reservation server-side; ensures
the adjudication schema; updates the attempt outcome; inserts
the one adjudication row; recomputes phase accounting and
clears the phase flag if `unknownOpen === 0`; returns the
attempt, the adjudication row, and `haltCleared`.

**What it does NOT do:** it does not write
`cost_micro_cents` (stays NULL); does not touch
`d6_execution_records` (the attempt's execution stays
`unknown_billing` — provenance, §9.2); does not change the
plan's state (stays `halted_unknown` — retirement is the
separate later gate); creates no grant, plan, job, or queue
message; changes no halt, queue, or settings state; makes no
provider call; and spends nothing (the disposition writes no
cost; provider billing is untouched — the figures are
internal ledger estimates, permanently flagged unverified).

**Read-back set after the call (all read-only):**

1. Diagnostics (Ch 2 plan): the attempt row now
   `outcome = "estimated_unverified"`, `costMicroCents` still
   **null**; the joined adjudication figures on the attempt
   (estimate 19,018, reservation 5,648, literal status
   `provider_unverified`); execution still `unknown_billing`
   (expected); plan block still `halted_unknown`.
2. Diagnostics `phaseAccounting` (both plan views,
   phase-scoped): settled **199,665 unchanged**;
   estimatedUnverified **19,018**; reservedUnverified
   **5,648**; in-flight 0; **unknownOpen 0**;
   `unverifiedStatus: "provider_unverified"` still present;
   budget 13,500,000.
3. Capabilities FP phase: estimated **19,018**, reserved
   **5,648**, settled 199,665 unchanged, remaining
   **13,294,687** (= 13,500,000 − 199,665 − 5,648, per §6.2);
   generationState still "halted". **This capabilities +
   diagnostics read-back is archived externally with the
   execution record as the §5.3 rollback baseline** (floor
   build + etag + the archived figures are the exit gate's
   comparison set for any future rollback).
4. Plan list + Ch 2 plan summary:
   `estimatedUnverifiedMicroCents: 19018` with
   `estimatedUnverifiedStatus: "provider_unverified"` now
   present; plan state still `halted_unknown`; settled
   179,991 unchanged; smoke plan untouched (estimate 0).
5. Full-footprint equality outside the §3 write-set:
   `/health` (build + halted), queue (paused, sole consumer),
   bindings (`GENERATION_HALT "1"`, policy "enforce"),
   settings revision 1, quota view unchanged, watermarks
   18/1800, conflicts (the two `schedule_dead` rows), Ch 3
   job (`parked_policy`, fingerprint
   `b991f18a…` exact), both jobs' grants unchanged,
   observability unchanged.

## 3. Write-set — precise, and the explicit zero-set

The one call writes, in **one coordinator transaction**
(plus the lazy schema ensure inside it):

| # | Write | Detail |
|---|---|---|
| W1 | `CREATE TABLE IF NOT EXISTS d6_billing_adjudications` + `d6_billing_adjudication_amendments` | Lazy DDL, both tables, one batch (§5.1). First-ever writer run: the tables are created by this call. The amendments table is created **empty** and has no writer in this build (Q3). |
| W2 | `UPDATE d6_attempt_log SET outcome='estimated_unverified', updated_at=? WHERE attempt_id='att-37d63768-…'` | One row. `cost_micro_cents` is **not** in the SET list — remains NULL. |
| W3 | `INSERT INTO d6_billing_adjudications` — exactly one row | attempt_id (PK), plan_id, phase `forever-pucked`, disposition `estimated_unverified`, estimated_cost_micro_cents **19018**, reserved_cost_micro_cents **5648**, estimate_basis (derivation + source-row identities, incl. entry upper 364,236 as recorded by the store and the line "grant-time flat estimate 19652 NOT used"), evidence_refs (the 5 server-stamped refs), authorization_ref (Julie's approval comment ID, trimmed), note (the §2 text), source `operator-route`, current_amendment **0**, created_at. |
| W4 | `UPDATE d6_phase_state SET halted_unknown_billing=0, halt_detail=NULL, updated_at=? WHERE phase='forever-pucked'` | Only because the same-transaction recompute yields unknownOpen 0 (expected; reported as `haltCleared`). This is the phase *billing flag* only — see the zero-set for what it is not. |

**Zero-set (explicit):** no other attempt row (the other 57
account-wide attempts untouched); no other plan; **no
`d6_plans` row write** (plan state, stopReason unchanged);
**no `d6_execution_records` write**; no grant created,
issued, or consumed; no job row; no queue message and no
queue/halt/settings change (`GENERATION_HALT` stays "1", the
queue stays PAUSED); no quota/ledger write; no R2 object; no
provider call; **no spend** — the disposition writes no cost
anywhere, and Google's billing is neither read nor altered
by it. Any read-back showing movement outside W1–W4 is a
STOP-level discrepancy for the execution record (§4).

## 4. Invariants + STOPs

**Fresh identity checks at execution (all must hold,
re-read immediately before the call — §5 step E0):**

- attempt still `confirmed`/`unknown` with cost NULL, upper
  5,648, in plan `plan:603ab416bd67ab1b25de97be`;
- exactly one plan entry for its occurrence, `char_count`
  1,349;
- plan still `halted_unknown` /
  `phase_halted_unknown_billing`; phase accounting still
  settled 199,665 / estimated 0 / reserved 0 / unknownOpen 1
  / remaining 13,300,335 (i.e. zero dispositions still);
- build still `6a73d962…` **and** script etag still
  `a9a4c0c4…` (the floor values); halt "1"; queue paused with
  the sole consumer; settings revision 1; Ch 3 fingerprint
  exact.
- **Any drift on any value = STOP. No call is made.**

**STOP-on-any-ambiguity in the response.** A non-200, a
malformed body, a `rejected` outcome, an `applied` outcome
with any figure differing from §1/§2, a timeout, or a
transport error whose outcome is unknown: **no retry, no
second call, no compensating action** — read-back only
(§2's set), then report. Stored state, not the response, is
the truth: if the read-back shows the disposition landed
exactly once with the expected figures and write-set, the
execution record reports it as applied-on-state-evidence and
still takes no further action; if it shows anything else
(partial, divergent, or absent after an ambiguous response),
the gate halts and any further step requires Julie's fresh
direction. (Partial application inside the store is not an
available outcome: the disposition is one transaction — §4.1
— and its fault-injection test rolls back whole.)

**Exactly-once (source guards).** A second call against the
same attempt refuses `attempt_not_unknown` (the
confirmed/unknown transition guard — a disposed attempt is
no longer `unknown`); the adjudication table's
`PRIMARY KEY (attempt_id)` makes a second audit row
impossible; the S1 guard refuses
`adjudication_cost_inconsistent` if the row's cost were ever
non-NULL. One-way: no function in this build transitions out
of `estimated_unverified` (the §8 amendment operation/route
does not exist in this build — schema only, Q3).

**Zero-grant / zero-resumption.** The disposition creates no
grant, plan, job, execution, or queue message, in either
halt state (design §10 test 2 proves non-resumption with the
global halt ON and OFF). Clearing the phase flag is **not**
re-arm authority: the plan remains `halted_unknown` and
driver-excluded, the admission fence still counts the halted
plan as owning its 18 segments until retirement, the global
halt and paused queue are separate latches this call does
not touch.

**Rollback-floor law (restated, §5.3).** Before any
disposition: rollback to `28850807…` only as a separately
Julie-authorized halted deploy, and only while zero
adjudication rows exist, re-demonstrated fresh (per §1's
evidence, not inferred from plan state). **After this
disposition executes: build `6a73d962…` + etag `a9a4c0c4…`
is the floor — rollback to any pre-disposition build is
PROHIBITED while any adjudication row exists (permanently,
absent the deferred §8 amendment package).** Any
post-disposition rollback (to the floor or a later
adjudication-aware build) requires, in order: the archived
external adjudication read-back (§2 read-back 3) captured
*before* the rollback; `GENERATION_HALT=1` verified and
held; queue PAUSED verified; re-arm BLOCKED for the whole
window; and the verifiable exit gate — live build = intended
target **with proven adjudication compatibility of the exact
target build** (not merely a newer SHA/date), capabilities
exposing both unverified keys exactly equal to the archived
read-back, and the disposed plan's summary still showing
`provider_unverified`. Absent key or mismatch → re-arm stays
BLOCKED. The honest residual stands as Rowan recorded it:
the floor is an operator procedure with a verification gate,
not a mechanically enforced cross-version guarantee.

## 5. Execution sequence (the future gate; numbered)

- **E0 — Preflight re-read.** Re-take §1's full read set
  fresh (health, script etag via GET headers, `/settings`
  bindings + script-settings, queue, settings, quota,
  capabilities, plan list + Ch 2 plan, both diagnostics,
  conflicts, Ch 3 fingerprint, zero-disposition evidence).
  **PASS:** every identity value equals §1 exactly.
  **STOP:** any drift — no call; report the drift.
- **E1 — Julie approval check.** Confirm Julie's distinct
  explicit approval naming this adjudication (attempt
  `att-37d63768-…`, plan `plan:603ab416bd67ab1b25de97be`) is
  on record on roundtable issue #15, given after Rowan's
  review of this proposal. Its comment ID becomes
  `authorizationRef`. **PASS:** approval present and
  unambiguous. **STOP:** absent, ambiguous, or scoped to
  anything else (a deploy approval, a build approval, or a
  general "proceed" does not satisfy this step).
- **E2 — The one call.** Execute §2's invocation exactly
  once, with the E1 comment ID as `authorizationRef`.
  **PASS:** HTTP 200, `outcome: "applied"`, figures
  19,018 / 5,648, `attemptCostMicroCents: null`,
  `haltCleared: true`. **STOP:** anything else (§4) —
  no retry; proceed to E3 read-backs only.
- **E3 — Read-backs.** Take §2's full read-back set.
  **PASS:** attempt `estimated_unverified` + cost NULL;
  adjudication figures frozen as expected; phase accounting
  settled 199,665 / estimated 19,018 / reserved 5,648 /
  unknownOpen 0 with `provider_unverified` visible; plan
  still `halted_unknown`; capabilities remaining 13,294,687;
  execution record still `unknown_billing` (expected, not a
  STOP); footprint outside W1–W4 identical to E0. Archive
  the capabilities + diagnostics read-back externally as
  the §5.3 rollback baseline, and record build `6a73d962…`
  + etag `a9a4c0c4…` as the rollback floor in the execution
  record. **STOP:** any mismatch — report; no further action
  without Julie's fresh direction.
- **E4 — Record filing.** Write the execution record locally
  (`~/workspace/ch2-program/adjudication-execution/`), pin it
  as a clean child on `ui1-review`, and file one board
  comment on issue #15 with a fresh Handoff ID for Rowan's
  review, attaching/linking the read-back evidence.
- **E5 — Rowan review.** Rowan reviews the execution record.
  Nothing further is authorized by a PASS: **retirement of
  the plan and any re-arm / fresh Chapter 2 generation are
  later, separate Julie gates** (design §11 gates 6–7) and
  are **not** part of this proposal or of the approval it
  requests.

## 6. Evidence housekeeping (Rowan's ask, 6536797045)

Attached in this package under `evidence/` — scrubbed copies
from the disposition deploy's evidence (grep-checked: no
credentials, tokens, or secrets; no book text; identifiers
are the operational IDs already on the board record):

- `evidence/d4-comparison-summary.md` — the deploy's D4
  comparison summary (21 surfaces identical under the
  data-not-shape interpretation; the additive-key assertions).
- `evidence/four-file-comparison.json` — the four-file
  Git-blob-vs-envelope byte comparison (genstore 47,108 B /
  `8602e45e…`; service 76,860 B / `c4008d98…`; grant-guards
  12,936 B / `9249539f…`; entry 64,548 B / `079e982b…` — all
  MATCH).
- `evidence/parts-verification-27.json` — the 27-part
  verification results: all 27 module parts byte-identical
  between envelope and deployed download; the sole
  non-module row is `metadata` (absent from the GET-script
  representation — the established, disclosed representation;
  its operative content is proven by the D2 PUT response and
  the `/settings` read-back).

These are the deploy's artifacts as captured, not
re-measurements; Rowan's stated evidence level for the
deploy (Wren-observed Cloudflare/log assertions, independently
reviewed as a pinned record) carries over to them unchanged.

## 7. What this proposal is not

Not an adjudication (no call is made by it). Not a
retirement proposal, not a re-arm proposal, not a generation
go, not a deploy (no code changes anywhere in this package).
The known-cost §6 route remains NOT SUBMITTED. The unknown
provider charge remains `provider_unverified` under this
disposition permanently, unless the deferred §8 amendment
package — its own future chain, requiring actual provider
evidence, human review of it, Rowan's source review, and
Julie's separate authorization — ever supersedes it.

**Turn: Rowan's** (review of this proposal), then
**Julie's** (the gate-5 execution decision).

— Wren
