# QUOTA ADDENDUM — Amendment to QUOTA-PROPOSAL.md

**Status: DESIGN ONLY — an amendment, not a rewrite.**
`QUOTA-PROPOSAL.md` (same folder) is preserved unchanged; this
addendum amends it at the points named in §0 and supersedes the
proposal only where the two conflict. It answers Rowan's
DESIGN HOLD on the quota proposal (issue #15, comment
6544821907): five points — reservation ownership/idempotence,
PT-day rollover, bootstrap/rollback proof, true limit
provenance, and a tests specification.

**Two statements required up front:**

- **The quota design is design-only: it is unimplemented and
  untested.** The six regression tests in this package
  (`tests/remediation-cache-refresh.test.mjs`, BUILD-REPORT §4)
  test the Signature B cache fix only; none of them exercises
  any part of this quota design, and no quota result may be
  inferred from them.
- **Any quota-code build requires Julie's separate explicit
  authorization**, distinct from the cache-build approval
  already given — and, after that, the standing separate gates
  for review, deploy, and arming. This document authorizes
  nothing.

Conclusions are labeled **CONFIRMED** (source-cited),
**INFERRED** (reasoning shown), or **OPEN** (not established).
Source citations are to this package's tree
(`~/workspace/ch2-program/remediation/worker-build/worker/`),
byte-identical to the deployed floor build `6a73d962…` except
for the two cache-patch files named in BUILD-REPORT §2.

---

## 0. What this addendum changes in the proposal

| Proposal text | Amendment |
|---|---|
| §2 presents "Gemini Tier 1: 100 requests/day" as the provider-enforced quota | **Superseded by §4 below**: the 100/day figure is relabeled an **app-selected conservative cap**; no proven Google limit is asserted |
| §3.2.1 offers a day-counter table as primary, a `dispatched_day_key` column as fallback, and leaves the choice open (Open Question 1) | **Resolved in §1**: Rowan's preferred direction is adopted — a durable per-dispatch budget ledger stamped with the dispatch day and linked to the attempt log, **plus** a separate auditable outstanding-grant-reservation ledger. A summary counter, if kept at all, is a derived cache that must reconcile to those records (§1.4) |
| §3.2.2–§3.2.4 specifies reservation points and a release rule but no durable reservation identity, no per-reservation state, and no replay/rollover semantics | **Completed in §1 and §2**: durable identity, per-reservation state and remaining slots, a single-release fence, and defined behavior for replay, multiple grants, aborts, parks, halts, retries, recovery, and crash/restart |
| §3.4 floats a realized-multiplicity refinement (reserve `ceil(targets × 6)`) | **Not adopted.** The worst-case ×12 reservation of §3.2.2 stays exactly as proposed; §3.4 remains a non-adopted discussion note and may not be cited as the design |
| §6 says first-day seeding derives the count from that day's dispatched rows, and that rollback to `6a73d962…` is "safe with respect to the counter" | **Amended in §3**: exact day assignment is possible only for a defined subset of rows; unassignable rows refuse/hold, never guess. And stated plainly: **the floor build does not enforce the new quota at all** — rollback safety comes from halt + pause holds, not from the floor |

Everything else in the proposal — the gap analysis (§1), the
fail-closed principle (§3.1, §4), the interaction rules (§5),
the additive-only migration discipline (§6) — stands as
written, as amended above.

---

## 1. Reservation ownership and idempotence (Rowan point 1)

### 1.1 The two durable ledgers

**Design (new; no code exists).** Two additive tables in the
coordinator's SQLite store, shipped through the same guarded,
DDL-only, idempotent bootstrap pattern as
`worker/generation/gen-schema.mjs` (**CONFIRMED**: that file's
header and `ensureGenSchema` establish the pattern — CREATE IF
NOT EXISTS plus guarded ALTERs, no reads at bootstrap, rows
never touched):

**(a) Per-dispatch budget ledger** — one row per provider call
that actually began dispatch:

```
d6_provider_dispatches (
  attempt_id TEXT PRIMARY KEY,        -- the attempt log's own identity
  grant_id TEXT NOT NULL,
  occurrence_id TEXT NOT NULL,
  plan_id TEXT, execution_id TEXT NOT NULL,
  dispatch_day_key TEXT NOT NULL,     -- dayKeyPT at the dispatch moment
  dispatched_at INTEGER NOT NULL)
```

