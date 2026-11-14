# W-4 TRACK A — A-1 IMPLEMENTATION CORRECTIONS (condition-disposition supplement)

**Case:** Opal Roundtable, issue #15 · **Handoff:** `RT-H-20261114-829e13`
**Date:** 2026-11-14
**Corrects:** the A-1 implementation package, pin `d873ce75abe6bb069d206f8c456e886890b66f0a`, per Rowan's implementation review of 2026-11-14 (board 6879179027), I-C1–I-C5.
**Operative specification:** unchanged — proposal `4bc8b81b…` + addendum `3759a69e…` + final ruling (board 6878847251) + the implementation review, which controls on the points it corrects.
**Authorization:** Julie's offline implementation GO (board 6878879682); the review's §8 confirms these are implementation corrections inside that scope, not a new design or proposal cycle. **No production contact of any kind was made.** Production remains HELD.

Review pin (repo `jedavid33-design/opal-reader`, branch `ui1-review`): `<PIN>`

## 1. Corrected candidate identity

Same manifest-verified S1 base; exactly two changed parts; 29 byte-identical; part count 31; bindings unchanged; no scheduler wiring (re-verified by T-23 and T-00 on the corrected tree).

| Part | Corrected SHA-256 | Was (first candidate) |
|---|---|---|
| `v2/coordinator.mjs` | `a3dce2976582aed353f1367f908a2bb2c759eb177eb5360ea97a7721669d611d` | `4a65eef5…` |
| `v2/worker-entry-prod-d6.js` | `4e2bed3c7e976db7f514e7d43a92af7d1c6a2a8afcd6d98c62c980aa2d54858b` | `33af3276…` |

Full corrected manifest pinned as `A1-CANDIDATE-MANIFEST.md`; unified diffs against the base pinned (`diffs/coordinator.diff`, 761 lines; `diffs/worker-entry-prod-d6.diff`, 166 lines); both complete changed sources pinned.

## 2. Correction dispositions

**I-C1 — Commitment boundary: REPLACED as directed.** The awaited boundary is now `state.storage.sync()` — the documented operation that synchronizes pending writes and resolves when they complete. The Phase B1 reservation, the commitment-failure handling (`error:commitment`, intent stands counted, no ensure/registration), and the repeated Phase B2 checks are preserved around it. The harness seam, T-17b, T-20b, T-24a, and the T-35 await whitelist were updated to match (the whitelist now reads `getAlarm | sync | setAlarm`). No PITR operation remains in the candidate.

**I-C2 — Phase B2 fails closed (defect confirmed and fixed).** The review's reading was correct: the first candidate computed competing reservations from a possibly-failed derivation. Phase B2 now, in order: (1) re-verifies repair state (`error:repair_state_unverified`); (2) re-verifies the authoritative derivation (`error:derivation_unverified` — never read as zero competition); (3) establishes that the evaluation's own reservation still exists and remains outstanding (`reservation_invalidated` if discharged, acknowledged away, or missing); (4) re-checks the bound on competing reservations; (5) takes a **fresh registration observation** and re-establishes P-STALE from it — a platform-side change that never moves the application revision is caught here (`observation_superseded`); (6) performs the final synchronous fence, containment, halt, and drive-pending checks before the watchdog ensure, due computation, and act. Every failure path produces zero watchdog-ensure and registration acts. New fault/interleaving coverage: T-37a (derivation failure after synchronization), T-37b (acknowledgment invalidating the reservation mid-flight), T-37c (platform-side registration change with no revision movement).

**I-C3 — Live-reservation protection and audit meaning.** Both of the review's named routes are implemented, belt and braces: (a) the derivation now requires a **completion record** before recorder evidence can discharge an intent, so a still-active reservation never becomes automatically dischargeable; (b) an operator acknowledgment may still cover a live intent, and Phase B2's reservation re-verification then invalidates that evaluation's permission to proceed (T-37b). The derivation and the audit surface now distinguish: outstanding strikes (`unresolvedIntentIds`), intents lacking a completion (`incompleteIntentIds`), completed-but-ineffective attempts (`completedIneffectiveIntentIds`), and acknowledged historical attempts (`acknowledgedIntentIds`). An acknowledged or discharged intent with no completion remains visible in `incompleteIntentIds` after pruning (T-40). One further durability completion within this condition: discharge events established by an evaluation's derivation are now persisted on **every** outcome recording — the registering completion (from its Phase B2 derivation) and the suppressed completions as well as declines — where the first candidate persisted them only on declines and reservations; T-40's flow (a registering evaluation whose post-boundary derivation establishes the discharge, then total recorder pruning) exposed and now proves the gap closed. The evidence description distinction is preserved: the recorder's `at` is captured at handler entry; discharge remains routine observed continuation, not L-1, and establishes no causation.

