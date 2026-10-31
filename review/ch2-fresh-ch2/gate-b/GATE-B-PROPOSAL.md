# GATE-(b) PROPOSAL — quota-guard bootstrap, read-only reconciliation, and individually named dispositions (repo-only, no-effect)

**Status: PROPOSAL ONLY — repo-only document, no effect.**
Prepared by Wren under Rowan's direction in her **gate-(a)
execution-record PASS** (issue #15, `jedavid33-design/
opal-roundtable`, comment **6547070545**), which closed gate
(a), accepted its one explained P0 deviation (the third
`schedule_dead` lease row — preserved as a known issue, **not**
cleared), and named this artifact as the next step: a repo-only,
no-effect gate-(b) proposal carrying explicit first-real-DO
bootstrap risk, pagination/completeness STOP conditions,
unknown-billing/accounting treatment, and rollback/containment
boundaries — for Rowan's review **before** Julie decides.

**This proposal is not gate-(b) authorization.** It does not
authorize any production call, read, write, bootstrap,
reconciliation or disposition invocation, halt/queue change,
re-arm, generation, or spend. Gate (a)'s deploy proposal (§4)
summarized gate (b) in advance; this document is the full
gate-(b) proposal that summary pointed to, written against the
**live** post-gate-(a) state. Where the earlier summary and
this document differ in detail, this document governs for gate
(b); the deploy proposal's §4 **re-arm law** and §6 **rollback
law** are carried forward verbatim in substance (§10, §9) and
are not weakened by anything here.

**Drafting made no production contact of any kind.** Every
production figure below is carried from the recorded gate-(a)
execution history and is re-verified at execution time (B0)
before anything is trusted. Source claims are cited to file and
line in the tree Rowan source-passed and gate (a) deployed
(`quota-routes-fix2/worker-build`, live as build `945875bc…`);
factual claims carry **CONFIRMED / INFERRED / OPEN** labels.

---

## 0. Julie-facing summary (plain language)

**Where things stand.** Gate (a) is done and Rowan passed its
record: the new code — cache fix, quota guard, and the three
operator buttons — is live, and the system is parked exactly as
promised: generation **halted**, queue **paused**, and the
quota guard **asleep** (not yet switched on; it created no
tables and counts nothing — verified live at gate (a) D4 by the
report button answering "not armed").

**What gate (b) would do, in order:**

1. **Re-prove the parked state (B0).** Before anything is
   touched, read back that the system is still on the gate-(a)
   build, still halted, still queue-paused, and that the guard
   is still asleep. The queue's pause can't be read by the
   program itself (its queue connection is send-only), so a
   person-side check re-proves the pause right before the
   switch-on and again before every later settle-by-hand step.
   Anything unexpected = stop, nothing runs.
2. **Switch the counter on — one call (B1).** A single
   operator call that takes **no numbers from anyone**: the
   program counts the past Google attempts from its own
   records, exactly once each. Every past attempt whose day can
   be *proven* from its own surviving timestamps gets stamped
   with that day; any attempt whose possible days straddle a
   midnight (Pacific) is **not guessed** — it is left flagged,
   by design, forever until it ages out. This is the one step
   in the whole program where this code runs against the real
   production store for the first time (§4.4 says plainly what
   could go wrong and why a failure strands nothing: the whole
   switch-on is one transaction — it lands completely or not
   at all — and the system stays switched off around it either
   way).
3. **Read the full report, to the last entry (B2).** A
   read-only report, paged through completely — never just the
   first page. If any page is missing, overlaps, or doesn't add
   up to the reported totals, the report is filed as
   **INCOMPLETE** and gate (b) does not close on it. Two honest
   endings are possible:
   - **Clean** — the books agree exactly; or
   - **Not clean, but fully explained** — gate (b) can then
     close only as a **documented accounting hold**: every
     discrepancy written down, system still parked. A hold like
     that can **never** be used to turn generation back on —
     turning back on always needs a fully clean report read at
     that moment, plus your separate go-ahead.
4. **Settle flagged entries by hand — only ones you name
   (B3).** If the report flags past attempts whose day *can* be
   proven, each one would come to you as its own named decision
   (which attempt, which day the evidence proves, what changes)
   before anything is recorded. Flagged attempts whose days
   straddle a midnight can **never** be settled by hand — not
   by you, not by anyone; the program refuses them by design.
   They simply keep the affected **past** days marked, and stop
   mattering once the calendar moves past them.

**What gate (b) does not do.** It does not turn generation back
on, does not unpause anything, does not generate or spend. At
the end the system is still halted + paused — the only
difference is that the counter is awake and the books are
reconciled. "Awake" means: from then on, *if* generation were
ever turned on by a later gate, every Google attempt would be
counted against the 100/day cap as it happens, and oversized
jobs would be sliced to fit instead of refused forever. It
enables nothing by itself.

**What stays exactly as recorded.** The settled Chapter 2
accounting — including the one mystery attempt, which stays
recorded as an honest estimate (`estimated_unverified`), never
a proven charge. The switch-on counts **requests**, never money:
it writes no cost figure anywhere, and it cannot turn an
estimate into a fact.

**One honest caveat, same as before:** the "100 per day" is a
cap *we* chose inside the app, not a verified Google limit, and
anything else using the same Google project outside the Reader
is invisible to the counter (§11).

---

## 1. Scope and non-goals

### 1.1 Scope — exactly these acts, in this order

- **B0** — same-session re-verification of the gate-(a) end
  state (read-only, plus cf-api queue read-back).
- **B1** — exactly **one** deliberate invocation of the
  bootstrap (`POST /v2/d6-quota-bootstrap`, figureless),
  through the existing operator connector
  (`custom.opalreader-v2-prod-operator`), one credential
  surrogate per request, production scope/instance headers.
- **B2** — the read-only reconciliation census
  (`GET /v2/d6-quota-reconcile`), paginated to completeness
  under §5's law, archived in full in the gate-(b) record.
- **B3** — dispositions (`POST /v2/d6-quota-dispose-exception`),
  **only** for bootstrap exceptions that (i) survive B2, (ii)
  are **provably same-day** under §7's rules, and (iii) Julie
  names **individually** under §7.1's presentation protocol.
  This proposal pre-approves **no** disposition and names none
  as expected; it defines the mechanism by which any would be
  presented and decided.

### 1.2 Non-goals — explicitly NOT part of gate (b)

- **No re-arm.** No halt flip, no queue unpause. Gate (b)
  begins and ends halted + paused (§8, §10).
- **No generation** of any kind: no intent submission, no
  provider call, no smoke, no spend.
- **No other operator act**: no adjudication, no retirement,
  no quarantine release, no seed, no diagnostics write.
- **No code change and no deploy.** Gate (b) runs the build
  gate (a) already deployed (`945875bc…`). Any defect found is
  a fix-forward matter for a separately authorized deploy
  (§9), never an in-gate patch.
- **No client publication**, no settings change, no change to
  any plan/job/book/binding state.
- **No clearing of the `schedule_dead` conflict rows.** Rowan
  (6547070545): the underlying lease SQL error is a known
  issue, preserved; gate (b) does not touch the conflicts
  surface.
- **No revisiting the gate-5 adjudication.** The disposed
  attempt's record stands exactly as written (§6.3).

---

## 2. Expected pre-state (last recorded; re-verified at B0)

Basis: the gate-(a) execution record (pin `68776e41…`, filed
6547057529; Rowan PASS 6547070545) and Wren's firsthand
spot-checks at its close. **These are last-recorded values, not
live reads taken for this proposal**; B0 re-captures each one
and STOPs on any material difference (§3).

- **Worker** `opalreader-api-v2-prod`: build
  **`945875bc26b0e2ca965d5c0f710f11c0164025f8`**, script etag
  **`d63b61c349a3518998d29d318ec465af24a63468df6cdf4876e4ba8862849039`**,
  latest deployment `f70aa8121c7a429784c2781b7924d164`.
  (CONFIRMED — gate-(a) D2/D4 record.)
- **Hold:** `GENERATION_HALT "1"`; `/health` generation
  `"halted"`. Queue `opalreader-generation-v2` (id
  `93b6a35fb8cf4788a91a2c90b748ae66`): `delivery_paused ==
  true`, sole consumer `f260f2188d80426bb0588685e9d084eb`.
  (CONFIRMED — gate-(a) P2/D4 + Wren spot-check.)
- **Observability:** enabled + logs enabled + persisted;
  survived the D2 upload byte-identical; no D3 PATCH was
  needed. (CONFIRMED — gate-(a) D3/D4.)
- **Quota guard UNARMED:** `GET /v2/d6-quota-reconcile` returns
  exactly `{ armed: false, ok: false, reason: "not_armed" }`;
  no bootstrap record, no `d6_provider_dispatches` /
  `d6_grant_reservations` tables, no `dispatched_day_key`
  stamps — gate (a) created no quota schema or data.
  (CONFIRMED — gate-(a) D4.)
- **Settings:** revision **1** (lane standard, cap $50).
  **Quota view (old ledger):** floor shape — grant-time
  estimates only; dayKey rolls at 3 a.m. ET; no provider-attempt
  fields exist pre-bootstrap. (CONFIRMED — gate-(a) D4:
  value-identical to baseline, no additive keys.)
- **Generation plane:** no active plan or job. Smoke plan
  `complete`; old Chapter 2 plan `retired` /
  `retired_unknown_billing` (stale job/grant rows proven
  non-executable at gate 7, untouched by design); fresh Chapter
  2 plan `plan:b2dc2a3d1cd367a0245b9102` `complete` (accepted);
  Chapter 3 job `parked_policy` rev 1, fingerprint
  **`b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`**.
  (CONFIRMED — gate-(a) P0/D0/D4 strict identity.)
- **Phase accounting** (`forever-pucked`, micro-cents,
  recorded/known kept separate from modeled): settled
  **579,339**; estimatedUnverified **19,018**;
  reservedUnverified **5,648**; unknownOpen **0**; remaining
  **12,915,013** of 13,500,000; `provider_unverified`.
  (CONFIRMED — gate-(a) P0/D4.)
- **Watermarks:** content **18** / bindings **1818**.
  **Conflicts:** the three `schedule_dead` lease rows (ids 1–3;
  row 3 = the fresh Chapter 2 grant lease, accepted as
  explained provenance by Rowan 6547070545). (CONFIRMED.)
- **Attempt history the bootstrap will meet** (recorded facts;
  the census split is **not** predicted — §4.3): the attempt log
  holds every D6 attempt ever made under the floor build,
  including the G10 smoke attempt, the original Chapter 2 run's
  attempts, and the Gate-8 fresh Chapter 2 run's **79 attempts
  across 36 executions** (recorded cost 379,674 micro-cents —
  an application ledger figure, not provider-confirmed spend).
  All 137 attempts inventoried at gate-(a) P0 were in
  `confirmed` state with zero in-flight. (CONFIRMED as recorded
  history; which rows the bootstrap can stamp exactly is a B1
  output, §4.3.)

---

## 3. B0 — preconditions, re-verified in the same session

B0 is read-only. Every item is re-captured in the gate-(b)
session; nothing is assumed to have persisted from gate (a).
**Any failure or material difference = STOP; no B1 call.**

1. **Build identity:** `/health` build ==
   `945875bc26b0e2ca965d5c0f710f11c0164025f8`, generation
   `"halted"`; script etag read back ==
   `d63b61c349a3518998d29d318ec465af24a63468df6cdf4876e4ba8862849039`
   (re-read, never assumed).
2. **Hold state:** `GENERATION_HALT` read back `"1"` from
   `GET /workers/scripts/{name}/settings` (bindings names +
   types only; secret values are never exposed or read);
   exactly the 10 expected binding names; phase policy
   `"enforce"`; observability still enabled + persisted.
3. **Queue pause — execution-time only.** The Worker **cannot
   read queue pause state** (its queue binding is send-only;
   source: entry header at `worker-entry-prod-d6.js` L836–843
   and the bootstrap handler's own comment). Queue-pause is
   therefore a **runbook precondition**: cf-api read-back of
   `delivery_paused == true` (sole consumer unchanged),
   performed **immediately before B1** and **again before each
   B3 call** (§7.2). A failed re-verification at either point =
   STOP, no call.
4. **Unarmed proof:** `GET /v2/d6-quota-reconcile` returns the
   floor shape `{ armed: false, ok: false, reason: "not_armed" }`
   verbatim. Any other answer — in particular `armed: true`,
   which would mean a bootstrap record already exists that gate
   (a) did not create — = **STOP** and report; gate (b) does
   not proceed on an unexplained armed state.
5. **Generation-plane identity:** plans/jobs/Ch 3 fingerprint /
   phase accounting / settings revision / watermarks /
   conflicts compared against §2 under the strict rule (the
   deploy proposal §3 D0 rule, carried forward): generation
   plane strict identity; Chapter 2 and parked Chapter 3 strict
   identity in all cases; bindings/content differences require
   per-entity provenance evidence and any unexplained change =
   STOP. (Listening through the frozen Shelf bridge is the
   known legitimate source of session/bindings movement and
   must be proven per entity, never presumed.)
6. **Operator readiness:** the migration-operator credential
   binding is present by name (presence/shape only, as at
   gate-(a) P0); the operator connector answers a read surface
   (the B0.4 reconcile read doubles as this proof). No
   credential value is displayed, logged, or tested beyond the
   admitted read.

---

## 4. B1 — the bootstrap (ONE call)

### 4.1 Exact call shape

- **Route:** `POST /v2/d6-quota-bootstrap` (public) →
  `POST /internal/d6/quota-bootstrap` (DO handler,
  `worker-entry-prod-d6.js` L828–920). Transport: the operator
  connector, one credential surrogate (migration-operator
  credential alone — the operator-alone fence class Rowan
  accepted, 6546277727), headers `X-OpalReader-Scope:
  production` + `X-OpalReader-Instance: account`.
- **Body: NONE, or `{}`.** The admissible shapes are exactly:
  no body, an empty/whitespace body, or the empty object. The
  public forward passes the body as **raw text, never
  parsed-and-rewritten** (entry L1496–1512); the DO handler
  parses it after the stamp + halt fences and before any store
  contact. **Figureless is structural**: there is no input by
  which a caller could supply a count, a day, a limit, or a
  cost — `bootstrapQuota(coord)` takes no figure arguments at
  all (quota-budget.mjs L279).
- **Fences, in order** (DO handler): operator-admitted stamp
  re-checked at the class gate (absent/wrong → HTTP 403
  `migration_operator_required`); halt fence
  (`GENERATION_HALT` must be exactly `"1"`); strict body rules;
  figure/allowlist rules; only then the store call.
- **Exactly one deliberate call** is authorized. (The store
  function is idempotent — §4.5 — but idempotence is a safety
  property, not a license for a second deliberate invocation.)

### 4.2 What the one call does (source semantics)

`bootstrapQuota` runs as **one coordinator transaction**
(quota-budget.mjs L279–341):

1. **Additive lazy DDL** (`ensureQuotaSchema`, L118–144):
   `CREATE TABLE IF NOT EXISTS d6_provider_dispatches` +
   `CREATE TABLE IF NOT EXISTS d6_grant_reservations`, plus
   one guarded `ALTER TABLE d6_attempt_log ADD COLUMN
   dispatched_day_key` (a duplicate-column error is the only
   tolerated ALTER outcome; anything else throws). No existing
   row of any table is touched by the DDL.
2. **Exact backfill** over every `d6_attempt_log` row in phase
   `dispatching` or `confirmed` whose `dispatched_day_key` is
   still NULL, in `(created_at, attempt_id)` order. A row's day
   is assigned **only** on one of the two evidence bases the
   addendum's §3.2 fixed (QUOTA-ADDENDUM.md §3.1–3.2):
   - phase `dispatching`: while a row sits in that phase, the
     only write since creation is `markDispatching` itself, so
     `updated_at` **is** the dispatch moment — exact; or
   - the whole evidence interval `[created_at, updated_at]`
     lies inside **one PT day** (`ptDayKey(created_at) ===
     ptDayKey(updated_at)`) — exact.
   For each assigned row the transaction writes **both** the
   attempt-log stamp and the matching `d6_provider_dispatches`
   row (attributed via the execution record's `grant_id`), so
   the derived totals are complete from the first guarded
   instant.
3. **Exceptions left NULL — never guessed.** A row whose
   interval straddles a PT midnight, or whose execution record
   is missing / carries no `grant_id` (unattributable), is
   assigned **nothing** and surfaces as a bootstrap exception
   (`bootstrapExceptions`, L239–258) with its evidence interval
   `intervalDays: [ptDayKey(created_at), ptDayKey(updated_at)]`
   attached.
4. **The bootstrap record is written last**, inside the same
   transaction: meta key `d6_quota_bootstrapped_at`, value
   `{ at, assignedCount, exceptionCount, limit: 100 }`
   (L317–335). The record's existence is the arming marker
   (§8); because it is written last and in-transaction, **no
   reachable state has the marker without the complete
   backfill, and no partial-arm state exists**.

### 4.3 Expected response — and what is NOT predicted

On success (HTTP 200, from the DO handler, L908–919):

```json
{ "outcome": "applied", "bootstrapped": true,
  "alreadyArmed": false,
  "assigned": <n>,
  "providerAttemptDailyLimit": 100,
  "exceptionCount": <m>,
  "exceptions": [ { "attemptId": "…", "phase": "…",
                    "intervalDays": ["YYYY-MM-DD", "YYYY-MM-DD"] },
                  … up to 100 … ],
  "exceptionsTruncated": <bool> }
```

- `assigned` + `exceptionCount` are **outputs, never
  predictions**. This proposal commits to the *rules* (exact
  evidence or exception, never a guess), not to a split: how
  many of the historical attempts carry provable same-day
  intervals is known only when B1 runs (deploy proposal §7,
  carried). (OPEN — by design.)
- The response's exception detail is **bounded at 100**
  (`QUOTA_ROUTE_DETAIL_LIMIT`, entry L365) with an explicit
  `exceptionsTruncated` flag. It is a finding to enumerate
  fully at B2, **never a complete census by itself** — if
  `exceptionsTruncated` is true, B2's paging is the only
  census.
- `alreadyArmed: true` in the response would mean a bootstrap
  record already existed — contradicting B0.4's floor-shape
  proof. If it appears, that is a **STOP-and-report** outcome
  (the call itself is harmless — §4.5 — but the discrepancy
  between B0 and B1 must be explained before gate (b) goes any
  further).

### 4.4 ⚠️ First-real-DO execution risk — stated plainly, with its containment

**The risk (CONFIRMED as a class).** B1 is the quota code's
**first execution against the real production Durable Object
store**. Every prior execution of `bootstrapQuota`,
`reconcileQuota`, and `disposeBootstrapException` happened
against the local test harness. That distinction matters for a
specific, previously-bitten reason: the harness's fake of the
DO SQLite `.one()` returns `null` on an empty result, while
**real DO SQLite `.one()` THROWS** on an empty result (the P8
settings-bootstrap deadlock, Oct 22, 2026 — 563 green harness
tests were no evidence for the empty-result path). The quota
suites were built with throwing-`.one()` semantics in their
store fake, and the bootstrap's own reads are deliberately
shaped defensively (`_all` and `_oneOrNull` on its census and
record paths — quota-budget.mjs L163–178, L282–307); the
adjudication build's lazy-DDL bootstrap is the working
precedent for this pattern in production. **None of that
converts harness-green into production proof.** A real-DO-only
failure mode — an empty-result throw on a path the fake
modeled differently, a transactional or typing behavior the
harness does not reproduce — can only be discovered by running
B1, and this proposal does not pretend otherwise.

**The containment (CONFIRMED, source + posture).** A B1 failure
strands nothing:

- **Atomicity:** the entire bootstrap is one transaction
  (`coord._tx`, L280). A throw anywhere inside — DDL, backfill,
  record write — rolls the whole thing back: no tables left
  half-created by a committed prefix, no stamps without the
  record, **no bootstrap record without the complete
  backfill**. The store remains exactly the gate-(a) end state:
  unarmed, floor-shaped. (The schema-presence discipline backs
  this: exactly-one-table-present is a loud named inconsistency
  — `provider_attempt_budget_schema_inconsistent`, L146–160 —
  never a silent half-state, and any later reconcile read
  surfaces it rather than absorbing it.)
- **Posture:** B1 runs **halted + queue-paused**, with the halt
  enforced in code before any store contact. No dispatch,
  grant, plan, or provider path is reachable during B1; a
  failed bootstrap cannot spend, generate, or half-arm
  enforcement, because enforcement keys on the bootstrap record
  that a rolled-back transaction never wrote (§8).
- **No retry under this approval.** If B1 throws or returns an
  ambiguous/non-200 outcome: read back the state (the B0.4
  reconcile read — floor shape proves unarmed; anything else
  is reported exactly as read), preserve the evidence, STOP.
  Diagnosis proceeds without time pressure (the system rests
  halted + paused either way); any corrective act — including
  a second B1 attempt after a proven no-effect failure — needs
  fresh authorization under the stopped-run rule (a Go covers
  one attempt). Nothing about a failed B1 is "fixed forward"
  inside gate (b).

### 4.5 Idempotence (recorded; not a second-call license)

`bootstrapQuota` considers only still-NULL rows and writes the
record only if none exists; a re-run returns
`alreadyArmed: true`, assigns nothing twice, and never rewrites
the original record (L282, L319–340). This property exists so
that an *accidental* duplicate (a retried transport, a doubled
click) cannot double-count history. Gate (b) still authorizes
exactly **one deliberate** B1 call; a deliberate second call is
a new act requiring its own authorization.

### 4.6 Refusal and fault vocabulary (B1)

All refusals arrive **before any state exists** (handler order,
§4.1) and change nothing:

| Surface | Outcome | Meaning |
|---|---|---|
| Missing/wrong operator credential or spoofed stamp | HTTP 403 `migration_operator_required` | fence refusal at the class gate |
| `GENERATION_HALT !== "1"` | HTTP 200 `{ outcome: "rejected", reason: "generation_not_halted" }` | halt-only fence |
| Body read failure (public entry) | HTTP 400 `quota_bootstrap_body_read_error` — nothing forwarded | a read failure is never an empty body (Rowan 6546431837) |
| Body read failure (DO handler) | `rejected / quota_bootstrap_body_read_error` | same rule, bypass-safe |
| Malformed JSON body | `rejected / quota_bootstrap_body_malformed` | strict body law (Rowan 6546277727) |
| Explicit JSON `null` body | `rejected / quota_bootstrap_body_null` | null is not absent |
| Bare numeric body, or a figure key (`assigned`, `limit`, `dayKey`, cost keys, …) | `rejected / quota_bootstrap_figure_caller_supplied` | figureless law |
| Any other body key | `rejected / quota_bootstrap_request_key_not_allowed` | empty allowlist |
| Non-object/non-figureless body shape | `rejected / quota_bootstrap_request_not_figureless` | shape fence |
| Store throw inside the transaction | HTTP 500-class fault; transaction rolled back (§4.4) | fault, never laundered into a refusal |

---

## 5. B2 — the complete paginated reconcile census

### 5.1 The surface

`GET /v2/d6-quota-reconcile` → `reconcileQuota(coord)`
(quota-budget.mjs L478–542), via the operator connector (GET; the same
admitted-stamp operator fence as the sibling routes applies; the
handler is read-only — it performs no mutation of any kind (the
routes-fix read-purity correction removed its last incidental write
path).

`reconcileQuota` reports, for the whole recorded history:

- `armed` — whether the durable bootstrap record exists;
- the per-day dispatch totals derived from `d6_provider_dispatches`;
- the outstanding-reservation totals derived from
  `d6_grant_reservations`;
- `exceptions` — recorded dispatch rows whose day could **not** be
  assigned with proof at bootstrap (the unassigned residue);
- `drift` — every way the derived totals disagree with what the
  records claim, each entry named (including `day_over_limit` for any
  PT day whose proven total exceeds the app-selected cap of 100);
- `ok` — defined in §5.2.

### 5.2 What `ok` means

CONFIRMED from source: `reconcileQuota.ok === true` exactly when
**the drift list is empty AND no current-day block exists** (no
exception or drift entry touches the current PT day in a way that
would fence new dispatch). An over-limit historical day is drift —
it makes `ok` false truthfully; it is never absorbed, averaged, or
renamed. `ok` is a statement about the accounting records only; it
grants nothing by itself (see the re-arm law, §10).

### 5.3 The pagination law

The exceptions and drift arrays page at a **fixed size of 100** via
`exceptionOffset` / `driftOffset` query parameters, forwarded to the
DO and strictly validated (`/^(0|[1-9]\d*)$/` plus a safe-integer
check; anything else is refused `quota_reconcile_offset_invalid`
before any read). Each response carries the per-array **total**, the
**next offset** (or null at the end), and `censusComplete` — true
only when every array has been walked to its end under stable
totals. Exceptions are returned in the store's deterministic
`created_at, attempt_id` order; drift entries are stably sorted at
the route. (Suite proof at build time: QROUTE-17 enumerated 107
all-straddling exceptions as disjoint pages of 100 + 7 whose union
equals the stored set, with zero disposition calls.)

B2 is **complete** only when all of the following hold: pages are
pairwise disjoint; their union equals the reported totals for both
arrays; the totals are identical on the first and last page (no
movement during the census); and `censusComplete` is true on the
final page.

### 5.4 STOP-and-archive-INCOMPLETE conditions

B2 stops, and the census is archived explicitly as **INCOMPLETE**,
if any of the following occurs:

1. a page request faults (HTTP 500-class) or returns a refusal;
2. totals change between pages (movement during the census);
3. pages overlap, or their union does not equal the reported totals;
4. `censusComplete` never becomes true at the reported totals;
5. any entry cannot be parsed into the documented shape;
6. the queue-pause read-back (B0 law) fails at any checkpoint.

An INCOMPLETE census closes nothing: gate (b) does not proceed to
B3, no end state is declared, and the partial census is filed as
evidence with the gap named. A later census requires Julie's fresh
word if it would run under a new session.

### 5.5 The three outcomes

| Outcome | Condition | Consequence |
|---|---|---|
| **Clean** | Census complete; `ok === true` | Gate (b) may close on the B1+B2 record (subject to the DP-B2 closure rule, §12). No B3 exists. |
| **Explained hold** | Census complete; `ok === false`; **every** drift/exception entry enumerated and individually explained in the record | Gate (b) may close as a *documented accounting hold* only. Re-arm remains fenced by §10 — an explained hold is never re-arm clearance. B3 may be proposed for provably same-day exceptions only (§7). |
| **Unexplained — STOP** | Census complete but any entry cannot be explained from the records, or census INCOMPLETE | Gate (b) does not close. Everything stays halted + paused; the discrepancy is filed and the next step is a decision for Julie, not an improvisation. |

---

## 6. Accounting treatment — what the counter counts, and what it never claims

### 6.1 Requests, not billing

CONFIRMED: the quota guard counts **provider dispatch requests**
(the calls the old counter could not see — up to 12 per grant). It
does not measure, estimate, or settle money. Google billing remains
what it has always been in this case: day-level aggregates only;
per-request cost is unknowable retroactively; nothing in gate (b)
changes that, and no figure produced by B1–B3 may ever be quoted as
a provider charge.

### 6.2 Two ledgers, kept separate

Grant-time **estimates** (the old counter's world: 19,652 units per
grant) and per-dispatch **reality** (the new ledger's world) are
different instruments. Gate (b) does not restate one in terms of
the other, does not true-up estimates into actuals, and does not
touch the phase accounting: settled **579,339**, estimatedUnverified
**19,018**, reservedUnverified **5,648**, unknownOpen **0**,
remaining **12,915,013** — all five figures are byte-identical
before and after gate (b), because the quota ledger and the phase
ledger are separate books.

### 6.3 The already-adjudicated attempt — flagged, not silently handled

The one mystery attempt from the original Chapter 2 halt,
`att-37d63768-db4b-447d-8150-580b7c6ee257`, was disposed in the
separate adjudication case as **`estimated_unverified`**: its
`cost_micro_cents` stays **NULL**, its estimate (19,018) and
reservation (5,648) stand as recorded, and its actual Google charge
remains **UNKNOWN**. Gate (b) does not revisit, re-price, or
re-label it.

If — hypothetically — that attempt surfaced in the B2 census as a
bootstrap exception with a provably single-day interval, a B3
disposition would add only a day-key assignment and its provenance
block to the *quota* ledger; it would not touch the adjudication
record. Wren flags this interaction explicitly rather than deciding
it inside this proposal: **no disposition naming that attempt will
be presented as a routine B3 item** — if it ever arises, it gets
its own named callout to Julie and Rowan first. (Expectation: it
does not arise — its interval is a straddle by construction of the
split that created it, and multi-day intervals are never
dispositionable under §7 in any case.)

### 6.4 Over-limit days and unresolved items

- A historical PT day whose proven dispatch total exceeds 100 is
  recorded as `day_over_limit` drift and named in the record with
  its total. It is a fact about the past (the old counter could not
  see per-dispatch calls), not a violation to be repaired.
- **Winner provenance** (which pre-existing objects won the eight
  fingerprint collisions in the Gate-8 run) remains **UNRESOLVED**;
  gate (b) neither needs nor performs the gated R2-HEAD read that
  could close it.
- The three `schedule_dead` conflict rows are **not cleared** by
  gate (b) (Rowan's gate-(a) ruling); the underlying lease SQL error
  remains a known issue, out of scope here.

---

## 7. B3 — dispositions: a presentation protocol, not a pre-approval

B3 exists only if the B2 census surfaces exceptions. This proposal
pre-approves **none** of them. Each disposition is its own
sub-decision, presented to Julie individually with:

1. the attempt's identity (attempt id, plan, occurrence);
2. its evidence interval `[created_at, updated_at]` and the proof
   that the interval lies inside exactly one PT day;
3. the single provable day-key it would be assigned to;
4. the expected effects (exception removed; that day's total
   incremented by one; whether the day crosses the cap — named
   before the call, never discovered after);
5. the verbatim refusal possibilities (below);
6. Julie's approval recorded as the call's `authorizationRef`.

**Store law (CONFIRMED from source, applied in order):** a
multi-day interval is refused `quota_disposition_ambiguous_interval`
**before** any bounds check — no authorization, Julie's included,
can make a straddling interval dispositionable; an out-of-interval
or non-real-calendar day-key is refused; a malformed stored row is
refused rather than guessed; disposition is exactly-once (a second
call for the same attempt refuses); a disposition that pushes a day
over the cap is **recorded with its over-limit consequence named**,
and `reconcileQuota` thereafter reports that day as drift until the
clock leaves it — disposition never manufactures `ok: true`.
Unexpected store faults surface as HTTP 500 faults, never laundered
into 200-style rejections (the routes-fix hardening).

Before **each** B3 call, the B0 queue-pause read-back is repeated
(cf-api; the Worker cannot read pause state). Any fault or refusal
stops B3 at that item; completed dispositions stand as recorded
(they are additive records, §9), the rest are not attempted.

---

## 8. End state — what "armed" means, and what it does not enable

After a completed gate (b): the durable bootstrap record exists, so
the quota guard is **armed** in the accounting sense — *if* the
grant/dispatch path ever ran, its gates would enforce the
per-dispatch budget from the reconciled ledgers. But:

- GENERATION_HALT remains `"1"`; the queue remains **paused**;
- no plan, job, or queue message can reach a dispatch path —
  arming the counter un-halts nothing, un-pauses nothing, and
  creates no generation;
- the client-visible quota view gains the armed shape (its figures
  derived from the new ledgers), which is a display change only.

Re-arm (halt flip + queue unpause) is a **later, separate gate**
under §10. Generation is later still, under gate (c).

---

## 9. Rollback and containment

- **Floor law (unchanged, restated):** the rollback floor is build
  `6a73d962…` + etag `a9a4c0c4…` + its data. The floor build does
  **not** enforce the provider-attempt counter and must never be
  represented as a safe re-arm fallback. No rollback below the
  settlement build while any adjudication record exists (gate-(b)
  changes nothing about that floor).
- **Bootstrap/dispositions are additive data.** They cannot be
  un-run. A rollback to the floor build would leave the quota
  tables in place, unread by that build; returning to the guarded
  build restores their use. Any rollback execution itself remains
  a separate Julie-authorized act requiring halted + paused holds
  held for the whole window, an externally archived copy of the
  affected records, and proven build compatibility — not commit
  recency.
- **Containment during gate (b):** every step runs behind the halt
  fence with the queue paused; the only writes gate (b) can make
  are the bootstrap record, the quota ledgers' bootstrap rows, and
  (under §7) disposition records. A fault at any step leaves the
  system halted + paused + (at worst) partially bootstrapped in a
  state the reconcile census can still describe truthfully —
  there is no step whose failure hides state.

---

## 10. The re-arm law (restated in full; gate (b) does not satisfy it)

A future re-arm requires **all** of the following, at the re-arm
moment:

1. the guarded build live (not the floor);
2. a fresh, complete, paginated reconcile census in that session;
3. `reconcileQuota.ok === true` on that census;
4. for any current-day hold created by a multi-day exception: the
   clock has left the exception's interval, and condition 3 is
   re-read *after* that moment;
5. Julie's separate, explicit GO for the re-arm itself;
6. the halt-flip and queue-unpause executed as their own recorded
   steps, in that order, each read back.

An explained `ok: false` hold — however well documented — satisfies
none of this. Gate (b) closing as an explained hold leaves the
system exactly as fenced as it is today.

---

## 11. Disclosures

- The 100/day figure is an **app-selected cap** (`PROVIDER_ATTEMPT_DAILY_LIMIT`),
  not a provider limit; Google's own quota is a separate, rolling
  100-requests/day limit that the app counter does not observe.
- Provider usage **outside** the Reader (other tools, other keys)
  is invisible to this counter and always will be.
- Harness green is not a production smoke: B1 remains the first
  real-DO execution of this code (§4.4), and gate (b) is designed
  so that this fact can cost a stopped session, never corrupted
  state.
- Every figure the quota ledger produces is **application
  accounting** — derived from the app's own dispatch records —
  never a provider-verified charge (§6.1).
- The B1 assigned/exception split **cannot be known in advance**;
  anyone quoting one before the call is guessing.

---

## 12. Decision points for Rowan

**DP-B1 — B3 timing.** When a complete B2 census surfaces provably
same-day exceptions, may B3 dispositions be presented to Julie and
executed in the same session, or must the census first be filed
and reviewed before any disposition? *Wren's lean: same-session
permitted, never required* — each disposition still carries its
own individual Julie approval with the §7 presentation, and the
census is complete and archived before the first B3 call either
way. Filing-first remains available whenever the census is large
or surprising.

**DP-B2 — Hold closure.** If gate (b) ends as an explained hold,
who declares it closed? *Wren's lean: Wren files the execution
record; Rowan reviews and closes it* — mirroring the gate-(a)
pattern (execution record → Rowan record review → closure), so no
hold is ever closed on Wren's say-so alone.

No other forks are presented: everything else in this proposal is
fixed by the prior rulings cited in the source index.

---

## 13. Non-authorizations and the approval sequence

This proposal authorizes nothing. The sequence is: Rowan's review
of this proposal → Julie's gate-(b) decision → execution of exactly
B0–B3 as approved → execution record → Rowan's record review.
Not included at any step: re-arm, queue unpause, halt flip,
generation of any kind, provider calls, spending, dispositions
beyond the individually approved §7 items, clearing of the
`schedule_dead` records, the R2-HEAD provenance read, client
publication, or any settings change.

---

## Source index

- `worker/generation/quota-budget.mjs` (deployed tree) —
  `bootstrapQuota`, `reconcileQuota` (L478–542), `disposeBootstrapException`,
  reservation identity, closure fence, derived-totals/drift law.
- `v2/worker-entry-prod-d6.js` (deployed tree) — the three operator
  routes, raw-text body forward, pagination validation, read-purity
  reconcile handler, disposition fault honesty.
- `worker/generation/gen-constants.mjs` — `PROVIDER_ATTEMPT_DAILY_LIMIT = 100`.
- `review/ch2-fresh-ch2/remediation/QUOTA-ADDENDUM.md` — bootstrap
  semantics, interval proof rules, acceptance invariants.
- `review/ch2-fresh-ch2/final-envelope/DEPLOY-PROPOSAL.md` — §4
  gate-(b) shape, §5 gate-(c) boundary, §6 rollback/floor law.
- `review/ch2-fresh-ch2/final-envelope/execution/EXECUTION-RECORD.md`
  (pin `68776e41…`) — gate-(a) end state: build `945875bc…`,
  etag `d63b61c3…`, halted + paused + UNARMED, `not_armed` read.
- Board rulings: quota design pass 6544950778; corrections
  re-review 6545597263; combined source pass 6545910782; deploy
  operational review 6546037460 (Amendments 1–4); routes reviews
  6546277727 / 6546431837; readiness pass 6546757371; gate-(a)
  record pass + deviation ruling 6547070545.
