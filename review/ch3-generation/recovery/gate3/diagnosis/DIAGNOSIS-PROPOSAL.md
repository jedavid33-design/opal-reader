# DIAGNOSIS PROPOSAL — Gate 3 E3 preview failure (bounded, read-only)

**Status: PREPARATION ONLY.** This proposal was prepared under Rowan's
ruling (board issue #15, comment **6559354445**), which authorized Wren
to *prepare* a bounded read-only diagnosis proposal — not to execute
any live diagnosis. Nothing in this document is an execution
authorization. No production call of any kind was made in preparing
it: every fact below comes from the pinned source of the live build
and from the saved Gate 3 execution evidence.

**Decision chain this proposal belongs to:** Rowan reviews this
proposal → Julie gives a separate decision authorizing **Stage 1
only** (the passive read-only diagnosis, §7.2) → Stage 1, if
approved, executes as its own gated step and its results return to
Rowan for review → any **Stage 2** (a repeat of the failed preview,
§7.3) requires its own later proposal, Rowan's review of the
Stage 1 results, **and** Julie's distinct approval — this proposal
does not request it → any code change, deploy, baseline change, or
new Gate 3 attempt needs its own further proposal and approval.
Julie's Gate 3 GO (board **6559241292**) is **consumed**: it does
not authorize a second preview, a second action, or any part of
the diagnosis proposed here.

**Subject system (unchanged since the STOP):** worker
`opalreader-api-v2-prod`, live build
`408f91497131a151a199b3f9ec4cbb283a8febd5`, `GENERATION_HALT "1"`
(generation halted), queue `opalreader-generation-v2` paused. The
stalled grant `grant:plan:e377a5559961b294154276b6:ch2:1:full`
remains `issued` rev 2; the Chapter 3 plan remains `active` at 8/23;
the finalizer has never been validly invoked (the one preview call
errored; the action was never called).

**Revision history — Amendment 1 (2026-11-01).** This amendment
answers Rowan's REVISE review (board comment **6559530709**) of
the original proposal (pin `d581f5bd…`). Four changes, and only
these:

1. **Conflict-change = probe STOP (§7.1, §7.5).** Any added,
   removed, or modified conflict row relative to the approved
   four-row baseline (Gate 2D baseline, pin `9284f5ef…`, the four
   rows enumerated verbatim in the Gate 3 proposal §4.4.1)
   immediately STOPs all further probes in the stage. A new
   `schedule_dead` row is evidence — captured verbatim and filed —
   never an exemption, and it never permits the stage to continue
   past the read that found it. Continuation requires a Rowan
   ruling on the changed set or a separately reviewed replacement
   baseline. The original framing (a purely additive new row is
   "evidence, not a stop") is superseded and void.
2. **Stage separation (§7.2, §7.3).** The live-diagnosis plan is
   split into separately authorized stages. **Stage 1** is passive
   read-only diagnosis only — probes D1–D5 plus a final conflict
   read (D6) — and contains no preview invocation of any kind.
   The preview re-invocation (formerly probe D6) is removed from
   Stage 1 entirely and deferred to a possible **Stage 2**, which
   this proposal does not request or pre-authorize: Stage 2 could
   only be proposed after Rowan reviews the Stage 1 results, and
   would require Rowan's later review plus Julie's distinct
   approval as its own decision. The former final conflict read
   (D7) is renumbered D6 inside Stage 1.
3. **Strict ceilings per stage (§7.2, §7.5).** Stage 1 carries a
   hard total request ceiling of **9 requests** (expected 7),
   stated per probe, with the quota reconcile's pagination
   explicitly capped (page size 100 entries per array; the D4
   probe hard-capped at 4 requests — needing a fifth is a STOP,
   not a continuation), per-probe stop conditions, and stage-level
   stop conditions. Every number is a binding ceiling on the
   executor, not an estimate.
4. **Inference discipline (§6, §7.3, §7.4).** A repeat HTTP 500 at
   the preview — in any future Stage 2 — would establish at most
   that the failure reproduces at the preview endpoint under those
   conditions; it is not proof of which SQL statement failed, nor
   of the SQLite engine mechanism, absent statement-level
   evidence. H1 remains a supported hypothesis, not a proven
   cause, throughout.

The traced path (§3), the pattern inventory (§4), the lease trace
(§5), the candidate table (§6 — with H0's discriminator reference
updated to §7.3), and the E3 evidence analysis (§§1–2) are
unchanged except where change 4 required wording discipline.

---

## 1. The failure, exactly as evidenced

During Gate 3 execution (2026-11-01, under GO 6559241292, following
the amended Gate 3 proposal pin `1610a314…` and Rowan's technical
PASS 6559214332):

- **E0 census: ALL PASS (21/21)** — 2026-11-01T14:26:12Z → 14:26:25Z,
  21 read surfaces, all HTTP 200, compared mechanically against the
  proposal §4 (`compare-e0.txt`: "VERDICT: ALL PASS (21/21 pass)").
  Conflicts exact-matched the four-row baseline; bindings 8/8 with
  revision_key == cache_key; reconcile `ok: true`; phase settled
  732,303; watermarks 1826/18.
- **E1 halt flip: PASS** (mutation 1 of 3) — 14:28:26Z → 14:28:28Z;
  post-halt conflict re-fetch still exact-match (4 rows).
- **E2 queue pause: PASS** (mutation 2 of 3) — 14:28:49Z → 14:28:50Z.
- **E3 preview: STOP** — exactly one operator call,
  `GET /v2/d6-grant-finalization-preview?grantId=grant:plan:e377a5559961b294154276b6:ch2:1:full&planId=plan:e377a5559961b294154276b6&jobId=plan:e377a5559961b294154276b6:ch2`,
  window 2026-11-01T14:29:00Z → 14:29:01Z. Response, preserved
  verbatim in `execution/evidence/preview-e3.json`:

  ```json
  {"status": 500, "body": {"error": "LIKE or GLOB pattern too complex: SQLITE_ERROR"}}
  ```

  The preview returned **no precondition digest** and did not
  classify the grant `finalizable`. The preview was not retried.
  E3.5 was not run as a step; **E4 (the finalizer action) was never
  called**; no audit row was written; $0 spend. Post-STOP read-backs
  (14:30Z) confirmed: grant still `issued` rev 2, plan still
  `active` 8/23, conflicts still exactly the 4 baseline rows, system
  HELD. Full record: `gate3/execution/EXECUTION-RECORD.md` (pin
  `b5fc3784…`).

The error string is byte-identical to the `found` field of the four
standing `schedule_dead` conflict rows. That identity is an
observation, not a diagnosis (§5–§6 treat it at its true strength).

---

## 2. What the saved E3 evidence does and does not establish

**It establishes:**

- The preview derivation, executed once against live production
  data, threw a SQLite error whose message is
  `LIKE or GLOB pattern too complex: SQLITE_ERROR`, and the route
  surfaced that message as HTTP 500 (the finalizer module's stated
  discipline is that unexpected faults throw and the entry maps
  them to HTTP 500 — `grant-finalizer.mjs` header, "Store
  discipline" paragraph).
- The system state immediately before the call was fully verified
  (E0 census, §1 above) and immediately after was unchanged
  (post-STOP read-backs). The failure is inside the preview's
  request handling, not in the census surfaces — every census read,
  including the plain conflicts read, succeeded minutes before and
  after, in the same held state.
- The call was made once, in a ~1-second window, with the exact
  identity parameters recorded above.

**It does not establish:**

- **Which statement threw.** The 500 body carries only the error
  message — no stack trace, no statement identifier, no progress
  log. The derivation returns nothing on a throw; there is no
  record of how far it got.
- Whether the throw came from the derivation at all, as opposed to
  another statement executed inside the same request (§6, H0).
- Whether the failure is deterministic. It has been observed
  exactly once.
- Any server-side log evidence: Workers Logs telemetry is not
  reachable through the existing Cloudflare connector credential
  (the telemetry query route 403s), so no log line was captured at
  E3 and none is assumed available to the diagnosis in §7.

---

## 3. The exact preview call path, step by step

Source tree traced: the live build `408f9149`'s tree at
`~/workspace/ch2-program/ch3-recovery/finalizer-build/worker-build/`
(the `v2/` path in the deployed parts is a symlink to `worker/`).
All citations are file:line in that tree; §9 lists the traced files'
SHA-256 hashes.

1. **Public route** — `worker-entry-prod-d6.js:1591-1594`: the
   request is recognized as the grant-finalization preview route
   (`GET /v2/d6-grant-finalization-preview`). It joins the
   operator-fence class: the production gate skips the client token
   for it (`:1596-1603`), and the operator-admission block
   (`:1649-1656`) requires the dedicated migration-operator
   credential and sets `operatorAdmitted`.
2. **Forward** — `worker-entry-prod-d6.js:1904-1920`: the entry
   forwards to the Durable Object as
   `GET https://do.internal/internal/d6/grant-finalization-preview`,
   copying **only** `grantId` (required), `planId`, and `jobId`
   from the caller's query into the internal URL, and sets the
   internal headers including the unforgeable
   `x-opalreader-operator-admitted` stamp (`forward` helper,
   `:1661-1670`).
3. **DO class gate** — `worker-entry-prod-d6.js:1326-1350`: the
   coordinator class handler re-checks the operator-admitted stamp
   (`:1335`; absent → 403 `migration_operator_required`), requires
   a non-empty `grantId` (`:1336-1338`), loads the cache
   (`await this._cache()`, `:1340`), constructs the
   `GenerationCoordinator` and the gen store
   (`createGenStore(coord)`, `:1341-1342`), and calls
   `previewGrantFinalization(coord, store, { grantId, planId, jobId })`
   (`:1343-1347`). After the call it flushes the cache (`:1348`).
   The handler writes nothing itself.
4. **Preview entry** — `grant-finalizer.mjs` `previewGrantFinalization`
   (from file line 677): validates `grantId` is a non-blank string,
   then calls the shared derivation
   `deriveGrantFinalizationState(coord, store, { grantId, planId, jobId })`.
   The preview does **not** ensure the audit schema — an absent
   `d6_grant_finalizations` table reads throw-safely as "no audit
   row" (`readAllSafe`/`readOneSafe`, `:132-143`).
5. **The derivation** — `deriveGrantFinalizationState`
   (`grant-finalizer.mjs`, from file line 267): re-derives every
   precondition server-side, in the proposal §4.3 order, returning
   the first refusal or, on success, the view + its SHA-256
   precondition digest (`grantFinalizationDigest`, `:155-157`).
   On an unexpected fault it **throws**; nothing partial is
   returned (see §2).

### 3.1 Ordered list of the derivation's data reads

In execution order (all reads are equality, `IN`-subquery, or
aggregate queries unless marked ◆):

1. §4.3.1 `grants` by `grant_id = ?`; `d6_plan_jobs` by `job_id = ?`.
2. §4.3.2 `jobs` by `job_id = ?`; `grants` by `job_id = ?` (grant
   uniqueness).
3. §4.3.3 `d6_plans` by `plan_id = ?`; `d6_plan_entries` by
   `plan_id = ?` (ordered); plan totals via, per entry,
   `occurrences` by (job_id, occurrence_id) and
   `store.executionFor` (`genstore.mjs:79`, equality read).
4. Audit row (throw-safe) from `d6_grant_finalizations` by
   `grant_id = ?`; `claims` by `grant_id = ?`; if the quota guard
   is armed, `d6_grant_reservations` by `grant_id = ?`.
5. §4.3.4 Phase B fences: throw-safe read of
   `d6_chapter_exemptions` by the final occurrence id; `jobs`
   (parked job for book+chapter); throw-safe read of
   `d6_park_releases` by the parked job id.
6. ◆ §4.3.5 **The derivation's only LIKE query** —
   `grant-finalizer.mjs:417-419`:

   ```sql
   SELECT detail_json FROM ledger_ops
    WHERE kind = 'attempt' AND op_key LIKE ?
    ORDER BY op_key
   ```

   with the pattern bound as a parameter: `` `op:${grantId}:%` ``
   (construction in §4). The result set defines the grant's target
   set; each row's `detail_json` is parsed for `occurrenceId`.
7. §4.3.6 `outbox` by `id = ?` (the grant id); payload parsed for
   the occurrence set.
8. §4.3.7/8 `occurrences` by `job_id = ?` (the job partition).
9. §4.3.9/10 Executions: `store.executionsForJob` /
   `d6_execution_records` by job; then claims re-checked
   (§4.3.15/16 — already read at step 4).
10. Quota arming check — `quotaArmed(coord)`
    (`quota-budget.mjs:163-171`): a `meta` equality read plus a
    table-presence check; throws a named schema-inconsistency error
    (not a LIKE/GLOB error) if the bootstrap record exists but the
    quota tables are missing.
11. §4.3.11–13/17–19 Per target (in plan order): attempts via
    `store.attemptsForExecution` (`genstore.mjs:235`, equality
    read on `d6_attempt_log`); dispatches from
    `d6_provider_dispatches` by (grant_id, occurrence_id);
    reservation cross-checks against the step-4 rows.
12. §4.3.20 `derivedDayTotals(coord, reservationDay)`
    (`quota-budget.mjs:193-201`): two aggregate reads
    (`COUNT(*)` on dispatches by day; `SUM` on open reservations
    by day).
13. §4.3.14/21 Phase proof — `phaseAccountingView`
    (`grant-finalizer.mjs`, from file line 187): settled /
    in-flight / unknown aggregates on `d6_attempt_log` with
    `plan_id IN (SELECT plan_id FROM d6_plans WHERE phase = ?)`;
    a throw-safe presence check for `d6_billing_adjudications`
    plus its aggregate if present; `d6_phase_state` by phase;
    `spend_intents` by job with an `IN` list over the pending ids.
14. §4.3.22 `sync_family_state` for families bindings/content.
15. §4.3.23 Per target: `bindings` by (occurrence_id, cache_key)
    equality reads.
16. View assembly + SHA-256 digest over the canonical-JSON view.
    **No digest was returned at E3** — so if the throw came from
    the derivation, it came from one of steps 1–15.

No other statement in the preview path (entry, class gate, cache
load/flush, genstore reads) contains a LIKE or GLOB pattern — see
the grep-complete inventory in §4.

---

## 4. The SQL pattern construction, and every LIKE/GLOB in the tree

**Pattern construction (finalizer §4.3.5).** The SQL text is a
constant template; the pattern is a **bound parameter**, never
interpolated into the SQL string. In JavaScript it is built by
concatenation: `` `op:${grantId}:%` ``. `grantId` arrives from the
request query string (entry forward step, §3 step 2) — at E3 it was
exactly `grant:plan:e377a5559961b294154276b6:ch2:1:full`
(46 characters), so the constructed pattern was
`op:grant:plan:e377a5559961b294154276b6:ch2:1:full:%` —
**51 characters, exactly one wildcard (`%`, trailing), no `_`
wildcard, no character classes**. The keys it matches are written
by the coordinator as `` `op:${grantId}:${occurrenceId}` ``
(`coordinator.mjs:1750`, `:2025`, `:2043`), so the pattern is a
pure prefix scan over one grant's attempt ops (8 rows at E3).

**Complete LIKE/GLOB inventory of the tree** (recursive grep for
`LIKE` / `GLOB` over `worker/`, all modules): there is **no GLOB
anywhere** in the tree, and exactly **five** SQL LIKE sites, four
of which use the identical pattern construction:

| # | Site | Pattern | Reachable from |
|---|------|---------|----------------|
| L1 | `grant-finalizer.mjs:417-419` | `` `op:${grantId}:%` `` (bound) | **The preview derivation (§4.3.5)** and the action's in-transaction re-derivation |
| L2 | `coordinator.mjs:1979-1980` | `` `op:${grantId}:%` `` (bound) | `_voidDispatch` (undelivered-grant voiding) |
| L3 | `coordinator.mjs:2145-2146` | `` `op:${grant.grant_id}:%` `` (bound) | `handleReport` (executor-report closure) |
| L4 | `coordinator.mjs:2591-2592` | `` `op:${grant.grant_id}:%` `` (bound) | The `lease` schedule case (§5) |
| L5 | `coordinator.mjs:2185` | `grant.job_id + ":follow:%"` (bound) | `handleReport` repair-chain follow-on count only |

Every other grep hit for "like" in the tree is an English word in a
comment. `genstore.mjs`, `quota-budget.mjs`, the entry, and the
cache code contain **no** LIKE/GLOB. The legacy `p8/freeze-worker.js`
contains no LIKE/GLOB either and is not on the preview path.

**What could make SQLite reject this pattern as "too complex" is
NOT determinable from the source.** In vanilla SQLite terms the
pattern is unremarkable: 51 characters against a default
`SQLITE_MAX_LIKE_PATTERN_LENGTH` of 50,000, and a single trailing
`%` is the cheapest shape the LIKE matcher handles. The Gate 2
finalizer suites — including Fixture S, which seeds the exact
production-shaped state (44 attempts / 52 residual / 96 consumed)
and runs the real finalizer and this same query — pass under the
test harness's SQLite. So either the Durable Object SQLite build
accounts pattern complexity differently from the harness engine,
or the production failure depends on something the fixture does not
replicate (for example the production `ledger_ops` table's full
history across all plans, versus the fixture's small table), or
the throwing statement is not this one (§6, H0). The proposal
deliberately does not pick among these: distinguishing them is
what the diagnosis in §7 is for. §7 is staged so that Stage 1 can
answer "does the lease path still produce the same error, and has
any state drifted" without ever depending on engine internals
Wren cannot inspect; the separate question "does the preview
failure reproduce" is reserved to a possible Stage 2 (§7.3),
which this proposal does not request.

---

## 5. The lease trace — where the four conflict rows came from

The four `schedule_dead` rows are produced by a fully traceable
mechanism in `coordinator.mjs`:

- Grants schedule a lease row at issuance:
  `_schedule(now + LEASE_MS, "lease", grantId, {})`
  (`coordinator.mjs:1757`; also `:1919` for the handoff-anchored
  form). For a lease row, `row.kind = "lease"` and
  `row.ref = grantId`.
- The DO alarm loop (`coordinator.mjs:2479-2496`) processes due
  schedule rows via `_processScheduleRow`. On a throw, it backs
  the row off; when `attempts + 1 >= SCHEDULE_MAX_ATTEMPTS`
  (`= 8`, `coordinator.mjs:147`), it marks the row `dead` and
  inserts a conflict row (`:2490-2492`):

  ```js
  INSERT INTO binding_conflicts
    (at, occurrence_id, cache_key, expected, found, reason)
  VALUES (?, ?, ?, ?, ?, 'schedule_dead')
  // params: now, row.ref, row.kind, String(row.attempts),
  //         String(e && e.message || e)
  ```

  This insert explains **every field** of the four standing rows
  mechanically: `occurrence_id` = the grant id (the lease row's
  ref — e.g. `grant:plan:e377a5559961b294154276b6:ch2:1:full`),
  `cache_key` = `"lease"` (the row's kind, stored in the
  binding-conflict column of that name), `expected` = `"7"` (the
  row's attempt count at death: 7 prior failures, the 8th tripping
  the maximum), `found` = **the thrown exception's message
  string**, `reason` = `schedule_dead`.
- The `lease` case of `_processScheduleRow` (`coordinator.mjs:2521`
  onward) handles expiry: for a delivered grant (outbox row present
  and `sent_at` set — the fall-through branch at `:2591`), it reads
  the grant's attempt ops with **the L4 LIKE**,
  `` `op:${grant.grant_id}:%` ``, before marking still-granted
  occurrences. For an undelivered grant it instead calls
  `_voidDispatch` (`:2575-2577`), which runs **the L2 LIKE**. No
  other LIKE/GLOB exists anywhere in the lease case's reachable
  code, and no other statement in that case is a pattern match.

**Honest comparison.** The conflict rows *prove* that, on four
separate occasions (2026-10-29 → 2026-11-01), processing a lease
row threw an exception whose message was exactly
`LIKE or GLOB pattern too complex: SQLITE_ERROR`. Because the only
pattern-matching statements reachable in that processing are L4
(delivered branch) and L2 (undelivered branch) — both the identical
`` `op:<grantId>:%` `` construction — the rows are strong evidence
that **this construction family throws this exact error in
production**. What the rows do *not* record: which of L2/L4 fired
for any given row, or the engine-level reason for the rejection.
Row 4 (the stalled grant's own lease row, written
2026-11-01T01:04:30Z, after Phase A completed) belongs to a grant
that was delivered and acknowledged, so its processing would have
taken the delivered branch (L4) — but that is an inference from
the branch structure, not a recorded fact.

**Shared construction, not coincidence of error text.** The
preview's L1 and the lease path's L2/L4 are the *same* query shape
against the *same* table with the *same* pattern construction,
written independently in two modules (the finalizer deliberately
duplicates coordinator derivations rather than importing them).
The error-text identity between the E3 500 and the conflict rows
is therefore not a bare coincidence of strings: both plausibly
originate from one construction family that production SQLite
rejects under conditions the source alone cannot pin down (§4).

One caution against over-reading the lease evidence: the L3 LIKE
in `handleReport` belongs to the same family, and executor reports
*have* closed grants in production (the fresh Chapter 2 plan
completed 18/18 on 2026-10-31). So the construction does not fail
universally on every call — or the successful closures did not all
traverse L3 in the same state. Intermittency, data-dependence, or
engine-state-dependence cannot be excluded; a "the pattern always
throws" claim would overstate the evidence.

---

## 6. Candidate-cause table

Ratings: **supported** = production evidence points at it and no
evidence contradicts it; **plausible** = consistent with all
evidence but not singled out by it; **unlikely** = reachable only
under assumptions the evidence does not favor. Nothing below is
rated "proven": the proven facts are only those in §1–§2 and §5's
mechanical field mapping.

| ID | Candidate | Evidence for | Evidence against / limits | Rating |
|----|-----------|--------------|---------------------------|--------|
| H1 | **The §4.3.5 LIKE (L1, `grant-finalizer.mjs:417-419`) threw at E3.** The derivation's only pattern query; the identical construction (L2/L4) provably threw this exact message in production lease processing (§5). | Only LIKE/GLOB in the entire preview path (grep-complete, §4); error text is specifically a pattern-complexity error; the same construction family's production failures are independently recorded four times; all derivation steps before §4.3.5 are equality/IN reads of the same kind the E0 census exercised successfully. | No progress logging exists, so reaching §4.3.5 is inferred, not observed — steps 1–5 (§3.1) precede it and any of them throwing a *differently-caused* error with this message is not formally excluded (though none contains a pattern); the same query passes under the harness SQLite, including on production-shaped fixture data. | **Supported** as the leading candidate for the specific call site; the *reason* the engine rejected the pattern remains unproven (§4). |
| H2 | The L5 pattern (`coordinator.mjs:2185`, `job_id + ":follow:%"`) is implicated. | Same error family in the abstract. | Unreachable from the preview path and from lease processing; it runs only inside `handleReport`'s repair-chain branch. The preview never calls `handleReport`. | **Unlikely** (considered and excluded by reachability). |
| H3 | A non-LIKE derivation statement (e.g. the `IN`-subquery phase aggregates, the `spend_intents` IN-list, `derivedDayTotals`) threw, and the DO SQLite layer reported it with this message. | The 500 body alone cannot formally exclude it. | Every such statement is an equality/IN/aggregate shape with no pattern semantics; nothing in the source suggests message normalization of that kind; the identical message is independently tied to a LIKE construction in §5. | **Unlikely**. |
| H0 | **Null hypothesis: the throw occurred outside the derivation** — e.g. in the class gate's cache load/flush (`worker-entry-prod-d6.js:1340`/`:1348`) or elsewhere in the same request's handling. | The response body carries no stack or statement identity (§2); the request does execute code before and after the derivation. | No LIKE/GLOB exists in the cache code or the gate (grep-complete); the error is specifically a query-pattern error; the gate's own validation failures return named 400/403 responses, not 500s of this shape. | **Unlikely, but not excludable from the E3 evidence alone** — retained deliberately; the Stage 2 preview re-invocation (§7.3 — not part of Stage 1 and not requested by this proposal) is what would discriminate it: a deterministic re-throw on an identical isolated call, with all surrounding state verified unchanged, would narrow the field to the derivation-or-gate segment of that one request — without proving which statement inside that segment threw (§7.3). |
| H4 | The conflicts read itself (`conflictsView`, `coordinator.mjs:2792-2793`) is the failing pattern query. | It is the surface whose data carries the same error string (as stored data). | It is a plain `SELECT * FROM binding_conflicts ORDER BY id DESC LIMIT 100` — no pattern matching; it is not called by the preview; and it succeeded at E0, post-E1, and post-STOP in the same window. The error string appears there as *stored data* (§5), not as that query's own failure. | **Unlikely** (excluded). |

**Leading hypothesis, at its true strength:** the preview most
likely threw at its §4.3.5 target-set LIKE — the same
`` `op:<grantId>:%` `` construction whose identical twins in the
coordinator's lease path are recorded throwing the identical error
in production. That is a *supported hypothesis about the call
site*, not a proven root cause: why the Durable Object SQLite
build rejected a 51-character, single-wildcard pattern that the
harness engine accepts is unknown, and intermittency is not
excluded (§5 caution).

---

## 7. Staged live-diagnosis plan — FOR LATER APPROVAL (not executed here)

Everything in this section is a **proposal for future gated
steps**, split under Amendment 1 into **separately authorized
stages**. This proposal requests authorization for **Stage 1
only** (passive read-only diagnosis, §7.2). **Stage 2** (a repeat
of the failed preview, §7.3) is **not requested and not
pre-authorized**: it could only be proposed after Rowan has
reviewed the Stage 1 results, and it would require Rowan's later
review **plus** Julie's distinct approval as its own decision.
Stage 1 uses only already-existing read surfaces; it proposes no
code change, no deploy, and no new route.

### 7.1 Preconditions, and the global conflict rule (Amendment 1)

All of the following must hold before the first Stage 1 probe:

- Rowan has reviewed this proposal; Julie has given a recorded
  decision for **Stage 1** (her consumed Gate 3 GO does not cover
  it, and no decision for Stage 1 covers Stage 2).
- The system is still HELD (`GENERATION_HALT "1"`, queue paused) —
  verified by probe D1; the diagnosis never un-halts or unpauses.
- Exactly one Stage 1 attempt; no probe is retried within it
  (a failed probe is a result, recorded, and the STOP rules in
  §7.5 decide what happens next).

**Global conflict rule — binds every conflict read in the
stage.** The comparison set is the approved four-row baseline
(Gate 2D baseline, pin `9284f5ef…`, the four rows enumerated
verbatim in the Gate 3 proposal §4.4.1). At **any** point Stage 1
reads the conflict set (probes D2 and D6), **any added, removed,
or modified row relative to that baseline — in count, id,
timestamp, occurrence, or any field — immediately STOPs all
further probes in the stage.** The changed set is captured
verbatim and filed as evidence; it is not argued with, filtered,
or read past. A new `schedule_dead` row **is** evidence (that
lease processing threw, and what its message was) — but it is
**not an exemption**, and it never permits the stage to continue
past the read that found it. Any continuation after such a STOP
requires a Rowan ruling on the changed set or a separately
reviewed replacement baseline. (This rule supersedes the original
proposal's framing, under which a purely additive new row was
"evidence, not a stop": that framing is void.)

### 7.2 Stage 1 — passive read-only probes, in order

All Stage 1 probes are GETs against already-existing read
surfaces. **No Stage 1 probe invokes the preview, the finalizer,
or any generation path.** "Exposure" states what production data
the response surfaces and how it is minimized; every response is
stored verbatim under §8 and handled under the standing rule:
structural metadata only, never segment text (none of these
surfaces carries segment text in any case).

| ID | Probe (exact) | What it reads / answers | Data exposure & minimization | Requests |
|----|---------------|--------------------------|------------------------------|----------|
| D1 | `GET /health` (client surface) | Build id, halt state, coordinator state — confirms the held baseline before anything else. | Build/flag metadata only; no user data. | 1 |
| D2 | `GET /v2/conflicts` (client surface) | The complete current conflict set, compared row-by-row against the approved four-row baseline (§7.1). Answers whether the conflict set has moved at all since the Gate 3 census — and, if a new `schedule_dead` row exists, captures it verbatim as evidence that lease processing threw again (and what its message was). **Per the global rule (§7.1), any change at all — including a purely additive new row — STOPs the stage at this probe:** the changed set is evidence to file, never a reason to continue. | The conflict rows themselves (grant ids, timestamps, error strings) — the same data class already captured at E0; stored verbatim, nothing further derived from it. | 1 |
| D3 | `GET /v2/d6-plans/plan:e377a5559961b294154276b6` (client surface) | Grant still `issued` rev 2, plan `active` 8/23, job/partition unchanged — the state the E3 call faced. | Plan/grant/job structural metadata (ids, states, counts) — same class as E0 captures. | 1 |
| D4 | `GET /v2/d6-quota-reconcile` (operator surface, paginated, SELECT-only) | Reconcile still `ok: true`, drift empty, sole straddler exception; reservations/attempts census unchanged (44/52/96 on PT 2026-10-31). Rules out quota-state drift as a confounder. | Quota ledger aggregates and per-attempt day assignments (ids + day keys + counts); no text, no audio data. **Pagination is hard-bounded:** the route's page size is fixed at 100 entries per array (`QUOTA_ROUTE_DETAIL_LIMIT = 100`, `worker-entry-prod-d6.js:372`), paged independently per array via `exceptionOffset` / `driftOffset`. The D4 request sequence is: the offset-(0,0) page; continuation pages **only** as the returned totals/nextOffsets require; then one totals-stability confirmation re-read at offset (0,0). Completeness must be proven under the standing rule (disjoint pages; union = totals; totals stable across the re-read). **D4 is hard-capped at 4 requests: if completeness is not proven within 4 requests, that is a STOP (§7.5), not a continuation.** | expected 2, **hard cap 4** |
| D5 | `GET /v2/sync/changes?family=bindings&sinceSeq=1826` (client surface) | Zero binding movement since the Gate 3 census watermark — confirms nothing has written bindings in the held interval. | Binding change records since seq 1826 (expected: none). If any exist, that is itself a STOP result (§7.5). | 1 |
| D6 | `GET /v2/conflicts` (client surface) — **final conflict read** (Stage 1's last probe; this is the original proposal's D7, renumbered by Amendment 1) | Re-reads the complete conflict set at the end of the Stage 1 window and compares it against the approved baseline (§7.1): detects whether anything during the diagnosis window — including the Durable Object wakes the Stage 1 requests themselves cause — added, removed, or modified a row. Subject to the same global rule: any change is captured verbatim, ends the stage in STOP disposition, and goes to Rowan for a ruling; it is never read past and never treated as an exemption. | Same class as D2. | 1 |

**Stage 1 request ceiling (Amendment 1) — binding, not an
estimate.** D1 1 + D2 1 + D3 1 + D4 ≤ 4 + D5 1 + D6 1 =
**hard ceiling 9 requests for the whole of Stage 1; expected 7**
(D4 expected 2). The executor may not exceed 9 Stage 1 requests
for any reason; reaching the ceiling without completing the probe
list is a STOP (§7.5). No other requests are in scope for
Stage 1; anything beyond this list is a new proposal.

**Honest caveat on "read-only".** Every Stage 1 probe is a read
at the API level and none of them writes application data. As
with any request to this system, a request wakes the Durable
Object and its own alarm machinery may run (that is production's
normal behavior, and D6 exists precisely to observe any visible
effect of it on the conflict set). The Gate 3 census and
post-STOP read-backs already exercised the same surfaces in the
same held state without incident.

### 7.3 Stage 2 — a repeat of the failed preview (NOT requested)

The original proposal's probe D6 — one re-invocation of
`GET /v2/d6-grant-finalization-preview` with the exact E3 identity
parameters (same grantId/planId/jobId), via the operator
connector — is **removed from the diagnosis stage plan**. This
proposal does **not** request it, does not pre-authorize it, and
does not ask Julie to approve it. At most, this: if Stage 1
executes and its results are filed, a **separate Stage 2 proposal
could follow**, seeking Rowan's review of the Stage 1 results and
Julie's **distinct approval** for a preview re-invocation as its
own decision. Any such proposal would have to justify the
re-invocation on the Stage 1 evidence and state its own strict
ceilings (the re-invocation itself, as contemplated in the
original proposal, is exactly one request, never retried, with
its outcome ending that stage in every case).

Reproducibility is the reason a Stage 2 might ever be proposed:
it is the single most discriminating fact the passive surfaces
cannot provide (it is what would discriminate H1 from H0, §6).
It is kept out of Stage 1 precisely because re-invoking the
preview re-executes the failing code path — it is not a casual
diagnostic step, and it is never bundled into a passive-read
authorization.

**Inference discipline for any future Stage 2 (Amendment 1).**
If a Stage 2 preview re-invocation ever returns another HTTP 500
with the identical message, that result would establish **at
most** that the failure reproduces at the preview endpoint, on
that request, under the verified state conditions at the time.
It would **not** prove which SQL statement inside the request
threw, and it would **not** prove the SQLite engine mechanism
behind the message — neither conclusion is available without
statement-level evidence (for example, statement-tagged logging
or an equivalent direct observation of the failing statement),
which no current surface provides (§2). The same discipline
applies in reverse: a Stage 2 success or named refusal would
establish non-reproduction under those conditions, not that H1
is false. And if a Stage 2 call ever returned a precondition
digest, the digest would be **evidence only**: it would authorize
nothing and could never be presented to the action (any future
action needs its own gate, its own preview, and its own digest).

### 7.4 What Stage 1 can and cannot conclude

- It **can** establish: whether the lease path is still producing
  `schedule_dead` rows and with what message (any such row is
  captured verbatim at D2 or D6 — and stops the stage at that
  read, §7.1); whether any state drift since the Gate 3 census
  confounds the E3 observation (D3–D5); and the exact current
  conflict set, filed as evidence for whatever Rowan rules next.
- It **cannot** establish: whether the preview failure reproduces
  (that is Stage 2's question, §7.3); which statement threw at
  E3; or the engine-level reason SQLite rejected the pattern (no
  log or statement-level telemetry is available, §2). Stage 1
  does not propose a fix. A fix is a separate code-change
  proposal informed by whatever the diagnosis stages find.
- **Inference discipline (Amendment 1).** Nothing Stage 1 can
  return upgrades H1 (§6) from a supported hypothesis to a proven
  cause. A fresh `schedule_dead` row bearing the identical message
  would strengthen the evidence that the lease path's construction
  family still throws in production; it says nothing new about
  which statement threw inside the E3 preview request.

### 7.5 Stage 1 STOP boundaries and escalation

- **Conflict rule (global, §7.1):** at D2 or D6, any added,
  removed, or modified conflict row relative to the approved
  four-row baseline → **STOP**: no further probes in the stage,
  whatever remains of the request ceiling stays unspent, the
  changed set is captured verbatim and filed as evidence, and
  any continuation requires a Rowan ruling on the changed set or
  a separately reviewed replacement baseline. A new
  `schedule_dead` row is evidence, **not** an exemption — there
  is no "record it and continue" outcome for a changed conflict
  set.
- Any Stage 1 probe returning a non-200 status → **STOP**;
  capture and report; no further probes.
- Any probe response with an unexpected payload shape — a field
  the comparison depends on is missing, the body is unparseable,
  or totals cannot be reconciled to the comparison → **STOP**.
- D4: reconcile not `ok: true`, drift non-empty, any exception
  beyond the known straddler, totals unstable across the
  confirmation re-read, or completeness not proven within the
  4-request cap → **STOP**.
- D3/D5: grant/plan state different from the Gate 3 census, or
  any binding movement since seq 1826 → **STOP**.
- Request ceiling: the 9th Stage 1 request is the last one any
  Stage 1 approval authorizes; needing a 10th is itself a
  **STOP** and a report, never a continuation.
- **Escalation:** Stage 1 results — stopped or complete — are
  filed under §8 and returned to Rowan. What they support next
  is Rowan's call: a Stage 2 proposal (§7.3), a code-change
  proposal (for example, replacing the LIKE prefix scan in the
  derivation — and, for Rowan's consideration, its coordinator
  twins — with a non-pattern read), a replacement-baseline
  ruling after a conflict STOP, or nothing further. This
  proposal deliberately designs none of those.

---

## 8. Evidence-capture specification (for the future diagnosis step)

- **Where:** `~/workspace/ch2-program/ch3-recovery/gate3/diagnosis/execution/evidence/`,
  created by the diagnosis execution (it does not exist yet and
  this proposal creates no execution directory).
- **What is saved, per probe:** the request (method, path, query —
  headers recorded by name only, **credential values never
  written**), the verbatim response envelope and body, the HTTP
  status, and start/end timestamps (the Gate 3 evidence pattern:
  `preview-e3.json` + window files).
- **Derived artifacts:** a compare sheet mechanically checking
  D1–D6 values against the Gate 3 E0 census values and the
  four-row conflict baseline (any conflict mismatch is a STOP
  under §7.5, with the changed set itself preserved verbatim as
  a capture); a SHA-256 census-evidence digest over the sorted
  capture listing (the established pattern), kept distinct from
  any preview precondition digest a future Stage 2 might return
  — the two digests are named separately in the record and never
  conflated (Gate 3 proposal §7.14 discipline).
- **Record and filing:** a `diagnosis/execution/EXECUTION-RECORD.md`
  stating each probe's outcome, the STOP/escalation disposition,
  and the hypothesis table (§6) re-rated against the new evidence
  — hypotheses re-rated explicitly, never silently upgraded to
  findings. The record is pinned in repo
  `jedavid33-design/opal-reader`, branch `ui1-review` (single-parent
  child of the then-current head, per-blob SHA assertions,
  read-back verification) and filed on board issue #15 with a
  fresh handoff ID for Rowan's review, following the established
  gate pattern.

---

## 9. What stays true regardless, and the traced source

**Regardless of any review outcome:** the system stays HELD
(halt `"1"`, queue paused) — this proposal does not propose
releasing the hold; the finalizer is not retried under the
consumed GO 6559241292; no generation, no submission, no
exemption, no re-arm; $0 spend. The preview is not re-invoked
under anything this proposal authorizes: Stage 1 contains no
preview call, and Stage 2 is not requested (§7.3). Any code
change or deploy, any baseline change, any Stage 2, and any new
Gate 3 attempt each require their own proposal and their own
approval, in that order.

**Traced source files** (live build `408f9149` tree,
`finalizer-build/worker-build/worker/`):

| File | SHA-256 | Lines |
|------|---------|-------|
| `generation/grant-finalizer.mjs` | `15dd575f77efb0d5159f3674162728662b102891cd95cd7b680bf4a8bd0794ee` | 830 |
| `coordinator.mjs` | `5d0727638b24e497c7b7ca73d6deead411a5ebc8e475163f78aa0b01d72a3de5` | 5,042 |
| `worker-entry-prod-d6.js` | `292ca83e892d5d675f1c107ea4adf1fed34cca6c054fcd068c51b403f79f8a31` | 1,964 |
| `generation/quota-budget.mjs` | `2b39924579e5af2d5d20eea01122d2323ccedac9fe9ff9f7026c49af14770820` | — |
| `generation/genstore.mjs` | `811b6b15b790097ad0010be3c71881c5024331143b4b0e2031392287bb839c2a` | — |

**Saved evidence relied on:** `gate3/execution/EXECUTION-RECORD.md`
and its `evidence/` directory — in particular `preview-e3.json`
(the verbatim 500), `compare-e0.txt` (21/21), `conflicts-e0.json` /
`conflicts-e1.json` / `conflicts-stop.json` (the four-row set,
unchanged across the gate), `census-evidence-digest-e0.txt`
(`bef72c47e31414e08796b7e5a3d84511a761c7d746bd9950067519f0aeb16b19`),
and the E3 window timestamps (14:29:00Z → 14:29:01Z).

— Wren (diagnosis-proposal author; preparation only, nothing executed)
