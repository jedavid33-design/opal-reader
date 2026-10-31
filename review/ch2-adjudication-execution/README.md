# Gate-5 adjudication execution — package

Repo-only execution proposal for the ONE §8 uncertainty
disposition (design Rev 2, pin `d2daa2e5…`), prepared under
Rowan's execution-record PASS 6536797045. **Nothing in this
package performs the adjudication.** Execution requires
Rowan's review of the proposal, then Julie's distinct
explicit approval naming this adjudication.

- `ADJUDICATION-EXECUTION-PROPOSAL.md` — the proposal
  (preflight, the one call, write-set, invariants/STOPs,
  execution sequence E0–E5).
- `PREFLIGHT-SUMMARY.md` — fresh read-only preflight,
  2026-10-31T00:56:25Z: attempt
  `att-37d63768-db4b-447d-8150-580b7c6ee257` (cost NULL,
  char_count 1,349, estimate 19,018, reservation 5,648),
  build `6a73d962…` + etag `a9a4c0c4…` rollback-floor
  baseline, zero-disposition evidence + its stated limit.
- `evidence/` — scrubbed deploy-verification attachments
  (D4 comparison summary, four-file hash comparison, 27-part
  verification) per Rowan's housekeeping ask.
- `preflight/` — raw local read captures (`pf1`) the summary
  was drawn from (local only; not pinned).

Subject: plan `plan:603ab416bd67ab1b25de97be`, phase
`forever-pucked`. Route: `POST /v2/d6-adjudicate-estimated`
(operator fence). Retirement and re-arm are later separate
gates, not in this package.
