# STANDARD RELEASE PAPERWORK — CORRECTIONS (per Rowan's release ruling)

Case: Opal Roundtable, issue #15. Date: 2026-11-14.
Authority: Rowan's Standard operational-release ruling §§1, 3
(verbatim board comment 6883695488), under Julie's preparation GO
(board comment 6883636191). The historical captures are NOT modified;
this document corrects the documentary reconstruction and estimate
that rest on them. Wren verified both corrections firsthand against
the pinned diagnostics before filing.

## Correction 1 — §4 addendum reconstruction (ruling §1)

The addendum (pin `b94bae36…`) stated that the attempt diagnostics
carry no per-attempt timestamps and reconstructed the settlement
curve in position order. **Both were wrong.** The diagnostics carry
`createdAt`/`updatedAt` on attempts and executions (the addendum's
extraction read only seq/outcome/cost and missed them), and
executions complete out of position order under parallel cohort
processing.

Corrected reconstruction (executions ordered by last-attempt
`updatedAt`, costs from the same pinned diagnostics):

- After 19 completed executions: cumulative **384,453** units.
- After 20 completed executions (position 120, last attempt updated
  20:06:32.479Z): cumulative **404,622** — still below the expected
  410,880.
- The final execution was position **114**; its last provider
  attempt, updated **20:06:55.005Z**, carried the cumulative to
  **422,397** — the crossing of the expected figure occurred on the
  final provider attempt of the stage. The execution row itself
  recorded updated at 20:06:56.299Z.
- First terminal supervision observation: ~20:07:51Z (the poller's
  21/21 poll + end-of-stage accounting reads).

The addendum's substantive conclusion stands, strengthened: the
excess was not actionable at the executed polling cadence, and no
synthesis work remained when it was observed. The supervision
limitation is retained verbatim: totals-only polling cannot
establish mid-stage expenditure compliance. Exact settlement
visibility is not inferred solely from update timestamps.

## Correction 2 — remaining-work arithmetic (ruling §3)

The operational-release proposal §3 stated the smoke gate consumed
42 occurrences and left ≈ 272. **Correct figures:** the gate
generated **22 new occurrences** (Chapter 4 plan: 20 eligible, 19
already complete → 1 new; Chapter 5 plan: 21 eligible → 21 new; the
two plans hold 41 total eligible). If the earlier 314-occurrence
remainder quote preceded the gate on the same eligibility basis, the
corresponding arithmetic remainder would be 292 — but **neither 272
nor 292 is adopted as the current eligible count**, and subtracting
settled expenditure from an estimated quote does not establish a
fresh remainder estimate. **The release-boundary census's fresh
whole-book remainder quote controls** (proposal §2 already requires
it; this correction removes the stale derived figures from §3's
basis).

All other proposal content stands as ruled.

Turn: Julie's (operational-release execution GO).