The row is written **inside the `markDispatching`
transaction**, atomically with the attempt's phase transition.
That seam is complete by construction: **CONFIRMED** —
`markDispatching` is "the ONLY path that may precede a
provider call" (`worker/generation/genstore.mjs` header,
L8–11; the transition itself at L150–157), and the executor's
single `wrappedSynthesize` is its only caller path — reserve →
`markDispatching` → provider call → confirm
(`worker/generation/d6-executor.mjs` L486–510). A dispatch-ledger
row therefore exists **iff** a call was dispatched, exactly
once per attempt (PRIMARY KEY on `attempt_id`; a duplicate or
out-of-order `markDispatching` already throws
`illegal_attempt_transition` in the base code, genstore
L153–154, before any ledger write can repeat).

**(b) Outstanding-grant-reservation ledger** — one row per
(grants, occurrence, day) reservation created at grant time:

```
d6_grant_reservations (
  reservation_id TEXT PRIMARY KEY,    -- §1.2
  grant_id TEXT NOT NULL, occurrence_id TEXT NOT NULL,
  plan_id TEXT, job_id TEXT NOT NULL,
  day_key TEXT NOT NULL,              -- the day this reservation authorizes
  slots_total INTEGER NOT NULL,       -- §1.3
  slots_consumed INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL,                -- open | closed
  close_reason TEXT,                  -- §1.5 vocabulary
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)
```

`slots_consumed` is not an independent counter: it is
incremented only inside the same `markDispatching`
transaction that writes the dispatch-ledger row, by joining
the attempt → execution → grant chain (**CONFIRMED**: the
execution record carries `grant_id` —
`worker/generation/gen-schema.mjs` L51–56 — and the attempt
row carries `execution_id`, L57–62). At every instant,
`slots_consumed` must equal the count of dispatch-ledger rows
for that reservation's attempts; §1.4 makes that a checked
invariant, not a hope.

### 1.2 Durable reservation identity

**CONFIRMED (base facts the identity builds on):** grant ids
are already deterministic —
``grant:${jobId}:${job.revision}:${probe ? "probe" : "full"}``
(`worker/coordinator.mjs` L1666) — and a duplicate grant is
refused `grant_exists` (L1667–1668). The grant ledger already
keys its per-occurrence rows idempotently as
`op:${grantId}:${occurrenceId}` (PRIMARY KEY `op_key`,
schema L169–172; insert at L1675).

**Design:** the reservation identity is

```
reservation_id = `qres:${grantId}:${occurrenceId}:${day_key}`
```

— deterministic, derived only from durable facts, and safe to
re-attempt: re-inserting an existing `reservation_id` is a
no-op read of the existing row (the same existence-guarded
insert pattern the base code uses for exactly-once release
rows: `rel:${op_key}` is inserted only if absent,
coordinator.mjs L1912–1919). Two reservations for the same
occurrence under *different grants* (a repair follow-on is a
new grant — **CONFIRMED**: `_issueGrant(... cause:
"repair_chain")`, coordinator.mjs L2102) or on *different
days* (§2 re-reservation) are different identities and never
alias.

### 1.3 Slots per reservation — the ×12 worst case, kept

**Design:** at grant time, inside the existing `_issueGrant`
transaction (**CONFIRMED**: one `this._tx(...)` spanning the
park check, quota check, cap check, D6 guard, grant insert,
ledger inserts, and outbox insert — coordinator.mjs
L1631–1703), each target occurrence gets one reservation with

```
slots_total = SEGMENT_ATTEMPT_BUDGET − segmentAttemptsUsed(planId, occurrenceId)
```

