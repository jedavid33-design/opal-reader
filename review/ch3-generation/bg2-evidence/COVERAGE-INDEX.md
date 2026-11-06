# B-G2 evidence — coverage index (ruling items 5 and 6)

Maps every B2-R1..B2-R4 condition, all 29 §4.3 crash windows, and
the three deviations named in the EVIDENCE HOLD ruling to the test
source that covers them and the captured log that records the
pass.

**Sources.** All BG2 test names are in
`tests/batch-bg2-battery.test.mjs` (line numbers below are that
file as included in this package). Every BG2 pass record is in
`exit-run-logs/bg2.log` (suite result: 110 tests, 110 pass,
0 fail; overall run exit 0 per `exit-run-logs/SUMMARY.txt`).
Window definitions are §4.3 of `BATCH-BG2-IMPLEMENTATION-SPEC.md`
(pin `7e3d773c…`).

**Basis labels** — read these before the tables:

- **NAMED** — the test name itself carries the window/condition ID.
- **BEHAVIORAL** — the test exercises exactly the §4.3 crash point
  or condition, without naming the ID.
- **INDIRECT** — coverage exists only as a consequence of broader
  assertions; the specific point is not isolated by a test.
- **PARTIAL / GAP** — part of the claim has no test. Stated, not
  smoothed.

## B2-R1 — lease custody (§3.7)

| Evidence | Basis |
|---|---|
| BG2-P (custody slice) — "an in-flight submitted map tolls the lease instead of going outcome_unknown — repeatedly, and across a restart" | Direct. The restart leg is the harness `crash()` (new instance over the same storage), inside this test. |
| BG2-P (custody slice) — "control: a granted occurrence with NO batch map still goes outcome_unknown at lease expiry" | Direct (negative control). |
| BG2-P (custody slice) — "a terminally consumed map does not toll: the lease expires normally" | Direct. |
| BG2-B — "rollback + restoration: a Standard-only build leaves Batch rows untouched; the restored build resumes without resubmitting" | Direct for the ruling's rollback scenario: the BASELINE (pre-B-G2) build's executor runs against a populated Batch store, refuses the batch message, leaves rows identity/accounting-identical; restoration polls and submits zero. |

Recorded in `exit-run-logs/bg2.log`. The record's stated boundary
stands and is not contradicted by anything here: a rollback
target *without* the custody predicate (e.g. the permanent floor
build `6a73d962…`) is **not** proven safe by these tests — the
rollback scenario above uses the composed baseline build.

## B2-R2 — repair origination (§3.9)

| Evidence | Basis |
|---|---|
| BG2-R — "ORIGINATION: an original batch job's policy_block creates the first repair job on the Standard lane, granted in the same transaction" | Direct. |
| BG2-R — "origination never fires for: a batch provider_error, a standard original job, or a repair parent" | Direct (the three negative cases). |
| BG2-R — "end-to-end: a Batch POLICY_BLOCK originates a Standard repair job whose F3 split chain commits exactly one binding" | Direct (exactly-once commit). |
| BG2-R — "the shared budget: Batch fence attempts and Standard repair attempts count in ONE segmentAttemptsUsed derivation (plan-linked)" | Direct (shared 12-attempt budget). |
| BG2-R — "partition exactness: a batch repair parent's policy_block follow-ons go Standard with the deviation markers; provider_error keeps the batch lane" + "a standard parent produces exactly today's follow-on shape…" | Direct (the pre-existing follow-on seam, for contrast with origination). |

## B2-R3 — halted fence

| Evidence | Basis |
|---|---|
| BG2-X — "halt asserted at submit: fence stands, no POST outcome; a later message converts it — never a second POST (B2-R3)" | NAMED. Durable visibility + no repeat POST after the halt clears (conversion is to ambiguous via `fence_without_outcome`). |
| BG2-X — "fence without outcome (CW-10): a committed bundle whose POST never ran converts, never posts" | NAMED (the conversion path itself). |
| BG2-B — "inventory over a populated Batch store: rows, linkage, custody classes, and the summary" | BEHAVIORAL for *durable visibility with retained exposure*: the standing fence's attempt upper bound appears in the inventory as outstanding exposure (the §3.12 suspect set). |
| BG2-X — "ambiguity gate (I-8): one ambiguous occurrence blocks new submissions for the whole job" | BEHAVIORAL (the gate that makes a repeat POST structurally impossible while the converted fence stands). |

