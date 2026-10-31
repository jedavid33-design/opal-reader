# Step D4 — post-state verification: PASS (capture 2026-10-31T00:49:21Z)

- Deployed-script download: **all 27 module parts byte-identical**
  to the validated envelope (parts-verification.json; the sole
  non-module row is `metadata`, absent from the GET-script
  representation — the established representation, disclosed at
  the combined deploy and accepted by Rowan: the metadata's
  operative content is proven by the D2 PUT response — entry
  point `v2/worker-entry-prod-d6.js`, compatibility 2026-08-29 +
  nodejs_compat, handlers [fetch, queue] — and by the GET
  /settings bindings read-back: exactly the 10 expected bindings,
  halt "1", policy "enforce"). Script etag on download ==
  `a9a4c0c40ceefa6138c1cc8ebb3f0ab5b2205e7b7a057b865c8c312cbb13c39e`,
  identical to the D2 PUT etag.
- `/health`: build `6a73d9622e1b4eac00c58e289de1c674ed6b3d6b`
  (exact), generation "halted", coordinator "armed".
- **Data comparison vs D0 (Rowan's mandatory interpretation,
  6536365406):** compare-d4.log (tools/compare_d4.py) — raw
  response bodies compared with the new build's legitimate
  additive keys recursively stripped: **ALL 21 surfaces
  IDENTICAL** (settings, quota, plan list, both plan details,
  all three jobs, conflicts, both sync snapshots, both
  diagnostics, capabilities, both queues, bindings,
  script-settings, health excluding build, v1 + staging etags).
  No substantive mismatch was skipped: every historical value —
  settings rev 1, quota 0 / 371485 / 19, watermarks 18 / 1800,
  Ch 2 `halted_unknown` with its unknown attempt still
  undisposed, 58 confirmed attempts / zero reserved/dispatching,
  both grants `issued` rev 2, the two `schedule_dead` conflicts,
  Ch 3 `parked_policy` + fingerprint
  `b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`
  exact, neighbors — is unchanged.
- **Additive keys observed live-but-dormant (zero unverified
  exposure), asserted individually in compare-d4.log:**
  capabilities FP phase `estimatedUnverifiedMicroCents: 0`,
  `reservedUnverifiedMicroCents: 0`, `remainingMicroCents`
  13,300,335 (unchanged, as the source promises at zero
  reservation); both plan summaries
  `estimatedUnverifiedMicroCents: 0` with NO
  `estimatedUnverifiedStatus` key (the status rides only when an
  adjudication exists — count is 0); both diagnostics views carry
  the new `phaseAccounting` block: settled 199,665 under
  `settledBasis: "recorded_known_existing_ledger"`, estimated 0,
  reserved 0, `unverifiedStatus: "provider_unverified"`,
  in-flight 0, `unknownOpen: 1` (phase-scoped per source — the
  one undisposed Chapter 2 unknown; identical on the smoke view
  because both plans share the phase).
- Per the proposal: **no playback smoke is claimed for this
  halted deploy** — the deploy swapped Worker code only; the one
  new surface is an operator-only route that stays dormant until
  the separate adjudication gate; nothing user-visible changed.