where `SEGMENT_ATTEMPT_BUDGET = 12` (**CONFIRMED**:
`worker/generation/gen-constants.mjs` L16) and
`segmentAttemptsUsed` counts the occurrence's dispatching +
confirmed attempts across its whole split/repair history
(**CONFIRMED**: genstore.mjs L212–217). For a fresh occurrence
this is the full worst-case **12 — the ×12 reservation of the
proposal §3.2.2 is not weakened** (and the §3.4 ×6 idea is not
adopted, §0). For a repair grant on an already-attempted
occurrence it reserves only the segment budget that actually
remains, so two grants for one occurrence can never jointly
reserve more than the 12 the segment ceiling already enforces.
The grant is refused with the proposal's named reason
(`provider_attempt_budget`) if
`dispatched(day) + Σ remaining slots of open reservations(day) + Σ new slots_total > PROVIDER_ATTEMPT_DAILY_LIMIT`,
all computed inside the same transaction — so two grant
transactions cannot both pass against the same headroom
(the coordinator's transactions serialize; the check and the
inserts are one atomic unit, exactly as the existing
`attempts + targets.length > DAILY_QUOTA_LIMIT` check is,
coordinator.mjs L1663).

### 1.4 One reconciled total

**Design:** there is exactly one definition of the day's
consumption, and every surface must agree with it:

```
dispatched(day)   = COUNT(d6_provider_dispatches WHERE dispatch_day_key = day)
reserved(day)     = Σ (slots_total − slots_consumed)
                    over d6_grant_reservations
                    WHERE day_key = day AND state = 'open'
consumed(day)     = dispatched(day) + reserved(day)
```

If an O(1) summary counter is kept for the grant-time check,
it is a **cache of these two queries, never a source of
truth**: the grant and dispatch transactions verify the cache
against the derived totals for the affected day before
relying on it, and any mismatch refuses with a named reason
(`provider_attempt_budget_counter_drift`) — the shape-fence
discipline of `d6PhaseBudgetCheck`, which refuses
`phase_accounting_incomplete` rather than coercing an absent
value to 0 (**CONFIRMED**:
`worker/generation/grant-guards.mjs` L108–114). Diagnostics
reports both ledgers' figures and any drift as a visible
discrepancy, in the spirit of the proposal §3.2.4's
unreleased-reservation figure — which under this design is
simply `reserved(day)` for past days, enumerable row by row.

### 1.5 Who consumes, who retains, who releases — the scenario table

**Release fence (design):** a reservation's slots are released
**only** by its transition `open → closed`, performed by a
single function, guarded by the row's current state (a second
release attempt is a no-op/refusal, never a second credit —
the `rel:` existence-guard pattern, coordinator.mjs
L1912–1919, applied to reservation state). A reservation may
close only when dispatch under it has become **impossible or
complete**, per the close reasons below; closing never deletes
the row. A reservation **must not** close while any execution
under its grant for its occurrence is non-terminal — that is
a checked invariant at close time.

