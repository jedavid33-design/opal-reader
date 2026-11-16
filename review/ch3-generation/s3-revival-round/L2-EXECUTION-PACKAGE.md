# L-2 EXECUTION PACKAGE — S-3 revival (amended, source-grounded)

Case #10 / P8 (issue #15). Prepared by Wren, 2026-11-16, under Rowan's ruling on
the S-3 revival round (PASS WITH REQUIRED AMENDMENTS; verbatim board 6920040804).
Handoff: RT-H-20261116-7dcfa1
Review pin: PIN-SLOT (repo `jedavid33-design/opal-reader`, branch `ui1-review`;
the Dropbox copy carries the filled pin — the only difference between copies).
Source basis: the deployed build `8a16def42e941790ef2eeb460366bb19ef977801`,
tree `~/workspace/ch2-program/a1-build/candidate-tree/` (the A-1 candidate =
the live build). All section references below are to `v2/coordinator.mjs`
unless another file is named.

**Status: EXECUTION NOT AUTHORIZED.** This package returns to Rowan for
review. The invocation executes only on Rowan's acceptance of this package AND
Julie's separate execution GO. Production remains in its standing LIVE posture
with the unresolved S-3 stall; nothing in this package changes that.

## 1. Source-grounded adjudication analysis (ruling Q1)

### 1.1 The exact state to be adjudicated

- Grant `grant:plan:305078b1fba2c5119a86e142:ch5:3:full`, state `issued`, rev 4;
  its 15-minute lease expired during fault #4.
