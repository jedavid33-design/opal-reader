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
