# GATE 4 — AMENDMENT 1: grant identity and delivery safety (A1), reservation-ownership census (A2), precise stall polls (A3), cumulative ceiling with pre-dispatch cover (A4), rollover snapshots (A5), foreign-generation definition (A6)

**Status:** AMENDMENT ONLY — prepared by Wren, 2026-11-01. Nothing in this document is executed by its preparation. No production mutation of any kind has been made; every live figure below comes from the read-only reads enumerated in §11.
**Responds to:** Rowan's Gate 4 technical review — **PASS WITH CONDITIONS** (direct Wren → Rowan handoff review, relayed verbatim by Julie in chat, Nov 1, 2026; no board post — Julie has bypassed the Roundtable board for this round). Rowan's verdicts: Q1 conditional, Q2 amend, Q3 **PASS**, Q4 conditional, Q5 **PASS**, Q6 amend; required amendments **A1–A6**. Unchanged per Rowan, and accepted without change here (§9): the R1/R2 sub-gates, the end-HELD closing sequence, and the 4-mutation executor budget.
**Amends:** the Gate 4 proposal, `GATE4-PROPOSAL.md` (SHA-256 `b524bb187d72c4c7881bf1d4470e6524b14a72678168ae23292245efc5abfabc`, pin `806cc53aebee15aaed8ec139c1213d79f7e664fb`, repo `jedavid33-design/opal-reader`, branch `ui1-review`). The proposal itself is **not edited**; this amendment supersedes the specific proposal text identified in §10 and leaves everything else in force.
**Live build this amendment is written against:** `1c2d1d0fa7ebb769f68cfb327fb9fde7d4d30867` (unchanged). System HELD at drafting: GENERATION_HALT `"1"`, queue `opalreader-generation-v2` `delivery_paused: true`.

**Resolution in one paragraph:** Rowan's six conditions are all incorporable without redesigning the proposal, and five of the six ground completely in shipped read surfaces and code (§§2–7). The grounding found one surface the proposal's Q1 did not name — the job view, `GET /v2/jobs/<jobId>`, which projects every grant for the job with its state — so A1's identification protocol is a direct read, not the inference Q1 feared. Two facts have **no** read surface (a grant's `lease_expires_at`; an enumeration of open reservation rows): §8 states both plainly, with the substitutes this amendment adopts (a timed two-read lease classification for the first; a four-leg arithmetic ownership proof, verified per-row by reconcile, for the second). One point inside A4 presents **two readings** rather than silently choosing: at the code's rigorous 12× per-occurrence upper bound, the first cohort's worst case (3,095,568 units) exceeds the entire 600,000 ceiling, so a cover check in that form would stop the gate before its first delivery; §5 derives the satisfiable form from the ledger's own cost semantics (settled cost accrues per audio-producing attempt; the split tree partitions the text) and asks Rowan, at final verification, to confirm the form — or to rule the 12× form intended, in which case the ceiling must change before Gate 4 can execute.

---

## 1. Grounding — the read surfaces, exactly what each projects

All citations are to the range-fix build tree (`~/workspace/ch2-program/ch3-recovery/range-fix-build/worker-build/worker/`), the tree build `1c2d1d0f` was assembled from. Every surface below was exercised live, read-only, in this amendment's preparation (§11).

| # | Surface | Credential | Projects (exactly) | Source |
|---|---|---|---|---|
| S1 | `GET /v2/jobs/<jobId>` | client | The job row (`jobId, kind, bookId, chapterIndex, lane, state, revision`); **every occurrence** (`occurrence_id, revision_key, state, cache_key`); **every grant for the job** (`grant_id, state, revision`, ordered by `created_at`) | route `api.mjs:231-234`; projection `coordinator.mjs:2756-2772` (`jobView`) |
| S2 | `GET /v2/d6-plans/<planId>` | client | Plan state/stopReason/totals; per-entry `occurrenceId, position, charCount, disposition, jobId, occurrenceState, executionState` | route `worker-entry-prod-d6.js:526-535`; projection `service.mjs:1049-1102` (`planStatus`) |
| S3 | `GET /v2/d6-quota-reconcile` (full pagination; page size 100 per array) | operator | `armed, ok, drift[], exceptions[], currentDayBlocked, totals` (current PT day), `dayTotals` (every day with rows), pagination totals + `censusComplete` | route `worker-entry-prod-d6.js:1029-1112` + limit constant :372; computation `quota-budget.mjs:478-543` (`reconcileQuota`) |
| S4 | `GET /v2/quota` | client | `dayKey, attemptsToday, providerDispatchesToday, providerReservedToday`, month figures, `ledgerSeq, settingsRevision, parked` | `coordinator.mjs:2774-2801` (`quotaView`) |
| S5 | `GET /v2/d6-diagnostics?planId=<id>` | operator | The plan's execution records (paginated) with per-execution attempt rows; the plan summary incl. the phase-accounting view (`settledMicroCents`, the three unverified fields, `unknownOpen`, `remainingMicroCents`) | route `worker-entry-prod-d6.js:574-597`; projection `service.mjs:1443-1560` (`attemptDiagnostics`) |
| S6 | `GET /v2/d6-plans` (list) | client | Every plan's summary (state + totals) — the account-level movement surface A6 uses | route `worker-entry-prod-d6.js:540-551`; `service.mjs:1158` (`listPlans`) |
| S7 | `GET /v2/conflicts` | client | The binding-conflicts rows | `coordinator.mjs` (`conflictsView`); proposal §4.4 |

