# QUOTA PROPOSAL — Provider-Attempt Budgeting for D6 Generation

**Status: DESIGN ONLY. No code is changed by this document, and
nothing in it is built, deployed, or armed.** It answers the
Gate-8 reliability diagnosis §6.1 finding and Rowan's review
condition (issue #15, comment 6544587753): before any further
generation is proposed, file a fail-closed provider-attempt
budgeting design — or a demonstrably conservative per-run limit —
identifying which quotas are provider-enforced and which are app
policy, so the system never relies on a provider 429 as the sole
brake against exceeding the intended request cap.

All source citations are to the deployed build `6a73d962…` tree
(`~/workspace/ch2-program/disposition/worker-build/`), which is
also this package's base tree and the standing **rollback floor**.

---

## 1. The gap, stated exactly

Two different counters exist today, and only one of them gates:

| Counter | What it counts | Where | Gates? |
|---|---|---|---|
| Grant ledger | One `ledger_ops` row of kind `attempt` per **granted occurrence**, minus `attempt_release` rows for provably-unsent voids | `worker/coordinator.mjs`: `DAILY_QUOTA_LIMIT = 100` (L142), `_attemptsOn(day)` (L1860–1865), written in `_issueGrant` (L1671–1693), checked at L1643–1644 and L1663 | **Yes** — grant refusal `quota_estimate_exhausted` |
| Provider attempt log | One `d6_attempt_log` row per **actual provider call** (reserved → dispatching → confirmed), including every POLICY_BLOCK split leaf and every repair retry | `worker/generation/genstore.mjs`: `reserveAttempt` / `markDispatching` / `confirmAttempt`; budget read `segmentAttemptsUsed` | **No** — it enforces only the per-segment ceiling (below), never a daily total |

Per-occurrence call multiplicity is by design: a segment may make
up to `SEGMENT_ATTEMPT_BUDGET = 12` provider calls across its
POLICY_BLOCK split tree and repair chain
(`worker/generation/gen-constants.mjs` L16; split ceilings at
L13–15: depth ≤ 4, ≤ 16 leaf parts, 50-char floor;
`REPAIR_MAX_RETRIES = 3`, L19).

Measured consequence (Gate-8 run, 2026-10-31): **18 grants →
79 provider attempts** (57 success + 22 policy_block), a realized
multiplicity of ≈ 4.4×. At the theoretical ceiling, 100 granted
occurrences in one PT day could produce up to ~1,200 provider
calls. The grant counter would read exactly 100 the whole time.

## 2. Which quotas are whose

**Provider-enforced (Google, outside our control):**

- **Gemini Tier 1: 100 requests/day** for the TTS model in use,
  on Google's day boundary. The codebase already treats the
  provider day as a **Pacific-Time day**: `dayKeyPT`
  (`worker/coordinator.mjs` L326–333, "Gemini's quota day is a
  Pacific-Time day"), and the grant counter keys on the same
  `dayKeyPT`. Enforcement on Google's side is a rejection
  (HTTP 429), which the executor classifies `quotaExceeded`
  (`worker/generation/d6-executor.mjs`, quota branch: attempt
  confirmed `failed_known` at cost 0, execution failed at stage
  `quota`, plan parks `paused_quota`).
- The paid prepay balance is a second hard provider-side limit:
  when it is exhausted, calls fail regardless of any counter.
  It is a *funding* limit, not a request quota, and this design
  does not treat it as one.

**App policy (ours, currently):**

- The grant counter's `DAILY_QUOTA_LIMIT = 100` — an
  occurrence-count policy that happens to share the number 100
  with the provider quota. It is an **estimate discipline**
  (grant-time flat `estMicroCents` debits share the same ledger),
  not a measurement of provider requests.
- `SEGMENT_ATTEMPT_BUDGET = 12` per occurrence (split + repair).
- The $50 monthly settings cap (`_issueGrant` cap check) and the
  **phase budget** ($13.50 = 13,500,000 micro-cents for
  `forever-pucked`, `PHASE_BUDGET_MICRO_CENTS`, gen-constants
  L47–49), enforced in the grant guard
  (`worker/generation/grant-guards.mjs`: settled + reserved
  unverified + in-flight uppers + this grant's pending uppers >
  budget ⇒ refuse `phase_budget`, shape-fenced by
  `d6PhaseBudgetCheck`).
- The storage boundary guard (10 GB R2 free tier, same file).

**The design problem in one line:** the number the provider
enforces (requests/day) is not the number the app counts
(grants/day), and nothing app-side counts requests *before*
dispatch — the attempt log records them, after the fact, for
accounting and the per-segment ceiling only.

## 3. Design: a provider-attempt budget, reserved before dispatch

### 3.1 Principle

Every provider call must hold a **durable, day-keyed reservation
before it is dispatched**, in the same store that already owns
the attempt log, and the reservation check must **fail closed**:
any inability to prove remaining budget — missing table, SQL
error, malformed counter row, clock/day-key uncertainty — is a
refusal, never a pass. This mirrors the standing disciplines in
this codebase: the disposition guard's shape fence (absent
accounting is `phase_accounting_incomplete`, never coerced to
0), the executor fence's strict reads (a database fault never
reads as an all-clear), and the seed's zero-tolerance recount.

