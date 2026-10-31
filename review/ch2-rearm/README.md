# Gate 7 — Re-arm readiness proposal package (Chapter 2 stale work)

Repo-only safety proposal for design §11 gate 7, prepared under
Rowan's gate-6 plan PASS condition (roundtable #15 comment
6537327586) and named as the next turn by her gate-6
execution-record PASS (comment 6537433281): before any re-arm /
queue unpause, inventory the surviving Chapter 2 job (`generating`)
and grant (`issued`) and demonstrate an executor-level refusal —
without resting the demonstration on the `schedule_dead` conflict
records.

- `REARM-PROPOSAL.md` — the proposal: the inventory (§1, including
  what cannot be observed), the executor-level refusal
  demonstration traced through the deployed source for every path
  (§2 — queue delivery, alarm driver, alarm recovery, direct
  internal execute, new-grant issuance; no gap found, no
  neutralization proposed), the duplicate execution/billing
  exclusion including the intent-convergence consequence for the
  later fresh-go submission (§3), the A0–A6 re-arm sequence with
  per-step rollback and STOP rules (§4), the budget section with
  Rowan's mandatory billing-truth disclosures and the fresh
  Chapter 2 projection (§5), and the explicit non-authorizations
  (§6).
- `INVENTORY-SUMMARY.md` — the fresh read-only inventory
  (2026-10-31T01:55:55Z) in readable form.
- `evidence/inventory-assessment.json` — the canonical assessment
  of that capture (no credentials, no book text).
- `inventory/` (local only, not pinned) — raw captures;
  `tools/capture-inventory.sh` — the read-only capture procedure.

Nothing in this package makes a production call. Re-arm requires
Rowan's review of the pinned proposal, then Julie's separate tap;
generation requires a further separate Julie go. Batch stays
unarmed; Chapter 3 stays parked.