- Execution `exec-c30d5a24-4b7c-455b-84f3-713aa3848541`, state `attempted`,
  created 2026-11-14T20:56:58.964Z (inside the fault's onset bracket).
- Attempt `att-741ceee0-645e-4558-9b85-fd6e1cd653b8`, seq 1, **phase
  `dispatching`**, outcome null, cost null, providerRequestId null,
  upperMicroCents **16,808**.
- Occurrence `c10f79c1-48b7-4763-9bda-79fc05e7e0ff`, state `granted`.

The `dispatching` phase is decisive evidence about where the work stopped:
per `v2/generation/d6-executor.mjs`, an attempt is reserved, then marked
`dispatching` immediately before the provider call, and its outcome is
confirmed only after the call returns. This attempt was therefore **in flight
to the provider when the fault hit**. Whether the provider received, processed,
or charged for the request cannot be established from any available evidence,
and this package does not attempt to establish it. What follows establishes
that the implementation handles that uncertainty safely.

### 1.2 The applicable branch on chain revival

Lease processing runs inside drive passes (the `lease` schedule case). For
this grant, on the first pass that processes its expired lease row:

1. **No void path is available.** Every void route runs through
   `_voidDispatch`, which is claim-fenced: a grant with a `claimed` claim row
   is never voided (`void_refused_claimed`), because a claimed dispatch may
   have spend in flight. This grant was claimed — the executor's recorded
   activity (execution, spend intent, dispatching attempt) exists only
   downstream of a claim. The safe-void branch (`lease_expired_undelivered`)
   additionally requires a provably unsent dispatch, which this is not.
2. **The delivered branch applies.** With delivery established, the lease case
   applies the `lease_expired` occurrence event to occurrences still `granted`
   under this grant that hold attempt ledger ops: occurrence →
   **`outcome_unknown`**; job → `outcome_unknown`; then `reconcileUnknown`
   runs immediately for the occurrence (§1.3).
3. **Convergence note (the one unreadable input).** No read surface returns
   the outbox row's `sent_at`. If — contrary to the executor evidence — the
   row showed a send attempted but unacknowledged, the lease case instead
   parks the grant as `handoff_uncertain` and schedules a queue-acceptance
   probe (`handoff_check`); the probe's claim fence resolves a claimed grant
   as **accepted** on the claim's own evidence, returning it to `issued` with
   a fresh lease, from which it ages into the same `outcome_unknown` path —
   never into a void, a release, or a re-grant. Every branch consistent with
   the evidence converges on §1.3; no branch re-dispatches this occurrence or
   releases its accounting by assumption.

### 1.3 What happens to the occurrence: `outcome_unknown` and its only exits

The occurrence state machine (`OCC_TRANSITIONS`) gives `outcome_unknown`
exactly three exits. **Re-dispatch is not one of them.**

- **`reconcile_adopt` → `ready`.** `reconcileUnknown` first tries the
  deterministic cache key: if the audio provably landed in the cache
  (`validateAndBind` succeeds), the occurrence is adopted by binding — no new
  provider call, no new charge. This is also the path by which a late-landing
  result is absorbed: content-addressed audio is never wasted, and a late
  report rejected for state purposes can still be adopted through bindings.
- **`reconcile_spent` → `failed`.** Only on a CONFIRMED provider outcome
  recorded against this exact grant (`noteProviderOutcome`: `failed` or
  `spent_without_audio`, with evidence). A dispatch record or a provider
  request ID alone never suffices — and this attempt has neither an outcome
  nor a request ID recorded, so this exit is not expected to fire.
- **Otherwise it stays `outcome_unknown`** — visible, surfaced to Julie, and
  resolvable only by Julie's explicit `ResolveOutcomeUnknown` command
  (`resolve_resynthesize` → `pending`, under a NEW operation identity), which
  is a separate authorization that L-2 does not request or imply.

Executor-side, the same classification holds: `recoverExecution` in
`d6-executor.mjs` returns `reconcileHold` for an `attempted` execution with a
`dispatching` attempt — it is never auto-replayed. (The provably-never-
dispatched release-and-fail path applies only when every attempt is still
`reserved`, which is not this case.)

### 1.4 Accounting treatment

- On the `outcome_unknown` path, **no `attempt_release` is written** (releases
  are written only by `_voidDispatch`, for provably undelivered work). The
  attempt's ledger op stays counted in its original PT day (2026-11-14) —
  conservative, and historical; it does not consume any future day's quota.
- The phase reservation attributable to this occurrence remains in the
  phase ledger's unverified figures until a disposition lands; the terminal
  census reports the actual figures rather than predicting their movement.
- Successor expenditure: **none for this occurrence under any branch** (§1.3).
  The job's 3 `pending` occurrences are unaffected work under Julie's own
  in-app submission: on drive resumption they are granted through the normal
  job advance and generated under the standing release's safeguards. That is
  the only additional provider expenditure L-2's revival foreseeably causes,
  and it belongs to the standing release, not to L-2's one-act ceiling.

### 1.5 Late reports, stale results, duplicate bindings

- From `outcome_unknown`, the state machine has **no report transition**: a
  late executor report cannot move, settle, or bind the occurrence. From
  `granted`, report events are fenced by grant state and job revision; a
  report citing a stale revision is rejected for state purposes.
- The handoff machinery applies the same discipline to itself: a queue-probe
  verdict acts only on state re-read inside one transaction after the await;
  a stale verdict is logged and changes nothing.
- Duplicate binding publication: binding is by the occurrence's single
  `cache_key` through `validateAndBind`; `ready` is terminal in the state
  machine (no outgoing transitions), so an adopted or reported occurrence
  cannot be re-bound by a second result. Checkpoint 5 nonetheless verifies
  exactly one authoritative binding for the affected occurrence individually —
  which, per the ruling, establishes one binding, not one provider call or
  one provider charge.

### 1.6 Expected observable outcomes (in order of expectation)

1. **Most likely:** the chain revives; the 3 pending occurrences generate
   normally; the affected occurrence enters `outcome_unknown` and stays
   there (no cache candidate, no confirmed outcome) → plan at 13/14 ready +
   1 unknown, job `outcome_unknown`. **Chain revival succeeds; the milestone
   does NOT complete.** The position returns to Julie for a separate
   disposition decision (expected: a `ResolveOutcomeUnknown` authorization,
   its own step, not part of L-2).
2. **Possible:** the audio had in fact landed before the fault →
   `reconcile_adopt` binds it → 14/14, job completes; the milestone proceeds
   to full verification and Julie's playback acceptance.
3. **Not expected:** a confirmed-outcome record exists → `reconcile_spent`
   marks the occurrence `failed` (spent_without_audio, visible); the
   milestone does not complete; the position returns to Julie.

**Q1 conclusion:** the deployed implementation establishes the required
protections — claim-fenced voids, no re-dispatch of uncertain work,
adoption-before-spend reconciliation, confirmed-outcome-only spent
accounting, and a Julie-gated sole exit for unresolved uncertainty. This
package therefore proceeds to an execution GO request rather than returning
HOLD, with the §1.6 consequence stated plainly: **L-2 revives the chain; it
probably does not by itself complete the Chapter 6 milestone.**

## 2. Corrected cost statement (ruling Q3)

Three separate lines, no double counting:

- **Verified settled (Chapter 6):** 188,064 units (≈ $0.188) — the 10
  committed executions, reconciled exactly against the phase ledger.
- **Unverified provider-side exposure (the original attempt):** the
  `dispatching` attempt's model upper bound is 16,808 units (≈ $0.017). The
  provider may have charged some, all, or none of it; **the absence of a
  settled cost does not prove the absence of a provider charge**, and
  internal reconciliation does not reconcile Google's billing records. This
  exposure is reported, never added to the settled line.
- **Estimated remaining chapter balance:** 73,082 units (the 261,146 quote
  minus 188,064 settled) is an **estimate, not a hard expenditure ceiling**.
  It covers the 3 pending occurrences' expected generation; if Julie later
  authorizes resynthesis of the unknown occurrence, that spend is additional
  and separately authorized. The stimulus itself is an operator route and
  costs nothing.

## 3. The amended checkpoints (ruling Q2)

**Checkpoint 1 — Pre-invocation census (pinned baseline).** Health (build,
halt, policy, bindings, observability); queue state by cf read-back;
containment; the complete baseline: outstanding grant id/state/revision,
execution id, attempt id/phase, occurrence ids (all 14); binding inventory
(watermark 1883 + per-occurrence verification set); reservation ownership;
repair derivation AND the effective eligibility basis — the P-STALE predicate
on a fresh recorder observation (latest complete pass 505,
2026-11-14T20:55:56Z, far beyond the staleness window; derivation: intent 1
discharged, effective strikes 0 of bound 3) — not merely the cached
projection (which still displays strikes: 1); phase and quota exposure with
reconcile. **Stand-down rule:** if spontaneous recovery is observed at any
point before the invocation (a new complete pass, or plan movement), L-2
stands down as unnecessary and the authorization is not spent.

**Checkpoint 2 — Invocation.** Exactly ONE `POST /v2/d6-repair-evaluate`,
body `{"action": "evaluate_repair", "authorizationRef": "L-2 execution —
Julie GO, board comment <id>", "reason": "L-2 S-3 revival: single authorized
A-1 evaluation, execution package RT-H-20261116-7dcfa1 as accepted by
Rowan."}` — byte-verified offline before sending, as at L-1. A timeout,
transport failure, malformed response, or ambiguous acceptance **consumes**
the invocation allowance. No resend, for any reason.

**Checkpoint 3 — Registration.** Record the exact response, evaluation
identity, and timestamps. Three separate findings, never conflated:
(a) registration (the response), (b) observed handler execution (a new pass
row), (c) complete handler execution (the pass completes, failures 0). An
ambiguous HTTP result followed by recorder movement is evidence of movement,
not conclusive proof of stimulus attribution.

**Checkpoint 4 — Autonomous continuation.** Predeclared protocol: polls every
2 minutes for 30 minutes after the invocation, then every 15 minutes to a
4-hour observation window. **Success:** ≥3 consecutive complete passes with
due-aligned delivery (a pass delivered within 1 s after the preceding
reported due time — the L-1 finding's shape) and recordingFailures 0.
**Inconclusive:** passes resume but irregularly (backlog cascade, as at L-1)
with failures 0. **Failure:** no new complete pass within 30 minutes of a
`registered` response, or recordingFailures > 0 at any point. RC-2 discharge
is verified separately from the repair-status derivation: the new intent is
discharged only when two consecutive complete passes carry handler-entry
timestamps strictly after the intent's completion timestamp; no other pair
of passes substitutes. No durability or gap-floor assertion beyond this
predeclared protocol.

**Checkpoint 5 — Plan resumption and milestone verification.** 14/14 is the
desired outcome, not an assumed consequence. Report independently: the
affected occurrence's original attempt, grant disposition, any successor
(none is possible for the unknown path — §1.4), additional expenditure, and
remaining uncertainty. Verify all 14 occurrence identities individually with
exactly one authoritative binding each; the 1897 watermark is corroborating
evidence only. Verify the 10 previously committed segments are untouched, no
unauthorized generation occurred, reconciliation is clean, and reservations
reach terminal disposition. A safely unresolved occurrence = revival success
but NOT milestone completion. Julie's playback acceptance remains mandatory
before any second chapter.

**Checkpoint 6 — Terminal census.** Separate verdicts: registration /
revival / autonomous continuation / repair discharge / plan completion /
accounting / playback acceptance. A checkpoint failure does not negate
earlier successful checkpoints. Repair derivation reported separately from
the cached projection. No intent is acknowledged or reset.

## 4. Standing terms and non-authorizations

Carried forward unchanged: Forever Pucked only; Standard lane only; Julie's
in-app submissions only; no second chapter before milestone acceptance; the
existing quota, phase, and expenditure safeguards; WAIT law. The standing
foreign-generation re-hold-first authorization remains in force, is
subordinate to WAIT law, is **not expanded by L-2**, and is accounted for
separately from L-2's one-act ceiling. Not authorized by L-2: a second
evaluation; any acknowledgment; speculative repair; operator resubmission;
manual grant disposition (including any `ResolveOutcomeUnknown` — Julie's
separate later decision if §1.6.1 lands); any deployment or settings change.
If the observation window expires without the intended result, the gate
closes at the observed state and the decision returns to Julie. No automatic
escalation.

## 5. Execution-day shape (summary)

Census (checkpoint 1) → stand-down check → body byte-verification → the one
invocation → checkpoints 3–5 under the predeclared cadence → terminal census
(checkpoint 6) → execution record (pin + board + Dropbox) → milestone
verification and Julie's playback acceptance, or the §1.6.1 return to Julie.

## 6. Returns

To Rowan: this package for review; after execution, the execution record.
To Julie: after Rowan's acceptance, the execution GO request (❗️ +
buttons); after execution, the checkpoint verdicts and — if the milestone
completes — the playback acceptance request.

Turn: Rowan's (review of this amended package). Julie pokes.
