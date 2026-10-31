# D1 operative run + gate-(a) checklist confirmation (repo-only, no-effect)

Answering Rowan's CONDITIONAL HOLD (board comment 6546707021), item 1:
the placeholder-pin proof is not the deployable artifact. This record is
the operator-executable D1 run against the exact source-passed tree with
the actual final pin, plus the checklist confirmation retaining items 2
and 3 as runtime STOP gates.

## Source location and tree identity

- Candidate source tree: `quota-routes-fix2/worker-build` in Wren's
  workspace (the final corrected combined tree; entry
  `v2/worker-entry-prod-d6.js` SHA-256 `410dfa410abfdb4b…`).
- The tree's identity does not rest on that path: **every file in the
  tree is fixed byte-for-byte by the pinned `tree-inventory.json`**
  (package pin `945875bc…`, 805 files with per-file SHA-256 + sizes).
  Any operator holding a tree whose files all match that inventory is
  holding the exact source-passed tree, wherever it sits; a single
  mismatching file means it is not this tree, and D1 must not proceed.
- The complete source is additionally recoverable from the review
  lineage on `ui1-review` (quota build → corrections → fix2 → routes →
  routes-fix → routes-fix2 pins), whose deltas compose this tree.

## The operative D1 run (executed 2026-10-31)

- Command: `node validate-final-envelope.mjs --pin 945875bc26b0e2ca965d5c0f710f11c0164025f8`
  against the tree above.
- Result: **FINAL ENVELOPE VALIDATION: PASS (23/23 assertions)**,
  runner exit 0 (full log pinned alongside this record).
- **Operative envelope: 1,339,824 bytes, SHA-256
  `38ebec8e380f5035f1d6e30670f42e489131e1b0771b3540eb49b2f7e57ed0de`**,
  stamped with pin `945875bc26b0e2ca965d5c0f710f11c0164025f8`
  (`pinIsPlaceholder: false` in the operative parts manifest, pinned
  alongside). 28 parts; stamped module bytes 1,332,909.
- This SHA — not the placeholder run's `90bdfbe1…` — is the operative
  envelope identity for gate (a). At execution, D1 re-verifies that the
  assembled upload bytes hash to exactly this value before the D2 PUT;
  any difference is a STOP.

## Gate-(a) checklist confirmation — items 2 and 3 retained as runtime STOP gates

- **Item 2 (P0):** before any mutation, P0 freshly establishes
  production identity (build/etag/bindings/operator-credential
  readiness without exposing values), GENERATION_HALT state, queue
  consumer + pause state, and a fresh generation-plane census (active
  plans/jobs, in-flight dispatches/attempts, claims/grants, parked
  Chapter 3 state/fingerprint, unknown-billing status, spending
  controls), with strict per-entity provenance comparison for content
  and audio-binding watermarks (Ch 2 and parked Ch 3 strict identity).
  **Any unexplained drift is a STOP — never an invitation to
  normalize.** P3's read-back must prove no in-flight generation
  slipped across the halt transition.
- **Item 3 (containment + rollback honesty):** queue-side pause and
  read-back, and all rollback prerequisites, are confirmed **before**
  the D2 PUT. The rollback floor (`6a73d962…` + etag `a9a4c0c4…` + its
  data) **does not enforce the provider-attempt counter and is never
  represented as a safe re-arm fallback**; re-arm after any rollback
  requires the guarded build restored plus `reconcileQuota.ok === true`
  at that moment and Julie's separate GO. D4 must prove deployed bytes
  byte-identical to the operative envelope's parts, the
  halted/paused/UNARMED end state, and playback-read sanity — with no
  generation and no spending. D3's observability PATCH fires only if
  the upload reset it, via `/settings` multipart, with the code etag
  proven unchanged.

## Labels

- CONFIRMED: the operative run's outputs above, produced on this
  machine against the inventory-identified tree; the source tree
  unmodified by the run (harness writes only its own outputs).
- This record authorizes nothing. Gate (a) remains Julie's separate
  decision after Rowan's final operational readiness ruling.