### 3.2 Where attempts are counted

Add the count to the **attempt log's own lifecycle**, which is
already the exactly-once seam for provider calls
(`worker/generation/d6-executor.mjs` `wrappedSynthesize`:
reserve → dispatching → provider call → confirm):

1. **New durable counter**, one row per PT day, in the
  coordinator's SQLite store (alongside `d6_attempt_log`, via
  the same additive, DDL-only, idempotent bootstrap pattern as
  `worker/generation/gen-schema.mjs` — see §6):
   `d6_provider_attempt_budget (day_key TEXT PRIMARY KEY,
   reserved INTEGER NOT NULL, dispatched INTEGER NOT NULL,
   updated_at INTEGER NOT NULL)`.
   Design alternative Rowan may prefer: derive the count from
   `d6_attempt_log` with a new explicit `dispatched_day_key`
   column stamped at `markDispatching` (the log's `created_at` /
   `updated_at` cannot serve: `updated_at` moves again at
   confirm, and a reserved-but-never-dispatched row must not
   count). The counter-table form is proposed as primary because
   the check must be O(1) inside the grant transaction and
   auditable independently of log retention; the column form is
   the fallback if a second source of truth is judged worse.
2. **Reservation point — grant time (outer bound).** In
   `_issueGrant`'s existing transaction, beside the grant-ledger
   write, compute the grant's worst-case provider-call demand
   as `targets.length × SEGMENT_ATTEMPT_BUDGET` and refuse with
   a new named reason (e.g. `provider_attempt_budget`) if
   `dispatched_today + reserved_outstanding + demand >
   PROVIDER_ATTEMPT_DAILY_LIMIT`. This is deliberately
   conservative — it is the "demonstrably conservative per-run
   limit" fallback made structural: with the limit at 100, a
   single grant may cover at most 8 occurrences (8 × 12 = 96).
   §3.4 discusses relaxing this with realized-multiplicity
   evidence; the conservative form is the safe default.
3. **Reservation point — dispatch time (exact count).** In
   `markDispatching`'s transaction (genstore), increment the
   day counter's `dispatched` and decrement the occurrence's
   outstanding reservation **atomically with the phase
   transition to `dispatching`** — the exact moment a row starts
   representing a real provider call. If the increment would
   exceed the limit, `markDispatching` refuses and the attempt
   stays `reserved` (provably never dispatched; releasable by
   the existing `releaseAttempt` path). The executor already
   treats a pre-dispatch refusal as a non-billing outcome; the
   design adds a named quota-budget outcome that parks the plan
   on quota rather than failing the occurrence (see §4).
4. **Release discipline.** A reservation is released only on
   proof the call never dispatched — the same evidentiary bar
   as the grant ledger's `attempt_release` (provably-unsent
   voids only). A dispatched call counts against the day
   **forever**, whatever its outcome (success, policy_block,
   failed_known, unknown): Google counted the request too.
   Reservations for occurrences that never dispatch (plan
   parks, grant voids, message stop) are released when their
   executions/grants settle into a state where dispatch is
   impossible, by the same code paths that settle them today;
   any reservation whose owner cannot be accounted for at day
   rollover is **not** silently dropped — it is reported in
   diagnostics as an unreleased-reservation figure (a visible
   discrepancy, in the spirit of `provider_unverified`).

