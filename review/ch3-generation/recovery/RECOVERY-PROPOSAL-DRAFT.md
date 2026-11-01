# Opal Reader v2 — Chapter 3 Phase A Recovery Proposal (Draft)

**Status:** Design only. Nothing in this draft is built, deployed, or executed by its filing.

**Companion diagnosis:** `DIAGNOSIS.md` in this directory. Every source claim below rests on the file:line proof there.

**Live build at diagnosis:** `63d7260ef0c87c45cdcb88c7007643bb90e1631c`

**Scope:** Recovery of exactly one stalled plan/grant:

- Plan: `plan:e377a5559961b294154276b6`
- Job: `plan:e377a5559961b294154276b6:ch2`
- Grant: `grant:plan:e377a5559961b294154276b6:ch2:1:full`
- Book: Forever Pucked (`5c589095-f812-48a2-8ab2-03ba2791f2b2`), chapterIndex 2

**Explicitly out of scope:**

- Phase B / the index-26 chapter exemption;
- any new plan submission;
- plan retirement;
- grant voiding;
- quota bypass;
- any other book, chapter, plan, job, or grant;
- Batch;
- the rest of Forever Pucked.

---

## Authorization structure — separable gates

No gate below is authorized by approval of an earlier gate. A reviewer PASS is not an execution authorization.

### Gate 1 — Diagnosis

**Content:** The read-only source/evidence diagnosis in `DIAGNOSIS.md`.

**Authorization line:** Proceeding beyond diagnosis requires Julie's explicit GO and Rowan review of the pinned diagnosis/proposal. Gate 1 itself performs no code change and no production action.

### Gate 2 — Code change (required for the recommended Option A)

**Content:** Build and test the dedicated operator-only grant finalizer described in Option A, repo-only.

**Authorization line:** Gate 2 requires Julie's explicit GO and Rowan source review. Gate 2 does **not** authorize a production deploy, a production finalization call, resumed generation, or Phase B.

### Gate 2D — Halted deploy and re-arm of the finalizer build

**Content:** The established separate halted-deploy sequence for the Gate 2 build, followed by the established separate re-arm sequence, ending live-but-idle with the finalizer route present but uncalled.

**Authorization line:** Gate 2D requires its own explicit Julie GO and Rowan operational review. It does **not** authorize calling the finalizer.

### Gate 3 — Production grant finalization

**Content:** Halt generation, pause the queue, take a fresh complete census, make exactly one authorized finalizer invocation for the exact grant above, keep the system held, and perform the full post-action readback set in §8.

**Authorization line:** Gate 3 requires its own explicit Julie GO and Rowan review of the fresh census. It does **not** authorize resumed generation or Phase B.

### Gate 4 — Continuation of the remaining 15

**Content:** Separately release the hold (unpause/unhalt in the order the governing re-arm procedure specifies) and observe the ordinary driver issuing the next grant(s) for the same plan/job until the 15 pending occurrences finish or a STOP condition fires.

**Authorization line:** Gate 4 requires its own explicit Julie GO. Finalization success in Gate 3 must never be treated as implied consent to spend on cohorts 2–3.

---

## 1. Honest remaining-work quote

The closing Phase A eligibility read — not a new quote — is:

| Item | Value |
|---|---:|
| Remaining Phase A segments | 15 |
| Remaining characters | 20,864 |
| Expected cost | 294,137 ledger units (≈ $0.294) |
| Phase settled before recovery | 732,303 |
| Phase remaining before recovery | 12,762,049 of 13,500,000 |
| Estimated unverified | 19,018 (unchanged; an estimate, never a known charge) |
| Reserved unverified | 5,648 (unchanged; a modeled allowance) |
| Unknown open | 0 |

The $0.294 figure is the eligibility quote for the 15. Actual recorded cost will depend on the attempts/splits the continuation actually makes, exactly as cohort 1's recorded +152,964 differed from a simple per-segment estimate. The quote fits inside the phase's remaining 12,762,049 units. Phase B's final segment is separate and is not included in this quote.

---

## 2. Accounting that every recovery option must preserve

### 2.1 Before finalization

| Figure | Before |
|---|---:|
| Plan state / done | `active` / 8 of 23 |
| Job state / revision | `generating` / 2 |
| Job occurrences | 8 `ready`, 15 `pending`, 0 `granted` |
| Grant state / revision | `issued` / 2 |
| Claim | must be freshly read; expected `claimed`, not `completed` |
| Executions under the grant | 8, all `committed` |
| Attempts under the grant | 44, all `confirmed` (30 success, 14 policy_block) |
| Dispatch rows for PT 2026-10-31 | 44 |
| Open reservations for the grant | 8 |
| Reservation slots total | 96 |
| Reservation slots consumed | 44, distributed 4 / 6 / 6 / 6 / 6 / 6 / 4 / 6 by occurrence |
| Reservation residual | 52 |
| PT 2026-10-31 derived totals | dispatched 44, reserved 52, consumed 96 |
| Phase settled | 732,303 |
| Bindings / content watermarks | 1826 / 18 |

