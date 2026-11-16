# A-3 Corrections Round — Reproducibility (HOLD ruling R8)

The whole battery reproduces from the pinned files alone.
This document inventories EVERY input the runner references
and states the exact reconstruction and run procedure. No
input lives only in the workspace: everything below is part
of the return package.

## Package inventory (paths relative to the package root)

| Path | Role |
|---|---|
| `candidate-tree/` (31 files) | The corrected A-3 candidate. |
| `rollback-tree/` (31 files) | The R6(c) rollback candidate. |
| `pre-a3-tree/` (31 files) | The live-build (`8a16def4`) baseline: the diff reference for both trees and the A-3 battery's BASE. Verify against `BASELINE-MANIFEST.txt` (31/31 sha256). |
| `baseline-tree/` (31 files) | The PRE-A-1 tree: the base the A-1 battery and the containment suite define against (`A1_BASE_DIR`, `CONTAINMENT_V4_BASE_DIR`). |
| `BASELINE-MANIFEST.txt` | sha256 of every baseline file, taken before any A-3 change. |
| `tests/harness.mjs` | The house harness (real node:sqlite; production `.one()` semantics; fault injection; per-authority storage; instance spawn/revoke). |
| `tests/a3-battery.test.mjs` | The A-3 battery, T-A3-01…46. |
| `tests/a1-battery.test.mjs` | The A-1 battery with its disclosed adaptations (header lists them; the a1-build original is a different file and is NOT an input). |
| `tests/rollback-rc2.test.mjs` | The rollback candidate's RC-2 battery (RB-1…RB-5). |
| `regressions/s1-enforcement-battery.test.mjs` | S1 suite (tree via `S1_TREE_DIR`). |
| `regressions/containment/containment-battery.test.mjs` + its harness files | Containment suite (trees via env). |
| `regressions/p2/battery.test.mjs`, `regressions/p2/harness.mjs`, `regressions/p2/baseline-tree/`, `regressions/p2/combined.diff` | P2 suite. NOTE: it hardcodes its candidate as `../candidate-tree` relative to `regressions/` — see the shadow-root step for rollback runs. |
| `regressions/r5a/r5a-battery.test.mjs`, `regressions/r5a/harness.mjs`, `regressions/r5a/baseline-tree/`, `regressions/r5a/coordinator.diff` | R5A suite; same hardcoded-candidate caveat. |
| `regressions/v3/v3-cold-restart.test.mjs` | V-3 suite (tree via `V3_TREE_DIR`). |
| `regressions/fixtures/identity-s1.json` | The shared identity fixture (containment's `CONTAINMENT_V4_IDENTITY`; also read by the P2/R5A batteries at `../fixtures/` relative to their suite dirs). |
| `verify-composition.mjs` | The R1 composition check (needs `diff` on PATH). |
| `run-all.sh` | The runner (bash). |
| `rollback-suites/` | The shadow root for the rollback P2/R5A runs — RECONSTRUCTIBLE from the items above (procedure below); it is also shipped as built so the runs can be repeated without rebuilding it. |
| `evidence/final-run/` | The FIRST build's preserved run (do not overwrite). |
| `evidence/final-run-corrections/` | This round's run: unabridged per-suite logs, `.exit` files, `SUMMARY.txt`. |

## Reconstruction procedure

1. Lay the package out with the paths above (the two trees,
   both baselines, `tests/`, `regressions/`, the scripts, at
   one root).
2. Verify the baseline: `sha256sum -c` equivalent against
   `BASELINE-MANIFEST.txt` for `pre-a3-tree/` (31/31).
3. Build the shadow root (only needed for the rollback P2/R5A
   suites; skip if `rollback-suites/` was shipped):
   ```
   mkdir -p rollback-suites/regressions/fixtures
   cp -r rollback-tree  rollback-suites/candidate-tree
   cp -r baseline-tree  rollback-suites/baseline-tree
   cp -r regressions/p2  rollback-suites/regressions/p2
   cp -r regressions/r5a rollback-suites/regressions/r5a
   cp regressions/fixtures/identity-s1.json \
      rollback-suites/regressions/fixtures/identity-s1.json
   ```
   Real copies, never symlinks (a mutating fixture must never
   write through to a candidate or base tree).
4. Run: `./run-all.sh <log-dir>` from the package root.
   Requirements: Node.js with `node:sqlite` (the harness's
   only non-core dependency is Node itself), bash, and `diff`
   on PATH (composition check only). No network, no
   credentials, no environment setup beyond the variables
   `run-all.sh` itself sets per suite.

## Expected result (the corrections run of record)

Per-suite counts and exits exactly as tabulated in
`IMPLEMENTATION-NOTES.md` (corrections-round section):
A-3 48/0 exit 0; A-1 48/0/5-skipped exit 0; S1 9/9; V-3 5/5;
composition OK; rollback-rc2 2/2; rollback A-1/S1/V-3
identical to candidate; containment 41/1, P2 31/2, R5A 22/1
against BOTH trees, failing only their historical
assembly & identity fixture subtests. **Overall runner exit
is 1**, by those fixture exits — that is the expected,
correct result, not a failure of the reproduction.
