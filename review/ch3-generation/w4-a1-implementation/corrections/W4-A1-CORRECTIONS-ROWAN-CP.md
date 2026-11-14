ROWAN COPY-PASTE — W-4 Track A: A-1 IMPLEMENTATION CORRECTIONS (for review of the corrected candidate)

Case: Opal Roundtable, issue #15. Handoff: RT-H-20261114-829e13.
Corrects: implementation package pin d873ce75abe6bb069d206f8c456e886890b66f0a, per your implementation review of 2026-11-14 (board 6879179027), I-C1–I-C5.
Authorization of record: Julie's offline implementation GO (board 6878879682); your §8 — implementation corrections, no new design cycle. Offline only; NO production contact. Production HELD.

READ ORDER (Dropbox folder "Opal Roundtable - For Rowan"; the pin carries the identical set plus the full logs):
1. W4-A1-IMPLEMENTATION-CORRECTIONS.md — the supplement: corrected identities, disposition of each I-C item, the B-G2 blocker, the corrected run.
2. The two full corrected sources + diffs vs the base, and A1-CANDIDATE-MANIFEST.md.
3. tests/a1-battery.test.mjs (+ harness) and logs/ — the complete corrected run.

CORRECTED CANDIDATE: same S1 base; exactly two parts changed — coordinator.mjs a3dce297…, worker-entry-prod-d6.js 4e2bed3c…. 29 parts byte-identical; no scheduler wiring.

WHAT CHANGED, PER YOUR ITEMS
- I-C1: the commitment boundary is now await state.storage.sync(). Reservation, commitment-failure handling, and the repeated boundary checks preserved; harness seam, T-17b, T-20b, T-24a, T-35 updated (await whitelist: getAlarm | sync | setAlarm). No PITR operation remains.
- I-C2: your defect reading was correct. Phase B2 now re-verifies state and derivation (a failed derivation suppresses as error:derivation_unverified, never zero competition), establishes the evaluation's OWN reservation still exists and remains outstanding (reservation_invalidated otherwise), re-checks the bound, takes a FRESH registration observation and re-establishes P-STALE from it, then runs the final synchronous fence/containment/halt/pending checks. New coverage: T-37a (derivation fault after sync), T-37b (mid-flight acknowledgment invalidates), T-37c (platform-side registration change, no revision movement, caught by the fresh observation).
- I-C3: both of your routes implemented — recorder discharge now requires a completion record (a live reservation is never AUTOMATICALLY discharged), AND an acknowledgment covering a live intent invalidates its permission at Phase B2. The derivation/status now distinguish outstanding strikes, completion-less intents, completed-but-ineffective attempts, and acknowledged historical attempts; a completion-less acknowledged intent stays visible after pruning (T-40). One completion within this item: discharge events are now persisted on EVERY outcome recording (registering completions from their Phase B2 derivation, and suppressed completions too), not only declines/reservations — T-40's register-then-prune flow exposed the gap.
- I-C4: the routed repair-status GET now constructs through the read-surface pattern (ASSUME_SCHEMA) — T-33 rewritten against the actual routed GET on dropped tables: reports missing state, creates nothing. Status events now carry the parsed detail payload (due, read-back, act-initiation, discharge pass ids, acknowledgment boundaries, intent linkage) plus authorization references and reasons; the derivation carries the I-C3 fields. Route mapping generalized: EVERY error:* outcome returns 500 — T-32c proves error:containment_unverified and error:registration_unreadable routed.
- I-C5: T-27 rewritten substantively (duplicate delivery over the held plan/job fixture: exactly one further pass; grants, plans, jobs, queue sends identical). T-38 (mid-evaluation containment stop) and T-39 (earlier pending row inserted mid-evaluation) added; T-17c added per your §3 (two wrappers, one state object). P2 adaptation as you accepted it.
- CORRECTED RUN (all rerun on the corrected tree, overall exit 0): A-1 battery 46 pass / 0 fail / 5 deferred-skips; S1 9/9; containment 42/42; P2 33/33; R5A 23/23; V-3 5/5. T-36 rollback re-executed on the corrected tree.

ONE ITEM RETURNED FOR YOUR DOCUMENTARY DISPOSITION — B-G2 (§3 of the supplement)
The B-G2 battery cannot bind to the A-1 candidate: its fixture builder requires the batch allowlist line in the candidate tree, and the A-1 candidate descends from the WS1 tree, where the batch subsystem does not exist (allowlist frozen ["standard"]). Against a scratch copy it fails at fixture setup before any test runs (log pinned). The WS1/WS2 candidates are separate trees by standing law and composition is expressly gated, so no legitimate shared tree exists today. B-G2 stands green against its own candidate (110/110, pin 4a924a7c…; additions 4/4, pin 6014babe…) and binds again at the composition step. Disclosure in full in the supplement: the scratch run's fixture builder flipped the allowlist line in place through a symlink before failing; the manifest walk caught it, it was reverted byte-identically, and the corrected candidate's two-part integrity is proven by the regenerated manifest and T-00 in the final run.

QUESTIONS
(i) Do I-C1–I-C4 as implemented discharge the corrections?
(ii) Your disposition on the B-G2 blocker: accepted as tree-bound, or do you require a different accounting?
(iii) Is the corrected candidate now clear for a deployment PROPOSAL to be prepared (proposal only — deployment itself remains Julie's separate gate)?

Production remains HELD. W-4 remains an open historical deviation. WS2/Batch untouched apart from the documentary question above.

Reply route: via Julie, as always. End by naming whose turn it is.
