# GATE 4 — AMENDMENT 2: Rowan's Amendment 1 REVISE (R1–R4) answered

**Status:** DRAFTED for Rowan's final verification, then Julie's Gate 4
decision. This amendment **authorizes nothing**. It changes the proposal
as amended by Amendment 1 only as §9 itemizes; everything else in the
proposal and in Amendment 1 stands exactly as written.

**Amends:** the Gate 4 proposal, pinned `806cc53aebee15aaed8ec139c1213d79f7e664fb`
(repo `jedavid33-design/opal-reader`, branch `ui1-review`, SHA-256
`b524bb187d72c4c7881bf1d4470e6524b14a72678168ae23292245efc5abfabc`),
as amended by Amendment 1, pinned `451f71ad5526879f6849f4f1607bb80024e439d0`
(SHA-256 `af3ec5d397fb427b4f53e05f69ee6cfc82328bba9d95913dbc4002723baa7ef1`).
Neither document is edited; this amendment is a child of Amendment 1's pin.

**Responds to:** Rowan's Amendment 1 review — **REVISE** (relayed
verbatim by Julie, Nov 1, 2026, direct mode). A1/A2/A5/A6 were found
substantially addressed; **A5 PASS, A6 PASS outright**; end-HELD (Q3)
accepted; the R1/R2 sub-gates and the 4-mutation executor budget stand —
subject to four required items, **R1–R4**, which this amendment answers
one by one, from the shipped source.

**Live build:** `1c2d1d0fa7ebb769f68cfb327fb9fde7d4d30867` (the range-fix
build). The system sits HELD (halted + queue paused); this drafting made
read-only calls only.

**The resolution, in one paragraph.** R1 is answered by proof, not by a
new mechanism: on the shipped code, all settled cost for an occurrence
accrues inside **one synthesis pass** — the spend-intent fence admits
exactly one pass per (job, occurrence) ever, the split machinery
**partitions** text (duplication factor 1.0 for settled cost), and every
non-success outcome settles exactly 0 — so the proven worst case for the
gate's whole closed scope is **469,519 units**, below the standing
**600,000** ceiling. The ceiling therefore binds **by arithmetic, not by
polling**; the tranche-interposition alternative is analyzed and rejected
(no interposition point exists in the shipped timing, and it would cost
≥ 6 mutations against the standing budget of 4). The proof's one premise
— the pinned cost model's rate bound — is named in §4 for Rowan's
explicit ruling, with the consequence stated if she declines it (§5.3).
R2 replaces the poll-pair rule with a ≥ 35-minute sliding window whose
intervening polls are individually checked (§6). R3 answers **yes** — a
zero-remaining open reservation row is possible in the machinery, in two
shapes — corrects Amendment 1's Leg 3 premise, and repairs the proof with
the evidence that actually excludes the shapes here, plus a read-order /
stability protocol for the non-atomic census (§7). R4 makes every newly
observed grant — census, step 0, every poll — pass the full A1
verification before any reliance, and states that lease freshness is
never inferred (§8).

| Item | Where answered | One-line result |
|---|---|---|
| R1 — ceiling enforcement | §§2–5 | Proven scope bound 469,519 ≤ 600,000; ceiling unreachable in-scope; no budget revision proposed |
| R2 — stall window | §6 | Sliding ≥ 35-min window; intervening polls checked; anchor resets on any movement |
| R3 — zero-remaining rows | §7 | Possible (two shapes); Leg 3 corrected, Leg 3b added; census read-order + stability rule |
| R4 — successor verification | §8 | Full verification for every new grant id before reliance; freshness never inferred |

---

## 1. Grounding — fresh live reads at drafting (2026-11-01, ~18:29–18:31Z)

Amendment 2 was drafted against a fresh read pass over the same surfaces
(Amendment 1 §1.1), in the order §7.3 now prescribes. **No contradiction
with Amendment 1's stated state was found.** Figures identical to
Amendment 1 / Gate 3 close unless noted:

- **S1 job view:** job `generating` rev **6**; grants `…:ch2:1:full`
  `reported`; `…:ch2:2:full`, `…:ch2:3:full`, `…:ch2:4:full` `voided`;
  **`…:ch2:5:full` `issued` (live)**. The churn advanced two cycles past
  Amendment 1's timed pair — the A1 mechanism working exactly as
  described. Granted set of the live grant: positions
  **{68, 69, 73, 75, 80, 82, 83, 89}** — Amendment 1's cohort set.
- **S2 plan:** `active`, 23 eligible / 8 done / 0 failed / 0 blocked /
  0 prompts — unchanged.
- **S5 diagnostics:** phase settled **732,303**, estimatedUnverified
  **19,018**, reservedUnverified **5,648** — unchanged.
- **S3 reconcile (operator):** `ok: true`, `censusComplete: true`,
  `currentDayBlocked: false`, drift **empty**, sole exception the
  adjudicated straddler. Day totals: 2026-10-29 = 57/0/57,
  2026-10-30 = 79/0/79, 2026-10-31 = 44/0/44,
  **2026-11-01 = 0 dispatched / 96 reserved / 96 consumed** (the churn).
- **S4 quota:** dayKey 2026-11-01, dispatched **0**, reserved **96**,
  attemptsToday 8, settings revision **1**.
- **Conflicts:** exactly the baseline **four** `schedule_dead` rows.
- **Eligibility:** 15 / 20,864 / 294,137, digest
  `9453ab5dc7ee6ade7c650d14066054b965875f2ef1b65eb24bc633588d778e67` —
  byte-identical to the proposal's quote.
- **Arithmetic re-verification:** every sum in §§4–5 was recomputed by
  executing the shipped `gen-constants.mjs` functions over the proposal
  §2.3 char table (all 15 char counts confirmed against the fresh S2
  entries). Results: Σ `upperBoundAttemptMicro` = **469,444**;
  Σ `upperBoundOccurrenceMicro` = **5,633,328**; Σ `expectedCostMicro` =
  **294,137** (exactly the live quote). Amendment 1's figures are
  confirmed exactly — including their floating-point behavior (§4.2).

---

## 2. R1(a) — Settled-cost semantics, proven from the shipped code

The gate's ceiling is denominated in **phase settled** — the figure the
S5 surface reports and the executor watches. What can move it, and by
how much, is a closed question in the shipped tree.

### 2.1 Phase settled counts exactly three outcomes, at exactly these costs

`phaseAccounting` computes settled as `SUM(cost_micro_cents)` over
confirmed attempts with `state = 'confirmed'` and outcome IN
(`success`, `failed_known`, `policy_block`)
(`worker/generation/genstore.mjs:403` ff.). The dispatch path writes
those costs at exactly four confirm sites, all inside the executor's
`wrappedSynthesize` (`worker/generation/d6-executor.mjs`):

| Outcome | Confirm site | Cost written |
|---|---|---|
| `success` | `d6-executor.mjs:514` | `knownCostMicro(res.durationSec)` = `round(durationSec × 225)` (`gen-constants.mjs:100`) |
| `policy_block` | `d6-executor.mjs:522` | **0** (hardcoded) |
| `failed_known` (any HTTP answer incl. errors/429) | `d6-executor.mjs:525` | **0** (hardcoded) |
| `unknown` (non-HTTP throw) | `d6-executor.mjs:529` | **NULL** — never in settled's outcome-sum with a value, and `markUnknownBilling` halts the phase fail-closed |

Two consequences are immediate. **(i)** Settled moves only at a
`success` confirm, by `round(durationSec × 225)`. A policy block settles
**nothing**; a failed attempt settles **nothing**. **(ii)** The figure
that lands in settled is the **actual measured audio duration** —
`durationSec` is computed from the returned audio bytes
(`audioDurationSec`, `worker/host/adapters.mjs:195`; used at
`adapters.mjs:333`) — **not** the expected formula
`round(chars / 15.96 × 225)` (`gen-constants.mjs:81`), which feeds
estimates, the eligibility quote, and adjudication only. (The §4 bound
deals with what that measurement can reach.)

Phase A's realized figures corroborate the reading: 44 attempts =
30 `success` + 14 `policy_block`, settled delta **152,964** — all of it
from the 30 successes; the 14 blocks contributed exactly 0
(Amendment 1 §5.0).