| Scenario | Consumption / retention rule |
|---|---|
| **Grant replay** (same command/grant re-presented) | Base behavior already refuses the duplicate grant (`grant_exists`, coordinator.mjs L1667–1668) inside the transaction, so no second reservation can be created; if a reservation insert is ever re-attempted under an existing identity, §1.2 makes it a no-op. **Zero double-count by construction.** |
| **Multiple grants** (different jobs/plans, same day) | Each grant's reservations are independent identities (§1.2); the shared constraint is only the day total (§1.3 check), evaluated atomically per grant transaction. No grant can consume another's slots: `slots_consumed` moves only via a dispatch whose execution belongs to that grant. |
| **Aborted message** (executor stops mid-message — quota stop, unknown stop, terminal block) | Attempts already dispatching/confirmed keep their dispatch-ledger rows forever. Attempts still `reserved` are released by the existing path (**CONFIRMED**: recovery releases reserved attempts of an attempted execution, `d6-executor.mjs` L423–424; `releaseAttempt` is legal only from `reserved`, genstore.mjs L187–196). The occurrence's grant reservation stays **open** — the grant is still live and a re-drive may still dispatch under it — until the grant itself settles (below). No slot is freed merely because a message ended. |
| **Known quota park** (provider 429 → execution fails at stage `quota`, plan parks `paused_quota`; **CONFIRMED**: `d6-executor.mjs` L538–545, and the park is recorded in `quota_parks`, coordinator.mjs L2031, with grants refused `quota_parked` while a park is open, L1639–1640) | The dispatched call counts (it happened). When the park is recorded, the parked grant's still-open reservations are closed with `close_reason = 'quota_park'` — dispatch under that grant is impossible while parked, and a resume proceeds by probe → a **new** grant (job revision has advanced) with **new** reservations against the resume day. Closing at park time is what prevents the parked grant and its successor from double-holding the same occurrences. |
| **Unknown-billing halt** (non-HTTP throw → attempt confirmed `unknown` at cost null, phase halts; **CONFIRMED**: `d6-executor.mjs` L503–507 and L552–560; genstore `markUnknownBilling`) | The dispatched attempt counts against its day **permanently** — dispatch began, so the daily hard limit counts it (§5). The plan's other open reservations are **frozen, not released**: they retain ownership (visible in diagnostics under the halted phase) but authorize nothing while the halt stands, because no grant or dispatch path runs for a halted phase. On adjudication/retirement settling the halt, each frozen reservation is closed with `close_reason = 'halt_settled'` as an accounting closure — dispatch by then is impossible (plan terminal/retired), which is the proof the release fence requires. No reservation is ever released *into* spendability by a halt. |
| **Retries** (repair chains: retryable known failures re-granted as follow-on jobs) | A repair is a **new grant** (coordinator.mjs L2102) and takes a **new reservation** whose `slots_total` is the segment budget *remaining* (§1.3) — so retries consume the same shared 12, never a fresh 12. The original grant's reservation closes when its own executions are terminal (`close_reason = 'grant_settled'`). |
| **Execution recovery** (service/executor re-drive) | Intent recovery and reverify-and-commit make **zero** provider calls (**CONFIRMED**: diagnosis §0/§2.2; `recoverExecution`, `d6-executor.mjs` L405–431) and consume **zero** slots. A recovery that resumes synthesis for a `granted` execution dispatches under the **original** grant's still-open reservation — ownership flows from the execution record's stored `grant_id` (gen-schema.mjs L53). If that reservation is found closed while the execution is non-terminal, recovery **fails closed** (that state is unreachable if the §1.5 close invariant holds, and reaching it is a loud defect, not a cue to mint a new reservation). |
| **Crash / restart** (DO eviction or process death at any point) | All quota state is durable SQLite rows; nothing lives in memory across invocations (the R2 snapshot cache is request-scoped and irrelevant here). The atomicity seam decides every crash window: crash **before** the `markDispatching` transaction commits ⇒ attempt still `reserved`, no dispatch-ledger row, slot still reserved, and the provider was provably not called (the call only follows the commit). Crash **after** it commits ⇒ dispatch-ledger row exists and the slot is consumed, whether or not the provider call completed — the conservative direction, matching "attempts that were actually sent keep counting" (coordinator.mjs L1855–1859 comment on the grant ledger). An attempt left in `dispatching` phase is treated as dispatched forever (recovery already holds such executions for reconciliation rather than releasing them — **CONFIRMED**: `d6-executor.mjs` L414–417). |

---

## 2. PT day rollover (Rowan point 2)

**CONFIRMED (the hazard is real in the base mechanics):**
`dayKeyPT(nowMs)` keys everything to a Pacific-Time day
(`worker/coordinator.mjs` L326–333). A grant is stamped with
the day in force at grant time (the ledger rows take `day`
from the grant transaction, L1642, L1675), but dispatch
happens later, in a different invocation, under no day check
at all — `markDispatching` today checks only the attempt's
phase (genstore.mjs L150–157). A grant issued at 23:5x PT
whose message is delivered or re-driven after midnight PT
would, under the proposal as written, dispatch against
yesterday's reservation. That is exactly the silent transfer
Rowan forbids.

**Design — re-reservation at the dispatch seam:**

1. Every reservation authorizes dispatches **only on its own
   `day_key`** (§1.1b). There is no transfer: a day-D
   reservation's remaining slots are never spendable on D+1,
   and they continue to count in `reserved(D)`'s historical
   total until closed.
