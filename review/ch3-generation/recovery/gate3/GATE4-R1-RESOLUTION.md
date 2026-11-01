# GATE 4 — R1 RESOLUTION: the spending ceiling after premise P's rejection

**Status:** DRAFTED for Rowan's verification, then Julie's Gate 4
decision. This resolution **authorizes nothing**. It answers the one
outstanding item of Rowan's Amendment 2 review — **R1** — and changes
the Gate 4 paperwork only as §10 itemizes; everything else in the
proposal, Amendment 1, and Amendment 2 stands exactly as written.

**Amends:** the Gate 4 proposal, pinned `806cc53aebee15aaed8ec139c1213d79f7e664fb`
(repo `jedavid33-design/opal-reader`, branch `ui1-review`, SHA-256
`b524bb187d72c4c7881bf1d4470e6524b14a72678168ae23292245efc5abfabc`),
as amended by Amendment 1, pinned `451f71ad5526879f6849f4f1607bb80024e439d0`
(SHA-256 `af3ec5d397fb427b4f53e05f69ee6cfc82328bba9d95913dbc4002723baa7ef1`),
and Amendment 2, pinned `34fceb04332c73dc85e71c39b1df53ccd933c331`
(SHA-256 `4f92ced7eaa67ba074f05f5992d4b7a18de66dde0d9e1c03785db9083f3b0c09`).
None of those documents is edited; this resolution is a child of
Amendment 2's pin.

**Responds to:** Rowan's Amendment 2 review — **HOLD, R1 ONLY**
(relayed verbatim by Julie, Nov 1, 2026, direct mode). R2 PASS,
R3 CONDITIONAL PASS, R4 PASS; A5, A6, the end-HELD closing sequence,
the R1/R2 sub-gates, and the four-mutation executor budget all stand.
**Premise P is rejected as proof of a hard spending maximum**: the
469,519-unit figure depends on actual audio duration never exceeding
chars/10, but shipped code measures duration from returned audio and
enforces no such maximum — the figure is a forecast, not guaranteed
maximum exposure. Rowan requires one of two approaches: **(1)** a
separately gated mechanism that enforces the $0.60 cumulative limit,
accounting for settled and in-flight work; or **(2)** an explicitly
detection-only threshold with the potential exposure stated plainly
for Julie's separate decision — never describing detection as a hard
ceiling. This resolution works both approaches from the shipped
source and recommends one (§9). **Wren's recommendation is Approach
2**; the decision is Julie's; the verification is Rowan's either way.

**Live build:** `1c2d1d0fa7ebb769f68cfb327fb9fde7d4d30867` (the
range-fix build). The system sits HELD; this drafting made read-only
calls only.