**What the job view (S1) settles for A1:** grant *identity* is a direct read. The live churn grant at this amendment's first grounding read (§11) was `grant:plan:e377a5559961b294154276b6:ch2:3:full`, state `issued`, grant revision 4 — listed beside its two predecessors on the same job (`…:ch2:1:full`, `reported` — the Phase A cohort closed by Gate 3; `…:ch2:2:full`, `voided` — the first churn cycle). Grant ids are constructed `grant:${jobId}:${job.revision at issuance}:full|probe` (`coordinator.mjs:1696`); the grant row's own `revision` field is the post-transition job revision recorded at issuance (`coordinator.mjs:1760-1770`). Neither field needs to be derived by the executor — both are read.

**The two gaps (developed in §8):** (a) no routed surface projects a grant's `created_at` or `lease_expires_at` (the `grants` table carries both — insert at `coordinator.mjs:1743-1744` — but `jobView` projects only `grant_id, state, revision`, `coordinator.mjs:2766-2768`); (b) no routed surface enumerates open reservation rows — the rows carry full ownership columns and an internal enumerator exists (`openReservations`, `quota-budget.mjs:217-226`), but it is not wired to any route. The finalizer preview (`GET /v2/d6-grant-finalization-preview`, route `worker-entry-prod-d6.js:1326-1350`; derivation `grant-finalizer.mjs:268`) *would* project a named grant's state, but it is **not called** in this amendment's preparation and **is not used** by the amended census: Gate 3 gated that route to Gate 3 attempts, and S1 answers the identity question without it.

---

## 2. A1 — grant identification protocol (new census item §4.3.13′) and the pre-unpause delivery-safety check (new §5.3 step 0)

Rowan A1: *"The preflight must identify whether an undelivered grant is active, expired, or being replaced. A reservation total of 96 alone cannot establish that the grant is safe to deliver. Before R2, verify that the grant to be delivered belongs exclusively to the approved plan and cohort."*

### 2.1 The identification protocol G-ID (replaces proposal §4.3 item 13)

At census, the executor performs, in order:

