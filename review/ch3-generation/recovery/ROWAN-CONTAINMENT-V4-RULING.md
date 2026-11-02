# Rowan ruling — Phase B containment V4 (record of relay)

> **Record note (Wren):** Relayed verbatim by Julie in the Coding Projects chat on Nov 2, 2026 (~2:32 p.m. ET). Rowan's review was performed against the six-file Dropbox V4 package — the first review round conducted through the Dropbox rotation folder. No board copy exists; this chat relay is the record. Verdict: REVISE BEFORE GATE APPROVAL. The same ruling text was relayed twice in chat (identical); recorded once.

---

ROWAN RULING — PHASE B CONTAINMENT V4

Verdict: REVISE BEFORE GATE APPROVAL

Documentary review completed against the six-file Dropbox V4 package dated November 2, 2026.

R1: ACCEPT. The derived confidence model and truth-table row 11 are approved as design choices.

R2: ACCEPT. The narrowed asynchronous ordering claims are appropriately qualified. Platform ordering and serialization assumptions remain unresolved.

R3: CONDITIONAL ACCEPTANCE. The retry-exhaustion law is directionally accepted, subject to V4-1 and V4-2.

R4: CONDITIONAL ACCEPTANCE. The C3 mutation ledger and revised write budgets are accepted in principle, subject to the ambiguous-response correction.

R5: ACCEPT the standing conditional S1-X authorization design, subject to V4-4. This is not an execution authorization.

R6: REVISE the evidence and risk wording.

Required corrections:

1. V4-1: Distinguish append-only audit persistence from the single previous-episode summary, which can be overwritten. Require historical audit review for restoration and post-exhaustion authorization.
2. V4-2: Separate recorded logical completion from physical verification throughout C3 re-entry. Do not treat an audit row alone as proof of physical completion.
3. V4-3: Make the readable-record precondition explicit in truth-table row 1, preserving row 2's unreadable-record precedence.
4. V4-4: Bind standing S1-X authorization to a pinned package, specific observation window, verified trigger evidence, single use, and expiration at window close.
5. V4-5: Correct the risk register's claims concerning next-read detection, historical exhaustion visibility, and commit-to-record uncertainty.

Preserve existing passing assertions. Add targeted regression coverage where the corrections change executable behavior.

No production calls, deployment, restoration, stimulus, or mutation are authorized. Production remains under INVESTIGATION HOLD, ending HELD.

Return one consolidated corrected package through the Dropbox folder. Replace the previous review files rather than accumulating versions. Include the exact candidate identities, test results, corrections, and remaining open risks.

Next turn: Wren.
