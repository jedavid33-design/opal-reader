# Containment V3 candidates — identities, diffs, battery record

Package: offline correction package #2, answering Rowan's
containment-correction ruling (`ROWAN-CONTAINMENT-CORRECTION-
RULING.md`; relayed verbatim by Julie 2026-11-02). Design:
`PHASEB-CONTAINMENT-DESIGN-V3.md`. Async evidence:
`PHASEB-CONTAINMENT-ASYNC-ANALYSIS.md`. Gates:
`PHASEB-RECOVERY-GATES-V3.md`. **Offline only. No production
calls of any kind were made. Production remains HELD on the
live instrumented build `86ad06ab…`.**

The v2 candidates (`containment/`, pinned at `e6e91870`) are
untouched; everything here is new scratch under
`containment-v3/` and `suites-v3/`.

## Trees

- `containment-v3/baseline-tree/` — byte copy of the live
  instrumented tree (31 parts; identical to
  `containment/baseline-tree/`).
- `containment-v3/candidate-tree/` — the CONTAINMENT V3
  candidate: baseline + the v3 containment change in exactly 3
  parts (below). Independent of R5a.
- `containment-v3/composed-tree/` — the COMPOSED V3 candidate:
  baseline + R5a + containment v3. Its entry and service parts
  are byte-identical to the containment candidate's; its
  coordinator carries R5a + the same containment v3 change (the
  containment code is byte-identical between the two
  coordinators — verified: the candidate↔composed coordinator
  diff contains no containment line).

## Containment V3 candidate — changed parts (vs live)

| part | bytes | SHA-256 | diff vs live |
|---|---|---|---|
| `v2/coordinator.mjs` | 301,131 | `c953ff2b65e250e458417aeb66f51a08a959dcce382e285ad4bfc01a8260230f` | +514/−0 |
| `v2/worker-entry-prod-d6.js` | 135,504 | `f746c632bd0b7dfa0aa6f8cebabc78dc21786f13962798ef6f6cb0075e0229d9` | +160/−3 |
| `v2/generation/service.mjs` | 90,032 | `bccda90983ef2f2352cb6ccb1a2262ad2a53e58f00949a4d9ece4bd48665fe52` | +42/−1 |

- The other 28 parts are byte-identical to the live tree
  (battery CT0, fixture-driven:
  `containment-v3/fixtures/identity-candidate.json`,
  SHA-256 `5c871b3b89da682795a36092458f5f24e42671aec572396fa11cc54ef257c0e4`).
- `node --check` passes on all three changed parts (CT0).

## Composed V3 candidate — changed parts (vs live)

| part | bytes | SHA-256 | diff vs live |
|---|---|---|---|
| `v2/coordinator.mjs` | 303,206 | `8ad74a938b37f0ef1698a81ff906ef51062f4108d1c7836a2b263e6124e3cd7f` | +563/−12 |
| `v2/worker-entry-prod-d6.js` | 135,504 | `f746c632bd0b7dfa0aa6f8cebabc78dc21786f13962798ef6f6cb0075e0229d9` | +160/−3 |
| `v2/generation/service.mjs` | 90,032 | `bccda90983ef2f2352cb6ccb1a2262ad2a53e58f00949a4d9ece4bd48665fe52` | +42/−1 |

Fixture: `containment-v3/fixtures/identity-composed.json`,
SHA-256 `f056a6dc9ae89a2393008e20074d78ce001f8a0d969603232bc42c6ee485ce7a`.

## What changed, v2 candidate → v3 candidate (the correction delta)

| diff | lines | SHA-256 (head) |
|---|---|---|
| `containment-v3/coordinator-v2-to-v3.diff` | +291/−27 | `f4e00513…` |
| `containment-v3/composed-coordinator-v2-to-v3.diff` | +288/−27 | `2819172a…` |
| `containment-v3/entry-v2-to-v3.diff` | +42/−20 | `beda8ae3…` |
| `containment-v3/service-v2-to-v3.diff` | +16/−0 | `06b474bc…` |