## B2-R4 — transaction atomicity

| Evidence | Basis |
|---|---|
| BG2-F — all 13 tests, incl. "fault at W1…W6…" (eight fault injections), "a RETURNED refusal … is converted to a thrown rollback", "nested _tx (B2-R4): an outer abort rolls the committed-looking bundle back too", "quota refusal … leaves no map/intent/attempt", "batch_quota_unarmed: refuses and writes nothing" | NAMED (suite header and the nested-_tx test carry B2-R4). Every grouped write is fault-injected on the real SQLite harness (throwing `.one()`); each assertion is rollback to a byte-identical snapshot. |
| BG2-C — "CW-16/CW-17: a fault inside the terminal bundle rolls it back whole…" | NAMED (terminal bundle). |
| BG2-C — AW-02, AW-03, AW-04 tests | NAMED (adjudication/decision transactions). |
| BG2-R — FW-01 test | NAMED (the report transaction). |
| BG2-C — "CW-13: an HTTP rejection whose known-outcome bundle cannot land is NEVER claimed as known" | NAMED (known-outcome bundle failure → fail-closed). |

## The 29 crash windows (§4.3)

All in `tests/batch-bg2-battery.test.mjs`; all recorded passing in
`exit-run-logs/bg2.log`.

| Window | §4.3 crash point (short) | Covering test(s) | Basis |
|---|---|---|---|
| CW-01 | Claim committed; no fence bundle yet | BG2-X — "end-to-end: fence -> POST -> immediate poll -> terminal bundle -> commit tail -> cohort report"; BG2-P — "continuation (§3.6.6): a claimed-but-never-delivered grant is driven by the pass — fence, POST, poll, commit, report" | INDIRECT — both tests *start* from the CW-01 state and run the bundle from the top (the specified recovery), but no fault is injected between claim and bundle. There is no durable write in between to tear — the claim is the last durable write — so the window is covered structurally, not by a crash injection. |
| CW-02 | Inside bundle, after W1 | BG2-F W-step fault set (see group note) | BEHAVIORAL (group) |
| CW-03 | Inside bundle, after W2 | BG2-F W-step fault set | BEHAVIORAL (group) |
| CW-04 | Inside bundle, after W3 | BG2-F W-step fault set | BEHAVIORAL (group) |
| CW-05 | Inside bundle, after W4 | BG2-F W-step fault set | BEHAVIORAL (group) |
| CW-06 | Inside bundle, after W5 | BG2-F W-step fault set | BEHAVIORAL (group) |
| CW-07 | Rollover-reservation creation inside W6 | BG2-F — "fault at the W6 day-rollover re-reservation: rolls back whole" | BEHAVIORAL |
| CW-08 | After dispatch-row insert, before slot increment | BG2-F — "fault at W6 slot increment: the whole bundle rolls back" (the fault lands exactly at this boundary) and "fault at W6 dispatch row…" | BEHAVIORAL |
| CW-09 | After slot increment, before the attempt's day stamp | No dedicated injection at this sub-point. The W6 fault tests assert the whole bundle — all three W6 effects together — rolls back to a byte-identical snapshot, which subsumes CW-09's recovery claim | INDIRECT |
| CW-10 | Bundle committed; POST not started | BG2-X — "fence without outcome (CW-10): a committed bundle whose POST never ran converts, never posts" (battery line 906) | NAMED |
| CW-11 | POST in flight; provider outcome unknown | BG2-X — "transport-unknown submit throw: ambiguous (submit_transport_unknown)" | BEHAVIORAL — §4.3 defines CW-11 as indistinguishable from CW-12 by construction, so the ambiguous-path test is the designed coverage |
| CW-12 | Provider accepted; `noteBatchSubmitted` not yet written | BG2-X — "accepted-but-unnamed: ambiguous (accepted_unnamed); attempt stays dispatching; intent stays open (CW-12)" (line 694) | NAMED |
| CW-13 | HTTP rejection received; known-outcome bundle not written | BG2-C — "CW-13: an HTTP rejection whose known-outcome bundle cannot land is NEVER claimed as known" (line 1206) | NAMED |
| CW-14 | Map `submitted`; no poll yet in this pass | BG2-P — "the driver polls a submitted map at most once per pass; observations and counters advance per completed pass"; BG2-X — "pending poll: no report, no resubmission; completion on a later message" | BEHAVIORAL — the window is an absence-of-poll state; no fault is injected, the poll discipline itself is the coverage |
| CW-15 | Poll GET in flight | BG2-P — "CW-15: a started-only observation (crash during the GET) does not advance the counter; the same token is spent, a new token polls" (line 1134) | NAMED |
| CW-16 | Terminal response received; terminal bundle not written | BG2-C — "CW-16/CW-17: a fault inside the terminal bundle rolls it back whole; the next pass re-polls and lands it" (line 1225) | NAMED (joint test) |
| CW-17 | Inside the terminal bundle | Same joint test as CW-16; CW-17's all-or-nothing claim is also the BG2-F pattern applied to the terminal bundle | NAMED (joint test) |
| CW-18 | Terminal success landed; flush not started | BG2-X — "crash between terminal bundle and commit tail (CW-18): the receipt resumes the commit; exactly one binding" (line 884) | NAMED |
| CW-19 | Flush object durable; transitions incomplete | BG2-C — "CW-19: crash after the object is durable, transitions incomplete — the receipt path adopts the object and commits" (line 1245) | NAMED |
| CW-20 | Execution `verified`; commit not yet run | BG2-C — "CW-20/CW-21: a fault inside commitVerified leaves the execution verified and the commit unlanded; recovery commits exactly once" (line 1262) | NAMED (joint test) |
| CW-21 | Inside `commitVerified` | Same joint test as CW-20 | NAMED (joint test) |
| CW-22 | Commit landed; projection note not written | BG2-C — "CW-22: commit landed, projection note lost — the drive sweep re-publishes it (self-healing)" (line 1280) | NAMED |
| CW-23 | Cohort terminal; `handleReport` not yet sent | BG2-X — "terminal_unreported recovery (CW-23): a failure landed in an earlier message is re-derived and reported at cohort completion" (line 854) | NAMED |
| AW-01 | Enumeration received; run-record tx not written | BG2-C — "AW-01: the enumeration itself fails (adapter throw) — no run record, no state change" (line 1650) | NAMED |
| AW-02 | Inside single-match run + adoption tx | BG2-C — "AW-02: a fault during adoption inside the reconcile transaction rolls back the run record too" (line 1667) | NAMED |
| AW-03 | Inside multiple-match run + adjudication tx | BG2-C — "AW-03: a fault on the run-record INSERT (after the adoption write) rolls the adoption back" (line 1690) | NAMED |
| AW-04 | Inside the adjudicate transaction | BG2-C — "AW-04: a fault on the decision act's record UPDATE rolls the adoption back; the record stays open" (line 1706) | NAMED |
| AW-05 | Adoption committed; next poll not yet run | BG2-M — "AW-05: after adoption the next pass polls normally on the same attempt (no new fence, no new dispatch)" (line 1501) | NAMED |
| FW-01 | Inside `handleReport` follow-on creation | BG2-R — "FW-01: a fault inside follow-on creation rolls the whole report back — no partial follow-on set, no settled occurrences" (line 1835) | NAMED |

