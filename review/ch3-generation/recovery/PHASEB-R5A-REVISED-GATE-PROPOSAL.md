# Phase B — R5a REVISED execution-gate proposal (deploy only; stimulus separately gated)

**Status: PROPOSAL ONLY — NOT APPROVED, NOT TO BE EXECUTED.**
Prepared under Rowan's R5a revision ruling (board comment
`6584187105`, 2026-11-02), which states: *"The R5a execution gate is
not approved."* This document is the separately reviewable gate the
ruling's process requires. Execution would additionally need
Rowan's approval of this gate **and** a fresh explicit Julie GO
(§9). Production remains under INVESTIGATION HOLD.

**Scope of this gate, if ever approved: deploy the pinned R5a
candidate and verify it, ending HELD. NO stimulus** — no command, no
report, no wake provocation, no SubmitJob. Any stimulus (R2 or
otherwise) is a *separate* gate, and per the containment design it
may not run until containment is deployed and verified (§2).

---

## 1. Object of the gate

Deploy exactly the candidate pinned with the R5a revision package:

- One part changes vs the live build `86ad06ab…`:
  `v2/coordinator.mjs`, 278,396 B, SHA-256
  `d3d9005b9c2f83cd9a47ef7012b7cea5ed21d73886626d6e24bb655ee90389a3`;
  diff +51/−12 (`coordinator.diff`, SHA-256
  `9720c34800eded95b419f089562076cac127f19444a7a4d039c1423a2e2e09aa`).
- The other 30 parts byte-identical to the live build's stamped
  manifest. The build stamp (`build-identity.mjs`) is updated to
  the execution pin per the standing build-marker rule, and that
  stamped part is counted in the assembly verification exactly as
  in the P2 gate.

## 2. Sequencing preconditions (hard)

1. **Containment first.** The containment mechanism
   (`PHASEB-CONTAINMENT-DESIGN.md`) must be deployed under its own
   gate and Layer 1 verified available **before** this gate's
   deploy is used as a platform for any stimulus — and, as proposed
   here, before this gate executes at all, so that no window exists
   in which a wake could revive the chain under R5a semantics with
   no tested stop. (If Rowan prefers R5a deployed first and
   containment second, that ordering is hers to rule — unresolved
   decision 5; the stimulus prohibition holds under either order.)
2. Rowan's approval of this gate as a **separate** ruling (her
   design acceptance does not approve it).
3. Julie's fresh explicit GO in the §9 scope wording.

## 3. Census (pre-flight; any deviation = STOP)

Identical in form to the P2 gate's §3 census, re-based to the live
instrumented build: /health build `86ad06ab…`; script etag
`ba80e81f…`; 31/31 parts vs the live manifest; observability enabled
+ persisted; 10 bindings; GENERATION_HALT "1"; policy enforce;
settings revision 1; queue paused, 1 consumer; standard admitted /
Batch not armed; registry FP ↔ `5c589095-f812-48a2-8ab2-03ba2791f2b2`;
phase figures exact (settled 1,029,420 / estimatedUnverified 19,018 /
reservedUnverified 5,648 / unknownOpen 0 / remaining 12,464,932);
reconcile `ok: true` with the sole straddler exception; PT
dispatched history exact and current PT day 0; exactly 5 plans with
the preserved plan `plan:19cad189fab54b9c804a74a6` active, entry
pending, job queued rev 1, quarantine unheld, grants []; conflicts
exactly the 4-row `schedule_dead` baseline; parked fingerprint
`b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`;
watermarks 18 / 1841; idx-26 R2 key FREE; **and** a `drive=1` read
recording armedAt, pendingSchedule, pendingWatchdog, tableState and
recorderHealth as the pre-deploy observation (whatever they then
are — they are recorded as the census baseline for §7 comparison,
not required to still equal the Nov 2 values; any *unexplained*
difference from the last recorded observation is a STOP).

## 4. Build verification

- Re-assemble from the live parts + the pinned coordinator diff;
  assert the assembled coordinator hashes to the pinned identity
  and the remaining 30 parts match the live manifest.
