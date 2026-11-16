# A-3 — R4 CLOSURE PACKAGE (registration revision fence)

Case #10 / P8 (issue #15). Prepared by Wren, 2026-11-16, under Julie's
offline implementation GO (board 6922008740), answering the one
remaining blocker in Rowan's corrections ruling (CONDITIONAL
IMPLEMENTATION PASS; verbatim board 6925313493). All other accepted
corrections (R1/R2/R3/R5/R6/R7/R8) are untouched; no regression was
found in any of them. Supersedes pin `d733c26e…` as the candidate's
state of record; that pin and its evidence are preserved unmodified.
Handoff: RT-H-20261116-r4close
Review pin: PIN-SLOT (repo `jedavid33-design/opal-reader`, branch `ui1-review`;
the Dropbox copy carries the filled pin — the only difference between copies).

## 1. The correction — registration revision fence

Rowan's point: the corrections round's stale-observation protection
depended on a newly recorded pass with a changed `armed_after`, but
the coordinator's command/report wake paths can initiate a
registration WITHOUT writing a pass row — and a native pass whose
recorder write fails leaves no row either. Recorder availability must
not be the sole concurrency witness.

The fix reuses A-1's pre-existing alarm revision mechanism (every
registration/deletion initiation bumps the one revision, in the same
synchronous stretch as the act):

- **Capture** (entry :2928): `alarmRevisionFor(this.state)` is read
  immediately before the tick's asynchronous `getAlarm()` observation.
- **Comparison** (entry :3189–3191): inside the final synchronous
  admission stretch, after the retained recorder stale-observation
  check and before the fresh classifier result is acted on. A changed
  revision refuses with classification UNMATCHED / reason
  `revision_changed`, logged as `skip_revision_changed`. Like every
  refusal it commits nothing — **the tick watermark is NOT consumed**
  (proven in T-A3-47: a later tick admits after the fenced refusal).
- Admission requires BOTH witnesses clear: revision unchanged AND the
  fresh classifier evaluation returning INTERVENE. The recorder
  protection is retained verbatim; the fence is additive.

One minimal coordinator change, justified: the D6 entry class does not
inherit the coordinator class (they are separate objects over the same
state — verified in source and empirically), and constructing a
coordinator inside the stretch was rejected because its constructor
runs schema DDL and seeding writes — mutation inside the boundary the
stretch keeps pure. The revision read was therefore factored into an
exported pure function, `alarmRevisionFor(state)` (coordinator :576 —
a WeakMap lookup only: synchronous, no await, no write, no throw),
and `_alarmRevision()` now delegates to it. One definition of the
read; zero behavior change to any coordinator path. The accessor is
mirrored verbatim into the rollback tree's coordinator for exactly one
reason — the composition check asserts Part 2 byte-identity between
the trees; nothing in the rollback tree imports it, and the rollback
entry is otherwise untouched (it has no tick and no fence, by
construction).

**Limitation, stated plainly:** the fence's writers are covered
because every coordinator registration initiation bumps the one
revision. A registration change made OUTSIDE the coordinator part
would not move it — none exists in the three parts (the entry never
calls `setAlarm` directly).

## 2. Targeted tests (wakes modeled through the real paths)

- **T-A3-47** command wake (`handleCommand`) during the observation,
  no pass row → `skip_revision_changed`, watermark unconsumed, no
  fallback pass; a later tick admits. PASS
- **T-A3-48** executor-report wake (`handleReport`) — same shape, same
  refusal. PASS
- **T-A3-49** native pass completing with its recorder write faulted:
  the pass arms (revision advances) but records no row; the fresh
  classifier alone would admit → the fence still refuses. PASS
- **T-A3-50** control: unchanged revision + qualifying observations →
  exactly one admitted fallback pass; redelivery of the same tick =
  `duplicate_or_stale_tick`. No over-suppression. PASS

## 3. R6 dormant exit-assurance qualification (demonstrated + delimited)

With the scheduler never activated (fixtures assert inactive, epoch 0,
no activation events), each shape twinned against the pre-A-3 build:

- **(a)** healthy numeric registration (T-A3-28): no act; no behavior
  change.
- **(b)** null registration + pending rows after a native pass
  (T-A3-51): the assurance performs one read, one `_armAlarm()`
  attempt through the coordinator's own containment-gated arming, and
  classifies the outcome from the read-back (`verified`). The pre-A-3
  twin exits with NO registration. **This is a behavior change vs the
  pre-A-3 build in dormant deployment** — stated at full strength in
  the notes. It is bounded to: pass exit ∧ exit read null ∧ pending
  rows ∧ containment permitting; it is fully recorded on the pass row;
  it introduces no scheduler, tick, or drive behavior.
- **(c)** failed native pass (original error rethrown unchanged) +
  null registration + pending rows (T-A3-52): the assurance runs
  identically on the failure exit and restores the registration; the
  twin recovers nothing.

Delimitation for the deployment gate: the fixtures model registration
loss as deletion-after-landing; whether the platform loses
registrations in that shape, and whether a re-armed registration is
subsequently DELIVERED, remain staging measurements (I8), not
provable offline. Rowan's wording is carried in the notes: a numeric
read-back is evidence a registration was observed, not proof of native
delivery or of correct registration identity.

## 4. Battery — final complete run on the exact final trees

2026-11-16T18:38:41Z, `evidence/final-run-r4closure/` (earlier runs
preserved). A-3 battery independently re-run by Wren: 54/0/0.

| Suite | Result | Exit |
|---|---|---|
| A-3 battery (T-A3-01…52) | **54 pass / 0 fail / 0 skipped** | 0 |
| Composition verification | OK | 0 |
| A-1 battery | 48 / 0 / 5 skipped (standing register) | 0 |
| S1 / V-3 | 9/9, 5/5 | 0 |
| Rollback RC-2 / A-1 / S1 / V-3 | 2/2, 48/0/5, 9/9, 5/5 | 0 |
| Containment (both trees) | 41 pass / 1 fail — CT0 only | 1 |
| P2 (both trees) | 31 pass / 2 fail — T0 only | 1 |
| R5A (both trees) | 22 pass / 1 fail — T0 only | 1 |
| **Overall runner** | | **1** |

Candidate vs live baseline: entry +1730/−77 (sha `c5853a70…`);
coordinator +145/−10 (sha `ce90852a…`); service +34/−0 (unchanged
this round). This pin carries the complete workspace (all runner
inputs, both trees, all evidence runs) with the file set mechanically
verified equal to the workspace.

## 5. Boundary

Offline only. Nothing here authorizes or requests deployment, staging
contact, trigger configuration, activation, or any production action.
On Rowan's acceptance, the next gate is a deployment proposal for
Julie (which must also carry the dormant-assurance delta in §3 and,
later, the activation proposal must address the WAIT-hold installation
contingency).

Turn: Rowan's (implementation acceptance review). Julie pokes.