**I-C4 — Audit surface and HTTP outcomes.** Three corrections: (a) the routed `GET /v2/d6-repair-status` now constructs its coordinator through the read-surface pattern (`ASSUME_SCHEMA`), so the shipped handler cannot create the repair tables or singleton; T-33 was rewritten to drive the **actual routed GET** against dropped repair tables on an instantiated object — it reports `initialized: false` and creates nothing. (b) The status response now exposes the inspectable detail: each recent event carries its parsed detail payload (registration due and read-back, act-initiation status, discharge pass identities, acknowledgment boundaries, intent linkage) plus its authorization reference and recorded reason; the derivation block carries the I-C3 distinction fields. (c) The route's response mapping is generalized: **every** `error:*` outcome returns HTTP 500 with the audit identity — T-32c proves `error:containment_unverified` and `error:registration_unreadable` routed, which previously fell through to 200. The distinctions among a failed `setAlarm` (`error:registration`, act uncertain), a completed call with null read-back (`registered` + `readback_null`), and observed delivery (later passes) are preserved (T-20c, T-26 as re-sequenced for the additional fresh observation).

**I-C5 — Acceptance evidence.** (a) **T-27 rewritten substantively**: over the held attempt-3 plan/job fixture, a duplicate alarm delivery must record exactly one further pass and leave grant identities/states, plan states, job states/revisions, and queue sends identical — no repeated protected work. (b) The remaining race cases are explicit: T-38 (a containment stop landing mid-evaluation suppresses the act; the stop stands), T-39 (an earlier pending row inserted mid-evaluation becomes the registered due), T-15 and the adversarial cases preserved. (c) The fence lifetime extension the review asked for: **T-17c** — two distinct `GenerationCoordinator` wrappers sharing one state object; a registration through one invalidates an observation through the other. (d) The P2 adaptation stands as accepted, described as a disclosed change to the snapshot comparison's scope with compensating guard coverage. (e) **B-G2 — specific blocker, returned for separate documentary disposition** (§3). (f) Every result in §4 was rerun on the corrected tree; no earlier result is represented as a corrected-tree result.

## 3. B-G2 blocker (for Rowan's documentary disposition)

The B-G2 battery (110 tests) is bound to the B-G2 candidate tree **by construction**, and cannot bind to the A-1 candidate:

1. Its fixture builder searches the candidate tree for the batch lane-allowlist line (`D6_LANE_ALLOWLIST`) to construct its admitted-tree variant; the A-1 candidate descends from the S1 (WS1) tree, in which the batch subsystem does not exist — the allowlist there is the frozen `["standard"]` of the accepted WS1 design. Run against a scratch copy pointing at the A-1 tree, the battery fails during fixture setup (`allowlist line not found in the fixture copy`) before any test executes (captured log pinned as `logs/bg2-vs-a1-candidate.log`, exit 1).
2. The WS1 and WS2 candidates are separate trees by standing law; composing them is expressly forbidden without its own reviewed step. There is therefore no tree on which both the A-1 changes and the B-G2 battery can legitimately run today.

The B-G2 battery stands green against its own candidate (110/110 at its exit run, evidence pin `4a924a7c…`; targeted additions 4/4, pin `6014babe…`) and binds again at the future composition step. The suites that bind to the A-1 tree's own lineage — S1, containment, P2, R5A, V-3 — all ran on the corrected tree (§4). **Disclosure**: the scratch run was pointed at the candidate through a symlink, and the battery's fixture builder flipped the allowlist line in place before failing; the write was caught by the manifest hash walk (a fourth changed part), reverted byte-identically from the S1 base, and the corrected candidate's two-part integrity is proven by the regenerated manifest and by T-00 inside the final run. The episode is itself evidence for the blocker: the battery treats its tree as a mutable fixture, which is only safe against its own tree copy.

## 4. Corrected final run (one complete run on the corrected tree; overall exit 0; logs pinned)

| Suite | Result |
|---|---|
| A-1 acceptance battery (51 tests) | **46 pass, 0 fail, 5 skipped** (the deferred register, unchanged: T-12/T-21/T-22 → A-3; T-29 → L-1; T-24b procedural) |
| S1 enforcement | 9/9 pass |
| Containment | 42/42 pass |
| P2 recorder | 33/33 pass (32 standing + the A-1 guard) |
| R5A | 23/23 pass |
| V-3 cold restart | 5/5 pass |

Rollback compatibility (T-36) re-executed on the corrected tree inside the battery: the base build operates against populated repair tables and leaves them untouched. The deferred-test register is unchanged; no deferred test is reported as passed.

## 5. Exclusions and next step

No deployment, evaluation, acknowledgment, stimulus, containment transition, queue or settings change, or generation act occurred or is proposed. No production surface was read or written. W-4 remains an **OPEN HISTORICAL DEVIATION**. WS2/Batch untouched (the B-G2 question in §3 is documentary only).

**Next step:** this corrected package returns for Rowan's review of the corrections. No deployment proposal will be prepared before that review, and deployment remains separately gated on Julie's further GO.

**Turn: Rowan's** (review of the corrected candidate). Then Julie's, for any deployment question.
