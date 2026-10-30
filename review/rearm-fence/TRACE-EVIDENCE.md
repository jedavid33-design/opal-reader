# RE-ARM FENCE — TRACE EVIDENCE LOG (supporting DESIGN-PACKET.md)

Method: read-only source inspection of the gen-pkg-1 candidate
tree (`~/workspace/gen-pkg-1/worker-build/`, the source of live
pin `f3b6e6e9…`), the signed Option-B amendment and the
grant-lifecycle addendum (local records under
`~/workspace/gen-pkg-1/logs/`), the D0 live-read evidence files,
and Rowan's ruling 6528590586 read directly from the board.
No production contact was made for this packet; every production
fact cited is from the existing Gate-1/D0 evidence record.

## Verification log

1. **Branch head (STOP check).** `GET
   /repos/jedavid33-design/opal-reader/git/refs/heads/ui1-review`
   → `548a0ffefdd263643506ed26fd984aa8dbb449b4` — matches the
   required parent exactly. (Re-verified immediately before the
   pin's ref update.)

2. **Rowan's condition.** Comment 6528590586 read in full from
   the board. Operative sentence for this case: "…generic re-arm
   must remain blocked until a separate reviewed control proves a
   stale Chapter 2 queue message cannot contact the provider for
   those nine occurrences, or closes that risk through an
   enforceable, tested server-side fence." Amendment §5
   (DEPLOY-PLAN-AMENDMENT-OPTION-B.md:457–487) carries the same
   condition as an operative term of Gate 1.

3. **Queue entry.** `worker-entry-prod-d6.js`: `queueHandler` at
   :880; `assertGenerationEnabled(env)` at :881; per-message POST
   to `https://do.internal/internal/execute` at :886–895; `ack()`
   on `response.ok`, `retry()` otherwise, :896–901. Default
   export `{ fetch, queue: queueHandler }` at :904–905 — the old
   `worker/executor.mjs` is not this script's consumer path.

4. **Execute routing.** `worker-entry.js:215–216` routes POST
   `/internal/execute` to `this._execute(...)`; the production DO
   class is the D6 subclass, whose `_execute` is at
   `worker-entry-prod-d6.js:589–613`: halt assert :593; shape
   validation :595–596; `createD6Executor` with
   `consumerId: this.env.EXECUTOR_CONSUMER_ID ||
   "opalreader-v2-prod-d6"` at :605.

5. **Halt layers.** `host/adapters.mjs:85–88`
   (`assertGenerationEnabled` throws unless `GENERATION_HALT ===
   "0"`); asserted inside the adapters at :290, :299, :344, :376.

6. **Executor path.** `generation/d6-executor.mjs`:
   `handleMessage` :468; batch layer 1 :472–476; job lane layer 2
   :480–482; quarantine block :500–527 (strict reads via
   `heldQuarantineStrict` after `ensureQuarantineSchema`, refusal
   `{refused: "plan_quarantined"}` / `"quarantine_check_failed"`);
   claim handling :529–533 (drop on completed/closed/unknown_grant;
   stand-down only on `already_claimed` by a DIFFERENT consumer);
   occurrence loop :539–546 (skip unless row state `granted`);
   existing-execution handling :551–565; `runFresh` call :592;
   report tail :605–613.
   `runFresh` :279–466: `createExecution` :282;
   `acquireSpendIntent` :293; intent-fence skip :296–317;
   `attempted` transition :319; attempts budget :321–323
   (`SEGMENT_ATTEMPT_BUDGET = 12`, `generation/gen-constants.mjs:16`
   — a split-depth budget, not a dispatch gate);
   `wrappedSynthesize` :328–352 with **`providers.synthesize` at
   :335**; attempt reservation immediately before it via
   `store.reserveAttempt` / `markDispatching` :330–331.

7. **NEGATIVE RESULT — no plan-state read in the executor.**
   `grep -n "halted|planState|plan_state|phaseHalt|phase_halt"
   generation/d6-executor.mjs` → **zero matches.** The D6 executor
   contains no reference to plan state, phase halt, or the word
   "halted" anywhere.

8. **Claim semantics.** `worker/coordinator.mjs` `claimGrant`
   :2696–2725: existing claims row returned first (:2701–2705,
   `already_claimed` when state `claimed`) BEFORE the
   reported/voided/superseded grant-state branches (:2706–2717) —
   grant state is never consulted when a claim row exists.
   `acquireSpendIntent` :2789–2810: refuses on any non-superseded
   existing intent; otherwise requires claim state `claimed` and
   `claim.consumer_id === consumerId`. `probeVerdict`
   :2730–2736: verdicts derive ONLY from claim rows.
   `closeAcceptance` :2745–2767: a `claimed` grant refuses
   closure.

9. **Budget absence on the executor path.** `generation/genstore.mjs`
   `reserveAttempt` :127–145: validates the execution is
   non-terminal and inserts the attempt row with its upper bound;
   **no budget, cap, or phase check**. Phase-budget and phase-halt
   enforcement live at issuance: `generation/grant-guards.mjs`
   `d6PhaseHalt` :49, `d6GrantGuard` :78 (called from grant
   issuance, not from the executor).

10. **Driver / admission / retirement.** `generation/service.mjs`:
    `driveOnce` plan selection :824 (`state NOT IN ('complete',
    'partial', 'retired', 'halted_unknown')`);
    `PLAN_FENCE_TERMINAL = ["complete", "partial", "retired"]`
    :607, used by the `submitIntent` overlap fence :610–632;
    `retireHaltedPlan` :458–492 — refuses unless plan is
    `halted_unknown` (:464–465), refuses while a confirmed/unknown
    attempt is open (:468–473), then writes ONLY the retirement
    audit row + plan state (:475–484). No grant, claim, or job
    write.

11. **Quarantine write points (exhaustive).** Sole writer
    `recordQuarantineHold`, `generation/quarantine.mjs:173`.
    Callers: `generation/service.mjs:745` (new plan submitted
    while halted; comment :742–743: "a pre-existing plan is never
    retro-marked"), `generation/grant-guards.mjs:133` and `:170`
    (plan-less job paths). No other callers in the tree
    (grep-verified across `generation/` and `worker/coordinator.mjs`).

12. **Drain.** `worker/coordinator.mjs` `drainOutbox` :1748–1750
    selects `WHERE sent_at IS NULL`. The Ch 2 grant's row has
    `sent_at` set (addendum §2.0(c), derivation from
    `schedule_dead` lease rows read live at `GET /v2/conflicts`,
    addendum §2.0(b)).

13. **Production shapes (from the D0 evidence record, Oct 30).**
    `plan-ch2.json`: plan `halted_unknown`,
    stopReason `phase_halted_unknown_billing`, totals eligible 18 /
    done 0 / failed 8. `job-ch2.json`: job state `generating`,
    revision 2, occurrence rows state `granted`. Gate-1 D4
    diagnostics (filed record): 58 attempts all `confirmed`;
    Ch 2 = exactly 8 failed + 1 unknown_billing executions.

14. **Consumer identity.** The string `opalreader-v2-prod-d6` is
    the `_execute` default in all three relevant trees: the G4
    build (d6-build rollback package), the seed-fix archive, and
    the current candidate (grep-verified). The addendum §2.0(d)
    derivation: 9 Ch 2 occurrences acquired spend intents on
    Oct 29, which `acquireSpendIntent` permits only against a
    `claimed` row held by the acquiring consumer — hence claim
    consumer = the production executor consumer.

15. **Queue platform facts.** `generation/wrangler-queues.md`:
    queue `opalreader-generation-v2`, `max_batch_size = 10`,
    `max_retries = 3`, no DLQ in the spec block; Free-plan message
    retention 24 hours; "queue messages are re-derivable from
    [the durable work plan], never the record" — the design
    premise the fence relies on (the plan, not the message, is
    the authority).

## Assumption register (explicit, per the packet's §6)

- A1. The claim row for the Ch 2 grant is in state `claimed`,
  consumer `opalreader-v2-prod-d6`. Basis: code-mediated proof
  (item 14). No read surface exists. The fence design is
  indifferent to this assumption (it refuses before claim), but
  the §1.2 trace's exposure branch depends on it; the contrary
  branch (different consumer → stand-down at claim +
  `claimed_by_other` at intent) is stated in the packet.
- A2. The 9 never-attempted occurrences still hold no execution
  record and no spend intent. Basis: D0/Gate-1 reads (Oct 30);
  nothing since then could have created one (generation halted,
  queue paused, driver excludes the plan). If a future read
  showed otherwise, the exposure set shrinks; the fence design
  is unchanged.
- A3. Line citations are to the pin `f3b6e6e9` source tree as
  checked out locally; the deployed build's identity was
  Gate-1-verified against this pin (etag `82b3be1d…`, /health
  build marker).

---

## Revision-1 addendum — verification for Rowan's corrections (Oct 30, 2026)

Method: read-only source inspection of the Workstream B tree
(`~/workspace/ch2-program/fix/worker-build/`, the fence build's
base, pin `22a849a8…` lineage). Items 16–21 ground DESIGN-PACKET
Revision 1. The original log above is unedited except item 10's
driver citation (see item 20).

16. **`planIdFor` is message-first and error-swallowing.**
    `generation/d6-executor.mjs:110–122`: returns
    `msg.planId || msg.d6PlanId` BEFORE any server record; then
    the job's `data_json` (`d6PlanId`, then `planId`); the whole
    lookup is wrapped in `catch { /* plan id is optional
    bookkeeping; never fail work over it */ }`. It never queries
    `d6_plan_jobs`. This is the helper the ruling's correction 1
    excludes from fence decisions.

17. **The quarantine check consumes `planIdFor`; its link
    fallback is also swallowed.** `d6-executor.mjs:518–545` (the
    pre-claim block): `qPlanId = planIdFor(jobId, msg)` at :520;
    the `d6_plan_jobs` fallback runs ONLY when `qPlanId` is null
    (:522–527) and is wrapped in `catch { /* link is optional
    bookkeeping here */ }`. Strict branch :528–541:
    `ensureQuarantineSchema`, `heldQuarantineStrict` for plan
    (:534) and job (:535), catch → `{ refused:
    "quarantine_check_failed" }` (:537), held → `{ refused:
    "plan_quarantined" }` (:539). `claimGrant` is called at :547
    — the block is the last checkpoint before claim. Consequence
    verified: a message carrying a foreign planId steers the
    quarantine plan-subject away from the job's real plan
    (correction 2's bypass; test T10).

18. **The authoritative persisted records.** Schema
    `generation/gen-schema.mjs:37–44`: `d6_plans` (:37) and
    `d6_plan_jobs (plan_id, job_id, chapter_index, seq, PRIMARY
    KEY (plan_id, job_id))` (:42–44) — the PK admits multiple
    rows per job under distinct plans (test T12). Writers:
    `generation/service.mjs:156` stamps `d6PlanId: plan.plan_id`
    into the SubmitJob payload (→ the job's `data_json`);
    `:160–164` inserts the `d6_plan_jobs` row
    (`INSERT OR IGNORE`) when the chapter job is applied. Both
    records are server-written at plan/job creation; neither is
    message-carried.

19. **The strict read primitive.** `worker/coordinator.mjs:390–407`:
    `_oneOrNull` is implemented over `toArray()` with an explicit
    cardinality check — 0 rows → null, 1 row → the row, >1 rows →
    throw, SQL errors propagate uncaught (header comment :390–399:
    strict reads are the design intent). `heldQuarantineStrict`
    (`generation/quarantine.mjs:164–167`) documents the D8-1 fence
    discipline §2.1 mirrors: caller ensures schema, any SQL error
    propagates, the fence treats the throw as a refusal, "never
    returns a fabricated all-clear." (`d6_plans`/`d6_plan_jobs`
    are core `GEN_SCHEMA` — genstore bootstrap ensures them — so
    no lazy-ensure step applies to the new reads.)

20. **Plan-state vocabulary is closed.** `setPlanState` write
    sites (`generation/service.mjs`): `retired` :495,
    `complete` :772 and :801, `partial` :801, `halted_unknown`
    :877, `parked_storage` :885, `active` :911/:938 and at
    creation :783; parked family map :55–59 (`parked_quota`,
    `parked_cap`, `parked_budget`, `parked_storage`), applied
    :915. Driver selection query: `:840–841` —
    `state NOT IN ('complete', 'partial', 'retired',
    'halted_unknown')`. (The original packet cited :824, the
    selection block's R4-1 comment region; corrected to :840 in
    Revision 1.) Plan-row read pattern:
    `SELECT * FROM d6_plans WHERE plan_id = ?`
    (`service.mjs:120`, `genstore.mjs:272`, `:372`).

21. **Post-claim `planIdFor` use.** `d6-executor.mjs:552`:
    `const planId = planIdFor(jobId, msg)` after claim, feeding
    execution-record creation (e.g. the `removed_provider`
    branch). Under the corrected design this bookkeeping adopts
    the §2.1 resolved identity, so no executor surface attributes
    work to a message-carried plan.

— Wren (Workstream A, Chapter 2 program)