### 2.2 One occurrence settles inside exactly one synthesis pass — retries cannot add a second

- **The attempt budget is plan-lifetime.** `segmentAttemptsUsed(planId,
  occurrenceId)` counts `dispatching` + `confirmed` attempts across
  **all** executions of the plan (`genstore.mjs:243`);
  `SEGMENT_ATTEMPT_BUDGET = 12` (`gen-constants.mjs:16`). A re-drive
  starts with `remaining = 12 − used`; a quota-refused dispatch releases
  its attempt and never reached the provider. No path gives an
  occurrence more than 12 provider calls, ever.
- **The spend-intent fence admits one pass.** `acquireSpendIntent`
  (`worker/coordinator.mjs:2921-2942`): a live (non-superseded) intent
  for (job, occurrence) is "the spend boundary: final" — a second
  acquisition returns `acquired: false` permanently. In the executor's
  `runFresh`, a non-acquired intent whose noted outcome is `success`
  takes the **intent-recovery** path — re-commit from the durable R2
  object with **no provider call and no new attempt rows**; any other
  noted outcome (or an un-noted live intent) ends the execution as
  `intent_fence` (`d6-executor.mjs:472`) — again **no provider call**.
- **Nothing supersedes a Standard-lane intent.** The only writer of
  `spend_intents.superseded_at` in the shipped tree is
  `resolveBatchNeverAccepted` (`coordinator.mjs:3045`) — the Batch lane,
  evidence-gated (`never_accepted`), not reachable from this gate's
  Standard plan. The executor never loops on its own repair markers
  (they are returned, not re-dispatched; recovery tails verify and
  commit, they never synthesize), and the coordinator's repair-chain
  follow-on spawn fires only for jobs of kind `repair`, which D6 plan
  jobs are not.
- **No other writer can settle inside the gate.** The adjudication path
  never writes `cost_micro_cents` (the estimate lives in a separate
  side record — Gate 5 law); `reconcileUnknown` is operator-only and
  unreachable in-gate, because an `unknown` attempt halts the phase and
  the gate STOPs (§5.5 of the proposal) before any operator action.

**Conclusion (a):** per (plan, occurrence), settled cost accrues within
**one** synthesis pass of at most 12 provider calls. Amendment 1's
adopted term — one `upperBoundAttemptMicro` per occurrence — was the
right *shape*; §§3–4 now prove it, with its rounding allowances made
explicit.

## 3. R1(b) — Split geometry: the parts partition the text; duplication factor 1.0

Rowan's question — do split children partition the parent's text or
overlap it (repeated context)? — has an exact answer in
`worker/generation/policy-split.mjs`:

- `splitText` chooses **one cut index** `i` and returns
  `[text.slice(0, i), text.slice(i)]` (`policy-split.mjs:42` ff.). The
  module's own header states the invariant: *"Concatenation identity:
  the parts always join back to the exact input"* — the children are
  **disjoint**, their concatenation is the parent, and each child is
  ≥ `SPLIT_MIN_PART_CHARS` = 50 chars or no split occurs.
- The synthesis recursion (`synthesizeWithPolicySplit`) explores this
  binary tree under the budget object: a node that succeeds is a
  **leaf** (its subtree is never explored); a node that returns
  `POLICY_BLOCK` is replaced by its two children. Blocked internal
  nodes re-send their text as their children — that repetition costs
  **attempt slots only**; a blocked node settles 0 (§2.1). Recursion
  depth is capped at 4 (`policy-split.mjs:269`).
- The pre-split (`synthesizeLongSegment`) applies the **same cut
  machinery** to produce chunks of ≤ `PRE_SPLIT_MAX_CHARS` = 1,200
  (`policy-split.mjs:222`): exact-concat again, and all chunks share
  the caller's **one** budget object. `stitchWav` concatenates the
  disjoint parts' PCM; a multi-part attempt's `durationSec` is the sum
  of the part durations — no sample is duplicated.

