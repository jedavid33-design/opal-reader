ROWAN COPY-PASTE — W-4 Track A: A-1 IMPLEMENTATION PACKAGE (for implementation review)

Case: Opal Roundtable, issue #15. Handoff: RT-H-20261114-a58bcb.
Operative spec: proposal pin 4bc8b81b24ef3dfdc39a41c831ead91399f76b7e + addendum pin 3759a69e1c25c21ca7c04002d2f4cb5eef972c7f + your final ruling of 2026-11-14 (board 6878847251), which controls on conflict.
Authorization of record: Julie's offline implementation GO, 2026-11-14 (board 6878879682). Offline only — NO production contact of any kind was made. Production HELD.

READ ORDER (Dropbox folder "Opal Roundtable - For Rowan"; the pin in opal-reader/ui1-review carries the identical set):
1. W4-A1-IMPLEMENTATION-PACKAGE.md — the package: identities, two-part verification, condition disposition map, results, deferred register, rollback.
2. The two full changed sources + unified diffs vs the base, and A1-CANDIDATE-MANIFEST.md.
3. tests/a1-battery.test.mjs (+ harness) and test-logs/final-run/ — the complete captured run.

WHAT WAS BUILT (summary; the package is authoritative)
- Base: the manifest-verified S1 tree (live build ef69b8f9…). Candidate: 31 parts, EXACTLY TWO changed — v2/coordinator.mjs (4a65eef5…) and v2/worker-entry-prod-d6.js (33af3276…). Bindings unchanged; NO scheduler entrypoint, flag, binding, trigger, or caller anywhere (A1-C4; absence verified by T-23 in source and in the module's exports).
- The evaluation: fail-closed state check → Phase O observation → synchronous Phase B1 (revision recheck, containment, halt, strike derivation, P-STALE only) → intent + projection in one transaction (the reservation; first persistent action) → commitment boundary → Phase B2 repeating the final revision/eligibility/halt/containment/due checks → watchdog ensure + setAlarm → read-back + completion. Declines 200 with the record; execution failures 500 with the audit identity; both route bodies closed-allowlist, reason recorded, boundary validated as a true integer naming an existing intent.

TWO IMPLEMENTATION CHOICES YOUR RULING LEFT OPEN — flagged for your judgment
1. Commitment boundary (§6 of your ruling): the implementation uses await state.storage.getCurrentBookmark() — the SQLite storage's PITR witness — as the documented synchronization establishing that durable history includes the intent, with the reservation preserved and ALL final checks repeated after it, exactly as your ruling prescribes for an added storage await. The structure accepts any documented synchronization operation in that slot without redesign.
2. Revision-fence mechanism (§2): a module-level WeakMap keyed by the Durable Object state object. Rationale: GenerationCoordinator is constructed per request in the entry, so a coordinator-instance field would fence nothing; the state object's lifetime IS the Durable Object instance's lifetime, an in-flight observation cannot survive its instance, and a reset on replacement therefore invalidates nothing that still exists. No persistent write is added to ordinary passes. Lifetime/reset demonstrated by T-19b; prevention demonstrated adversarially by T-17a (observation window) and T-17b (commitment window).

RESULTS — one complete run on the exact final tree, overall exit 0 (full logs pinned):
- A-1 acceptance battery: 38 pass / 0 fail / 5 skipped — the skips are exactly the deferred register (T-12, T-21, T-22 → A-3; T-29 → L-1; T-24b → procedural, never claimed as code behavior).
- Standing regressions: S1 9/9, containment 42/42, P2 33/33, R5A 23/23, V-3 5/5.
- One disclosed adaptation: the P2 copy's twin snapshots exclude the candidate's two additive repair tables (as they already exclude the recorder's table), with a new guard test asserting ordinary traffic writes nothing to them (passes). No original test/assertion modified or loosened; T-11 independently pins the evaluation write-set by full-database snapshot.
- Rollback (T-36, executed): the base build runs against populated repair tables incl. an unresolved intent — reads 200, repair rows untouched. Your §9 qualifications are restated in the package, not smoothed.

QUESTIONS FOR YOUR IMPLEMENTATION REVIEW
(i) Does the bookmark commitment boundary discharge §6 as you conditioned it?
(ii) Does the WeakMap fence satisfy §2's "smallest reliable revision mechanism" with its lifetime/reset demonstration?
(iii) The discharge-event route (§3's first option) was implementable in-surface; the conservative alternative was not needed. Do you accept it as implemented?
(iv) Anything in the two changed sources that must be corrected before a deployment proposal may be prepared?

Production remains HELD. No deployment proposal will be prepared before your implementation review, and none is requested here. W-4 remains an open historical deviation. WS2/Batch untouched.

Reply route: via Julie, as always. End by naming whose turn it is.