**Group note for CW-02..CW-06.** §4.3 states one shared recovery
rule for these windows (the bundle transaction rolls back; the
next pass sees the pre-bundle state). The battery's BG2-F suite
injects a fault at *every* write boundary of the bundle —
"fault at W1 createExecution", "fault at W2 transitionExecution",
"fault at W3 acquireSpendIntent", "fault at W4 reserveAttempt",
"fault at W5 fenceBatchSubmit", "fault at W6 dispatch row",
"fault at W6 slot increment", "fault at the W6 day-rollover
re-reservation" — and asserts in each case that the whole bundle
rolls back to a byte-identical snapshot. That is the windows'
recovery rule proven at every boundary; the battery does not
label CW-02..CW-06 individually, and this index does not pretend
otherwise.

## The three named deviations (ruling item 6)

### Deviation — staged quota refusal (record deviation 7)

*A fence-time quota refusal's `daily_limit` is staged in memory
and reportable only when nothing in the cohort is in flight; the
bundle rolled back, so nothing durable exists to re-derive it
from on a later pass.*

- **Direct, for the nothing-durable half:** BG2-F — "quota
  refusal (slots exhausted) propagates as thrown and leaves no
  map/intent/attempt" (battery line 528). After a fence-time
  quota refusal there is provably no durable row — which is
  exactly why the staging is memory-only.
