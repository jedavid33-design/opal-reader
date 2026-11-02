# Containment V4 candidates — identities, diffs, battery record

Offline assembly only. No production calls were made.
Scratch: `containment-v4/` (sibling of `containment-v3/`;
the v3 trees are untouched). Basis for both v4 trees: the
v3 candidates copied byte-for-byte, then the v4 changes
applied — so the v3→v4 diffs below are the complete v4
delta, and the vs-live diffs are the complete deployable
delta. Baseline: `containment-v4/baseline-tree/` = the live
instrumented build `86ad06ab…` (31 parts, copied from the
v3 baseline; spot-verified identical at copy time).

## Trees and changed parts

Both trees: 31 parts; exactly **3 changed parts** vs live;
the other 28 byte-identical to live (CT0, fixture-driven).

**Candidate** (`containment-v4/candidate-tree/`, live +
containment v4):

| part | bytes | SHA-256 |
|---|---|---|
| `v2/coordinator.mjs` | 313,063 | `6c19a50e88d8bc00d357f7a5facf33ed8425b53daa20e8d700037f9fd121b2f2` |
| `v2/worker-entry-prod-d6.js` | 136,357 | `2bb0608b589a084ca275428c3236c24680f4a4692afe2245dfcb2880257983c1` |
| `v2/generation/service.mjs` | 91,500 | `5c5183e664218b9746c497e9456af45c7467a8ace66fd1b9ef0928eccb3c7c14` |

**Composed** (`containment-v4/composed-tree/`, live + R5a +
containment v4):

| part | bytes | SHA-256 |
|---|---|---|
| `v2/coordinator.mjs` | 314,712 | `5303cb6323da01c21a5ebe9a7983f87abe08e14945660daaebce99734849e1ed` |
| `v2/worker-entry-prod-d6.js` | 136,357 | `2bb0608b589a084ca275428c3236c24680f4a4692afe2245dfcb2880257983c1` |
| `v2/generation/service.mjs` | 91,500 | `5c5183e664218b9746c497e9456af45c7467a8ace66fd1b9ef0928eccb3c7c14` |

