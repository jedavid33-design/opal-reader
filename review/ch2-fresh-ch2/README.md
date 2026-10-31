# Fresh Chapter 2 generation — plan package (gate 8, repo-only)

Prepared under Rowan's gate-7 re-arm execution-record PASS
(roundtable issue #15, comment 6537871481), which authorized
preparing this plan. **This package submits no intent, makes no
production mutation, generates nothing, and spends nothing.** The
investigation behind it was read-only (connector GETs) plus source
analysis of the deployed build tree.

## Contents

- `GENERATION-PLAN.md` — the operational plan: §0 a correction to
  the gate-7 record (the intent-identity formula changed between
  the build that minted the retired plan and the live build, so
  the retired plan's convergence premise no longer holds — proven
  by exact key reproduction); §1 the distinct minting identity
  (chapter scope, chapterIndex 1, keepGoing `false`, lane
  `standard`, phase `forever-pucked`; predicted plan
  `plan:b2dc2a3d1cd367a0245b9102`, probed nonexistent), with the
  scope analysis rejecting book scope both ways and segment scope;
  §2 the three-way eligible/bound re-derivation (18 eligible /
  25,091 chars / expected 353,726; 20 bound; writer's quote,
  retired-plan entries, and the live bindings snapshot in exact
  agreement); §3 safety and duplicate-billing protections;
  §4 the execution sequence and stop behavior for Julie's later
  go, including the unknown-billing runbook; §5 budget with the
  mandatory billing-truth disclosures and the dated ($17.83,
  Oct 29, 2026 screenshot) prepay caveat; §6 explicit
  non-authorizations.
- `evidence/rederivation-assessment.json` — the canonical
  assessment: the live system snapshot (2026-10-31T02:43:02Z),
  the full 38-row chapter-1 re-derivation table with per-segment
  cost-model figures and live-binding flags, the book-scope
  counterfactual quote, the intent-identity archaeology (both
  formulas, both candidate keys, the exact reproduction of the
  retired plan's key under the pre-B2 formula), and the budget
  math. Raw connector captures stay in the local package
  (`reads/`); the JSON is generated from them programmatically.

## How to verify

- Intent keys: canonical JSON (recursively key-sorted) over the
  evidence JSON's `intentIdentity.eligibleIdsInReadingOrder`,
  SHA-256 hex; plan id = `plan:` + key[:24]. The pre-B2 field set
  `{bookId, scope, chapterIndex, occurrenceId, eligibleIds}`
  reproduces the retired plan's key exactly; the live B2 set adds
  `lane`, `keepGoing`, `phase`.
- Cost figures: expected = round(chars / 15.96 × 225);
  per-attempt upper = round(chars / 10 × 225); per-occurrence
  upper = 12 × per-attempt upper (`generation/gen-constants.mjs`
  in the deployed build tree).
- Source claims cite the deployed tree
  (`generation/service.mjs`, `generation/grant-guards.mjs`,
  `generation/binding-projection.mjs`, `generation/policy-split.mjs`,
  `coordinator.mjs`, and the prod entry's `d6Intent` forwarding).

Execution requires Rowan's review of the plan and Julie's
distinct go; Batch stays unarmed and Chapter 3 stays parked
throughout.

— Wren
