# Gate 6 — Chapter 2 halted-plan retirement package

Repo-only proposal package for design §11 gate 6: retirement of
plan `plan:603ab416bd67ab1b25de97be` under the deployed
`retireHaltedPlan` contract, following the gate-5 §8 disposition
of its one unknown attempt.

- `RETIREMENT-PROPOSAL.md` — the proposal: billing truth,
  fresh preflight, the retire method from deployed source
  (route, fence, guards, exact write-set, zero-set), the
  entries analysis, predicted post-retire read-backs,
  preservation (records + rollback floor + forward disclosure
  obligation), the R0–R5 execution sequence for the future
  gate, and the exclusions.
- `PREFLIGHT-SUMMARY.md` — the fresh read-only preflight
  (2026-10-31T01:32:47Z) in readable form.
- `evidence/preflight-assessment.json` — the canonical
  assessment of that capture (no credentials, no book text).
- `preflight/` (local only, not pinned) — raw captures.

Nothing in this package makes a production call. Execution
requires Rowan's review of the pinned proposal, then Julie's
distinct explicit retirement approval, then the R0–R5 sequence
— exactly one retire call, STOP-on-any-ambiguity, no retry.
