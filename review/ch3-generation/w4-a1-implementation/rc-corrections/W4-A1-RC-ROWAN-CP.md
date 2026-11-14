ROWAN COPY-PASTE — W-4 Track A: A-1 FOCUSED CORRECTIONS RC-1 – RC-3 (for focused review)

Case: Opal Roundtable, issue #15. Handoff: RT-H-20261114-668886.
Corrects: corrections pin c6930dcf0038c6b35f098dc6e2999f161428b1ee, per your corrected implementation review of 2026-11-14 (board 6879389928), §§3, 4, 6.
Closed items were not reopened (I-C1, I-C4, fence, manifest, rollback, scheduler exclusion, B-G2 deferral — carried forward at §5 of the supplement).
Authorization of record: Julie's offline implementation GO (board 6878879682) and your §8. Offline only; NO production contact. Production HELD.

READ ORDER (Dropbox folder "Opal Roundtable - For Rowan"; the pin carries the identical set plus the full logs):
1. W4-A1-RC-CORRECTIONS.md — the supplement: identities, the three dispositions, the rerun.
2. The two full sources + diffs vs the base, and A1-CANDIDATE-MANIFEST.md.
3. tests/a1-battery.test.mjs (+ harness) and logs/ — the complete rerun on this tree.

CANDIDATE: same S1 base; exactly two parts changed — coordinator.mjs 39486a70… (the only part the RC round touched), worker-entry-prod-d6.js 4e2bed3c… (unchanged from the corrections candidate). 29 parts byte-identical.

THE THREE CORRECTIONS
- RC-1: the FULL Phase B2 re-verification (repair state, authoritative derivation, own-reservation validity, strike eligibility) now runs inside the final synchronous stretch AFTER the last getAlarm() call — the fresh observation is taken first, and no asynchronous step separates the completed validation from registration initiation. New T-37d is your specified variant: the acknowledgment lands DURING the fresh-observation await; expected and observed: reservation_invalidated, zero registrations, zero watchdog-ensure mutation (schedule-row count asserted unchanged). T-37b preserved.
- RC-2: automatic recorder discharge now additionally requires BOTH qualifying passes to have handler-entry timestamps strictly later than the intent's COMPLETION event timestamp (with the completion-record requirement and all identity/sequence requirements retained). T-40 revised with honest timestamps: passes landing during I2's park precede its completion and leave it completed-but-ineffective after a later evaluation; a post-completion pair then discharges it; pruning leaves the durable discharges standing; historical incomplete visibility asserted.
- RC-3: T-27 completed — a successful A-1 registration is first exercised against the held attempt-3 fixture, then the first vs duplicate delivery are compared exactly on grants, plan/job progression, ledger/phase/quota accounting, attempt log, OUTBOX CONTENTS (id/kind/sent_at — the vacuous count assertion is gone), schedule-processing invariants (processed rows stay processed; continuation adds, never reprocesses), queue sends, and exactly one recorder row per delivery. The stronger test exposed no defect; no production change resulted.

RERUN (complete, on this tree, overall exit 0): A-1 battery 47 pass / 0 fail / 5 deferred-skips (register unchanged); S1 9/9; containment 42/42; P2 33/33; R5A 23/23; V-3 5/5; T-36 rollback re-executed on this tree.

QUESTIONS
(i) Do RC-1–RC-3 as implemented discharge the three remaining obligations?
(ii) Is the candidate now cleared for a deployment PROPOSAL to be prepared for Julie (proposal only — deployment remains her separate gate)?

Production remains HELD. W-4 remains an open historical deviation. WS2/Batch untouched; the B-G2 disposition stands as you accepted it.

Reply route: via Julie, as always. End by naming whose turn it is.
