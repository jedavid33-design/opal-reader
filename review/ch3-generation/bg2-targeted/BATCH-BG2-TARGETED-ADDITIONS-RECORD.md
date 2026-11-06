# B-G2 Targeted Test Additions (T1–T3) — Record

**Return to:** Rowan's ruling *WS1 CANDIDATE PASS / WS2 HOLD CLOSED*
(board 6690000339), Part 2 — the three targeted offline test
additions and the nested-duplicate investigation, filed against the
**same** WS2 B-G2 candidate identity. **Offline only.** No candidate
code changed; no staging, production, or provider contact; no
B-G3 act of any kind is taken or implied by this record.

**Filed run:** 2026-11-06T16:46:11Z (logs §5). **Result: T1 PASS,
T2 PASS, T3 (CW-09 + control) PASS; battery confirmation 110/110;
overall exit 0.** No test exposed a candidate defect.

---

## 1. Candidate identity binding

The additions bind to the WS2 B-G2 candidate exactly as pinned:

- Candidate pin: `jedavid33-design/opal-reader`, branch
  `ui1-review`, commit `9d6f6b85…` (B-G2 implementation);
  evidence pin `4a924a7c…` (the package this return supplements).
- Identity check, performed **before and after** the filed run:
  all **31** manifest parts of `bg2-build/candidate-tree/` were
  re-hashed (SHA-256) and compared against `bg2-build/MANIFEST.md`
  — **zero mismatches at both checks**, and the tree's file set
  equals the manifest's file set (31 files). The eight changed
  files, re-verified unchanged:

  | file | sha256 |
  |---|---|
  | `v2/coordinator.mjs` | `6e04df3301eab49f11c86458cb15e683fdfc1fa008440a24bb2faab2b6b9b0d7` |
  | `v2/executor.mjs` | `f91ce0bda5aecac813f283d83b2b38ba2a5b8e3839bb8fbfc329f93ed3bcb666` |
  | `v2/generation/d6-executor.mjs` | `9d469bf03b1a3fdcaf8f660c4c003ecc69ba9ef5df8ee87b32f35d8c8f7ded4e` |
  | `v2/generation/gen-constants.mjs` | `a713dc35dbc13c71b777dc448a604c357ae0aa098a38f0153ea8e246fa445469` |
  | `v2/generation/genstore.mjs` | `f8614f9df097833182061e2e08b238fc9a371b6dc6652d460e24032378ab907f` |
  | `v2/generation/service.mjs` | `761ac47736ec6c958f60e85a70789cd613590c274286729713b55974c246db03` |
  | `v2/host/adapters.mjs` | `ee99bdf2e6d21ab1c70504e95c16f0744e1c2b3feed958083803a41164af1620` |
  | `v2/worker-entry-prod-d6.js` | `4087d3c7f310ebad85ac2a229cbb368d34fd4397e68eb2768e473e126add75eb` |

  The allowlist in the candidate tree remains `["standard"]`;
  behavioral tests run on the battery's throwaway admitted-tree
  copy (allowlist flipped in the copy only, rebuilt every run) —
  the §3.13 mechanism, unchanged.

## 2. What was added

One new test file, following the battery's house patterns on the
same harness (real `node:sqlite`, throwing `.one()`, statement-
matching fault injector, `crash()`), with the battery's own
helpers (`batchWorld`, provider stub, bucket, payload) copied
verbatim so the additions stand on the identical basis:

- `bg2-build/tests/batch-bg2-targeted-t1t2t3.test.mjs`
  (24,760 B; sha256 `2757464483e6d0931d6514741f0afb2da0f68cf7d9b527922b43ee61f2c0aaa5`)
  — 4 tests in 3 suites (T1, T2, CW-09 + its control).
- `bg2-build/tests/run-targeted.sh` — the separately labeled
  runner (targeted file, then the battery file, sequentially).

## 3. T1 — cohort quota refusal (direct; upgrades deviation 7)

**Design.** Two-occurrence Batch job on the admitted tree.
Leg 1 drives occ-b1 alone: fence + submit + immediate poll
RUNNING — occ-b1 is durably **in flight**. Leg 2 zeroes
occ-b2's grant reservation `slots_total` (the BG2-F staging
technique, targeted per-occurrence), so occ-b2's fence refuses
at W6 with `provider_attempt_budget`, and drives a cohort
message for both occurrences. Leg 3 restores occ-b2's slots,
lets the provider complete, and drives the cohort again.