2. Inside the `markDispatching` transaction — before the
   phase transition and before any provider call — the
   dispatcher computes `dispatchDay = dayKeyPT(now)` and
   checks the attempt's reservation:
   - reservation `day_key == dispatchDay` and reservation
     open ⇒ proceed (consume one slot, write the
     dispatch-ledger row stamped `dispatchDay`).
   - reservation `day_key != dispatchDay`, or reservation
     closed ⇒ **atomic re-reservation in the same
     transaction**: verify/create the reservation identity
     `qres:${grantId}:${occurrenceId}:${dispatchDay}`
     (§1.2 — re-running this step is idempotent), with
     `slots_total` = the occurrence's remaining segment
     budget (§1.3 formula, recomputed now); run the §1.3 day
     check against `dispatchDay`; only if it passes, consume
     one slot from the **new** reservation and stamp the
     dispatch row with `dispatchDay`.
   - If the D+1 check fails (budget exhausted or accounting
     incomplete/drifted) ⇒ `markDispatching` **refuses** with
     a named reason (`provider_attempt_budget_day_rollover`),
     the attempt stays `reserved` (provably never dispatched,
     releasable by the existing path), and the executor
     surfaces the existing quota-park shape (proposal §4) —
     the plan parks on quota; it does not fail the occurrence
     and it does not dispatch.