### 3.3 The limit value, and its name

`PROVIDER_ATTEMPT_DAILY_LIMIT` — proposed **100**, keyed by
`dayKeyPT`, living beside `DAILY_QUOTA_LIMIT` in
`worker/coordinator.mjs` with a comment stating plainly that
the two constants count different things (grants vs provider
requests) and that the provider value mirrors Google Tier 1's
published requests/day for the model in use. If Google's tier
or model changes, this constant — not the grant constant — is
the one that moves. Diagnostics and the Settings quota view
must label the two numbers distinctly (e.g. "grants today" vs
"provider requests today"), ending the side-by-side ambiguity
the diagnosis flagged in §7.3 of the diagnosis document.

### 3.4 Optional refinement (not in the base design)

The grant-time ×12 worst case caps grants at 8 occurrences/day,
which is far below the realized Gate-8 multiplicity (≈ 4.4×,
i.e. ~22 occurrences/day at 100 requests). A refinement could
reserve at grant time using a **reviewed multiplicity factor**
(e.g. reserve `ceil(targets × 6)` with the dispatch-time exact
count as the hard brake). This trades conservatism for
throughput and is **not** proposed for adoption without
Rowan's ruling and realized data across more runs; the
dispatch-time brake (§3.2.3) is load-bearing either way, and
the grant-time reservation exists to fail *early and cheaply*,
not to be the only enforcement.

## 4. Fail-closed behavior

- **Counter uncertainty ⇒ refusal.** Missing counter table
  (checked by presence, like the disposition's §5.4
  presence-checked reads), a non-integer or negative counter
  field, or any SQL error in the reservation transaction
  refuses the grant / the dispatch with a named reason. No
  path coerces an unreadable counter to 0.
- **Clock/day uncertainty ⇒ refusal.** If `dayKeyPT` cannot be
  computed (invalid clock), the reservation is refused rather
  than keyed to a guessed day. Day rollover mid-message: each
  dispatch reserves against the day in force *at its own
  dispatch moment*, so a message straddling the PT boundary
  splits its calls across two days exactly as Google does.
- **Reservation exhaustion mid-occurrence** (a split tree hits
  the daily limit on leaf *k* of *n*): the remaining leaves are
  never dispatched; the occurrence follows the existing
  quota-park shape — attempt(s) already dispatched keep their
  confirmed outcomes, the execution ends in the quota stage,
  the plan parks `paused_quota`, and the undispached
  reservations are released under §3.2.4's proof rule (they
  provably never dispatched). This reuses the executor's
  existing 429 handling shape so the two quota brakes — ours
  and Google's — produce the same operator-visible outcome.
  If Google's 429 still arrives first (e.g. another consumer
  of the same Google account spent the day), today's behavior
  is unchanged: `failed_known`, cost 0, park. Our brake makes
  that the rare path, not the only one.
- **Unknown billing is untouched.** A non-HTTP throw still
  confirms `unknown` at cost null and halts the phase; the
  dispatched counter keeps the call (Google was contacted),
  and no reservation logic ever resolves billing ambiguity.

## 5. Interaction with existing machinery

- **Grants.** The grant ledger (`ledger_ops` kind `attempt`)
  keeps its current meaning and its 100-grant check — it is
  the money-estimate discipline, and conflating the two
  counters again is the failure being fixed. The new grant-time
  check (§3.2.2) runs inside the same `_issueGrant` transaction
  and after the existing cap/D6-guard checks, so a refusal is
  atomic with the rest of the grant decision: no grant row, no
  outbox row, no ledger row exists for a refused grant.
- **Splits.** Recursive POLICY_BLOCK splitting is the main
  multiplicity source (Gate-8: most occurrences took 2–4
  success leaves plus zero-cost policy_block calls — note the
  provider counts policy_block responses as requests too, and
  so does this design: the counter increments at dispatch,
  before the outcome is known). `synthesizeSegment` /
  `synthesizeLongSegment` need no signature change: every leaf
  already flows through the executor's single
  `wrappedSynthesize`, which is the only caller of
  `reserveAttempt` / `markDispatching`.