- **Battery re-run on the exact assembled tree is mandatory**
  (the pinned battery log is evidence about the pinned tree; the
  gate re-runs the full combined battery — R5a suite + P2
  regression suite — against the gate-assembled tree and records
  its own log; the two superseded P2-T0 identity assertions are
  expected to fail against any post-P2 tree and are replaced for
  this purpose by R5A-T0's assertions, as documented in the
  revision spec §8).
- Pin the gate-assembled tree before upload (build-marker rule).

## 5. Mutation budget (complete and reconciled)

| item | budget |
|---|---|
| forward upload | **1** |
| observability PATCH after forward upload | ≤1, only if the post-upload read shows observability reset |
| rollback upload (conditional, §8 triggers only) | ≤1 |
| observability PATCH after rollback upload | ≤1, same condition |
| commands / reports / SubmitJob | **0** |
| hold flips / queue changes | **0** |
| alarm registrations caused by this gate | **0 expected** — a deploy is not a wake; the P2 deploy left the armed value bit-identical. Any registration change observed in §7 is a finding to classify, not a budget item to spend |
| recorder rows | 0 expected (no pass is provoked; if the platform delivers the stale alarm spontaneously during the window, rows accrue and are classified, §7) |
| spend | $0 |

## 6. STOP conditions

**Correction 6 (ruling item 6) — governs every STOP in this
document, verbatim:** STOP prevents additional operator stimuli but
cannot itself stop an already-revived alarm chain. A successful
recovery may continue watchdog and grant/void activity beyond the
observation window, indefinitely under the holds; containment of a
revived chain requires its own independently gated procedure, and
that continuing effect must be explicitly addressed before any
production stimulus. (This gate contains no stimulus; the clause is
carried because the deploy changes the semantics under which any
later wake acts.)

STOP — before upload — on: any §3 census deviation; battery re-run
not matching the pinned result profile; assembled-tree hash
mismatch; containment precondition (§2.1) unmet. STOP — after
upload — fires the §8 rollback evaluation on: read-back parts not
byte-identical to the stamped manifest; /health not reporting the
new build with generation halted and coordinator armed; any change
in the preserved plan, exemption-visible state, conflicts baseline,
phase figures, or queue/hold state between the §3 census and the §7
read-backs that is not fully explained by a spontaneously delivered
pass (§7 classification).

## 7. Post-deploy observation and classification

Two `drive=1` observation reads (approximately +10 and +25 minutes,
the P2 gate's cadence). Classify outcomes exactly as the P2 gate
did: no rows + unchanged armedAt = **inconclusive** (it does not
prove non-delivery); rows present = classify each pass against the
§7.3 pre-classified movement set from the R5a paperwork (any
movement outside it = STOP + report, and containment Layer 1 is the
standing answer if a chain has revived); changed armedAt without
rows = a finding requiring classification before anything else
proceeds. **This gate ends HELD regardless of classification**, and
no classification under this gate authorizes a stimulus.

## 8. Rollback

Conditional, in-gate only, on the §6 post-upload triggers:
re-upload the live build `86ad06ab…`'s byte-identical parts
(preserved), + ≤1 conditional observability PATCH, then read back.
The rollback floor is untouched by this gate (both builds are far
above `6a73d962…`). Any rollback **after** the gate closes needs its
own authorization.

## 9. Exact Julie GO scope a future execution would need

> "GO — execute exactly one R5a deploy attempt per the revised gate
> as pinned: one upload of the pinned candidate (+ at most one
> conditional observability PATCH, and conditionally one rollback
> upload + at most one conditional PATCH on the gate's named
> triggers), census and observation reads as specified, **no
> stimulus of any kind** (no command, report, wake, SubmitJob, hold
> or queue change), ending HELD. I understand permanent production
> safety is not claimed until the retry issue is resolved."

## 10. Preservation checks (closing)

Repeat the §3 census items verbatim at close: preserved plan /
entry / job / grants [], conflicts baseline exact, phase figures
exact, parked fingerprint exact, watermarks unchanged, holds and
queue state unchanged, exemption untouched (its journal has no read
surface — §9.2A(c) UNAVAILABLE, never claimed as read).

**Turn: Rowan's** (gate review). No GO is requested by this
proposal.
