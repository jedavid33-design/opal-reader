# Operator-route correction 2 — body-read failure is not an empty body (repo-only)

Answering Rowan's one-item fail-closed hold (board comment 6546431837 on
issue #15), which closed her three prior route holds and left exactly this:
both bootstrap body reads — the public forward and the DO handler — used
`await request.text().catch(() => "")`, transforming an I/O/read failure
of a nonempty or aborted body into the same empty string that
intentionally authorizes the one-time quota bootstrap.

## The patch (entry file only, both layers byte-identical)

- Public forward (`POST /v2/d6-quota-bootstrap`): the body is read with
  an explicit try/catch; a read failure returns HTTP 400
  `{error: "quota_bootstrap_body_read_error"}` and is **never forwarded**.
- DO handler (`/internal/d6/quota-bootstrap`): the same read, after the
  admitted-stamp and halt fences and before any store contact; a read
  failure returns the named refusal `quota_bootstrap_body_read_error`
  (200 `{outcome:"rejected"}`), distinct from
  `quota_bootstrap_body_malformed` (unparseable content) and
  `quota_bootstrap_body_null` (explicit JSON null), and from a
  legitimately absent/empty/`{}` body, whose semantics are unchanged.
- No other route, handler, or file changed. `REVISED-DEPLOY-PLAN.md` is
  unchanged from the routes-fix pin (the plan does not specify body-read
  mechanics) and is therefore not re-pinned here.

## Test

- **QROUTE-20** (new): a request whose body is a ReadableStream that
  errors on read, sent (a) through the public entry WITH the correct
  operator credential → HTTP 400 `quota_bootstrap_body_read_error`, and
  (b) directly to the admitted DO handler → 200 rejected with the same
  reason. Both assert zero state movement (byte-identical snapshot, no
  `d6_provider_dispatches` table created, no bootstrap marker). A valid
  no-body request afterwards boots normally. QROUTE-16's
  malformed/null/valid semantics all still pass.
- Route suite: **20/20**.

## Battery (one complete run on the exact final tree)

- 135 suites: 113 pass / 22 fail; **1,099 tests: 1,077 pass / 22 fail**;
  runner exit 0; zero `AssertionError`.
- Delta vs the routes-fix tree (135 / 113/22; 1,098 / 1,076/22): exactly
  **+1 test / +1 pass / +0 fails** (QROUTE-20). The 22 failing suites are
  programmatically set-identical to the routes-fix baseline.

## Hashes

- `worker/worker-entry-prod-d6.js` (= `v2/` mirror):
  `d862612e…` (routes-fix) → `410dfa410abfdb4bfeb81ac1a9c102b89ec6ce68c352b6b6fe3360d7dfe0b017`
- `tests/quota-operator-routes.test.mjs`: extended with QROUTE-20 only.
- `quota-budget.mjs` and every other protected file: byte-identical to
  the routes-fix tree.

## Pin disclosure

The first fix2 pin (`02d8473d…`) was committed with the *previous*
package's BUILD-REPORT.md still in this directory (the corrected report
write was refused because the copied file had not been read first; the
pin proceeded with the stale file). The entry source, tests, and logs in
that pin are the correct final artifacts; only the report was stale.
This report ships in a single-parent child commit correcting exactly
that one file; the lineage is not rewritten.

## Labels

- CONFIRMED: the two read sites and their catch-to-empty behavior in the
  routes-fix source; the patch, test, and battery results above, all
  produced and verified on this tree.
- No production contact of any kind; no deploy; envelope not recomputed
  (per amendment 4, counts are harness outputs at re-proposal time).