- **Direct, for the surrounding machinery:** BG2-X — "submit 429
  with the quota marker: daily_limit derivation parks like
  Standard" (line 682, the landed-known-outcome daily_limit
  path); BG2-X — "cohort rule: a committed sibling is NOT
  deferred while another is in flight; the report fires at
  completion" (line 815, the §3.6.5 cohort-report discipline the
  deviation's condition refers to).
- **GAP (partial):** no test stages a *fence-time* quota refusal
  inside a cohort and asserts the reportable-only-when-nothing-
  in-flight behavior, nor the occurrence's later re-fence after
  such a refusal. The deviation is implemented
  (`generation/d6-executor.mjs` in the candidate) and its two
  halves are each constrained by the tests above, but the
  combined scenario is untested. Named here per the ruling's
  explicit-coverage requirement.

### Deviation — drive-pass-only poll observations (record deviation 6)

*Poll observations are recorded for drive-pass polls only; the
queue branch's immediate poll passes no pass token; its
accounting is identical, only observation recording is scoped.*

- **Direct, drive-pass side:** BG2-P tests assert the
  observation rows themselves — "the driver polls a submitted
  map at most once per pass; observations and counters advance
  per completed pass" (observation rows read at battery lines
  1036/1124), "a duplicate pass token does not double-count
  (observation PK)" (line 1047/1053), and the CW-15 test (line
  1134/1147).
- **Indirect, queue side:** BG2-H — "a queue-branch poll throw
  leaves exactly the §3.5 durable state (map submitted, attempt
  dispatching, intent open)" (line 2348) proves the queue-branch
  poll's durable accounting state is the specified one.
- **GAP (narrow):** that queue-branch test does not assert the
  observations table is empty afterwards. No test directly
  asserts zero observation rows after a queue-branch poll; the
  scoping is proven from the drive-pass side (observations are
  pass-token-keyed) and by the code path, not by a queue-side
  negative assertion.

### Deviation — receipt recovery by re-poll (record deviation 5)

*A Batch execution in `synthesized` state with a landed success
receipt resumes via re-poll + flush-adopt (`resumeBatchCommit`)
rather than the existing `reenterFlush`.*

- **Direct:** BG2-X — the CW-18 test (line 884): a crash is
  injected after the terminal bundle lands; the receipt is
  asserted present with the execution still `attempted` and zero
  bindings; the next message resumes and commits — asserting
  exactly one binding, `submitBatch` called exactly once (no
  resubmission), and exactly one attempt ever reserved.
- **Direct:** BG2-C — the CW-19 test (line 1245): object durable,
  transitions incomplete — the receipt path adopts the object
  and commits.
- **Also:** BG2-P poll selection includes the CW-18 receipt
  recovery path in the driver's Phase A (see BUILD-LOG Phase 4,
  included in the implementation record's account).

This deviation's coverage is complete as mapped; no gap.
