# A-3 IMPLEMENTATION — CORRECTIONS PACKAGE (R1–R8)

Case #10 / P8 (issue #15). Prepared by Wren, 2026-11-16, under Julie's
offline implementation GO (board 6922008740), answering Rowan's
implementation HOLD ruling (verbatim board 6924207601; corrections
R1–R8, blockers R2 and R4). Supersedes the first-build package (pin
`cd4b20cc…`) as the state of record for the candidate; that pin and its
evidence are preserved unmodified.
Handoff: RT-H-20261116-corr01
Review pin: d733c26e3666d186dfb379fd30a618fb5b304ee3 (repo `jedavid33-design/opal-reader`, branch `ui1-review`;
the Dropbox copy carries the filled pin — the only difference between copies).

## 1. Per-R dispositions — all done; no boundary expansion was required

- **R1 — composition verification.** `COMPOSITION-VERIFICATION.md` +
  `verify-composition.mjs` (the `composition` suite, exit 0): both
  trees differ from the live-build baseline in exactly the three parts,
  28 files byte-identical. The four historical assertions (containment
  CT0; P2 T0 identity; P2 T0 round-trip; R5A T0) are dispositioned
  individually as historical assembly-fixture incompatibilities.
  Fixtures and raw nonzero exits are preserved; the overall runner
  exit remains **1** and is not described as all-green anywhere.
- **R2 (BLOCKER) — fail-open fallback removed.** `_repairRecorderPasses()`
  now probes each A-3 recorder column separately: legacy row semantics
  apply ONLY to a positively established pre-migration schema; in a
  migrated or uncertain world an extended-read failure fails closed —
  no legacy substitution, no discharge from that read. The derivation
  itself was corrected from pair-skipping to the design §8 WINDOW
  rule: any not-well-formed extended row inside an intent's window
  (post-watermark NULL kind, unrecognized kind, NULL seq) fails that
  intent closed, surfaced as `failClosedIntentIds` on the derivation
  and the repair-status projection. Fault injection is T-A3-39 (the
  pre-correction code discharged exactly this shape through the legacy
  SELECT); poison variants + a scheduled-row control are T-A3-40.
- **R3 — watchdog-only classification corrected.** HEALTHY_IDLE now
  requires a timely, consistently armed idle watchdog. An overdue
  watchdog is overdue work: INTERVENE, or PASS_WITHOUT_PROGRESS
  (report-only) when a complete pass postdates its due. No schedule
  rows at all → NO_SCHEDULE_OBSERVED. Admission's earliest-due uses the
  same all-rows definition. Fixtures: T-A3-41 (all cases).
- **R4 (BLOCKER) — final admission revalidates everything.** The
  synchronous stretch recomputes every storage-local input fresh —
  pending rows and earliest due, completePassSinceDue, containment,
  activation+epoch, WAIT hold, watermark — and re-evaluates the actual
  classifier; admission proceeds only on a fresh INTERVENE. New
  stale-observation rejection: a pass recorded after the tick's
  observation watermark whose recorded registration differs from the
  observed one refuses admission (`skip_stale_observation`). The
  stretch does not re-read getAlarm() (that would break the
  synchronous boundary); freshness is enforced against recorded pass
  evidence instead. Test T-A3-42: a native pass completing during the
  tick's getAlarm() await, with overdue work still present → no
  admission.
- **R5 — WAIT hold verified-inactive.** Admission (initial observation
  and the final stretch) requires the hold value to be exactly the
  valid inactive representation; unreadable, malformed, or unknown
  values fail closed as `wait_hold_unverifiable` (T-A3-43, both
  points). Hold persistence across activation/deactivation is proven.
  The candidate's refusal of scheduled admission while GENERATION_HALT
  is not "0" is expressly documented in the notes as an initial
  LIVE-only OPERATING-SCOPE decision for the activation proposal, not
  a defect. The failed/ambiguous hold-write contingency remains
  documented for that proposal.
- **R6(a) — assurance outcomes distinguished.** New recorder fields
  `assurance_outcome` / `assurance_armed_after`: after the assurance
  call, the outcome is classified from a READ-BACK — `not_required` /
  `verified` / `suppressed` / `failed` / `read_failed`; a normal method
  return alone certifies nothing, and `suppressed` certifies the
  read-back state, not its cause (stated at true strength).
  `assurance_fired` records the attempt. T-A3-44 exercises the
  outcomes; dormant deployment gains no recovery act (T-A3-28 stands).