### 2.2 After a truthful grant finalization — and before any resumed generation

| Figure | After finalization |
|---|---:|
| Plan state / done | `active` / 8 of 23 (unchanged) |
| Job state / revision | `generating`; revision unchanged unless a job event in the finalizer design explicitly says otherwise |
| Job occurrences | 8 `ready`, 15 `pending`, 0 `granted` (unchanged) |
| Grant state | `reported` |
| Claim state | `completed` |
| Executions | 8 `committed` (unchanged) |
| Attempts | 44 `confirmed` (unchanged) |
| Dispatch rows | 44 (unchanged; none erased, none added) |
| Reservations for the grant | 8 `closed`, every one with `close_reason = grant_settled` |
| Stored `slots_consumed` | unchanged: 4 / 6 / 6 / 6 / 6 / 6 / 4 / 6 |
| PT 2026-10-31 derived totals | dispatched 44, reserved 0, consumed 44 |
| Phase settled | 732,303 (unchanged) |
| Estimated / reserved unverified | 19,018 / 5,648 (unchanged) |
| Unknown open | 0 (unchanged) |
| Bindings / content watermarks | 1826 / 18 (unchanged) |
| Eligibility | still 15 eligible / 11 bound / 1 parked, digest `9453ab5dc7ee6ade7c650d14066054b965875f2ef1b65eb24bc633588d778e67`, unless the fresh Gate 3 census supersedes it before action |

Any option whose “after” table differs from this — other than a separately explained, separately authorized continuation — has changed more than grant bookkeeping and must be held.

### 2.3 Why closing the reservations is not a quota bypass

Closing a reservation does not delete its dispatches, rewrite its consumed count, or grant new slots retroactively. It records that dispatch under that grant has become impossible/complete, which is the exact semantic of `grant_settled` in `generation/quota-budget.mjs:102-107` and the single release fence at `generation/quota-budget.mjs:662-692`.

The 44 dispatches remain counted on PT 2026-10-31 forever. What changes is only that the 52 unused worst-case slots stop being held open for a grant that can no longer dispatch.

---

## 3. Quota-day interaction for continuation

This section answers Rowan's rollover point operationally.

### 3.1 Rollover alone

If nothing is finalized and the PT day rolls over:

- the grant remains `issued`;
- the eight PT 2026-10-31 reservations remain `open` on their original day;
- the new day's derived totals do not include the old day's reservations;
- the driver still refuses a new grant because `liveGrant` is true.

**Rollover is not recovery.**

### 3.2 If finalization happens on PT 2026-10-31 itself

After the eight reservations close:

```text
PT 2026-10-31 derived: 44 dispatched + 0 reserved = 44 consumed
Headroom: 56 slots
```

Each remaining occurrence is fresh and needs a 12-slot worst-case reservation. The first continuation prefix that day is therefore:

```text
floor(56 / 12) = 4 occurrences (48 slots)
```

not eight. Later prefixes that same day depend on how many provider attempts those cohorts actually dispatch, because derived `dispatched` grows attempt-by-attempt while reservations convert to dispatches.

### 3.3 If finalization has already happened and continuation starts on a fresh PT day

Before any new dispatch that day:

```text
New day derived: 0 dispatched + 0 reserved = 0 consumed
Headroom: 100 slots
First continuation cohort: 8 occurrences (8 × 12 = 96)
```

After that cohort settles, the next prefix is **not** automatically seven and is **not** automatically deferred to another day. It is recomputed from that day's derived totals:

```text
next prefix size = longest ordered prefix of the remaining fresh occurrences
                   whose 12-slot reservations fit in 100 − derived consumed
```

Two illustrative extremes for a fresh day:

- If cohort 2's eight occurrences each dispatch exactly once (8 dispatches), 92 slots of derived room remain after settlement, and all seven remaining occurrences fit (7 × 12 = 84): the 15 can finish in two cohorts that day.
- If cohort 2 resembles cohort 1 and dispatches 44 attempts, 56 slots remain after settlement, and the next prefix is four occurrences (48 slots), with the rest continuing as headroom allows, potentially on a later day.

The governing rule is the derived-total formula, not a fixed 8/7 or 8/4/3 promise. Any execution plan for Gate 4 must quote cohorts conditionally in exactly this way.

### 3.4 If finalization happens on a fresh day but continuation is not authorized until a later day

Finalization changes only the old grant and its old-day reservations. It creates no reservation and no credit on the continuation day. Gate 4's first cohort is sized from the continuation day's own derived totals at that time.

---

## 4. Option A — Dedicated operator-only grant finalizer (RECOMMENDED)

### 4.1 Shape

Add one new operator-only surface and one coordinator finalization operation. Reuse the existing closure semantics; do not invent a second accounting system.

Proposed surface (names are design proposals for Gate 2, not shipped routes):

- Preview: `GET /v2/d6-grant-finalization-preview?grantId=<exact grant>`
- Action: `POST /v2/d6-finalize-grant`

Both join the existing operator fence class used by the Chapter 3 mechanisms:

- the public production gate skips the ordinary client token for the route;
- admission requires the migration-operator credential;
- the public entry stamps `x-opalreader-operator-admitted: 1` only after that credential is presented;
- the Durable Object class gate requires the stamp again.

That fence pattern is the one documented for the park-release/exemption routes at `worker-entry-prod-d6.js:1490-1504` and enforced at `worker-entry-prod-d6.js:1550-1564`.

### 4.2 Closed request shape

The action body is closed — unknown keys are refused. Proposed body:

```json
{
  "grantId": "grant:plan:e377a5559961b294154276b6:ch2:1:full",
  "planId": "plan:e377a5559961b294154276b6",
  "jobId": "plan:e377a5559961b294154276b6:ch2",
  "authorizationRef": "<the Gate 3 authorization citation>",
  "expectedPreconditionDigest": "<digest returned by the preview surface>"
}
```

Hard rules:

- No `results` array. The caller can never supply success/failure/block outcomes.
- No caller-supplied job revision. The finalizer reads the current job revision inside its own transaction.
- No caller-supplied counts are trusted. Every count is re-derived server-side inside the transaction; the supplied digest is only a concurrency check.
- No caller-supplied close reason. The only reason is `grant_settled`.
- `authorizationRef` is required, non-empty, and stored in the audit record.
- Any grant/plan/job mismatch refuses with no writes.

### 4.3 Server-side precondition proof — all inside the finalization transaction

The finalizer must derive and verify **all** of the following from durable records inside one coordinator transaction. Any failure throws or returns a no-write refusal; a partial finalization is not an acceptable outcome.

**Identity and state**

1. The grant exists, its job ID and plan link match the body's plan/job exactly, and its state is `issued` — or it matches the exact already-finalized state defined in §4.5.
2. The job exists, belongs to the same book/chapter/lane/phase as the plan, is `generating`, and has exactly one grant: this one.
3. The plan exists, is `active`, has exactly 23 eligible entries for this job, and its totals are done 8 / failed 0 / blocked 0 / prompts 0.
4. No Phase B exemption row exists for the chapter's final occurrence, and the park-release row for this chapter remains releaseId 1 / `live`, untouched.

**Grant target set**

5. The grant's ledger attempt set (`ledger_ops` rows of kind `attempt` for this grant) contains exactly eight occurrence IDs — no more, no fewer.
6. The outbox payload for this grant, if the row is present, names exactly the same eight IDs. Preferred Gate 3 rule: the outbox row must be present with `sent_at` set (acknowledged handoff). If it is absent, the finalizer stops; absence may be taken as proof only under a separate Rowan ruling that names the claim + execution + dispatch evidence as a substitute.
7. Every target occurrence is `ready`; none is `granted`, `pending`, `blocked_policy`, `failed`, or `outcome_unknown` under this job.
8. The job's full occurrence partition for this plan is exactly 8 `ready` + 15 `pending`; the 15 pending IDs are exactly the plan's eligible IDs minus the grant's eight.

**Execution and attempt proof**

9. Exactly eight execution records exist for this grant/job, one per target, and every one is `committed`.
10. No execution record exists under this plan/job for any of the 15 pending occurrences.
11. Every attempt under the eight executions is `confirmed`; none is `reserved`, `dispatching`, or unknown.
12. Attempt counts per occurrence are exactly 4 / 6 / 6 / 6 / 6 / 6 / 4 / 6 in the target order established by the census, totaling 44.
13. The dispatch ledger contains exactly 44 rows for this grant, one per attempt ID, all with dispatch day PT 2026-10-31.
14. Plan-level unknown open is 0, and a fresh quota reconcile for the census window is `ok: true` with empty drift (the finalizer transaction re-derives the grant-local facts; the reconcile remains a Gate 3 external precondition).

**Claim proof**

15. Exactly one claim row exists for the grant; its state is `claimed`. (The saved job view does not expose the claim, so this must be read by the preview/finalizer surfaces, not assumed from the execution record.)
16. No `_completeClaim` effect is present before action: a `completed` claim beside an `issued` grant is an inconsistent state and stops the finalizer.

**Reservation proof**

17. Exactly eight reservation rows exist for this grant, all `open`, all with `day_key = 2026-10-31`, each `slots_total = 12`.
18. Each row's stored `slots_consumed` equals both (a) that occurrence's attempt count and (b) the derived dispatch count for `(grant, occurrence, 2026-10-31)`.
19. The residuals sum to exactly 52.
20. Derived totals for PT 2026-10-31 are exactly dispatched 44 / reserved 52 / consumed 96 at the moment of finalization. If any other authorized work has changed them, this proposal no longer describes production and Gate 3 stops for a revised census.

**Money and sync proof**

21. Phase settled is exactly 732,303; estimated unverified 19,018; reserved unverified 5,648; phase remaining 12,762,049.
22. Bindings watermark is 1826 and content watermark is 18.
23. Each target occurrence's binding matches its committed execution's cache key. (This is a read-only consistency check; the finalizer never rebinds.)

**Absence-safe reading rule**