**Quantified:** across the successful calls of one pass, the synthesized
texts are pairwise disjoint sub-texts of the segment — successful calls
are exactly the leaves of the realized partition forest — so
**Σ chars over successful calls ≤ the segment's chars**, with equality
only when every part succeeds. The settled-cost duplication factor is
**1.0**: no context is ever re-synthesized into a second *settled*
charge for the same characters.

**Successful-leaf bound.** Let S = successful calls in the pass,
B = blocked calls. Every call consumes one budget unit: S + B ≤ 12
(an erroring call settles 0 and ends the pass, so it only tightens
this). Each chunk tree with s_c successes has ≥ s_c − 1 blocked
internal nodes, so B ≥ S − #chunks. Every one of the 15 segments is
1,215–1,493 chars, so the pre-split yields 2 chunks (3 only if boundary
placement forces a first cut within ~293 chars of an edge — the
midpoint fallback cut bounds any post-cut remainder to ≤ 1,443 chars,
which then splits in two). With #chunks ≤ 3: 2S ≤ 12 + 3, hence
**S ≤ 7** — and S ≤ 6 in the normal 2-chunk case.

---

## 4. R1(c) — The true per-occurrence worst case, derived

### 4.1 The derivation

For one occurrence, settled is the sum over its successful calls of
`round(durationSec × 225)` (§2.1). For each successful call:

- `round(x) ≤ x + 0.5` — rounding contributes at most **+0.5 per call**.
- `durationSec ≤ chars / 10` for the call's text — **premise P**, §4.3.

Summing over the pass, with §3's disjointness (Σ successful chars ≤
segment chars) and S ≤ 7:

> settled(occ) ≤ chars × 22.5 + 0.5 × 7 = chars × 22.5 + 3.5.

The shipped bound function is `upperBoundAttemptMicro(chars) =
Math.round(chars / 10 * 225)` (`gen-constants.mjs:88`). Against it, the
per-occurrence allowance is set at **+5**: 0.5 (the model's side of the
rounding) + 3.5 (per-call rounding at S ≤ 7) + **1.0 of slack for the
shipped function's floating-point boundary behavior** (§4.2). Hence:

> **settled(occ) ≤ upperBoundAttemptMicro(chars) + 5**, and for the
> gate's whole scope: **Σ = 469,444 + 15 × 5 = 469,519 units**.

For the drafting-time live cohort (8 occurrences): 257,964 + 40 =
**258,004**.

### 4.2 Comparison against the two candidate forms — and which one the code supports

- **Amendment 1's adopted term, Σ = 469,444:** the exact sum of the
  shipped `upperBoundAttemptMicro` over the 15 (recomputed by executing
  the function, §1). It is the right base — but as a *bound* it was
  incomplete: it carried no rounding allowance. This amendment
  supersedes the figure with **469,519** (§9). Note the float subtlety,
  verified live in §1's recomputation: `chars / 10` is inexact in
  binary, so e.g. 1,397 chars yields 31,432 from the shipped function,
  one unit below exact-arithmetic rounding (31,433); the shipped Σ
  (469,444) sits one unit below the exact-arithmetic Σ (469,445). The
  +5 allowance absorbs this class of effect with room to spare.
- **The 12× form, Σ = 5,633,328 (cohort 3,095,568):** **not** a
  settled-cost bound the code supports. It prices twelve full-text
  successes per occurrence. §2 (one pass, ever) and §3 (the pass
  partitions the text) make that unreachable: twelve attempts can
  synthesize the segment's characters **once**, in total, into settled
  successes. The 12× figure remains exactly what it is in the code —
  the phase fence's per-occurrence **projection** (plan entries carry
  `upper_micro_cents = upperBoundOccurrenceMicro(charCount)`,
  `service.mjs:808`; refused against at grant time by
  `d6PhaseBudgetCheck`, `grant-guards.mjs:108`) — a reserve-side
  conservatism for admission control, not a prediction of settled cost.
  At drafting figures its tier-1 projection is 732,303 + 5,648 + 0 +
  5,633,328 = **6,371,279 ≤ 13,500,000**, so the fence admits this
  gate's grants exactly as Amendment 1 §5.2 described.

