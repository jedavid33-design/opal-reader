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