3. **No double count, no lost ownership:** the D reservation
   is *not* debited for a D+1 dispatch (its `slots_consumed`
   is untouched; the dispatch-ledger row names the D+1
   reservation's grant/occurrence/day), and the D reservation
   is not silently closed either — it closes later by the
   normal §1.5 rules for its own grant (settled / park /
   halt), with its remaining slots still visible in
   `reserved(D)` until then. The occurrence is thus accounted
   under exactly one reservation per dispatch, and each day's
   total (§1.4) is derivable from unique rows.
4. **In-progress split/repair across midnight:** a split tree
   is not one dispatch but one `wrappedSynthesize` per leaf
   (**CONFIRMED**: `d6-executor.mjs` L486, called per part by
   `synthesizeSegment` / `synthesizeLongSegment`, L528–529),
   so the rollover rule applies **per leaf call**, at its own
   dispatch moment: leaves dispatched before midnight PT
   count against D under the original reservation; the first
   leaf after midnight triggers the one atomic re-reservation
   to D+1, and later leaves consume that same D+1 reservation
   (identity already exists ⇒ §1.2 no-op). A repair chain that
   resumes on D+1 normally arrives under a new follow-on grant
   stamped D+1 anyway (§1.5); if a stale grant's message is
   what straddles midnight, the re-reservation path — not the
   stale stamp — is the only way any of its calls dispatch.

---

## 3. Bootstrap and rollback proof (Rowan point 3)

### 3.1 What timestamp evidence actually exists

**CONFIRMED — the attempt log has exactly two timestamps, and
neither is a dispatch timestamp.** `d6_attempt_log` carries
`created_at` and `updated_at` and no `dispatched_at` column
(`worker/generation/gen-schema.mjs` L57–62). Their write
semantics, from genstore.mjs:

- `created_at` is set once, at `reserveAttempt` (L139–146) —
  it is the **reservation** time, before dispatch.
- `updated_at` is overwritten at **every** transition:
  `markDispatching` (L155), `confirmAttempt` (L176–178), and
  again later if the row is ever reconciled
  (`reconcileUnknown`, L520) or adjudicated
  (`adjudicateEstimated`, L758). Rowan's flag is correct: for
  a confirmed row, `updated_at` is (at best) the confirmation
  time, and after any later disposition it is the disposition
  time. It never durably holds the dispatch moment.
- No auxiliary evidence fills the gap: `provider_request_id`
  is recorded only when the provider returns one the executor
  passes through, and is explicitly **null** for policy_block,
  failed_known, and unknown outcomes (**CONFIRMED**:
  `d6-executor.mjs` L500–507); `detail_json` on attempt rows
  is not written by the reserve/dispatch/confirm path.

**INFERRED (tight but not proof):** in the live flow,
`markDispatching` is the *immediately following* await after
`reserveAttempt` in `wrappedSynthesize` (L487–489), so for an
undisturbed row the dispatch moment lies in the interval
`[created_at, updated_at]`, normally seconds wide. An interval
is evidence only when it does not straddle a boundary; the
bootstrap rule below uses exactly that, and nothing stronger.

### 3.2 The exact-assignment rule (migration)

**Design:** the guarded-build migration adds
`dispatched_day_key` to `d6_attempt_log` (guarded ALTER, the
gen-schema evolution pattern) and backfills it in **one
transaction**, idempotently (only rows where the column is
still NULL are considered; re-running changes nothing). For
each existing row:

| Row phase | Assignment |
|---|---|
| `reserved` or `released` | Never dispatched (**CONFIRMED**: genstore.mjs header L8–11; `releaseAttempt` L187–196). `dispatched_day_key` stays NULL — correctly, forever. |
| `dispatching` (still in flight at migration) | `updated_at` **is** the dispatch moment: while a row is in this phase, the only write since creation is `markDispatching` itself (L155); confirm/reconcile/adjudicate all require or produce other phases. Assign `dayKeyPT(updated_at)` — **exact**. |
| `confirmed`, and `dayKeyPT(created_at) == dayKeyPT(updated_at)` | Dispatch ∈ `[created_at, updated_at]` (§3.1) lies wholly inside one PT day. Assign that day — **exact**. (This covers every Gate-8 row whose reserve→confirm interval sits inside 2026-10-31 PT, including rows later adjudicated, provided the whole interval — creation to *current* `updated_at` — is intra-day.) |
| `confirmed`, and the interval straddles a PT midnight | **Unassignable.** The dispatch may have occurred on either side of midnight, and `updated_at` may since have been overwritten by a disposition. The row is written to a bootstrap-exceptions list (attempt id, interval, current phase/outcome) and `dispatched_day_key` stays NULL. **Never guess, never split the difference, never assign it to the grant's day** (the grant day is the *ledger* day, not evidence about this call). |

**Fail-closed consequence:** if any exception row's interval
includes **the current PT day**, or the derivation itself
cannot be performed completely (missing table, SQL error,
malformed row), the current day's budget starts **refused** —
grants and dispatches refuse with a named reason
(`provider_attempt_budget_bootstrap_incomplete`) — until the
exceptions are dispositioned by a reviewed, auditable
operator action. Exceptions confined to *past* days do not
block the current day (past-day totals no longer gate
anything), but they are reported in diagnostics permanently:
those days' provider-call totals are labeled **partially
unprovable**, not silently rounded to the assignable count.
This replaces the proposal §6 "first-day seeding" paragraph,
whose "derivation over that day's already-dispatched rows"
assumed a derivation that §3.1 shows is only sometimes exact.

### 3.3 Rollback to the floor build `6a73d962…`

**CONFIRMED / stated plainly:** the floor build contains no
part of this design. Its only daily gate is the grant ledger
(`_attemptsOn`, coordinator.mjs L1860–1865, against
`DAILY_QUOTA_LIMIT`); it never reads the dispatch or
reservation ledgers. **The old floor does NOT enforce the new
quota.** The proposal §6 sentence calling rollback "safe with
respect to the counter" is amended: rollback is safe only
because of the operational holds, not because of anything the
floor build does.

**Design (rollback / re-arm rule):**

1. Rollback to `6a73d962…` happens only under the standing
   pre-holds — **generation halted and queue paused, verified
   before the rollback begins** — and both holds **remain in
   force for the entire time the floor build is live**. While
   halted and paused, the floor build cannot dispatch (that
   is the property relied on, and the only one).
2. If either hold cannot be verified in force, the rollback
   itself is refused. There is no state in this design where
   the floor build runs with generation armed.
3. The new ledgers' data is untouched by the floor build
   (additive tables/column it never references — the same
   property the proposal §6 relied on, restated accurately:
   the data survives; the *enforcement* does not).
4. **Re-arm requires the guarded build restored first**, then
   a reconciliation pass before any grant: recompute
   `dispatched(day)` and `reserved(day)` from the ledgers
   (§1.4), re-run the §3.2 assignment for any rows created
   since (there should be none — the holds were in force —
   and any that exist are treated as bootstrap exceptions),
   and verify no drift. Any exception touching the current
   day, or any drift, keeps generation **halted** until
   dispositioned. Only after a clean reconciliation may the
   separate, Julie-gated re-arm decision proceed.

---

## 4. True limit provenance (Rowan point 4)

**Amendment to proposal §2 and §3.3 — CONFIRMED as a
correction of our own text:** the proposal called 100/day
"Gemini Tier 1: 100 requests/day … provider-enforced". The
only in-repo support for that figure is our own code comment —
`DAILY_QUOTA_LIMIT = 100; // Gemini Tier 1 requests/day
(provider day, PT)` (`worker/coordinator.mjs` L142) — which is
an assertion we wrote, not evidence about Google. The
diagnosis §6.1 already flagged the same number doing double
duty; this addendum completes the correction:

- **`PROVIDER_ATTEMPT_DAILY_LIMIT = 100` is an APP-SELECTED
  conservative cap** — a number *we* chose, informed by
  Google's published tier material at design time, adopted as
  Reader policy. It is not a proven Google limit, and no
  document or surface may present it as one.
- **Google's actual limits are whatever Google currently
  enforces**: per Google's published rate-limits documentation
  (https://ai.google.dev/gemini-api/docs/rate-limits), limits
  are scoped to the **project**, vary by **model and tier**,
  may change, and the authoritative current values are those
  shown for the project in **AI Studio**. This design neither
  asserts nor depends on a specific provider number.
- **Usage outside Reader is invisible to this counter.** The
  dispatch ledger sees only calls made through the D6
  executor's `wrappedSynthesize`. Any other consumption of
  the same Google project — other tools, other workers,
  manual AI Studio use — is uncounted here by construction.
  Therefore even a perfectly enforced app cap of 100 proves
  only "Reader's D6 lane dispatched ≤ 100 today", never
  "the project stayed under Google's limit". Diagnostics and
  the Settings quota view must label the figure exactly that
  way ("Reader D6 provider requests today, app-counted"),
  alongside — never merged with — "grants today".
- **The provider 429 remains the external final backstop** —
  the signal that the *project's* real limit, whatever it is,
  was reached — and it keeps today's handling (attempt
  confirmed `failed_known` at cost 0, execution failed at
  stage `quota`, plan parks `paused_quota`). It is a backstop,
  not evidence that the app ceiling is correct, complete, or
  "provider-perfect"; the proposal §4 sentence framing the
  two brakes as equivalent operator outcomes stands, but
  neither brake validates the other.
- The PT day key is retained as **app convention**, not as a
  claim about Google's accounting: `dayKeyPT`'s own comment
  says the quota day is a Pacific-Time day "v1 semantics"
  (coordinator.mjs L326–327) — a convention we keep because a
  conservative cap needs *some* fixed day, and PT is the one
  the codebase already uses consistently.

---

## 5. Tests specification (Rowan point 5) — design only

**No test below exists.** This section specifies what a
future, separately authorized quota build must prove; writing
it here is not implementation, and the six cache tests in
this package cover none of it (§0). All specified tests are
deterministic: injected clock (the day functions already take
`nowMs` — `dayKeyPT(nowMs)`, coordinator.mjs L326; the
coordinator's `this._now()` is the single time seam,
L1642), in-memory SQL/bucket/provider fakes of the shapes the
tree's suites already use, zero real provider calls.

**Counting rules the tests must pin (stated once, normatively):**

- The daily hard limit counts **every request once dispatch
  began** — success, **POLICY_BLOCK**, failed_known, provider
  429, and **transport-unknown** outcomes alike. (POLICY_BLOCK
  and unknown outcomes are confirmed *after* `markDispatching`
  in the base flow — **CONFIRMED**: `d6-executor.mjs`
  L500–507 — so both are post-dispatch by construction.)
- A `reserved` attempt that is released without dispatching
  counts **zero**, forever.
- The grant-time reservation is the **worst-case ×12** per
  fresh occurrence (minus segment attempts already used,
  §1.3). It is not weakened to ×6 or any realized factor.

| # | Test (specified) | Must prove |
|---|---|---|
| T1 | **Parallel grant transactions** — two grants for different jobs racing the same day with combined demand > limit | Transactions serialize; exactly one passes the §1.3 check; the other refuses `provider_attempt_budget`; no partial reservation rows exist for the refused grant; derived totals (§1.4) equal the ledgers exactly |
| T2 | **Duplicate / out-of-order `markDispatching`** — same attempt dispatched twice; confirm attempted before dispatch; dispatch attempted on a released attempt | Second dispatch throws `illegal_attempt_transition` and writes **no** second dispatch-ledger row and consumes **no** second slot; out-of-order transitions throw and consume nothing |
| T3 | **First-day unknown counts** — bootstrap over a fixture log containing a midnight-straddling confirmed row whose interval includes the current day | The row lands in bootstrap exceptions, `dispatched_day_key` stays NULL, and the current day starts **refused** (`provider_attempt_budget_bootstrap_incomplete`); a fixture whose straddle is confined to a past day bootstraps clean with the exception reported |
| T4 | **Quota exhaustion mid-split** — a segment whose leaf *k* of *n* reaches the daily limit | Leaves after *k* are **never dispatched** (provider fake sees exactly *k* calls); already-dispatched leaves keep their confirmed outcomes; the plan takes the quota-park shape; the undispatched attempts are released and the reservation's remaining slots are freed exactly once |
| T5 | **Known and unknown provider outcomes** — one occurrence each ending success / policy_block / failed_known / 429 / transport-unknown | Each consumes **exactly one** dispatch-ledger row and one slot, permanently; the unknown outcome still halts the phase (billing behavior untouched) while its slot stays consumed; a released-without-dispatch attempt consumes zero |
| T6 | **Cross-day continuation** — grant issued day D, message delivered D+1 (injected clock), incl. a split tree straddling midnight leaf-by-leaf | No dispatch occurs under the D reservation on D+1; the first D+1 dispatch atomically re-reserves (§2) and is stamped D+1; pre-midnight leaves are stamped D; with D+1 budget exhausted, dispatch refuses, the attempt stays `reserved`, and the plan parks — **zero** provider calls made on stale authority |
| T7 | **Orphaned reservations** — grant voided before dispatch; message aborted after grant; crash simulated between grant and dispatch, and between `markDispatching` commit and provider return | Void/abort paths close or release exactly once (second release is a no-op); the pre-dispatch crash leaves the slot reserved-and-visible until grant settlement, never silently dropped; the post-dispatch crash leaves the slot **consumed**; diagnostics enumerates every orphan by identity |
| T8 | **Rollback / re-arm** — ledgers populated, then floor-build semantics applied (no quota reads), then guarded build restored | Under halt + pause, no dispatch occurs on the floor; on restoration, reconciliation (§3.3.4) reproduces the pre-rollback totals exactly or keeps generation halted on any drift/current-day exception; re-arm without reconciliation is impossible |

Harness caveat, carried from the diagnosis and BUILD-REPORT
§6: these tests, when eventually written, are DO-harness
evidence. This tree's harness implements the throwing `.one()`
semantics, but harness-green is still not a production smoke;
any staging/provider-facing verification is its own gate.

---

## 6. Status and open items

- **CONFIRMED:** the base mechanics cited throughout —
  deterministic grant ids and duplicate refusal, the
  transactional grant, the grant-ledger quota, the attempt
  lifecycle and its two timestamps, `markDispatching` as the
  sole pre-call seam, the 12-attempt segment budget, the
  quota-park shape, and recovery's zero-call commits — are
  as the cited source reads.
- **INFERRED:** the bootstrap interval argument (§3.1–§3.2)
  — that dispatch lies in `[created_at, updated_at]` for an
  undisturbed row follows from the sequential awaits in
  `wrappedSynthesize`; the design deliberately treats it as
  evidence only when the interval is intra-day.
- **OPEN:** (i) whether Rowan prefers the §1.4 derived-total
  check on every grant/dispatch transaction or a verified
  cache with periodic reconciliation — the design takes the
  stricter option and flags the cost as hers to judge;
  (ii) the operator disposition path for bootstrap exceptions
  (what evidence could ever settle a straddled row's day —
  possibly none, in which case the exception is permanent and
  only its *blocking* effect expires with its day);
  (iii) whether `PROVIDER_ATTEMPT_DAILY_LIMIT` should be a
  pinned constant or a settings value (proposal Open Question
  4, unchanged by this addendum — but under §4 it is now
  unambiguously an *app policy* value either way).

— Wren (design only; amends QUOTA-PROPOSAL.md; no code
changed, nothing built, deployed, posted, or pinned by this
document)