Every precondition read whose absence is a legitimate refusal outcome must use `_oneOrNull` or `_all`, never a bare `_one()`. Bare `_one()` is permitted only for scalar aggregates (such as `COUNT(*)`) where SQLite guarantees a row. This mirrors the discipline documented for diagnostics at `generation/service.mjs:1418-1420` and the `_oneOrNull` contract at `coordinator.mjs:394-410`.

### 4.4 Exact writes

In the same transaction, after every precondition passes:

1. Insert one audit row into a new append-only table (proposed `d6_grant_finalizations`) keyed by `grant_id`, containing at least:
   - grant, plan, and job IDs;
   - `authorizationRef`;
   - the precondition digest and the before totals (44 / 52 / 96; settled 732,303);
   - the server timestamp;
   - outcome `applied`.
   A duplicate primary key on replay is the idempotency signal in §4.5, not an error to paper over.
2. Perform the same closure statements as an empty `handleReport`, in the same order:
   - defer any ledger-listed target still `granted` (precondition 7 proves there are none; the statement remains as a fail-safe, and if it would change any row the transaction must instead abort — see the note below);
   - `UPDATE grants SET state = 'reported', report_json = ?` where `report_json` is a clearly labeled operator-finalization record, e.g. `{ "grantId": ..., "results": [], "detail": { "finalization": "operator_grant_finalization", "authorizationRef": ..., "preconditionDigest": ... } }` — never a record that impersonates an executor report;
   - `_completeClaim(grantId)`, and verify exactly one claim row moved `claimed → completed`; any other result aborts the transaction;
   - `settleReservationsForGrant(grantId)`, and **require** its result to be exactly the eight expected reservation IDs in `closed` with an empty `blocked` list; anything else aborts the transaction. This is deliberately stricter than generic `handleReport`, which does not inspect the blocked list;
   - `_deriveJobCompletion(jobId, "operator_finalization")`, and verify the job remains `generating` because 15 occurrences are open.
3. No other writes.

> **Design note for Rowan:** the generic closure's “defer unmentioned granted targets” step is safe in `handleReport` because the executor's report is the grant's final word. In the finalizer, precondition 7 has already proved no target is `granted`. Gate 2 should decide whether the finalizer (a) reuses the shared closure code verbatim for maximal semantic identity, accepting the defer step as a proved no-op, or (b) extracts the post-result closure into a shared internal function with an explicit `expectNoGrantedTargets` assertion. This draft recommends (b) if it can be done without changing `handleReport`'s behavior for ordinary reports; otherwise (a) with a test proving the defer loop changes zero rows in the Phase A fixture.

**Writes that must not occur:**

- no provider call and no attempt/dispatch row;
- no binding or cache-key change;
- no phase-accounting change;
- no plan/job state change beyond the derivation no-op above;
- no change to any of the 15 pending occurrences;
- no park-release or exemption write;
- no new grant, plan, job, outbox row, or schedule row created by the finalizer itself.

### 4.5 Idempotency

The finalizer is idempotent by state recognition, not by repeating effects:

- **First success:** grant `issued → reported`, claim `claimed → completed`, eight reservations `open → closed`/`grant_settled`, one audit row. A second settlement credit is impossible because `closeReservation` returns `alreadyClosed` for a closed row (`generation/quota-budget.mjs:667`) and the finalizer requires the audit row's presence on any replay.
- **Exact replay:** if the grant is `reported`, an audit row exists for it, the claim is `completed`, and all eight reservations are `closed` with `grant_settled`, return `{ outcome: "already_finalized", ... }` with zero writes.
- **Reported without an audit row:** this means a real executor report landed, not this finalizer. Return a no-write `already_reported_not_finalizer` outcome; do not claim it as a finalizer replay.
- **Reported with reservations still open:** inconsistent partial state. **Stop.** Do not silently settle in the replay path; that state needs its own ruling because it is not a state this finalizer can produce (its transaction either commits all of it or none of it).
- **Any other grant state** (`voided`, `handoff_uncertain`, missing): refuse with no writes.
- **Ambiguous response at Gate 3:** read back first. Idempotency makes a verified replay safe, but Gate 3 authorizes one invocation; a second invocation after an ambiguous response requires the readback to be reported and a fresh explicit ruling, exactly as with every other gated production act in this project.

### 4.6 How the 15 resume after Gate 3

Finalization does not resume anything by itself. At Gate 4, once the hold is released, the production alarm runs service `recover()` then `driveOnce()` (`worker-entry-prod-d6.js:1379-1390`). The driver's grant step then sees:

- plan still `active`;
- job still `generating`;
- 15 occurrences `pending`;
- no grant in state `issued`.

It requests the next grant through the ordinary `_issueGrant` path (`generation/service.mjs:979-1007`, `coordinator.mjs:1635-1773`). All ordinary fences remain in force: phase policy/budget, storage projection, monthly cap, grant-count ledger, quota cohort bounding, quarantine, and halt fences.

**Why no duplicate provider calls for the eight done:**