Substance (design v3): (1) the stop record — six new columns
on `d6_containment_state` (`stop_status`, `stop_verified_at`,
`stop_verify_action`, `stop_armed_before`, `stop_armed_after`,
`stop_verify_attempts`) written by `stop_chain` itself in its
commit transaction; (2) the `verify_chain_stop` operator action
(re-verification/retry, bounded at `MAX_STOP_VERIFY_ATTEMPTS =
3` per stop episode); (3) `clear` requires a recorded `reason`
(route allowlist gains the `reason` key, ≤2000 chars); (4) the
race fix — `_armAlarmIfEarlier` re-checks the arm gate after
its `getAlarm()` await, in the same synchronous stretch that
initiates `setAlarm`; (5) read surfaces expose the three
stop-record facts (state route body + drive=1 projection).
No other behavior changes. All eight v2→v3 and e0 round-trip
diffs were verified to reproduce the v3 parts byte-for-byte
(`patch -p1` + `cmp`).

## Round-trip diffs vs live and vs the deployed parts (parts-e0)

- vs live: `containment-v3/coordinator.diff` (+514/−0,
  `b8ab6bd3…`), `composed-coordinator.diff` (+563/−12,
  `da7dfebd…`), `entry.diff` (+160/−3, `06387c18…`),
  `service.diff` (+42/−1, `bc125032…`).
- vs parts-e0 (`containment-v3/diffs-e0/`): coordinator and
  composed-coordinator diffs are byte-identical to the vs-live
  ones (the e0 coordinator IS the live coordinator);
  `entry.diff` +578/−18 (`9c92fb62…`), `service.diff` +282/−1
  (`ae510172…`) — these carry instrumentation + containment v2
  + v3, as in prior packages.

## Battery record (all runs on the exact trees above)

Harness: `containment-v3/tests/harness.mjs` (17,768 B,
`8eb4c0d6…`) — the v2 harness plus ONE marked extension: a
one-shot deferred-`getAlarm` seam for the race tests.
Battery: `containment-v3/tests/containment-battery.test.mjs`
(46,191 B, `72060ff1…`) — the v2 battery plus the disclosed
adaptations in its header (CT1 projection extension, CT9/CT10
reason arguments, CT0 markers, CT3/CT6 added assertions) and
new groups CT11 (verify_chain_stop), CT12 (restoration),
CT13 (races).

| run | suite | tree | result | exit | log SHA-256 (head) |
|---|---|---|---|---|---|
| containment battery | `containment-v3/tests/containment-battery.test.mjs` | v3 candidate | **32/32 pass** | 0 | `33b456fc…` (`containment-v3/logs/containment-v3-candidate.log`) |
| containment battery | same | v3 composed | **32/32 pass** | 0 | `50becf51…` (`containment-v3/logs/containment-v3-composed.log`) |
| P2 parameterized regression | `suites/p2-battery.test.mjs` (unmodified) | v3 candidate | **32/32 pass** | 0 | `d93cc557…` (`suites-v3/logs/p2-v3-containment.log`) |
| P2 parameterized regression | same | v3 composed | **32/32 pass** | 0 | `ba9ef3bb…` (`suites-v3/logs/p2-v3-composed.log`) |
| R5a suite | `suites/r5a-battery.test.mjs` (unmodified) | v3 composed | **23/23 pass** | 0 | `859fd875…` (`suites-v3/logs/r5a-v3-composed.log`) |
| **defect demonstration** | v3 battery, `--test-name-pattern "CT13a\|CT13b"` only | **v2 candidate** (`containment/candidate-tree`) | **0/2 — BOTH FAIL** at the resurrection assertion (`alarmCalls` 1 ≠ 0, both branches) | 1 | `6fbdb2c2…` (`containment-v3/logs/containment-v3-races-on-v2-tree.log`) |

Regression fixtures: `suites-v3/fixtures/p2-identity-
containment-v3.json` (`1f7b8ffb…`), `p2-identity-composed-
v3.json` (`96ca2acf…`), `r5a-identity-composed-v3.json`
(`2836cdb9…`).

Run-note (disclosed): the first P2 invocations in this package
passed `P2_BASE_DIR=<live tree>`; the P2 suite's BASE is the
UNMODIFIED (pre-instrumentation) build, so 3 tests failed on
harness semantics unrelated to the candidate (baseline-pristine
vs parts-e0, T2 health-channel, T7 base-build surface). The
invocation was corrected (BASE/PARTS at suite defaults, as in
the v2 package runs) and both runs are the clean 32/32 above.
No test was modified.

Harness caveats (standing): the harness invokes `alarm()`
directly; it cannot prove platform delivery, platform retries,
or real-DO behavior beyond mirrored `.one()` throw semantics.
Harness-green is evidence at harness strength only; the
async analysis lists every harness-only claim as a platform
uncertainty for Rowan.