**Statement of the supported figure:** the code supports 469,519 as the
worst-case settled delta for the gate's entire scope — expected value
294,137; Phase A's 8 realized at ≈ 97.4% of their success-only expected
figure (152,964 against 157,076, Amendment 1 §5.0), far under the
chars/10 rate bound.

### 4.3 Premise P — the one ruling this amendment asks Rowan to make

The derivation's rate step — a successful call's `durationSec` cannot
exceed its text's chars/10 — is **the pinned cost model's own bound**
(`gen-constants.mjs:88-91`: seconds bounded at chars/10, "≥1.59× slower
than the realized rate" of 15.96 chars/s). It is a premise, and this
amendment names it as one: `durationSec` is **byte-measured actual
audio** and is **not clamped by any code** — if the provider returned
audio spoken slower than the model's slowest admitted rate, a call
could settle above its chars/10 term. Two supporting observations:
(i) the adapters' no-signal fallback duration estimate also sits under
the bound for every part the splitter can produce (an ≈ chars/14
estimate, capped — `adapters.mjs:201-202`; parts are ≥ 50 chars);
(ii) the shipped phase fence already spends real refusal authority on
this same premise — its projection terms are these same rate formulas,
so the premise is the codebase's own pinned basis for money decisions,
not an assumption invented for this gate. **Rowan is asked to confirm
premise P as the ceiling basis explicitly** — the same kind of
confirmation Amendment 1 §5.0 requested for the bound's form. §5.3
states the consequence if she declines it.

## 5. R1(d) — The enforcement construction

### 5.1 Recommended: the ceiling binds by arithmetic (adopted, subject to Rowan's verification and Julie's GO)

Because §4's bound is per-occurrence over a **closed scope** — 15 named
occurrences, each settle-capped at `upperBoundAttemptMicro + 5`, each
reachable in exactly one pass — the coordinator **cannot** settle more
than **469,519** units of in-scope work no matter how autonomously it
issues cohorts, at any poll cadence, including no polling at all. The
standing **600,000** ceiling is therefore **unreachable within the
gate's scope**, and enforcement does not depend on executor timing:

- **Polling is demoted to detection, with teeth.** The cover check is
  retained in proven form, evaluated at census and at every poll from
  live figures: `settledDelta + Σ over remaining occurrences of
  (upperBoundAttemptMicro(chars) + 5) ≤ 600,000`. At opening it reads
  469,519 ≤ 600,000 — **130,481 of headroom** — and it is recomputed
  from the live char counts each time, so any scope or text change
  fails it loudly instead of passing on census memory.
- **A proof-refuting observation is a STOP.** Any single observation
  of `settledDelta > 469,519` refutes the premises in operation; under
  A6 it is treated as foreign work: STOP + containment. (Reaching
  600,000 without first crossing 469,519 is arithmetically impossible.)
- **The phase fence remains the system's own independent hard stop** —
  an in-transaction refusal at every grant issuance against the
  13,500,000 phase budget (§4.2), executor-observed per Amendment 1
  §5.2. The gate thus has two independent ceilings: the fence's
  projection-side refusal, and §4's settled-side arithmetic.

**No ceiling revision is proposed.** Julie's 600,000 stands as she
approved it; this amendment asks Rowan to verify that the figure is
unreachable in-scope — a stronger position than Amendment 1 could
offer — and asks Julie for **no new figure at GO**. (If Rowan prefers
the ceiling restated at the proven bound, the figure to adopt would be
469,519; that restatement would be a revised figure for Julie's
acceptance at her GO. The amendment recommends against it: lowering
the number changes nothing enforceable.)

### 5.2 Cohort-tranche interposition — analyzed, not adopted

The alternative — executor re-pauses the queue as each cohort settles
and re-verifies before unpausing for the next — fails on the shipped
timing, and on budget:

1. **No interposition point exists.** `driveOnce` issues the next
   grant and drains the outbox in the same pass
   (`service.mjs:1030-1035`: issuance, then `drainOutbox` at the tail),
   inside one coordinator alarm invocation. Issuance and delivery are
   one function chain; the executor observes over HTTP from outside
   and cannot land between them.
2. **A re-pause gates delivery, not execution** — and the settlement
   that frees the next issuance lands at the *end* of the in-flight
   execution (the report closes the grant). By the time any external
   poll can see cohort N settled, the same alarm chain may already
   have issued **and delivered** cohort N+1.
3. **The mutation budget breaks anyway.** Standing budget: {halt flip,
   unpause, closing re-pause, closing re-halt} = **4**. The tranche
   form costs 4 + 2 × (number of inter-cohort gaps) — at minimum
   **6** (the guard's sizing makes ≥ 2 cohorts certain for 15
   occurrences), realistically 6–8 — exceeding the budget Rowan left
   standing, for a mechanism that still guarantees nothing under
   points 1–2.

Tranche interposition is therefore **rejected**: adopted only in a
design where the coordinator itself fences between cohorts — which is
§5.3(b)'s code change, not an executor procedure.

### 5.3 If premise P is declined — stated plainly

If Rowan declines to let any ceiling rest on the pinned model's rate
bound, then **no finite ceiling is provable from the shipped cost
semantics** — a single call's duration is byte-measured and unclamped,
and the 12× form does not escape the premise (it is the same rate,
multiplied). In that case Gate 4 does **not** proceed under the 600,000
figure as a guarantee. The remaining honest constructions are:
**(a)** restate 600,000 as a detection-and-stop bound (executor STOP on
observation) — legitimate as monitoring, but it must not be called
enforcement, and Amendment 2 does not recommend presenting it as such;
or **(b)** a separately gated code change — a gate-scoped settled-cost
circuit breaker evaluated inside the dispatch transaction, the only
place enforcement can mechanically live — as future work in the family
of Amendment 1 §8's gaps. The fork is Rowan's to close at verification;
Julie's GO is sought only on the construction Rowan verifies.

---

## 6. R2 — The stall signature, restated as a sliding window

Amendment 1 §4.3's consecutive-pair rule is **replaced** by the
following. Rowan's defect is repaired arithmetically: the binding span
is a ≥ 35-minute window of *continuously observed* non-progress, and
the intervening ~15-minute polls are evidence inside the window, not
its boundary. Poll contents are Amendment 1 §4.1's, **plus** the live
grant id recorded at every poll.

1. **Anchor.** Let t0 be the time of the first poll at which a grant G
   is observed **delivered** (Amendment 1 §4.2's definition: S5 shows
   ≥ 1 execution under G, or the gate-dispatched figure rose
   attributably to G). An undelivered grant never anchors.
2. **Evaluation.** At every poll P with P − t0 ≥ 35 minutes, evaluate
   the signature over the **whole window [t0, P]**: the stall fires
   iff at **every** poll in the window — each intervening poll checked
   individually — and at P: (1) the live grant is still G, same id;
   (2) cumulative gate-dispatched (Amendment 1 §4.5 basis) is unchanged
   from its value at t0's poll; (3) plan totals
   (eligible/done/failed/blocked/prompts) are unchanged; (4) the
   gate-settled-delta is unchanged; and at P, (5) S3 reads `ok: true`.
3. **Resets.** Any intervening observation of movement on (2)–(4)
   **negates** the window: if G settled with progress, no anchor
   exists until a successor grant delivers (its own t0 at its first
   delivered observation, per §8's verification); if G was replaced by
   a *delivered* successor, the successor anchors at its delivery.
   Replacement by an **undelivered** successor neither anchors nor
   resets — the exclusions of Amendment 1 §4.4 (pending grants, lease
   churn, PT rollover) are preserved in full, as is §4.6's
   effect/non-effect statement.

Concretely: two polls ~15 minutes apart can no longer conclude
anything; the earliest a stall can fire is 35 minutes after a delivered
grant's first observed dispatch with **every** observation in between
showing the same frozen figures — the Phase A signature (Amendment 1
§4.7) restated soundly.

## 7. R3 — Zero-remaining open reservation rows: possible; the proof repaired

### 7.1 The answer: yes — in exactly two shapes, both by consumption, never by creation

- **(T) Transient.** `applyDispatchQuota` increments `slots_consumed`
  per dispatch and refuses the *next* dispatch at `consumed ≥ total`
  (`quota-budget.mjs:803`, `:814`). A row therefore reaches
  `slots_consumed == slots_total` exactly on its occurrence's last
  permitted dispatch, and it stays `open` until the grant's settlement
  sweep closes it (`closeReservationsForGrant` at report time,
  `quota-budget.mjs:714`). In between, `derivedDayTotals`
  (`quota-budget.mjs:193-202`) counts it at **(total − consumed) = 0**
  toward the day's reserved sum — an open row contributing zero.
- **(P) Persistent.** The single close fence, `closeReservation`
  (`quota-budget.mjs:662-672`), blocks a close while any
  dispatch-capable execution exists for (grant, occurrence), and
  blocks the `unknown_billing` close for every reason except
  `halt_settled`. A grant whose last-slot attempt ended in an
  unresolved unknown leaves its zero-remaining row open indefinitely
  behind that execution.
- **Never by creation.** `boundGrantTargets` breaks the cohort prefix
  at `slots ≤ 0` (`quota-budget.mjs:624-645`), and the dispatch-time
  re-reservation refuses `slots ≤ 0` (`DAY_ROLLOVER`,
  `quota-budget.mjs:782-785`); every full-grant issuance passes through
  `boundGrantTargets` first. (`reserveForGrant`'s own guard refuses
  only `slots < 0` — unreachable on the coordinator's path.)

### 7.2 Correction to Amendment 1, and the strengthened proof

**Amendment 1 §3.2's Leg 3 premise — "every open reservation
contributes ≥ 1" — is false in shapes (T)/(P), and is corrected
here.** The conclusion survives, on evidence that actually excludes
the shapes at this census. Legs 1, 2, 4 stand; Leg 3 is replaced by:

- **Leg 3b (reconcile verifies every row, whatever its remaining
  slots).** `reconcileQuota` iterates **every** reservation row —
  `SELECT * FROM d6_grant_reservations`, no state filter
  (`quota-budget.mjs:478` ff.) — and verifies each row's stored
  `slots_consumed` against the derived count, flagging any mismatch
  (and any `consumed > total`) as drift, which S3's `ok: true`
  excludes. With census-day dispatched = 0: every row carrying the
  census day_key has derived consumed = 0, hence (reconcile-verified)
  stored consumed = 0, hence remaining = `slots_total`. A
  zero-remaining census-day row would need `slots_total = 0` —
  excluded for the 15 by Leg 2 (their rows are created at used = 0,
  total = 12; `attemptsUsed` is monotone because the attempt log is
  append-only, so used = 0 at census implies used = 0 at every
  creation instant) and excluded account-wide for the census day by
  S6 with dispatched = 0 (a consumption-side zero-remaining row needs
  dispatches on that day_key — there are none).
- **Subject-direct exclusion.** Shapes (T)/(P) require an execution
  under the row's grant for one of the 15. S5 shows **no execution for
  any of the 15 under any grant, ever** — the plan's only executions
  are Phase A's 8, under the now-reported grant, all terminal — and
  that grant's reservation rows were verified closed one by one at
  Gate 3's E4.

The residual honesty of Amendment 1 §3.3 stands unchanged: no surface
projects the open-row **count**; the proof is by legs — now five, each
shown.

### 7.3 Read consistency during churn — order and stability rule (new)

The census surfaces are separate, non-atomic reads, and the churn
guarantees they can straddle a void/re-grant. The census is therefore
taken in the **fixed order S1 → S2 → S5 → S3 (full pagination) → S4 →
S7**, and is **valid only under the stability rule**: the A1 timed
pair's second S1 must agree with the first pass on (live grant id,
granted set), and a closing S4 re-read must agree with the first pass
on (census-day totals, phase settled). Any disagreement restarts the
census from S1 — figures are never mixed across grant generations.

The **void-instant zero** (a single read showing reserved = 0,
G = ∅, no live grant) is acceptable **only when the timed pair brackets
it**: one pass zero-case, the other pass showing the predecessor
(pre-void) or the successor grant with the full §3/§7.2 proof closing
on it. **Two zero-case passes ≥ 16 minutes apart with no live grant at
either = STOP**: `driveOnce` re-grants within one watchdog cycle of a
void, so a persistent grantless state contradicts the driver's
observed behavior, and the census does not proceed through it. The
same rule binds G polls (§8): a poll whose S1 and S3 disagree about
the live grant generation is discarded and re-read once before any
figure from it is used.

## 8. R4 — Every successor grant is verified before any reliance

Amendment 1 §§2 and 7 are extended as follows. **Every newly observed
grant id** — at census (including the timed pair's successor), at
Amendment 1 §5.3's step 0, and at **every G poll** — receives the full
verification **before** any reliance on it (before its figures feed
the §5.1 cover check, the §6 stall window, or the A6 evaluation):

1. S1 shows it as a grant **of this job**, and the unique live grant;
2. its granted set ⊆ the approved 15, and equals the cohort the
   guard's arithmetic selects — the executor recomputes
   `boundGrantTargets`' inputs from S2 order and S3/S4 headroom and
   compares;
3. the ownership proof (§3 as repaired by §7.2) re-run, closing on
   **its** reservation set;
4. reconcile `ok: true` within the same read pass.

A successor failing any leg = **STOP + containment** (proposal §5.7) —
never noted-and-continued.

**Lease freshness is never inferred from appearance.** No surface
projects lease timestamps (Amendment 1 §8.1 stands), and a newly
appeared `issued` grant may be seconds from expiry. What is used
instead: the timed classification of Amendment 1 §2.1 step 4 at
census, and at polls the observation pair (first-seen poll, next poll)
classifying persisted/replaced the same way. Delivery safety rests on
neither: it rests on the drain's **delivery fence**
(`coordinator.mjs:1861-1876` — a dispatch leaves only while its grant
is `issued`, at the job's current revision, with
`now ≤ lease_expires_at`; otherwise the grant is voided in-transaction,
its reservations released, and re-advance scheduled), which is the
ultimate safeguard and is indifferent to what the executor believes
about freshness.

## 9. Amendment mechanics — what changes, what stands, satisfiability

**This amendment replaces:** Amendment 1 §5.0–§5.2's cost-bound form
and cover check (per-occurrence proven term `upperBoundAttemptMicro +
5`; proven scope bound **469,519**; cover condition as §5.1 states);
Amendment 1 §4.3 (sliding window, §6); Amendment 1 §3.2 Leg 3
(corrected, Leg 3b added, §7). **It extends:** Amendment 1 §§2 and 7
(successor verification, §8; census consistency, §7.3). **Everything
else stands exactly as Amendment 1 left it** — A5, A6 as passed; Q3
end-HELD; the R1/R2 sub-gates; the **4-mutation budget** (this
amendment adds no mutation; the only construction that would have
changed the budget — tranche interposition — is analyzed and not
adopted, §5.2); the census surfaces; the STOP law; §8's two gaps,
unchanged and still separately gated future work.

**Satisfiability, stated plainly.** R1–R4 are each answered within the
shipped machinery, as shown. Nothing in R2–R4 is unsatisfiable. In R1,
the single point requiring a **ruling** rather than a reading is
premise P (§4.3): if Rowan confirms it, the 600,000 ceiling is
enforceable by arithmetic and Gate 4 may proceed on the verified
construction at Julie's GO; if she declines it, §5.3 governs — Gate 4
does not proceed under an unenforceable ceiling, and the alternatives
(detection-restatement, or the separately gated circuit-breaker build)
are named with whose decision each is. No other item in this amendment
requires a decision beyond Rowan's verification and Julie's Gate 4 GO.

**This amendment does not authorize execution.** Execution still
requires Rowan's final verification of this amendment and Julie's
separate GO, recorded before any step.

---

*Prepared by Wren (executor/drafter) for Rowan's verification —
Amendment 2 to the Gate 4 proposal, answering REVISE items R1–R4.
Read-only drafting; no production mutation, no preview call, no board
filing (direct mode). File URLs for Rowan's reference accompany the
return summary (the repo is private; the summary carries the
substance).*