- They are `ready`, bound, and excluded from the pending set the driver grants from (`generation/service.mjs:982` selects only `pending`).
- Their executions are `committed`; the driver also refuses to grant a pending occurrence with a non-terminal execution (`generation/service.mjs:985-991`), and none of the eight is pending in any case.
- Eligibility independently excludes them as `bound_already` (11 = 3 pre-existing + 8).

**Why no duplicate provider calls for the 15:**

- They have no execution records, no attempts, and no dispatch rows under this plan (preconditions 10–13 prove the grant-local side; Gate 3's diagnostics census proves the plan-local side).
- The coordinator's spend-intent fence is per occurrence: an intent permits exactly one provider spend for that occurrence, and a second acquisition by anyone returns the existing intent with `acquired: false` (`coordinator.mjs:2881-2889`). The 15 have no prior acquired intent under this job to collide with; their first continuation grant is their first spend authorization.
- Cohort bounding takes the ordered pending prefix only, so the cohort sequence cannot omit or duplicate an occurrence across grants (the invariant stated at `generation/quota-budget.mjs:605-621` and exercised by the tests cited in the diagnosis).

**New grant identity:** the continuation grant is constructed from the job's current revision (`grant:${jobId}:${job.revision}:full`, `coordinator.mjs:1695`), so it cannot collide with the revision-1 grant being finalized.

### 4.7 What Rowan should check hardest in Option A

1. Whether an operator-generated empty closure is semantically legitimate when all successes were committed outside `handleReport` — i.e., whether “the grant's executions are terminal and its audio is bound” is a sufficient truth condition for `reported`.
2. Whether the precondition set in §4.3 is complete — in particular the outbox-absent rule, the claim-state read, and the spend-intent check for the 15.
3. The stricter-than-`handleReport` settlement requirement (§4.4, item 2): aborting the whole transaction if any reservation blocks.
4. The already-reported-but-reservations-open state (§4.5): is “stop, never settle on replay” the right rule?
5. Whether `report_json`'s labeled operator-finalization record is distinguishable enough from an executor report for every future reader, including the transitions/audit surfaces.
6. Whether the preview surface's digest covers every field whose change between census and action should stop Gate 3.

---

## 5. Option B — Executor self-healing fix (follow-on hardening; not sufficient alone for this grant)

### 5.1 Shape

Change the D6 executor so that a redelivery can close a grant whose targets have all reached durable terminal states:

1. At the end of `handleMessage`, when the current pass produced no reportable results and no new commits, derive the grant's durable closure eligibility from coordinator/genstore records — not from the message alone:
   - grant still `issued`;
   - this consumer holds the claim;
   - every message occurrence is no longer `granted`;
   - every corresponding execution is terminal (`committed`, or a state `handleReport` would truthfully report);
   - no execution is in an unknown-billing state.
2. If eligible, call `handleReport` with an empty `results` array even though `reportResults.length === 0 && committedCount === 0`.
3. **Inspect the return value.** If it is not `ok: true`, do not treat the message as handled:
   - on `stale_revision`, re-read the job view and retry the report within a small bounded loop inside the same invocation;
   - on any other non-ok return, or if the bounded loop exhausts, throw so the queue redelivers rather than acknowledges.
4. Add the same return-value inspection to the ordinary report call at `generation/d6-executor.mjs:859`.

### 5.2 Accounting and idempotency

If triggered, the writes are exactly `handleReport`'s ordinary closure — the same before/after table as §2. A second redelivery after closure is dropped at the claim (`completed`), as the existing fault-injection test already demonstrates for the settled case. No provider call is possible for `ready` targets because the executor's per-occurrence loop skips non-`granted` occurrences before any work-source or spend-intent step.

### 5.3 Why it does not recover Phase A by itself

The original queue message may already have been acknowledged — Candidate 3 in the diagnosis produces exactly that outcome, and Candidates 1–2 may also have ended in an acknowledging redelivery. No shipped schedule reconstructs an executor message for an already-acknowledged grant. Deploying Option B therefore fixes the **class** of failure for future redeliveries but leaves the current grant dependent on either:

- an operator finalization (Option A), or
- a separately authorized manual redelivery/requeue of the original grant message — a production act with its own risks (message reconstruction must be byte-faithful to the grant's outbox payload; a hand-built message that disagrees with durable state must be refused by the executor's existing fences, and proving that is its own test burden).

**Recommendation within this option:** build B as preventive hardening in a later, separate code gate if Julie wants it — ideally after Phase A is recovered — but do not make Phase A's recovery wait for it, and do not combine A and B into one authorization.

### 5.4 What Rowan should check hardest in Option B

- The closure-eligibility derivation: which execution states count as “reportable terminal,” and whether an all-`failed` grant should be closed by an empty report or by re-reporting the failures.
- Whether throwing on a non-ok report can create a poison-message retry loop for a grant that can never report (e.g., permanently stale revision), and what bounds that.
- Whether the bounded stale-revision retry belongs in the executor or inside `handleReport`.

---

## 6. Option C — One-time use of the existing generic `/v2/reports` route (available; not recommended)

### 6.1 Shape

No code change. Under a Gate 3-style authorization, an operator would POST exactly one body to the shipped route (`api.mjs:152-155`):

```json
{
  "grantId": "grant:plan:e377a5559961b294154276b6:ch2:1:full",
  "jobRevision": 2,
  "results": []
}
```

with `jobRevision` re-read immediately before the call and the call stopped if it is no longer 2.

### 6.2 Exact writes and accounting

If the revision matches, `handleReport` performs its normal closure in one transaction: grant → `reported` with the posted body stored as `report_json`, claim → `completed`, reservations settled via `grant_settled`, job completion derived. The before/after accounting is the §2 table. A repeat POST is a grant-level no-op: `handleReport` returns `{ ok: true, replayed: true }` for an already-`reported` grant before checking the revision (`coordinator.mjs:2063-2064`).

Resume of the 15 is identical to §4.6: the ordinary driver, once separately authorized.

### 6.3 Why this draft does not recommend it

1. **Wrong fence class.** The route is admitted on the ordinary production client token, not the migration-operator credential. Every comparable state-changing D6 surface in this build — park release, exemption, quota bootstrap/dispose, plan retirement — is operator-fenced. A grant-closing repair should not be the exception.
2. **No server-side precondition proof.** `handleReport` trusts the report. It does not verify that all eight targets are `ready`/`committed`, that attempts total 44, that reservations are exactly the expected eight, or that unknown open is 0. Those facts would rest entirely on the external census and operator discipline.
3. **No closed shape.** The same route accepts arbitrary `results` that can bind, block, fail, defer, or quota-park occurrences. A malformed or misdirected body is a production incident, not a refused request.
4. **Settlement is not verified inside the transaction.** Generic `handleReport` ignores the settlement sweep's `blocked` list. In the exact Phase A state all eight should close — but “should” is external reasoning, not a server-enforced precondition.
5. **Audit ambiguity.** The stored `report_json` would be the posted body, indistinguishable in form from an executor report unless a reader already knows the history. There is no authorization reference or finalization audit row.
6. **HTTP 200 is not success.** The route returns 200 with `{ ok: false, ... }` bodies; the executing procedure must inspect the body, and a stale-revision refusal would leave the grant untouched while looking superficially “sent.”

Option C remains in the draft because it is genuinely available and Rowan may judge the external census sufficient. If Rowan wishes to accept it, that acceptance should be explicit about waiving the operator-fence, closed-shape, and in-transaction settlement-verification requirements — and Gate 3's census/STOP law in §7–§8 then carries the entire proof burden.

---

## 7. Option D — New-plan supersession (rejected on current shipped code)

### 7.1 Shape considered

Terminate or supersede the stalled plan, close out its grant/reservations somehow, and submit a fresh plan for the remaining 15.

### 7.2 Why it fails its proof burden

1. **The shipped retirement path cannot take this plan.** `retireHaltedPlan` refuses any plan not in `halted_unknown` (`generation/service.mjs:550-557`). Phase A's plan is `active`. Its reservation closure is plan-wide with reason `halt_settled` inside a retirement for unknown billing (`generation/service.mjs:565-578`) — the wrong semantics for a fully known, fully confirmed grant.
2. **The active plan fences the 15.** A non-terminal plan — including `active` — fences its eligible occurrences against a second plan until a terminal state or explicit retirement clears ownership (`generation/service.mjs:680-729`). A replacement plan over the same 15 cannot be admitted while this plan remains active.
3. **The grant cannot be truthfully voided.** §3.4 of the diagnosis: `_voidDispatch` is for provably-never-sent dispatches and refuses claimed grants. This dispatch was sent, claimed, and executed 44 times.
4. **Supersession therefore needs the very closure it tries to avoid.** Any honest terminal disposition of the old plan must first report/finalize the old grant and settle its reservations as `grant_settled`. Once that is done, the old plan resumes normally and supersession is unnecessary.
5. **New identity weakens the audit story.** A new plan/job creates a new spend-intent namespace. The 15 have no prior attempts, so a sufficiently elaborate proof might show no double-billing for this instance — but the design would still carry two ownership histories over one chapter scope, a retired-but-not-completed original plan, and a permanent question about which plan “owns” the eight completed segments' provenance. Option A carries none of that.

**Disposition:** rejected. Do not pursue unless Option A is proved impossible, in which case supersession returns as a new design with its own full proof burden — beginning with a truthful closure of grant 1.

---

## 8. Gate 3 fresh census, STOP law, containment, and readbacks

These apply to whichever option Gate 3 executes. They are written for Option A; Option C uses the same census and readbacks, with its §6.3 waivers recorded.

### 8.1 Fresh census — immediately before action, complete or stop

All of the following, captured in one census window with no other authorized generation work intervening:

1. `/health`: build is the expected build for the gate (Gate 2D build for Option A; `63d7260e…` for Option C), generation enabled before the hold, coordinator armed.
2. Queue `opalreader-generation-v2`: consumer identity unchanged; delivery state recorded before the Gate 3 pause.
3. Hold applied and verified: generation halted and queue delivery paused, in the order the governing procedure specifies; both read back.
4. Quota reconcile: complete census (`censusComplete: true`), `ok: true`, drift empty, sole exception the known adjudicated straddler; day totals for PT 2026-10-29 (57), 2026-10-30 (79), 2026-10-31 (44 / 52 / 96), and the current PT day.
5. Plan view and diagnostics for `plan:e377a5559961b294154276b6`: §2.1 exactly — 8 committed executions, 44 confirmed attempts with the exact per-occurrence counts, failed 0, blocked 0, unknown open 0.
6. Job view: `generating` revision 2; occurrences 8 `ready` / 15 `pending`; exactly one grant, `issued` revision 2.
7. Finalization preview (Option A) or internal read (Option C design substitute): claim `claimed`; outbox acked; exactly the eight expected reservations with the §4.3 values; precondition digest computed and recorded.
8. Eligibility: 15 / 11 / 1 with digest `9453ab5dc7ee6ade7c650d14066054b965875f2ef1b65eb24bc633588d778e67` and expected cost 294,137. Any change stops the gate for a re-quote.
9. Phase accounting: settled 732,303; estimated unverified 19,018; reserved unverified 5,648; remaining 12,762,049; settings revision 1.
10. Sync watermarks: bindings 1826, content 18.
11. Conflicts: exactly the three known `schedule_dead` rows.
12. Parked Chapter 3 job untouched (`parked_policy` revision 1, fingerprint unchanged); park-release row 1 `live`; no chapter-exemption row.
13. Plans inventory: no new plan, no second grant for the job, no other active plan overlapping this chapter.

### 8.2 STOP law

Stop **before** the finalization call if any census figure differs from §8.1 — including by one row, one slot, or one revision. The Gate (a) lesson governs: an executor's own plausible explanation never clears its own STOP. Report the exact deviation and wait for a fresh ruling.

Stop and hold if, during or after the call:

- the response is ambiguous, malformed, or reports any `blocked` settlement;
- any readback figure differs from §2.2;
- any provider dispatch, binding change, phase-settled change, or new grant appears before Gate 4;
- unknown open becomes nonzero;
- a TerminalBlock / plan `partial` appears;
- Phase B state changes in any way.

No blind retry. No second release. No retirement. No void. No substitute route after a failed attempt under the same GO.

### 8.3 Containment

The Gate 3 hold (generation halted + queue paused) is applied **before** the call and remains applied after it, successful or not, until Gate 4 or a separate ruling releases it. If the post-action state is unexpected:

- keep the hold;
- preserve the finalizer audit row, the request/response, and every readback;
- do not roll back code or data;
- do not “fix forward” under the same GO;
- report to Julie and Rowan with the exact divergent figures.

### 8.4 Post-action readbacks — all required

1. Grant: `reported`; grant revision and `report_json` shape as designed.
2. Claim: `completed`.
3. Reservations: exactly the eight IDs, all `closed` / `grant_settled`, stored `slots_consumed` unchanged.
4. Derived totals: PT 2026-10-31 = 44 / 0 / 44; current PT day totals recorded explicitly (not assumed).
5. Quota reconcile: complete, `ok: true`, drift empty, same sole exception.
6. Plan: `active`, done 8 / failed 0 / blocked 0 / prompts 0.
7. Job: `generating`; occurrences 8 `ready` / 15 `pending`.
8. Eligibility: unchanged 15 / 11 / 1 and digest.
9. Phase: settled 732,303 and all unverified figures unchanged; remaining 12,762,049.
10. Sync: bindings 1826, content 18.
11. Conflicts: exactly the same three.
12. Park release / exemption: releaseId 1 `live`; no exemption row.
13. Health/queue/hold state: exactly as Gate 3 specified (held until Gate 4).
14. Finalizer audit row (Option A): present exactly once, with the census precondition digest and authorization reference.

---

## 9. Test plan (Gate 2; also the acceptance bar for any option)

No test result may be reported as green until one complete run's full log and exit code are captured on the exact final tree.

### 9.1 The live-shaped fixture — mandatory

A fixture mirroring Phase A exactly:

- one plan, one chapter job, 23 eligible occurrences;
- first grant bounded to eight by quota;
- eight executions committed through `commitVerified`, occurrences `ready`;
- grant still `issued`; claim still `claimed`;
- eight open reservations, `slots_total` 12 each, consumption 4 / 6 / 6 / 6 / 6 / 6 / 4 / 6;
- 44 dispatch rows on one PT day; derived totals 44 / 52 / 96;
- 15 occurrences `pending` with no execution, attempt, dispatch, or spend-intent rows;
- plan `active`, unknown open 0, phase settled fixed.

Tests on this fixture must prove:

1. **Stall reproduction:** driver issues no second grant; a redelivered cohort-1 message makes zero provider calls and does not report.
2. **Finalization:** one call produces the §2.2 after-state exactly, with zero provider calls (fake-provider call count unchanged), zero new bindings, and zero phase-settled movement.
3. **Replay:** a second call returns the already-finalized outcome and changes nothing — row counts and all figures byte-identical.
4. **Partial-state refusal:** grant `reported` with any reservation still open stops with no writes; grant `reported` without an audit row is not claimed as a finalizer replay.
5. **Precondition refusals, each with zero writes:** wrong plan/job; one target not `ready`; one execution not `committed`; an extra or missing ledger target; attempt total ≠ 44; any reservation missing, closed early, wrong-day, or with drifted `slots_consumed`; claim missing/completed/closed; unknown open > 0; a Phase B exemption row present.
6. **Claimed-grant void refusal:** the recovery path never calls `_voidDispatch` for this grant, and a direct void attempt remains refused.
7. **Continuation:** after finalization, `driveOnce` issues the next grant for the same job; the eight are never re-granted; the 15 are granted in ordered prefixes; total provider calls across the whole fixture equal exactly one logical spend per occurrence (attempt retries within an occurrence follow the attempt-budget rules, never a second spend intent).
8. **Multi-cohort succession after recovery:** the full 23 complete through successive cohorts on the same plan/job, including a PT-day rollover variant in which the remainder is re-evaluated whole against the new day — the succession case that has never run live.
9. **Same-day sizing:** with finalization on the original day (44 / 0 / 44 after closure), the first continuation prefix is exactly four fresh occurrences.
10. **Fresh-day sizing:** with finalization on a prior day, the first continuation prefix on a fresh day is exactly eight.

### 9.2 Existing-suite anchors

- Cohort succession with reports landing: `tests/quota-corrections.test.mjs` (8 / 7 / 3 regression) and `tests/quota-rereview.test.mjs` (101-occurrence rollover) must stay green on the final tree.
- Report-throw rollback: `tests/coordinator-recovery.test.mjs:131-149` must stay green.
- Settlement idempotency: `tests/quota-budget.test.mjs:438-457` (second settle is a no-op) must stay green.
- New tests for Option B, if built: redelivery-after-committed-successes closes the grant; a `stale_revision` report return is not acknowledged as success; an unknown-billing grant is never auto-closed.

### 9.3 Empty-result discipline

The main harness in this tree is production-faithful: `tests/helpers/do-harness.mjs:9-26` makes `.one()` throw on zero and on multiple rows. That corrected behavior is the acceptance environment. Additionally:

- audit every finalizer/preview read for the `_oneOrNull` / `_all` rule in §4.3;
- include explicit missing-grant, missing-claim, missing-outbox, and missing-reservation tests — each must produce the designed refusal, not an exception escape;
- any test-local SQL fake introduced for these tests must implement throwing `.one()` semantics; a null-returning fake invalidates the run for empty-result purposes;
- run at least one empty-store preview/finalizer call to prove the surfaces answer sanely on a store where none of the Phase A rows exist.

---

## 10. Rollback and floor implications

1. **Gate 2D rollback (before Gate 3):** if the finalizer build must be rolled back before any production finalization, roll back to build `63d7260e…` under the halted/paused state. The new audit table and preview surface are additive and inert on the old build. After any code upload, re-check script-settings observability and re-apply it via the multipart settings PATCH if the upload reset it, verifying the script etag is unchanged by the settings PATCH — the standing deploy rule.
2. **No data rollback after Gate 3:** a successful finalization is truthful terminal bookkeeping (a delivered grant reported; its reservations settled). Reopening the grant or its reservations would falsify the record. If a finalization were later proved wrong, the remedy is a forward correction under a new ruling, never a restore.
3. **The `6a73d962…` floor is not a recovery fallback:** that build does not enforce the provider-attempt counter. Rolling back to it does not close the grant, does not settle the reservations, and must never be used to re-arm generation while quota-guarded state (bootstrap records, dispatch/reservation ledgers, or a finalization record) exists, absent a separate compatibility proof and explicit ruling.
4. **Phase A release row:** releaseId 1 (`live`, the 23 occurrence IDs) has already been written and is part of every option's starting state. No rollback — code or data — undoes it, and no recovery option may re-release, revoke, or otherwise touch it. The chapter's eligibility shape (23 released / 1 still parked) depends on it remaining exactly as executed.
5. **Rollback does not resurrect Phase A:** returning to the pre-Phase-A worker would still leave the plan, job, grant, executions, bindings, and phase accounting exactly where execution left them. Code rollback is a build remedy only; it is never a plan remedy.

---

## 11. Recommendation

**Adopt Option A** — the dedicated operator-only grant finalizer — as the recovery path, with Option B considered later as separate preventive hardening and Option C held in reserve only if Rowan explicitly waives its fence/proof deficits. Reject Option D.

Reasons, in one paragraph: Option A is the only design that closes this grant truthfully (`reported` / `grant_settled`, never `voided`), proves every precondition server-side inside the same transaction that acts, verifies its own settlement instead of assuming it, leaves an audit record that cannot be mistaken for an executor report, changes nothing but the stalled grant's bookkeeping, and hands continuation back to the ordinary driver machinery with every existing fence intact. Option C reaches the same accounting through a broader, weaker surface; Option B fixes the future but cannot reach this already-acknowledged grant; Option D cannot honestly dispose of the old plan at all.

**Turn:** Rowan's review of the diagnosis and this draft; then Julie's Gate 2 decision.
