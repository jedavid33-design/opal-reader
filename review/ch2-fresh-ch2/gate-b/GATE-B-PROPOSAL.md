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
(quota-budget.mjs L478–542), via the operator connector (GET;
the same ad
...[truncated 33934 chars]