**The resolution, in one paragraph.** Without premise P, the gate's
ledger exposure is exactly parameterized by the realized duration
multiplier m (actual duration = m × the model's chars/10 bound):
settled ≤ m × 469,444 + 15 × (0.5m + 4.5), which crosses 600,000 only
at a scope-average m ≈ 1.28 — against Phase A's realized m ≈ 0.61
(§4). The shipped phase fence does **not** strictly entail settled ≤
13,500,000 either; the correct statement is settled ≤ 13,500,000 +
Σ (per-occurrence excess over its 12× fence allowance), a term that
vanishes to rounding dust (≤ ~10 units per occurrence) for any
m ≤ 12 (§3). Real-cash exposure is a separate, smaller question:
Google bills per input character, total submitted characters are
hard-bounded at 216,000 (structural tightening 158,320), converting
to at most ≈ $3.04 at Julie's introductory rate, behind a verified
$17.83 prepay balance with auto-reload off (§5). Approach 1 — a
gate-scoped check inside the dispatch transaction — is designed in
full (§7), including its one-sentence achievable guarantee; the
guarantee retains a single-in-flight-attempt excess term that **no**
pre-dispatch mechanism in this architecture can remove, because the
provider call precedes the measurement. Approach 2 (§8) relabels
600,000 as a detection threshold with containment, and carries the
verbatim exposure paragraph Julie would accept at GO.

| Item | Where answered | One-line result |
|---|---|---|
| Exposure without premise P | §§3–6 | settled(m) ≤ m × 469,444 + slack; 600,000 crossed only at m ≈ 1.28; Phase A realized m ≈ 0.61 |
| Approach 1 (enforcement design) | §7 | Dispatch-transaction gate check; guarantee = ceiling + one in-flight attempt's excess; +2 in-gate mutations, deploy under its own gate |
| Approach 2 (detection-only) | §8 | 600,000 relabeled detection threshold; poll + containment; verbatim exposure paragraph for Julie |
| Recommendation | §9 | **Approach 2** — proportions, backstops, precedent; Approach 1 cannot deliver a hard cap either |

---

## 1. Grounding — fresh live reads at drafting (2026-11-01, ~18:42Z)

Read-only, against the same surfaces as Amendments 1–2. No
contradiction with Amendment 2's grounding: `/health` reports build
`1c2d1d0f…`, generation **halted**; the quota read for PT 2026-11-01
shows `providerDispatchesToday: 0`, `providerReservedToday: 96` —
the churn Amendment 1 identified, still turning over with zero
dispatches and zero spend. Plan, phase figures, conflicts, and the
eligibility digest are as Amendment 2 §1 recorded them (phase settled
732,303 / estimatedUnverified 19,018 / reservedUnverified 5,648;
plan active 8/23; conflicts the baseline four; digest `9453ab5d…`).
All source citations below are to the range-fix build tree, the tree
the live build was assembled from. All sums were recomputed from the
proposal §2.3 char table using the shipped functions, as in
Amendment 2 §1: Σ `upperBoundAttemptMicro` over the 15 = **469,444**;
Σ expected = **294,137**.

## 2. An open question carried forward — R3's condition

Rowan's Amendment 2 review relayed **R3 as a CONDITIONAL PASS
without spelling out the condition**. This resolution does not guess
it and does not treat it as satisfied. **Rowan is asked to state the
R3 condition explicitly at this verification.** Nothing in the R1
resolution depends on it, and Gate 4's GO should not be sought until
the condition is on the record — the same discipline as premise P:
an unnamed condition is not a met condition.

---

## 3. Exposure mathematics I — what the phase fence actually bounds

The phase fence is the only money check the shipped code runs, so
its exact strength matters to both approaches.

### 3.1 Composition, timing, transaction

`d6GrantGuard` (`worker/generation/grant-guards.mjs`) is called from
`GenerationCoordinator._issueGrant` (`worker/coordinator.mjs:1639`),
**inside that method's single transaction**, after the park, daily
quota, and monthly-cap checks (`coordinator.mjs:1644–1666`). It is
evaluated **only at grant issuance** — never at dispatch, never at
confirm. Its budget verdict is `d6PhaseBudgetCheck`
(`grant-guards.mjs:108`):

> projected = settledMicro + reservedUnverifiedMicro +
> inFlightUpperMicro + pendingUpper > 13,500,000 ⇒ refuse
> `phase_budget`.

The terms, exactly as the code computes them:

- **settledMicro** — `genstore.phaseAccounting`
  (`worker/generation/genstore.mjs:403`): SUM of `cost_micro_cents`
  over **confirmed** attempts with outcome ∈ {success, failed_known,
  policy_block}, phase-wide. A success contributes
  `round(durationSec × 225)` with `durationSec` byte-measured
  (Amendment 2 §2.1); the other two outcomes contribute exactly 0.
- **reservedUnverifiedMicro** — the adjudication reservations of
  `estimated_unverified` dispositions (here: 5,648, the known
  straddler's). Not gate spend; a fixed carried term.
- **inFlightUpperMicro** — SUM of `upper_micro_cents` over the
  phase's attempts in phases `reserved`/`dispatching`
  (`genstore.mjs:410–413`): per-**attempt** model uppers
  (`upperBoundAttemptMicro` of each attempt's own text, stored at
  reservation, `d6-executor.mjs` `wrappedSynthesize`), **not**
  per-occurrence 12× figures.
- **pendingUpper** — SUM of `upper_micro_cents` over the **job's**
  pending eligible plan entries (`grant-guards.mjs`, the `pending`
  query), where each entry carries
  `upperBoundOccurrenceMicro(chars)` = **12 ×
  `upperBoundAttemptMicro(chars)`** (set at plan build,
  `service.mjs:808`). At drafting figures this term is 5,633,328 for
  the gate's 15. Note the guard sums the job's **full** pending set;
  cohort bounding happens later in `_issueGrant`, so the fence is
  evaluated against the whole remainder every time.

### 3.2 settled ≤ budget is NOT strictly entailed — the correct bound

The projection prices every not-yet-settled occurrence at its 12×
allowance and every created attempt at its model upper. A confirmed
success, however, lands in settledMicro at its **byte-measured
actual**, which no term of the projection clamps. Track one
occurrence's contribution across its life: while pending it
contributes `a(occ) = 12 × upperAttempt(occ)` to pendingUpper; once
its attempts are created, each contributes its own upper to
inFlightUpper — and since an occurrence has ≤ 12 attempts ever
(Amendment 2 §2.2), each on a sub-text of the occurrence (≤ the
occurrence's upper), created uppers sum to ≤ `a(occ)`; on confirm,
an attempt's contribution swaps its upper for its actual. Summing
over the phase, the exact statement the code supports is:

> **settled_final ≤ 13,500,000 + Σ_occ ( settled(occ) − a(occ) )⁺**
> (+ the fixed reservedUnverified term, already inside the
> projection).

Only the amount by which an occurrence's realized settled **exceeds
its full 12-attempt allowance** can leak past the fence. Under the
m-parameterization of §4, `settled(occ) ≤ m × upperAttempt(occ) +
0.5m + 4.5`, so the leak per occurrence is
≤ ((m − 12) × upperAttempt(occ) + 0.5m + 4.5)⁺ — **zero, up to a
rounding term of ≤ 0.5m + 4.5 ≤ 10.5 units per occurrence, for any
m ≤ 12**. In words: the fence is a hard phase cap to within ~10
units (a hundred-thousandth of a dollar) per occurrence for every
duration multiplier up to 12× the model's slowest rate, and leaks
only linearly in (m − 12) beyond that. For Gate 4 this is a
backstop statement about the $13.50 phase total; the gate's own
delta is bounded far tighter, directly, in §4.

### 3.3 The monthly cap is not a settled-cost check

For completeness, since it is sometimes mistaken for one: the
monthly-cap check inside `_issueGrant` (`coordinator.mjs:1651`)
compares `_spendIn(month)` — a SUM of `est_micro_cents` over the
legacy `ledger_ops` for the month — plus the job's **expected**
per-occurrence estimate × the full pending count, against
`monthlyCap` ($50 ⇒ 50,000,000). It gates **issuance on estimates**
in a different ledger; it never reads D6 settled actuals and cannot
bound them. Gate 4 passes it trivially. It is not cited as a
safeguard anywhere in this resolution.

---

## 4. Exposure mathematics II — the m-parameterization (no premise P)

Amendment 2 §4's derivation is re-run with its rate step replaced by
a free multiplier. Define **m** by: a successful call's
`durationSec = m_call × (its text's chars / 10)`. m = 1 is premise P
(the model's slowest admitted rate, 10 chars/sec); the pinned
realized rate 15.96 chars/sec corresponds to m ≈ 0.63. m is a
property of returned audio, observable only after the fact — that is
Rowan's point, and this section honors it: **no value of m is
assumed anywhere below; the exposure is stated as a function of m.**

Repeating Amendment 2 §4.1 with the multiplier carried through
(successful calls are partition leaves, so Σ successful chars ≤
segment chars; successes per occurrence S ≤ 7, Amendment 2 §3;
per-call rounding +0.5; model-side and float slack as in Amendment
2 §4.1):

> **settled(occ) ≤ m × upperAttempt(occ) + (0.5m + 4.5)**, and for
> the gate's closed scope of 15:
> **settled_gate ≤ m × 469,444 + 15 × (0.5m + 4.5)**.

| m | Meaning (speech rate) | Bound (units) | Bound ($) |
|---|---|---|---|
| 1.0 | 10 chars/s — the model's slowest admitted rate (premise P) | 469,519 | $0.47 |
| 1.5 | 6.7 chars/s | 704,245 | $0.70 |
| 2.0 | 5 chars/s | 938,971 | $0.94 |
| 3.0 | 3.3 chars/s | 1,408,422 | $1.41 |
| 5.0 | 2 chars/s — pathological, far outside observation | 2,347,325 | $2.35 |

Structural caps used: successes per occurrence ≤ 7 ⇒ total
successes ≤ **105**; total attempts ≤ **180** (12 × 15). The bounds
above already absorb those caps; they are stated because they also
bound §§5–6.

**Threshold crossing.** Solving the bound = 600,000: the detection
threshold of §8 can be crossed at all only if the scope-average
multiplier reaches **m ≈ 1.28** — every successful call in the
chapter averaging ≥ 28% slower than the slowest rate the cost model
admits, sustained across the whole scope.

**The empirical anchor — Phase A's realized m.** Phase A's cohort 1
(8 occurrences, Gate 3 record): 30 successes settled **152,964**;
the success-only expected sum was **157,076** (Amendment 1 §5.0).
Leaf-level attempt rows are not reproduced in the gate paperwork,
so Σ upperAttempt over the successful leaves is recovered from those
two published sums: Σ upper = Σ expected × (15.96 / 10) ± ≤ 15 units
of per-leaf rounding ≈ **250,693**, giving **m_A = 152,964 /
250,693 ≈ 0.61** (0.609–0.611 allowing the rounding). Phase A's
audio ran ~39% **under** the model's slowest-rate bound
(equivalently, settled/expected = 0.974). This is evidence about
what this provider, voice set, and text profile actually do — not a
premise, and not used as one: the exposure table above stands for
every m.

---

## 5. Exposure mathematics III — real cash (Google billing), separately

The ledger above is the Reader's own accounting unit (micro-cents
at 225 per audio second — the introductory $0.81/audio-hour rate).
**Google's actual billing for TTS is per input character.** The two
views answer different questions and are never mixed in this
resolution: §§3–4 bound the ledger figure the gate's threshold
watches; this section bounds the cash Julie's prepay is charged.

**Rate basis (Julie's verified figures, converted by the pinned
constants).** Introductory rate $0.81 per audio hour at the realized
15.96 chars/sec ⇒ 225 / 15.96 ≈ **14.10 micro-cents per submitted
character ≈ $14.10 per 1M characters**; at the doubled post-intro
rate (Jan 1, 2027), ≈ **$28.20 per 1M characters**. (Google's own
detail is day × product only — Gate 5 record — so cash figures here
are rate conversions, not invoice reads.)

**Submitted characters.** Every dispatched attempt submits its
node's text; blocked and failed attempts submit too. Bounds:

- **Assumption-free bound: 216,000 chars.** Attempts ≤ 180, and
  every attempt's text ≤ 1,200 chars (the pre-split cap,
  `PRE_SPLIT_MAX_CHARS`, `policy-split.mjs:222`, applied before any
  synthesis, `policy-split.mjs:306`): 180 × 1,200 = 216,000.
- **Structural tightening: 158,320 chars.** Within one pre-split
  chunk, distinct attempted nodes occupy ≤ 5 levels (the chunk plus
  split depth ≤ 4, `SPLIT_MAX_DEPTH`, `gen-constants.mjs`) and each
  level partitions the chunk, so distinct-node submissions ≤ 5 ×
  the occurrence's chars; repair retries resubmit an already-counted
  node, ≤ 3 per chain (`REPAIR_MAX_RETRIES`, `gen-constants.mjs`),
  adding ≤ 3 × 1,200 per occurrence. Total: 5 × 20,864 + 15 × 3,600
  = **158,320**. (Assumptions stated: one repair chain per
  occurrence, per Amendment 2 §2.2's one-pass finding; the
  assumption-free bound above stands without them.)

**Cash figures.** Expected: a clean pass submits 20,864 chars ≈
**$0.29** (identical to the ledger expected, by construction); at
Phase A's realized attempt profile (44 attempts: 30 successes, 14
blocks) scaled to this scope, ≈ 30,000 chars ≈ **$0.43** (an
estimate, labeled as such). Worst case: 216,000 chars ≈ **$3.04**
introductory / **$6.09** post-intro; structurally tightened,
158,320 chars ≈ **$2.23** / **$4.46**.

**Physical backstop.** Julie's AI Studio prepay balance was
**$17.83** verified Oct 29, 2026, auto-reload **off** — Google-side,
total spend across everything stops when the balance exhausts; no
figure in this resolution approaches it. The $50 monthly cap plays
no role here (§3.3: it gates ledger estimates at issuance, not
cash, not settled).

---

## 6. Exposure mathematics IV — in-flight billable work

At any instant, billable-but-not-yet-settled work is the set of
attempts in phase `dispatching` whose confirms have not landed
(attempts still `reserved` are not billable: no provider call has
occurred, and release counts them exactly zero, `genstore.mjs`
`releaseAttempt`).

- **Operational bound — one attempt.** The executor processes a
  grant message strictly sequentially: the occurrence loop awaits
  each execution (`d6-executor.mjs:795` ff.), and
  `wrappedSynthesize` awaits its confirm before returning. Grant
  exclusivity (a successor issues only when no grant reads
  `issued`, Amendment 1 §2) means at most one grant of the gate
  plan is ever executing. So at most **one** gate attempt is
  dispatched-but-unconfirmed at any instant, and its eventual
  settled ≤ m × upperAttempt(leaf) + 0.5 ≤ **m × 27,000 + 0.5**
  (a leaf is ≤ 1,200 chars ⇒ upper ≤ 27,000).
- **Structural bound — the whole live grant, no sequentiality
  assumed.** All unconfirmed attempts of the live grant confirm as
  successes: their leaves partition their occurrences, so the
  total ≤ m × Σ upperAttempt over the grant's occurrences + 5 per
  occurrence — for the cohort-8 form, **m × 258,004** (Amendment 2
  §4.1's cohort figure at m = 1: 258,004).
- An attempt whose confirm never lands (executor lost mid-call)
  confirms as `unknown` on recovery: it settles **0** in the ledger
  and halts the phase (Amendment 2 §2.1). Google may still have
  billed its characters; that cost is inside §5's bounds, which
  count every dispatched attempt.

---

## 7. Approach 1 — a separately gated enforcement mechanism (design)

Specified to reviewable concreteness. Building it requires its own
repo-only build approval, Rowan source review, and a halted deploy
gate — none requested here.

### 7.1 Where the check lives

Inside **`genstore.markDispatching`** (`genstore.mjs:171`) — the
only path that may precede a provider call (genstore header,
`genstore.mjs:10`; the executor's `wrappedSynthesize` is its sole
dispatch caller). The check runs **inside markDispatching's existing
transaction** (`coord._tx`), immediately after `applyDispatchQuota`
succeeds and before the phase transition to `dispatching`. A refusal
throws, the transaction rolls back, the attempt stays `reserved`,
and **no provider call may follow** — mechanically identical to the
shipped `QuotaBudgetRefusal` (`quota-budget.mjs:75`), whose executor
handling already exists: release the attempt (counts zero in every
accounting view) and surface the refusal as the outcome.

The grant guard was rejected as the check's home: it is
projection-side and issuance-time (§3.1), and Amendment 2 §5.2
showed issuance and drain are one pass — a per-grant check cannot
bound within-grant settling above projections. The dispatch
transaction is the only per-attempt interposition the architecture
has.

### 7.2 What it counts, and the refusal disposition

A new refusal class, `GateBudgetRefusal`, modeled line-for-line on
`QuotaBudgetRefusal`. On each dispatch of an attempt belonging to
the gate plan, inside the transaction:

> gateDelta = (plan-scoped settled now) − (opening settled figure)
> \+ Σ `upper_micro_cents` over the gate plan's attempts in phases
> `reserved`/`dispatching`
> — refuse if gateDelta > ceiling (600,000).

Plan-scoped settled uses the same SUM as `phaseAccounting` narrowed
to the gate's plan (the `planUnverifiedAccounting` sibling at
`genstore.mjs:437` is the shipped precedent for the plan-scoped
form). The candidate attempt is itself in `reserved` at check time,
so its upper is already inside the in-flight term: the check admits
a dispatch only when settled-to-date plus **every** created-but-
unconfirmed upper, including the candidate's, totals ≤ ceiling.

Executor handling rides the quota path: the attempt is released,
and the plan takes a shipped park state — the design specifies
**`parked_budget`** (the plan-state the service's mapping already
assigns to the `phase_budget` reason, `service.mjs:70`), via one
new mapping row for the gate-budget refusal reason, mirroring the
`provider_attempt_budget → parked_quota` rows (`service.mjs:60`).
A parked plan issues no further grants; unparking stays a separate
operator/Julie matter, exactly as with shipped parks. No new
disposition semantics are introduced.

### 7.3 Gate-scope state — minimal

One lazily created table, `d6_gate_budget` (the lazy-DDL pattern of
`d6_grant_finalizations` / the quarantine schema), one live row per
gate: `gate_id, plan_id, ceiling_micro, opening_settled_micro,
opened_at, closed_at`. Written only by two **new operator routes**:

- **Open** — after the Gate 4 census, before sub-gate R1. The
  opening figure is **computed server-side** from the gate plan's
  accounting at open time; a caller-supplied figure is refused —
  the bootstrap's figureless law (`quota_bootstrap_figure_caller_
  supplied` precedent) applied to gate state.
- **Close** — at the gate's end state, after the closing holds;
  stamps `closed_at`. The check in §7.2 applies only while a row is
  open for the attempt's plan, so closing retires the mechanism
  with the gate.

No settings change; no client surface; Batch and every other plan
are untouched (no open row ⇒ the check is inert).

### 7.4 The achievable guarantee — stated precisely

> **With the check inside markDispatching's transaction, no attempt
> is ever dispatched unless gate settled-to-date plus the model
> uppers of every created-but-unconfirmed gate attempt, the
> candidate included, total at most 600,000; final gate settled can
> therefore exceed 600,000 only by the excess of the single
> in-flight attempt's byte-measured actual cost over its own model
> upper — at most (m − 1) × 27,000 + 1 units at realized multiplier
> m (§6) — because the provider call that creates the cost
> necessarily precedes any measurement of it.**

A **margin variant** tightens this: enforce at an internal
threshold T = 600,000 − E, and the guarantee becomes *settled ≤
600,000 whenever the final attempt's excess ≤ E* — E = 27,000
covers any single leaf at m ≤ 2; E = 108,000 covers m ≤ 5 — at the
price of refusing in-scope work whose true cost might have fit.

**What Approach 1 cannot do, stated plainly:** a literally
unconditional hard cap is **not achievable in this architecture**.
The single-attempt excess is unbounded in principle (duration is
byte-measured after the call and clamped nowhere), so any
pre-dispatch mechanism — this one included — leaves exactly that
term. A design claiming otherwise would be premise P in a new
place. What Approach 1 genuinely buys over §8 is replacing "a whole
scope's worth of autonomous settling between polls" with "one
attempt's excess" as the only unguarded term.

### 7.5 Process cost, and its effect on the mutation budget

- **Build:** the genstore check + refusal class, executor handling
  (largely inherited from the quota path), the service park
  mapping, two operator routes, the lazy table, and a test battery
  (dispatch-transaction refusal tests, in-flight accounting tests,
  open/close route tests) — a repo-only build of the same class as
  the range-fix.
- **Review:** Rowan source review of the build; this resolution's
  paperwork verified against the new tree.
- **Deploy:** a separate halted deploy gate under the family's
  standing law (fresh census, STOP law, one upload, observability
  re-check, denied probes, ends HELD).
- **Paperwork:** Gate 4's census and verification texts cite build
  `1c2d1d0f…` throughout; all must be re-verified (and where they
  name the build, re-pinned) against the new build before a GO can
  be sought.
- **Mutation budget (identified separately, as Rowan required):**
  the deploy's upload belongs to the deploy gate and does **not**
  touch Gate 4's budget. Inside Gate 4's execution, Approach 1
  adds exactly **two** executor mutations — the gate-budget **open**
  (after census, before R1) and **close** (at the end state) — for
  a Gate 4 total of **6**, against the standing 4. Rowan's and
  Julie's approval of Approach 1 is approval of that revised count.

---

## 8. Approach 2 — the detection-only threshold (specification)

### 8.1 Relabeling — every occurrence, no exceptions

If Julie adopts Approach 2, the figure **600,000** is restated
throughout the Gate 4 paperwork — proposal §5.5's cost bullet,
Amendment 1 §5 (A4), Amendment 2 §5.1 — as a **detection
threshold**, in these words: *"detection threshold (600,000 units):
an executor stop-trigger on observation; not a cap, not a guarantee
that settled spend stays at or under it."* Amendment 2 §5.1's
sentence "the ceiling binds by arithmetic" is superseded by §4 of
this resolution: 469,519 stands as the **m = 1 forecast**, labeled
as a forecast wherever it appears. The cover-check form of
Amendment 1 §5.2 is retained as a **detection** computation (a poll
whose projected settled crosses the threshold stops the gate the
same way), never described as enforcement.

### 8.2 Detection and containment procedure

Unchanged from the standing design, restated under the honest
label: at census and at every G poll, the executor reads the gate's
settled delta from live figures. On any observation of
**settledDelta > 600,000**, or of **settledDelta > 469,519** (the
forecast bound — crossing it refutes the operating picture and is
treated as foreign work under A6, Amendment 2 §5.1), the executor
STOPs and applies the closing holds in containment order
(**re-pause, then re-halt**), with read-backs, and reports the
figures. Between polls the coordinator's autonomous cohorts
continue — that is the design's nature, and §8.3 says so to Julie
in plain words. The detection lag is itself bounded: settling
between two polls cannot exceed one cohort's worth, ≤ m × 258,004
(§6, structural form), and the gate's total exposure at every m is
§4's table, which no poll cadence changes.

### 8.3 The exposure paragraph — verbatim, as it will be put to Julie at GO

> Before you decide: the $0.60 figure in this gate is a **detection
> threshold, not a guaranteed cap**. Software watches the running
> total and stops the gate if it passes $0.60 — but batches run on
> their own cycle between checks, so spending can pass $0.60 before
> the stop lands. Here is the honest range. The job is expected to
> cost about **$0.29**. On the cost model's own slowest-rate
> assumption, the worst case is **$0.47** — already under the
> threshold. The threshold can only be crossed at all if the audio
> comes back at least ~28% slower than that slowest assumed rate
> across the whole chapter; in Chapter 3's first batch the audio
> actually ran about 39% *faster* than that bound (realized factor
> 0.61). If durations ran 1.5× the bound, the total would be about
> **$0.70**; 2×, about **$0.94**; 3×, about **$1.41**; even 5× —
> speech at 2 characters per second, far outside anything observed
> — about **$2.35**. Two independent backstops sit behind all of
> this: the system's own **$13.50 phase budget** for Forever
> Pucked, which the code refuses new batches against, and your
> Google **prepay balance** ($17.83 on Oct 29, auto-reload off),
> which physically caps all Google spending. Separately, Google
> charges per character sent rather than per second of audio; the
> absolute worst case for characters sent (every possible split
> and retry) converts to about **$3.04** at today's introductory
> rate. Approving this gate means accepting that $0.60 is
> monitored-and-stopped — with the realistic worst case under
> $0.50 and the extreme tail bounded as above — **not** a hard
> guarantee of $0.60.

---

## 9. Recommendation — Approach 2

Wren recommends **Approach 2**, for these reasons:

1. **Proportions.** The cap under discussion is $0.60 on a job
   expected to settle $0.29, whose forecast worst case ($0.47)
   already sits under it. Crossing $0.60 requires the whole scope
   to average m ≥ 1.28 against a realized 0.61 — and even the
   m = 5 tail ($2.35) is small money, doubly backstopped (§§3, 5).
2. **Approach 1 does not deliver the thing it would be bought
   for.** Its guarantee (§7.4) is a ceiling plus one attempt's
   excess — better than detection, honestly stated, but not the
   hard cap R1 asks about, because no pre-dispatch mechanism in
   this architecture can produce one. The real choice is between
   two non-hard constructions: one cheap and immediate, one a
   full build–review–deploy cycle.
3. **Precedent.** Every generation gate in this program — Gate 8's
   Chapter 2 run (≈ $0.38 recorded), Phase A itself — ran under
   the phase fence plus modeled budgets plus monitoring. No gate
   has carried a dispatch-transaction circuit breaker, and the
   two completed runs both landed at or under their modeled
   figures (Phase A at 97.4% of expected).
4. **Approach 1 keeps its value at larger scope.** The rest of
   Forever Pucked (≈ $5.84 modeled) or Batch arming would change
   the proportions entirely; the §7 design is written to be
   reusable there, with Gate 4's realized m as evidence.

The recommendation is Wren's. **The exposure decision is Julie's
separate decision**, taken on §8.3's paragraph if Approach 2 is
adopted. Rowan's verification of this resolution — the mathematics
of §§3–6 and the correctness of both constructions — is required
either way, as is her answer on R3's condition (§2).

---

## 10. Amendment mechanics — what changes, what stands, satisfiability

**Changes (only under the approach Julie adopts):**

- *Approach 2:* the relabeling of §8.1 (proposal §5.5, Amendment 1
  §5, Amendment 2 §5.1's enforcement language superseded by this
  resolution §§4, 8); the exposure paragraph §8.3 becomes part of
  the Gate 4 GO presentation. **No change to the four-mutation
  budget**, the sub-gates, or any procedure.
- *Approach 1:* the §7 build, review, and deploy sequence runs
  first, under its own gates; Gate 4's paperwork is then
  re-verified against the new build; Gate 4's mutation budget
  becomes **6** (+ open, + close), identified here as Rowan
  required. The 600,000 figure is then described exactly as §7.4
  states — never as an unconditional cap.

**Stands unchanged:** the proposal's scope, census, and STOP law;
Amendment 1 in full (A1–A3, A5, A6 as amended); Amendment 2's R2
sliding window, R3 five-leg proof and read-order protocol, R4
successor verification; the end-HELD closing sequence; the
four-mutation budget (except as Approach 1 §7.5 revises it, if
adopted); the phase fence and quota guard as shipped.

**Satisfiability.** R1 is answered under both of Rowan's permitted
forms: the enforcement form is designed to the strongest guarantee
the architecture admits, with its irreducible term named (§7.4);
the detection form is specified with its exposure stated in the
words Julie will decide on (§8.3). The one point that cannot be
satisfied by anyone is a literally unconditional hard cap from
pre-dispatch machinery — stated, not papered over. One question
rides with this filing: **R3's unstated condition** (§2).