Entry and service are byte-identical between the two trees
(as in v3). The containment CODE is byte-identical between
the two coordinators; the single containment-region
difference is one COMMENT line in `_armAlarmIfEarlier`'s
re-check narration (the composed method's comment is the
R5a memo variant and never carried the withdrawn "last
physical act" formulation — analysis v4 §3 item 6).

## Diffs (unified, `a/`→`b/`, `patch -p1`-applicable)

Vs live baseline (in `containment-v4/`):

| diff | content lines | SHA-256 |
|---|---|---|
| `coordinator.diff` | +753/−0 | `53306786125545df00d6993bfa1f28cfbefdc84e321b601e7995d38823ad224b` |
| `composed-coordinator.diff` | +795/−12 | `38f28d0def1ec6b67ee438eb3eb69951c370336341f906a568a63ba38d9e3a11` |
| `entry.diff` | +175/−3 | `0d0fdf6aff6ae8126c20bb075da071fd55021936231288fc080d8e590d8fde75` |
| `service.diff` | +73/−2 | `9b52249525bbafa84f4f640a6dc50431b2627bd80616771d61308a1be1701b65` |

Vs the v3 candidates (the v4 delta alone):

| diff | content lines | SHA-256 |
|---|---|---|
| `coordinator-v3-to-v4.diff` | +267/−28 | `cba526a26719641913fbc7597086d74c9a122c9bc6624cb12e8b40f4759e7241` |
| `composed-coordinator-v3-to-v4.diff` | +258/−26 | `39c50d6d12d06a1238a1dbb4c32a6bc06a5d44be927388277389e0148b480384` |
| `entry-v3-to-v4.diff` | +16/−1 | `1180b374a3a2ad4091659c4fd2e12677a0200541b775d41c3a6dbea435a2d361` |
| `service-v3-to-v4.diff` | +31/−1 | `ac9cfd534f3fde2b0e7c75c70b7148b365a3ba892e89f0d99bdbc5bce7ddf3ab` |

Vs deployed parts-e0 (`containment-v4/diffs-e0/`):
`coordinator.diff` `53306786…` and
`composed-coordinator.diff` `38f28d0d…` (identical to the
vs-live diffs — the e0 and live coordinators are the same
bytes), `entry.diff` `09fd03a4a3acb327f74e608c788a81549fa1fb39233f9f0baba8a76bcdf40a89`,
`service.diff` `da7cf1560cfebf83760588f6c30f95e1c1a89d1cc969b82a00f0cfb78b49eb39`.

**Round-trips verified** (`patch -p1` + `cmp`, this
package): live → v4 candidate (coordinator+entry+service)
byte-identical; v3 candidate → v4 candidate byte-identical;
parts-e0 → v4 candidate byte-identical; live → v4 composed
byte-identical.

## What the v4 code changes are (summary; design v4 governs)

Coordinator: six new state columns (episode id/exhausted +
previous-episode summary) with additive `ALTER TABLE`
migration in the existing schema-creation path; exported
pure `deriveStopConfidence(read, fresh)` + `CONTAINMENT_
STOP_CONFIDENCES` vocabulary + `containmentConfidence`
method; episode minting inside the `stop_chain` commit
(episode id = the audit row id), atomic episode close +
reset inside the `clear` commit (v3 did the reset as a
post-commit write — behavior preserved, atomicity new);
exhaustion flag + `stop_episode_exhausted` audit event
written in the same transaction as the attempt that
reaches the bound; defensive one-time exhaustion recording
on the refusal path; two code comments narrowed (the
withdrawn "last physical act" formulations — analysis v4
§3). Entry: the containment GET no longer collapses a
failed `getAlarm()` to null (tracks `armedReadFailed`) and
projects the episode fields + `stopConfidence`. Service:
the `drive=1` projection likewise (duck-typed
`containmentConfidence`, null on a pre-v4 coordinator).

## Battery record (exact v4 trees; one complete run each; log + exit code captured)

| suite | file | tree | result | exit | log SHA-256 (path) |
|---|---|---|---|---|---|
| containment battery v4 | `containment-v4/tests/containment-battery.test.mjs` (`14d6d360…`) | v4 candidate | **41/41 pass** | 0 | `40bed0eeb250d8778aafb110e981dee021f1f4db6e43fa28735431e87a2c2c6c` (`containment-v4/logs/containment-v4-candidate.log`) |
| containment battery v4 | same | v4 composed | **41/41 pass** | 0 | `976778a7773c0c8cd6aa665510e6a0f89d0af51c31eab9203b120364a86e8b0d` (`containment-v4/logs/containment-v4-composed.log`) |
| P2 parameterized regression | `suites/p2-battery.test.mjs` (unmodified) | v4 candidate | **32/32 pass** | 0 | `4548c21f0457172a04a283d085427f2948e449b70e4ed6d9eec0a39b5689274f` (`suites-v4/logs/p2-v4-containment.log`) |
| P2 parameterized regression | same | v4 composed | **32/32 pass** | 0 | `81ec122b4e9608c23ccbb9580325ab73c8efe5ba69ee0ebae489d15cd2b32e55` (`suites-v4/logs/p2-v4-composed.log`) |
| R5a suite | `suites/r5a-battery.test.mjs` (unmodified) | v4 composed | **23/23 pass** | 0 | `0165246f1faa42bd182da4be0f7c542834e2d93eb7890d297d565bba0712e8ae` (`suites-v4/logs/r5a-v4-composed.log`) |

Run discipline notes: P2 runs used the v4 CAND trees with
BASE left at the suite default and PARTS at the default
parts-e0 (the v3 run-note applies: passing the live tree as
BASE causes 3 unrelated harness-semantics failures — seen
once during this package's runs with BASE mis-set, re-run
correctly; the 29/32 log was overwritten by the correct
run). Regression fixtures: `suites-v4/fixtures/
p2-identity-containment-v4.json` (`4291e9c4…`),
`p2-identity-composed-v4.json` (`0e198834…`),
`r5a-identity-composed-v4.json` (`22a39ac9…`); containment
fixtures `containment-v4/fixtures/identity-candidate.json`
(`6ec5e908…`), `identity-composed.json` (`ef5fe527…`).

## Assertion changes (complete list; NO v3 assertion deleted or loosened)

Battery file adaptations (all disclosed in the battery
header): env vars `CONTAINMENT_V3_*` → `CONTAINMENT_V4_*`;
CT0 marker set EXTENDED with the v4 vocabulary (6 added
matches); CT1's deep-equal projection expectation EXTENDED
with the 7 new fields at their empty values. New groups:
CT14a (truth table, 14 rows + all non-stopped combinations,
against the exported derivation), CT14b/CT14c (surface
degradation: later surviving registration → `contested`;
failed read → `unknown`; enum + `stopVerifiedAt` asserted
intact), CT15a–c (exhaustion recording, persistence across
clear, refusal after fault clears), CT16a–c (C3 ledger
dry-run: end-to-end sequence; delete-failure + ambiguous
re-entry with landed-delete count asserted; ambiguous
delete resolved by read-back, no duplicate delete).

Corrections made to the NEW v4 tests during development
(first candidate run: 38/41, exit 1 — the 3 failures were
in the new tests, none in carried v3 tests): (1) CT14a's
synthetic read objects initially omitted the real read
shape's `known` flag, which the derivation legitimately
requires — test data corrected. (2) CT14c initially
expected `unverified` after a failed-delete stop; the
correct display per the truth table is `contested` (the
registration survives — positive evidence dominates) —
expectation corrected to the table. (3) CT16a initially
expected a `stop_chain_verify` audit event after a
VERIFIED stop; the shipped/v3 behavior appends that event
only for an unverified outcome — expectation corrected.
No production-code change resulted from any of the three.

## Harness caveats (standing)

The harness invokes `alarm()` directly; it cannot prove
real platform delivery, real platform retry behavior,
platform storage-effect ordering (analysis v4 O-6 —
marked, not tested), or real-DO SQLite behavior beyond
its mirrored `.one()` throw semantics. R5 is
paperwork-only by design (no code seam was needed: the
existing transition actions are the S1-X mechanism).

## Deviations from the tasking

One, disclosed: the tasking's R3 parenthetical said the
attempt counter "persists across a clear" in the state
store. The implementation preserves the closed episode's
summary in `prevEpisode*` columns + the permanent audit
trail (rather than leaving the live counter un-reset),
because `readContainmentState`'s reset-on-clear shape is
asserted by carried v3 tests (CT11d/CT12) whose assertions
may not be loosened. The disclosure property the ruling
requires — the exhausted episode is never hidden and a
re-stop is never presented as a fresh budget — is fully
implemented and tested (CT15b); the gates carry the
anti-circumvention rule as paperwork (design v4 §4.3).