- **R6(b) — disablement evidence hardened.** `drained_normally` is
  recorded ONLY when the pass's completion was durably recorded. On a
  recording failure the active-pass record is preserved and the
  disposition resolves `interrupted_or_unknown` atomically with a
  `drain_unrecorded` event; the normal clear + disposition is one
  transaction. T-A3-45.
- **R6(c) — genuine rollback candidate built.** `rollback-tree/` +
  `ROLLBACK-MANIFEST.md`: the pre-A-3 build retaining the full
  corrected recorder (schema, migration, transactional seq-stamping,
  pair-protecting prune) and the corrected RC-2 derivation, with the
  scheduler and shared-drive mechanism REMOVED by construction —
  default export exactly `{fetch, queue}`, no tick or activation
  routes, no scheduler tables ever created (RB-1/RB-3). Its pass rows
  are well-formed extended evidence (`assurance_outcome:
  "not_required"` — it has no exit assurance and claims none), and the
  candidate's derivation accepts rollback-written evidence and vice
  versa (RB-4). Diff vs the live baseline: the same three parts, the
  entry part carrying recorder-only changes (+245/−22).
- **R7 — effect census completed; adoption defect tracked, not
  repaired.** The notes carry verified file:line traces for every
  external effect (grant issuance's atomic stretch; delivery's
  marker-before-invoke; the flush's conditional content-addressed PUT
  and digest-equality adoption; recover()/driveOnce() inside the pass
  body; alarm registration). New T-A3-46: (a) a revoked pre-drive
  continuation initiates zero grants/outbox/sends while the
  replacement sends exactly once; (b) resumed flush publication adopts
  a digest-equal winner and refuses a differing one. `keyFor()=null`
  is documented as a SEPARATE tracked defect, deliberately not repaired
  inside A-3; the predicted S-3 outcome (10 ready + 1 outcome_unknown
  + 3 pending) stands. One overstatement in the first build's notes
  (T-A3-23's coverage) is corrected in place and the correction
  recorded.
- **R8 — reproducible pin.** This pin carries EVERY input the runner
  references: candidate tree, rollback tree, the live-build baseline
  tree, the pre-A-1 baseline tree, the regression sources + fixtures,
  the rollback shadow-suite construction, tests, and the runner.
  `REPRODUCIBILITY.md` gives the exact reconstruction and run procedure
  from the pinned files alone.

## 2. Corrected candidate — diff vs the live baseline (zero-context)

| Part | Candidate | Rollback |
|---|---|---|
| `v2/worker-entry-prod-d6.js` | +1683 / −76 | +245 / −22 (recorder-only) |
| `v2/coordinator.mjs` | +129 / −8 | identical to candidate |
| `v2/generation/service.mjs` | +34 / −0 | identical to candidate |

All other files byte-identical to the baseline in both trees
(composition suite, exit 0). Wren independently diffed both trees and
re-ran the A-3 battery firsthand: 48/0/0.

## 3. Battery — final complete run on the exact final trees

2026-11-16T18:04:05Z, `evidence/final-run-corrections/` (the first
build's run is preserved in `evidence/final-run/`). Three test
corrections were required by the ruling's semantics and are disclosed
in place (T-A3-19, T-A3-21, T-A3-36 part 3 — each now asserts the
corrected, stricter behavior), plus one disclosed test-side adaptation
in the copied A-1 battery for rollback runs.

| Suite | Result | Exit |
|---|---|---|
| A-3 battery (T-A3-01…46) | **48 pass / 0 fail / 0 skipped** | 0 |
| A-1 battery | 48 / 0 / 5 skipped (standing register) | 0 |
| S1 / V-3 | 9/9, 5/5 | 0 |
| Composition verification | OK | 0 |
| Rollback RC-2 battery | 2/2 | 0 |
| Rollback A-1 / S1 / V-3 | 48/0/5, 9/9, 5/5 | 0 |
| Containment (candidate AND rollback) | 41 pass / 1 fail — CT0 only | 1 |
| P2 (candidate AND rollback) | 31 pass / 2 fail — T0 only | 1 |
| R5A (candidate AND rollback) | 22 pass / 1 fail — T0 only | 1 |
| **Overall runner** | | **1** |

The overall exit is 1 SOLELY from the historical T0/CT0 fixture suites,
per R1. All evidence is offline harness simulation; platform behaviors
remain staging measurements under I8.

## 4. Boundary

Offline only; nothing here authorizes or requests deployment, staging
contact, trigger configuration, activation, or any production action.
On acceptance, the next gate is a deployment proposal for Julie.

Turn: Rowan's (corrections review). Julie pokes.