**Asserted (Rowan's four, plus the constructive completion):**
(a) *No premature report* — the refusal stages as
`{ reported: "daily_limit", quotaBudgetRefusal:
"provider_attempt_budget" }`; `batchReported` stays undefined;
`batchCohortPending` contains occ-b1; grant stays `issued`;
job state unchanged; occ-b2 stays `granted`; `quota_parks`
stays empty (the refusal never reached `handleReport`).
(b) *No orphaning* — occ-b1's map remains `submitted` with
`provider_name = batches/stub-1`; occ-b2 has no map, no
execution record, no intent (its rolled-back bundle created
nothing durable).
(c) *No duplicate submission* — `submitBatch` calls = 1 and
dispatch rows = 1 after leg 2.
(d) *No lost durable custody* — occ-b1's attempt stays
`dispatching`, its intent outcome stays null, its reservation
`slots_consumed` stays 1; occ-b2's stays 0.
Leg 3 then proves custody constructively: the cohort completes,
occ-b1 lands from its **original** submission (exactly 1 attempt
across the scenario), occ-b2 re-fences and submits exactly once
(1 attempt, totals: 2 POSTs, 2 dispatches, 1 binding each),
grant `reported`, both occurrences `ready`.

**Result: PASS** (filed run, 101 ms).

## 4. T2 — immediate poll observation (direct; upgrades deviation 6)

**Design.** One-occurrence Batch job, poll script always
RUNNING. Leg A drives one message (fence + submit + the queue
branch's **immediate** poll). Leg B drives a second message
(a second immediate poll of the in-flight job). A control leg
then runs one drive pass (`pollBatchPass`).

**Asserted:** after each immediate poll — the poll really ran
(`getBatch` count 1, then 2) — the observation table holds
**0 rows** (presence-aware count) and `batchPollState(...)`
returns **null**: no poll-state row exists, so the D-4
observed-pass counter (`consecutive_no_progress_passes`) was
not created, let alone advanced. The immediate polls' durable
accounting is the §3.5 shape (map `submitted`, attempt
`dispatching`, intent open). Control: the single drive pass
records exactly **1** observation row and the counter at **1**
(classification `BATCH-IN-FLIGHT`) — the zeros are the §3.5
scoping property, not a broken table.

**Result: PASS** (filed run, 22 ms).

## 5. T3 — CW-09 named case (direct; upgrades CW-09 from INDIRECT)

**Design.** The exact window, established from the candidate
source: inside `batchFenceBundle`'s W6 step,
`applyDispatchQuota` issues (1) `INSERT INTO
d6_provider_dispatches`, then (2) `UPDATE d6_grant_reservations
SET slots_consumed = slots_consumed + 1`, and returns; the very
next statement is `genstore.markDispatching`'s day stamp,
(3) `UPDATE d6_attempt_log SET phase = 'dispatching',
dispatched_day_key = ?` — a statement shape unique in the tree
(the quota bootstrap's stamp has a different form). The test
installs a **stateful** fault-injector match that records every
write statement the SQL facade sees and fires the injected
error on the day-stamp statement, then calls the bundle
directly (the BG2-F pattern).

**Asserted:** the bundle throws the exact injected error; at
fault time the final three recorded writes are, in order, the
dispatch insert, the slot increment, and the day stamp —
proving the injection fired at the first statement after the
slot increment, with both prior W6 writes already issued inside
the transaction; the post-fault full-store snapshot is
**byte-identical** to the pre-bundle snapshot (`snapshotDb`
deep equality — the T-NO-MUTATION pattern); explicit witnesses
under the snapshot: no execution record, no dispatch rows,
`slots_consumed` back to 0, no intent, no map.
**Control test:** the identical bundle unfaulted returns the
execution id, the attempt stamped `dispatching` with
`dispatched_day_key` equal to the PT day key, `slots_consumed`
1, one dispatch row — the fault, not the flow, caused the
rollback.

**Result: PASS** (filed run: CW-09 80 ms; control 9 ms).

## 6. Runs and totals (accuracy statement)

All counts are from captured logs, not narration.

| run | when (UTC) | targeted file | battery file | disposition |
|---|---|---|---|---|
| development run 1 | 2026-11-06T16:43:20Z | 0/4, exit 1 | 110/110, exit 0 | **Test-authoring defect in the new file only**: it imported a non-existent harness export (`createHarness`; the harness exports `makeWorld`). No candidate behavior was exercised. Its detailed log was overwritten by run 2 before preservation — stated plainly; its outcome and error are recorded here from the session capture. |
| development run 2 | 2026-11-06T16:45:48Z | 3/4, exit 1 | 110/110, exit 0 | T1, T2, CW-09 **passed**. The CW-09 **control** failed on the test's own wrong assertion (`out.fenced` — the bundle's return carries no such field). Logs preserved at `test-logs/targeted-additions/development-runs/run-2-*`. The assertion was corrected to the BG2-F shape (`out.executionId`). |
| **filed run** | **2026-11-06T16:46:11Z** | **4/4, exit 0** | **110/110, exit 0** | overall exit **0** |

Filed-run logs: `bg2-build/test-logs/targeted-additions/`
(`targeted-t1t2t3.log` sha256 `7bd952cee6029e459f321f3fb98f1b5343328cf6828be3933616e06c496c8ce4`;
`bg2-confirmation.log` sha256 `ca0024129641255de93fdac19d20384c4b84b7f14206b7a26d2134ab7407481e`;
per-suite `.exit` files; `SUMMARY.txt`).

The two development failures were defects **in the new test
file's scaffolding/assertions**, never in the candidate: at no
point did any run show candidate behavior contradicting an
assertion about the candidate. The candidate tree was
byte-identical before and after every run (§1).

**Original evidence retained untouched.** The original exit-run
logs (`test-logs/exit-run/`, 2026-11-06T15:42–15:43Z) and the
pinned evidence package (`bg2-build/evidence/`, pin `4a924a7c…`)
were not written to, merged into, or re-run; exit-run file
mtimes were re-verified at 15:43Z after this work. These
additions are filed **separately**, per the ruling.

**Coverage state after this return:** deviation 6 — direct
(T2); deviation 7 — direct (T1); CW-09 — direct (T3). Unchanged
by this return (not in the ruling's list): CW-01 INDIRECT;
CW-02..06 BEHAVIORAL-as-group.

## 7. Investigation — the nested duplicate test directory

**Object.** `bg2-build/tests/containment/containment/`,
containing byte-identical copies of `containment-battery.test.mjs`
(67,037 B) and `harness.mjs` (17,768 B). **Not deleted** (per
instruction); still in place.

**Established facts (firsthand, this return):**

1. Content: SHA-256 of both nested files equals the originals in
   `bg2-build/tests/containment/` and the copies in
   `s1-build/tests/containment/` — one identical file set
   everywhere (`2b2befa5…` battery, `8eb4c0d6…` harness).
2. Timing: the nested directory and both files have birth =
   mtime **2026-11-06T16:04:33.299Z** (a single operation, ~1 ms
   span). The originals date to 15:02:00Z (B-G2 Phase 0
   scaffolding). `bg2-build/tests/` now holds 109 files = the
   107-file as-run tree + these 2.
3. The only other copies of these exact files created in the
   window are the S1 build's: `s1-build/tests/containment/`
   files have birth **16:04:37.819Z — 4.5 seconds after** the
   nested copy. The S1 build's `BUILD-LOG.md` (CP-2) records
   that it copied the standing-battery scaffolding — containment
   battery + harnesses — **from the WS2 build's test copies**
   during exactly this window; its p2/r5a/v3 copies followed at
   16:05Z and its final run at 16:06:55Z.
4. The evidence assembly is excluded as the source: its copies
   out of `bg2-build/tests/` were complete and verified before
   the event (its preserved-mtime copies sit at 15:02:00Z; its
   standing-batteries copies landed 16:02:23Z), its writes went
   to `bg2-build/evidence/`, and it was the assembly that first
   *observed* and reported the duplicate.
5. Nothing else under `bg2-build/tests/` was created or
   modified in the 16:00–16:10Z window (filesystem scan), and no
   other same-name nesting exists in either build workspace.

**Conclusion (at its true strength).** The duplicate was created
by a single recursive-copy operation at 2026-11-06T16:04:33.299Z
whose destination resolved to the source directory itself, so
`tests/containment/` was copied into `tests/containment/` —
the classic copy-into-own-parent nesting signature. The only
actor demonstrably copying these exact files in that window was
the **S1 build's CP-2 scaffolding step**, whose correct copies
of the same two files landed in `s1-build/tests/containment/`
4.5 s later; a mistargeted first (or mistargeted-destination)
copy inside that scaffolding sequence is therefore the strongly
indicated cause. **Residual uncertainty, explicitly retained:**
no command-level log of the stray operation survives (the S1
BUILD-LOG narrates CP-2 without commands), so the attribution
rests on timing, file-set identity, and the nesting signature —
not on a captured command line. **Impact: none.** The directory
postdates the B-G2 exit run by ~21 minutes, was excluded from
the evidence pin (which preserves the as-run 107-file tree),
touches no candidate file, and affects no result in this return
(the filed runs' trees were verified per §1).

## 8. Files produced by this return

- `bg2-build/tests/batch-bg2-targeted-t1t2t3.test.mjs` (new)
- `bg2-build/tests/run-targeted.sh` (new)
- `bg2-build/test-logs/targeted-additions/` — filed-run logs,
  exits, `SUMMARY.txt`, plus `development-runs/` (run-2 logs)
- `bg2-build/BATCH-BG2-TARGETED-ADDITIONS-RECORD.md` (this file)
- `bg2-build/BATCH-BG2-TARGETED-ADDITIONS-ROWAN-CP.md`

**Nothing in this return authorizes B-G3, staging, or any
provider call.** The three additions were the ruling's named
pre-B-G3-readiness step; B-G3 readiness remains separately
gated on Rowan's review of this return and Julie's authorization.

*End of record. Turn: Rowan's (review of the T1–T3 additions and
the investigation), on Julie's poke.*