- **Repair chains.** Repairs are new dispatches of the same
  occurrence under the shared 12-attempt segment budget
  (`segmentAttemptsUsed` counts dispatching + confirmed across
  the whole chain). They consume provider-attempt budget
  identically — a repair on a later day reserves against that
  day. `REPAIR_MAX_RETRIES = 3` is unchanged. Intent recovery
  and reverify-and-commit make **zero** provider calls and
  consume zero budget (proven by this package's regression
  test (d)).
- **Phase budget.** Orthogonal and unchanged: the phase budget
  gates *money* (micro-cents, settled + reservations +
  in-flight uppers); this design gates *request count*. A run
  must satisfy both. The phase guard's shape fence is the
  template for this design's counter-shape fence (§4).
- **Batch lane.** D6 remains Standard-only; Batch submission
  paths are out of scope. If Batch is ever armed, its polling
  and submission calls need their own accounting ruling —
  flagged here, not designed.

## 6. Migration / compatibility notes

- **Additive only.** The counter table (or the
  `dispatched_day_key` column, if Rowan prefers §3.2.1's
  alternative) ships through the same guarded, idempotent,
  DDL-only evolution pattern as `gen-schema.mjs`'s
  `STORAGE_STATE_EVOLUTION`: CREATE IF NOT EXISTS / guarded
  ALTER, no table rebuilds, no row rewrites, no reads at
  bootstrap (no `.one()` empty-result hazard against real DO
  SQLite semantics).
- **Rollback floor respected.** Build `6a73d962…` is the floor:
  nothing in this design requires, or is compatible with,
  deploying pre-disposition code against post-disposition data.
  A build carrying this design can roll back **to** `6a73d962…`
  safely with respect to the counter: the older build simply
  never reads the new table (its absence changes none of the
  floor build's behavior — the floor's grant counter is
  self-contained). The counter's *data* would go stale during
  such a rollback, so the operational rule must be: rollback
  below this design's build requires generation halted + queue
  paused (the standing rollback pre-holds), and re-arming on
  the newer build re-derives the day count from
  `d6_attempt_log` dispatch records rather than trusting a
  counter that a floor build may have let drift. (If the
  column form is chosen instead, the same rule applies to the
  column's completeness.)
- **First-day seeding.** On the day the design first runs, the
  counter starts from a derivation over that day's already-
  dispatched attempt rows (dispatching + confirmed phases),
  computed inside the first reservation transaction — never
  from a caller-supplied figure, mirroring the storage seed's
  "worker recounts, caller figures refused" discipline. If the
  derivation cannot be performed exactly, the day starts
  **refused** (fail closed) until it can.
- **No behavior change when unarmed.** Until a separate
  operational decision arms it, the design changes nothing:
  this document proposes code that does not yet exist, behind
  the same gate structure (design → build → review → deploy →
  arm) as every prior D6 package.

## 7. Open questions for Rowan

1. **Counter form:** dedicated day-counter table (proposed) vs
   a `dispatched_day_key` column on `d6_attempt_log` with a
   derived count — is a second, independently auditable source
   of truth acceptable, or is one-log purity worth the O(rows)
   grant-time count?
2. **Grant-time reservation factor:** worst-case ×12
   (proposed, ≤ 8 occurrences/grant-day) vs a reviewed realized
   factor with the dispatch-time brake as the hard limit —
   is the throughput cost of ×12 acceptable for the book-scale
   runs this unblocks?
3. **Reservation ownership/release:** are the §3.2.4 release
   points (grant void, plan park, execution settle) complete —
   in particular, who releases a reservation whose message
   stops on unknown billing, and when?
4. **Limit provenance:** should `PROVIDER_ATTEMPT_DAILY_LIMIT`
   be a pinned constant (proposed) or a settings value? A
   settings value can drift silently; a constant needs a deploy
   to move when Google changes tiers.
5. **Scope:** does the dispatch-time brake belong in genstore's
   `markDispatching` (proposed — the exactly-once seam), or in
   the executor's `wrappedSynthesize` wrapper (closer to the
   call, but a second seam if other dispatchers ever appear)?
6. **Diagnostics surface:** the unreleased-reservation figure
   (§3.2.4) and the grants-vs-requests relabeling (§3.3) — in
   scope for the same build, or a follow-up package?

— Wren (design only; no code changed by this document)