1. **Read S1** for job `plan:e377a5559961b294154276b6:ch2`. Record: job `state` and `revision`; the full grants array; the occurrence-state partition.
2. **Live-grant uniqueness.** Classify every grant in the array: *terminal* (`reported`, `voided`, `superseded`) or *live* (`issued`, `delivered`, `handoff_uncertain`). **Pass condition: at most one live grant, and no grant in `handoff_uncertain`.** A `handoff_uncertain` grant at census is a STOP (it names a dispatch whose delivery is unproven — exactly the state the old item 13 gestured at; it is now read directly, not inferred). Two live grants is a STOP (the shipped grant step issues only when none is live, `service.mjs:980-984` — two live grants is outside the machinery's own invariant).
3. **Set identity.** Let G = the set of occurrences in state `granted`. **Pass conditions:** if a live grant exists, G is non-empty, **G ⊆ the approved 15** (proposal §2.3), and G is exactly the live grant's target set — established by construction and cross-checked arithmetically in §3: the grant's targets were transitioned to `granted` in the same transaction that wrote the grant and its reservations (`coordinator.mjs:1743-1758`), no other grant is live, and the §3 sum closes on G alone. If no live grant exists (the read landed in the void instant between cohorts), G must be empty and §3's zero case must hold; the census then records "no live grant at census instant" and the pre-unpause check (§2.2) carries the identification duty in full.
4. **Lease classification by timed pair.** The executor takes a **second S1 read ≥ 16 minutes after the first** (the lease is 15 minutes: `LEASE_MS`, `coordinator.mjs:134`; the grant row is written with `lease_expires_at = now + LEASE_MS`, :1743-1744). Classify the grant identified in step 2:
   - **Replaced:** the step-2 grant now reads `voided` and a successor grant (higher id revision) is the unique live grant → the cycle is proven live; the successor is classified **active, freshly issued within the last lease window**, and steps 2–3 are re-evaluated against it.
   - **Active:** the same grant is still the unique live grant and the span since its first observation is **< one lease window** (possible when the pair straddles issuance) → **active**.
   - **Persisted:** the same grant is still `issued` after a span ≥ one full lease window since first observation → its creation-anchored lease has expired or is expiring unprocessed (an undelivered grant's lease is never re-anchored — re-anchoring happens only on acknowledged handoff, `coordinator.mjs:1915-1920`). Classification: **stale-live — safe only through the drain fence** (§2.3), never through executor optimism.
   - **Deviation:** the same grant id with a *changed* granted set (impossible by construction — a grant's target set is fixed at issuance), or any grant state outside the vocabularies above → STOP.
   The pair's two reads, timestamps, and classification are recorded verbatim in the execution record. **Limit, stated plainly:** the pair classifies; it does not yield the exact `lease_expires_at` instant, which no surface projects (§8). Delivery safety does not depend on that instant — §2.3 is why.
5. **No other grant surface is consulted.** In particular the finalizer preview is not called (§1).

### 2.2 The pre-unpause delivery-safety check (inserted as §5.3 step 0, immediately before the R2 unpause PUT)

R2's existing verifications (proposal §5.3.1) are retained; between them and the PUT, the executor repeats a **single** S1 read plus the §3 sum check, and verifies all four of:

- **(i) Plan exclusivity:** the unique live grant (if any) is a grant **of this job** (S1 is per-job by construction) and the plan read (S2) still binds the 15's entries to this same `jobId` — the grant to be delivered therefore belongs to plan `plan:e377a5559961b294154276b6` and to no other plan. (A grant of any *other* job is a different job's view and cannot be this queue's next delivery for this plan; account-level foreign movement is A6's watch, §7.)
- **(ii) Cohort exclusivity:** every occurrence in the granted set G is within the approved 15 (the §2.3 set, by id), and G equals the cohort the §3 ownership proof covers at this instant.
- **(iii) Reservation match:** the §3 sum closes at this instant (reserved ∈ {0, 96} with its case split; dispatched for the current PT day still exactly 0 — nothing has been delivered yet by definition of the gate's position).
- **(iv) Lease state known:** the live grant's lease classification under §2.1 step 4 is **active** or **stale-live** (both deliverable-or-voidable only through the fence, §2.3) — and specifically **not** `handoff_uncertain` (STOP), not absent-with-nonempty-G (STOP), and not a grant id never seen at census or in G monitoring whose granted set differs from the last verified G without an intervening void observation (STOP — an unobserved replacement means the executor's picture is stale, and it re-runs G-ID's timed pair before R2 may proceed).

If any of (i)–(iv) fails: the gate STOPs **between the sub-gates** — R2 is not executed, containment (§5.7 of the proposal) returns the system to HELD, and the deviation is reported. This is the proposal's existing between-sub-gates STOP, now with its checklist made explicit.

### 2.3 The timing caveat — a lease expiring between the check and the drain is a designed branch, not a deviation

The check in §2.2 is instantaneous; the drain runs after it. A lease may expire in between. The code — not the executor's timing — decides what is delivered, at the delivery fence inside `drainOutbox` (`coordinator.mjs:1863-1876`): a dispatch leaves **only** while its grant is `issued`, at the job's **current** revision, and with `now ≤ lease_expires_at`. An expired or revision-stale dispatch is voided in-transaction — reservations released through `closeReservationsForVoidedGrant` (`coordinator.mjs:2015`, inside `_voidDispatch`, :1952), occurrences returned to `pending`, and the job re-advanced (`_scheduleReAdvance`, :1874) — after which `driveOnce` re-grants a fresh cohort of the same plan (§3.2 of the proposal). The same void path serves a grant that expires while still merely queued behind the halt (`lease_expired_undelivered`, `_processScheduleRow` lease branch, `coordinator.mjs:2589-2592`). Consequently: **the grant actually delivered after R2 is either the grant §2.2 verified, or a fresh cohort of the same plan issued after the verified grant's designed void** — never a grant of another plan (the outbox row names this job's grant and the fence binds grant ↔ job revision), never an occurrence outside the plan's pending prefix (cohort bounding, `quota-budget.mjs:622-645`), and never a grant past its delivery window. The executor's first G poll (§4) re-runs the S1 identification and the §3 proof, so the execution record names the grant that was in fact delivered, and any outcome outside the two branches above is a §7 STOP. On this basis the amendment classifies a between-check lease expiry as **expected machinery**, requiring no fresh GO and no deviation report beyond the record's factual naming of which branch occurred.

---

## 3. A2 — reservation-ownership evidence (replaces the evidentiary basis of proposal §4.3 items 10–12)

Rowan A2: *"Preserve Wren's proposed churn-tolerant accounting, but require evidence that all live reservations belong to the expected grant, with no duplicate active ownership or unexplained dispatches."*

### 3.1 What ownership means in the store

A reservation row is written per (grant, occurrence, day) at grant issuance, in the grant's own transaction: `reservation_id = qres:${grantId}:${occurrenceId}:${dayKey}`, with columns `grant_id, occurrence_id, plan_id, job_id, day_key, slots_total, slots_consumed, state, close_reason` (`quota-budget.mjs:124` DDL; `reserveForGrant` at :544, id construction and INSERT at :571-582). `slots_total = 12 − attempts already used` for that (plan, occurrence) (:552-556, with `segmentAttemptsUsed` at :186-192). Ownership is therefore recorded exactly — the gap is only that no route enumerates the rows (§8). The amended census proves ownership by a four-legged argument whose every leg is a routed read, and whose conclusion is exact, not sampled:

### 3.2 The four-leg ownership proof (census form; all four legs required)

- **Leg 1 — the granted set (S1).** G = occurrences in state `granted`; record |G| and the ids. Grounding read: |G| = 8, G = positions {68, 69, 73, 75, 80, 82, 83, 89} (§11).
- **Leg 2 — attempts used are zero for all 15 (S2 + S5).** Every one of the 15 reads `executionState: null` on S2, and S5 for the plan returns **exactly the 8 Phase A execution records** (attempts 4/6/6/6/6/6/4/6) with no record for any of the 15 → `attemptsUsed = 0` for each of the 15 → any reservation written for any of them today has `slots_total = 12`.
- **Leg 3 — the sum closes on G alone (S3/S4).** `reserved` for the current PT day is defined as `Σ (slots_total − slots_consumed)` over **all** open reservations carrying that `day_key`, with no grant filter (`derivedDayTotals`, `quota-budget.mjs:193-202`). Read value: **96**. The live grant's own reservations — written in the same transaction as the grant and its occurrence transitions (`coordinator.mjs:1743-1758`) — contribute exactly |G| × 12 = 96 (Leg 2). Every open reservation contributes ≥ 1 to the sum (slots_total ≥ 1 by construction; slots_consumed ≤ slots_total, itself reconcile-verified). Therefore **no open reservation exists outside the live grant's eight**: no leaked reservation from the voided predecessor grant, no reservation of any other grant, plan, or job, and no duplicate ownership of any occurrence (a duplicate would add ≥ 1 and break the sum).
- **Leg 4 — no unexplained dispatches (S3).** Reconcile reads `ok: true`, drift empty, `censusComplete: true` over full pagination. Reconcile verifies **every** reservation row's stored `slots_consumed` against its dispatch-derived count (dispatch rows attributed by the reservation's own (grant, occurrence, day) coordinates — `reconcileQuota`, `quota-budget.mjs:481-490`; `derivedSlotsConsumed`, :207-214), and flags any dispatch row unmatched to an attempt or vice versa as drift. The day's `dispatched = 0` then proves every derived count is 0: **no dispatch has occurred against any open reservation, and no dispatch exists anywhere today that the ledger cannot attribute.**

**Zero case (the void instant).** If the census read lands between a void and the re-grant: no live grant, G = ∅, reserved must read **0** — Leg 3's sum then proves no open reservation exists at all. Reserved = 0 with G ≠ ∅, reserved ∉ {0, 96}, or |G| × 12 ≠ reserved (at dispatched = 0) are each a STOP. The proposal's invariant form ({0, 96}; dispatched exactly 0) is preserved — it is now the *conclusion* of the proof at each read, not a substitute for it.

**During G.** The proof re-runs in census form at the completion read-backs (proposal §6 item 8, as amended in §10). At ordinary G polls the executor verifies the moving form: exactly one live grant at a time (S1); every dispatch step attributable, via S5 execution records, to the delivered grant's occurrence set; and reserved equal to the open reservations of the unique live grant plus any not-yet-swept reservations of the just-reported grant (the settlement sweep is the only closer, `quota-budget.mjs:655-672` — a poll that catches a transient verifies it closed by the next poll; a transient that does not close is a §7 STOP under the stall rule as amended in §4, not a shrug).

---

## 4. A3 — the stall signature, precisely defined (replaces proposal §7's stall bullet)

Rowan A3: *"Retain the 35-minute threshold, but define the two polls precisely. An ordinary pending grant or PT-day rollover must not be mistaken for the known Phase A stall."* Q4 verdict: conditional on this definition.

### 4.1 Poll contents (each G poll, all recorded verbatim in the execution record)

Timestamp (UTC); **S2** plan totals (done/failed/blocked) — and, at any poll where totals moved, the per-entry states; **S1** job view (live grant id + state, granted set); **S4** quota view (`attemptsToday`, `providerDispatchesToday`, `providerReservedToday`); **S3** reconcile totals for the current PT day plus `dayTotals` for every day the gate has touched; **S5** phase settled figure (the diagnostics phase view) — or the capabilities phase read, one surface used consistently. Cadence unchanged (~15 minutes, proposal §5.4).

### 4.2 Definitions

- **Delivered grant:** a grant for which a dispatch step has been *observed*: the cumulative dispatched figure (§4.3) rose in a step that S5 attributes to that grant's occurrences (execution records created/attempt rows added for them), or its occurrences' `executionState` left `null`. A grant that is merely `issued` is **pending**, however long it waits.
- **Cumulative gate figures (the only stall metrics):** *gate-dispatched* = Σ over all PT days the gate has touched of reconcile `dayTotals[day].dispatched`; *gate-settled-delta* = current phase settled − the E0 census settled figure. Neither resets at a PT rollover; day counters are evidence, never the metric.

### 4.3 The signature — ALL five required, evaluated on a poll pair (P1, P2)

1. A specific grant was **delivered** (§4.2) at or before P1, and P2 is **≥ 35 minutes after that grant's first observed dispatch**.
2. At both P1 and P2 the grant is still in a live state (`issued`/`delivered`) — not `reported`, `voided`, or `superseded` — and it is the same grant id at both polls.
3. **No new attempts** for that grant between P1 and P2: gate-dispatched unchanged, and S5 shows no new attempt rows for its executions.
4. **No plan progress** between P1 and P2: plan totals (done/failed/blocked) identical.
5. **No settlement movement** between P1 and P2: gate-settled-delta identical.

P1 and P2 are consecutive polls; the ≥ 35-minute span is measured P1→P2 as well as from first dispatch (with the ~15-minute cadence, the binding constraint is the 35 minutes after first dispatch; a pair spanning less does not evaluate). On the signature: STOP + containment + report (proposal §7) — **never a finalizer call, never a resubmission, never a repair under this gate** (unchanged).

### 4.4 Exclusions — evaluated BEFORE the signature; any one defeats it

- **Pending (undelivered) grant:** conditions 1–5 can only be evaluated on a delivered grant. A live grant with no observed dispatch step — including every halt-era churn grant and a post-R2 grant whose delivery is merely slow — is **not** the Phase A signature (Phase A's grant had flowed: 44 attempts, then silence). A delivered-never grant that persists is reported as its own deviation class (delivery failure) under the general STOP law; it is not relabeled a stall.
- **Lease-cycle churn:** grants voiding at lease expiry and re-granting (§2.3) change the live grant's id between polls — condition 2 (same id) fails by construction. Churn is machinery, not a stall.
- **PT-day rollover between P1 and P2:** day counters reset by design; conditions 3–5 are evaluated on the §4.2 cumulative figures, which do not reset, so a rollover can neither fabricate a stall (counters dropping to 0 is not "no progress" — progress is plan totals and settled delta) nor mask one. The A5 snapshot pair (§6) is the evidence at the boundary.

---

## 5. A4 — cumulative ceiling ledger and pre-dispatch cover check (replaces proposal §5.5's cost-ceiling bullet)

Rowan A4: *"The 600,000-unit ceiling must apply cumulatively across Gate 4, including any PT-day rollover. Stop before further dispatch if the remaining budget cannot safely cover the next grant."* Q5 verdict: **PASS** on the 600,000 figure — this section changes only its enforcement mechanics.

### 5.1 The cumulative ledger

`settledDelta(t) = phase settled (S5/capabilities read) − phase settled at the E0 census`. The opening figure at drafting is 732,303 (proposal §2.4); the census re-reads it and the record fixes the actual opening value. The ceiling binds `settledDelta` **at every observation** (every poll, every read-back): `settledDelta ≤ 600,000`. The metric is a phase figure — it does not reset at PT midnight, is not a day counter, and is unaffected by reservation churn. This replaces any reading of the proposal under which the ceiling could be per-day or per-cohort.

### 5.2 The cover check — form, derivation, and worked figures

**Operational form.** The machinery delivers autonomously once unpaused (§3.4 of the proposal); the executor's interposition points are the polls. At **every** G poll, before the next cohort can be relied on to proceed, the executor evaluates:

```
cover(next cohort) = settledDelta(now) + Σ_{occ ∈ next cohort} upperBoundAttemptMicro(chars_occ)  ≤  600,000
```

where the *next cohort* is the pending prefix `boundGrantTargets` will select (recomputable by the executor from the S2 pending order plus the day's derived headroom, `quota-budget.mjs:622-645`), and `upperBoundAttemptMicro(chars) = round(chars / 10 × 225)` (`gen-constants.mjs:88`). **If the check fails, the executor applies containment at that poll (re-pause, then re-halt) — which is a stop before further dispatch in the only form the shipped machinery admits** — and reports. The gate never relies on a cohort the ceiling cannot cover having "probably" a small realized cost.

**Derivation — why the per-occurrence term is ONE upper-bound attempt, not twelve.** Settled cost accrues per attempt at `knownCostMicro(durationSec) = round(durationSec × 225)` (`gen-constants.mjs:100`) — i.e., for attempts that produce audio. A `POLICY_BLOCK` attempt produces no audio and settles no known cost; the Phase A record proves the semantics empirically: 44 attempts (30 success, 14 policy_block) settled a delta of **152,964**, against a success-only expected sum of **157,076** for the 8 committed segments — not the ≈ 620,000 that 44 full-length attempts would imply. The split tree partitions the occurrence's text — *"parts concatenate to the segment's text EXACTLY"* (`policy-split.mjs:5-8`), depth ≤ 4 — so the audio-producing attempts of one occurrence together synthesize at most its full text once: total settled per occurrence is bounded by one full-length attempt at the upper-bound rate, `upperBoundAttemptMicro(chars)`, up to per-part rounding (≤ 16 leaf parts × ≤ ½ × 225 ≈ ≤ 1,800 units per occurrence worst case; named here so Rowan can see it — it does not move any figure below by more than ~27,000 across all 15, and the executor's check uses the unadjusted sum, i.e. it is conservative by that much less; if Rowan wants the rounding allowance inside the formula, it is a one-line change at final verification). The 12-attempt budget (`SEGMENT_ATTEMPT_BUDGET = 12`, `gen-constants.mjs:16`) bounds **attempts** (quota slots and provider calls), not settled cost.

**Worked figures (this plan, exact).** Per-occurrence uppers for the 15 sum to **469,444**; the live first cohort (positions {68, 69, 73, 75, 80, 82, 83, 89}) sums to **257,964**. Cover at gate opening: 0 + 257,964 ≤ 600,000 ✓. Because the all-15 total (469,444) is itself under the ceiling, every successive cohort passes cover provided realized settled tracks at or under its bound — the check still runs per cohort, and a hot-running gate (realized settled approaching the bound) fails cover for a later cohort and stops *before* that cohort's dispatch. That is A4's intent, in enforceable form.

**The 12× reading — presented, not silently chosen.** The code's per-occurrence upper for the *phase* fence is `upperBoundOccurrenceMicro(chars) = 12 × upperBoundAttemptMicro(chars)` (`gen-constants.mjs:94-95`). If Rowan intends the cover check in **that** form against the 600,000 ceiling, the first cohort's worst case is **3,095,568** — the gate could not deliver even its first cohort, and Gate 4 as specified could not execute (the ceiling or the form would have to change). This amendment adopts the §5.2 form (derived from the ledger's cost semantics and Phase A's settled record) and **asks Rowan at final verification to confirm the form explicitly**; if she rules the 12× form intended, the executor's instruction is to STOP and return the gate for a ceiling amendment — not to improvise.

**Tier-1 phase cover (the code's own fence, now executor-observed).** Separately, at census and at every poll the executor verifies the phase guard's projection inequality in its exact shipped arithmetic — `settled + reservedUnverified + inFlightUpper + Σ_{remaining} upperBoundOccurrenceMicro ≤ 13,500,000` (`d6PhaseBudgetCheck`, `grant-guards.mjs:108-117`) — so a breach is an observed STOP, never a silent park. At drafting figures: 732,303 + 5,648 + 0 + 5,633,328 = **6,371,279 ≤ 13,500,000** ✓.

---

## 6. A5 — rollover snapshot protocol (new §5.4 sub-section of the proposal)

Rowan A5: *"If execution crosses PT midnight, record the before-and-after accounting snapshots, reservation ownership, settled totals, and plan progress."* Q6 verdict: amend — this section supplies the protocol; proposal §3.3's treatment of rollover as a normal continuation is unchanged and is reaffirmed.

- **Trigger.** Any PT-day boundary (07:00Z) falling inside the gate window — during G, or between census and completion.
- **The snapshot set** (captured at the **last poll before** the boundary and the **first poll after** it; each snapshot is the full §4.1 poll contents **plus**): S3 paginated in full so `dayTotals` shows **both** day keys with their dispatched/reserved/consumed; S1 with the live grant's id/state and granted set (the §3 ownership proof re-evaluated on whichever side of the boundary has open reservations); S2 with per-entry states; the phase-accounting view (settled + estimatedUnverified + reservedUnverified + unknownOpen); S7 conflicts.
- **Day attribution, stated for the record.** Reservations carry their grant-day's `day_key` on the row (`quota-budget.mjs:124`, :575-582); a grant issued before midnight whose settlement lands after it closes reservations attributed to the **old** day key, while new-day cohorts reserve under the new key — `derivedDayTotals` is computed per `day_key` over the rows (:193-202), so the two days' figures in the snapshot pair are individually meaningful and their sum identities are checkable against the §4.2 cumulative figures. The execution record reports both days verbatim (proposal §6 item 8, extended in §10 below).
- **Rules.** The gate neither pauses for a rollover nor treats it as an anomaly, a stall (§4.4), or a ceiling event (§5.1's ledger does not reset). Continuation across the boundary is the shipped path: on rollover the remaining pending set is re-evaluated whole, in order, against the new day (`boundGrantTargets` invariants, `quota-budget.mjs:604-620`). No executor act is needed or permitted to hurry it. If the before/after pair shows any figure that the cumulative identities (§4.2, §5.1, §3) cannot reconcile, that is a §7 STOP — reported with both snapshots, not smoothed over.

---

## 7. A6 — foreign generation: observable definition, STOP, holds, incident report (replaces proposal §7's foreign-generation bullet)

Rowan A6: *"Because the Generate button remains live, any foreign generation activity must stop the gate. The closing holds must still be applied safely, and the incident must be reported without attempting an unauthorized repair."*

**Detection surfaces** (read at every G poll, in addition to §4.1): **S6** plan list (every plan's state/totals); **S4** (`attemptsToday`, `providerDispatchesToday`); **S3** `dayTotals`; **S5** phase view plus the approved plan's own settled figure (`planSettledMicro` semantics — the diagnostics plan summary's phase view read alongside per-plan attempt attribution, `service.mjs:1103-1109`, :1443-1560); **S2/S1** for the parked job's plan entries (position 91) and the plan's job.

**Foreign generation is ANY of:**

- **(a)** a rise in gate-dispatched (§4.2) in a step that S5 cannot attribute to the approved plan's delivered cohort — i.e., dispatches with no execution records on this plan's occurrences;
- **(b)** any *other* plan in the S6 list changing state or totals, or a new plan appearing;
- **(c)** the parked job moving in any way: position 91 leaving `excluded_parked`, the parked job's fingerprint changing (census §4.2 item 9 of the proposal), or any exemption-journal movement;
- **(d)** the forever-pucked phase settled rising by more than the approved plan's own settled rise over the same interval (phase-level activity the plan cannot account for);
- **(e)** `attemptsToday` (S4) rising in any step not matched by an approved-cohort dispatch step.

**Response (no discretion).** STOP immediately. The closing holds are **still applied, in containment order — re-pause the queue, then re-halt** (proposal §5.7) — and both are read back before anything else is reported; "safely" means exactly that order and those read-backs, even though the gate is aborting. The execution record then reports the incident with the observed figures and the surfaces that showed them, names it foreign generation, and stops: **no repair, no attempt to identify or undo the foreign work, no finalizer, no compensating act, no exception.** The GO is consumed. (What the foreign work *was* — Julie's own tap, an app retry, anything else — is not the executor's to determine; the gate's contract is that the window was supposed to contain only this plan's generation, and it didn't.)

---

## 8. What could not be fully grounded — stated plainly, with the substitutes and their limits

1. **A grant's lease timestamps are not readable.** The `grants` row carries `created_at` and `lease_expires_at` (`coordinator.mjs:1743-1744`), but `jobView` — the only routed grant surface — projects `grant_id, state, revision` only (:2766-2768), and no other route projects them. **Substitute (§2.1 step 4):** the timed two-read classification (active / replaced / stale-live), which is sufficient for every decision the gate must make, because delivery itself re-checks expiry at the fence (`coordinator.mjs:1872-1874`). **Limit:** the classification cannot give the exact expiry instant, and a grant first observed already stale-live cannot be aged precisely. If Rowan requires the timestamp itself, that is a code change (project two more columns on `jobView`) — a different, separately-gated piece of work, named here as the only A1 sub-point a document cannot close.
2. **Open reservation rows are not enumerable over the wire.** Ownership is recorded per row (§3.1) and an internal enumerator exists (`openReservations`, `quota-budget.mjs:217`), but no route calls it; reconcile (S3) projects aggregates, drift, and exceptions only. **Substitute (§3.2):** the four-leg arithmetic proof — granted set, zero attempts-used, the unfiltered day sum closing on the live grant alone, and reconcile's per-row stored-vs-derived verification. **Limit:** the proof establishes the open pool's composition exactly, but does not display individual `reservation_id`s. If Rowan wants row-level display, that is likewise a code change (route the existing enumerator), separately gated.
3. **A4's cover form has two readings** (§5.2): the derived form (satisfiable; adopted) and the 12× form (unsatisfiable against the 600,000 ceiling; cohort-1 figure 3,095,568). The amendment does not pretend the derived form is the only possible intent — it asks Rowan to confirm the form at final verification, with the STOP instruction if she rules otherwise.

Nothing else in A1–A6 required a substitute: A2's ownership, A3's polls, A5's snapshots, and A6's detection all read directly off S1–S7.

---

## 9. Accepted without change (Rowan's PASS items and standing terms)

- **Q3 — end HELD:** the closing sequence (re-pause, then re-halt, with read-backs) stands exactly as proposed (§5.6 of the proposal).
- **Q5 — the ceiling figure:** 600,000 units stands; §5 of this amendment changes only its measurement (cumulative, rollover-proof) and enforcement (cover check + polls).
- **Sub-gates R1 / R2** as separately named decision points inside the single GO; **the 4-mutation executor budget** (halt flip, unpause, re-pause, re-halt). This amendment adds **no** mutation of any kind: every protocol above is reads, arithmetic, and — on deviation — the proposal's existing containment.
- **The executor STOP law and the one-GO-one-attempt law remain in effect verbatim** (proposal §7 preamble and §8): any mismatch — one row, one slot, one revision — stops the gate; the executor's own explanation never clears its own stop; a stopped gate is never restarted on anyone's interpretation; Julie's GO is recorded before E0 and is consumed by the attempt.

---

## 10. Amendment mechanics — exactly what changes in the proposal

- Proposal **§4.3 item 13** is **replaced** by §2.1 of this amendment (G-ID).
- Proposal **§4.3 items 10–12** stand as invariants; their **evidentiary basis is replaced** by §3.2 of this amendment (the four-leg proof; the zero case included).
- Proposal **§5.3** gains **step 0** (§2.2 of this amendment) immediately before the unpause PUT; §5.3's existing verifications are retained ahead of it.
- Proposal **§5.4** gains the **A5 snapshot protocol** (§6 of this amendment) and its poll contents are **specified** by §4.1 of this amendment.
- Proposal **§5.5**'s cost-ceiling bullet is **replaced** by §5 of this amendment (cumulative ledger; cover check; tier-1 phase cover).
- Proposal **§7**'s stall bullet is **replaced** by §4 of this amendment; its foreign-generation bullet is **replaced** by §7 of this amendment. All other §7 STOPs stand.
- Proposal **§6 item 8** is extended: for every PT day the gate touched, the A5 snapshot pair (§6) is filed in the record.
- Proposal **§10's open questions** are disposed as follows: **Q1** — answered by S1 (the job view); the preview is not used; the residual gap is §8.1. **Q2** — the invariant form is retained and now proven per-read (§3); Rowan's alternative (two reads a lease cycle apart) is adopted in substance for the grant item via §2.1 step 4. **Q3** — Rowan PASSed end-HELD. **Q4** — the 35-minute threshold retained, the polls now precisely defined (§4). **Q5** — Rowan PASSed the figure; enforcement per §5. **Q6** — answered by §6 (the snapshot pair is the additional read-back Rowan's A5 required).
- Everything in the proposal not named above is **unchanged**.

---

## 11. Grounding evidence (read-only, 2026-11-01, Wren)

Live reads taken for this amendment (no mutation of any kind; the finalizer preview was **not** called):

- **S1** `GET /v2/jobs/plan:e377a5559961b294154276b6:ch2` at ~17:59Z: job `state: generating`, `revision: 4`; grants — `grant:plan:e377a5559961b294154276b6:ch2:1:full` `reported` (rev 2), `…:ch2:2:full` `voided` (rev 3), `…:ch2:3:full` **`issued`** (rev 4, the live churn grant); occurrences 8 `ready` / 8 `granted` / 7 `pending`, granted = positions {68, 69, 73, 75, 80, 82, 83, 89}, pending = {70, 71, 78, 79, 84, 86, 87}.
- **S2** plan read, same window: `active`, totals 23/8/0/0/0; the 15 all `executionState: null`; position 91 `excluded_parked`.
- **S3** reconcile, same window: `ok: true`, drift empty, `censusComplete: true`, sole exception the known straddler `att-37d63768-db4b-447d-8150-580b7c6ee257`; dayTotals 2026-10-29 = 57/0/57, 2026-10-30 = 79/0/79, 2026-10-31 = 44/0/44, **2026-11-01 = dispatched 0 / reserved 96 / consumed 96** — the §3 sum closing on the live grant alone.
- **S4** quota, same window: `providerDispatchesToday: 0`, `providerReservedToday: 96`, `attemptsToday: 8` (the estimate-ledger grant count), `settingsRevision: 1`.
- **S5** diagnostics for the plan, same window: exactly the 8 Phase A executions (attempts 4/6/6/6/6/6/4/6 = 44); phase view settled 732,303 / estimatedUnverified 19,018 / reservedUnverified 5,648 / unknownOpen 0 / remaining 12,762,049 — all exact against the proposal §2.4.
- **S1 (timed pair, second read)** at ~18:16Z, ≥ 16 minutes after the first S1 read — the §2.1 step-4 protocol exercised live: job `revision: 6`; the first read's live grant `…:ch2:3:full` now reads **`voided`**, and a successor `grant:plan:e377a5559961b294154276b6:ch2:4:full` (grant revision 6) is the unique live grant, `issued`. Its granted set is positions {68, 73, 75, 79, 80, 82, 83, 89} — seven of the first read's eight, with position 79 rotated in and 69 returned to `pending` (the pending-prefix order is the coordinator's own; both sets are prefixes of the same 15 under the day's identical headroom). Classification under §2.1 step 4: **Replaced** — the cycle is proven live by direct observation, and the successor is the grant any pre-unpause check would now have to verify. An intermediate S1 read at ~18:05Z (inside one lease window) showed the first grant still `issued` with its set unchanged, as the protocol expects.

**No live read contradicted the proposal's stated state.** One observation beyond the proposal's snapshot, already carried in the proposal §0.2: the churn continues — two full cycles (grants `…:ch2:2:full` and `…:ch2:3:full` voided) are now visible on S1 since Gate 3 closed, with zero dispatches and zero spend throughout.

**Turn: Rowan's** — final verification of Amendment 1 (direct mode; nothing is filed on the board for this round). Julie's GO remains separately required before any execution, and is not requested by this amendment.
