# B-G2 evidence — machine-checkable tree association (ruling item 4)

**Claim.** The tree the reported exit run tested is the candidate
tree pinned at `9d6f6b850960e2ea85210df2da04f8d8dce6b5ee`
(repo `jedavid33-design/opal-reader`, branch `ui1-review`). That
pin carries the implementation record, `MANIFEST.md`, and
verbatim copies of the eight changed files under
`review/ch3-generation/bg2-candidate/v2/`.

## How the run was bound to the tree (in words)

`tests/run-all.sh` (included verbatim in `tests/`) runs from the
build root and, in one invocation:

1. runs `node tests/regen-fixtures.mjs`, which regenerates the
   identity fixtures **from the two trees on disk**
   (`candidate-tree/`, `baseline-tree/`) before any suite runs;
2. runs the containment battery with
   `CONTAINMENT_V4_CAND_DIR=<build root>/candidate-tree` and
   `CONTAINMENT_V4_BASE_DIR=<build root>/baseline-tree`;
3. runs the P2 and R5A batteries, whose identity groups read the
   regenerated `tests/fixtures/identity-bg2.json` and whose
   behavioral groups run against the historic twin trees inside
   `tests/` (see EVIDENCE-README §2);
4. runs the V3 battery with `V3_TREE_DIR=<build root>/candidate-tree`;
5. runs the BG2 battery, which loads `candidate-tree/` directly
   for the inertness family (BG2-S) and a throwaway copy of it
   (`tests/admitted-tree/`, deleted and rebuilt by the battery at
   load, with only the allowlist line flipped in the copy) for
   the behavioral families — the §3.13 mechanism, record
   deviation 2.

The BUILD-LOG's CP-8 entry records the exit run against "the
final tree": one invocation of `tests/run-all.sh`,
2026-11-06T15:43:04Z, overall exit 0.

## Recomputation performed at assembly (2026-11-06, no suite rerun)

Every file under `bg2-build/candidate-tree/` was re-hashed
(SHA-256) and compared against the full 31-part manifest in
`MANIFEST.md`:

- **31 of 31 parts match the manifest exactly.** The candidate
  tree on disk contains exactly those 31 files and no others.
- The 8 changed parts (candidate hashes, from the manifest,
  recomputed identically from disk):

| part | sha256 |
|---|---|
| v2/coordinator.mjs | `6e04df3301eab49f11c86458cb15e683fdfc1fa008440a24bb2faab2b6b9b0d7` |
| v2/executor.mjs | `f91ce0bda5aecac813f283d83b2b38ba2a5b8e3839bb8fbfc329f93ed3bcb666` |
| v2/generation/d6-executor.mjs | `9d469bf03b1a3fdcaf8f660c4c003ecc69ba9ef5df8ee87b32f35d8c8f7ded4e` |
| v2/generation/gen-constants.mjs | `a713dc35dbc13c71b777dc448a604c357ae0aa098a38f0153ea8e246fa445469` |
| v2/generation/genstore.mjs | `f8614f9df097833182061e2e08b238fc9a371b6dc6652d460e24032378ab907f` |
| v2/generation/service.mjs | `761ac47736ec6c958f60e85a70789cd613590c274286729713b55974c246db03` |
| v2/host/adapters.mjs | `ee99bdf2e6d21ab1c70504e95c16f0744e1c2b3feed958083803a41164af1620` |
| v2/worker-entry-prod-d6.js | `4087d3c7f310ebad85ac2a229cbb368d34fd4397e68eb2768e473e126add75eb` |

- The other 23 parts also match `baseline-tree/` byte-for-byte
  (the unchanged set, cross-checked against the second pristine
  copy); the 8 changed parts differ from baseline, as the
  manifest's delta table states.

## Run-time association evidence (generated *during* the reported run)

- `exit-run-logs/regen-fixtures.log` — written by the exit run's
  own regen step — lists "changed parts: 8" with the same eight
  SHA-256 values as the manifest table above. The run therefore
  measured the same delta it tested.
- `tests/fixtures/identity-bg2.json` — the fixture as regenerated
  by that same step and left on disk — carries the identical
  `changedParts` set and hashes, plus the full pinned baseline
  manifest the identity groups measured against.
- `tests/admitted-tree/` vs `candidate-tree/`: a recursive diff
  at assembly shows exactly one differing line — the
  `D6_LANE_ALLOWLIST` flip in the copy's
  `v2/generation/gen-constants.mjs` (`["standard"]` →
  `["standard", "batch"]`). The behavioral families therefore
  ran on the candidate's code with the single prescribed
  difference.

## Copy verification (this package)

At assembly, every copied file was hash-compared against its
source under `bg2-build/` (SHA-256 walk, both directions —
nothing missing, nothing extra, nothing different):

- `tests/` ← `bg2-build/tests/`: **107 / 107 files identical**.
- `exit-run-logs/` ← `bg2-build/test-logs/exit-run/`:
  **12 / 12 files identical**.
- `standing-batteries/` subsets ← their sources under
  `bg2-build/tests/`: containment 2/2, p2 34/34, r5a 34/34,
  v3 1/1, plus `harness.mjs`, `regen-fixtures.mjs`, and
  `fixtures/identity-bg2.json` — all identical.

**Post-verification source anomaly (2026-11-06T16:04:33Z).**
After the copy verification above passed, the *source* tree
gained a nested duplicate: `bg2-build/tests/containment/containment/`
appeared, containing byte-identical copies of the battery and
harness (SHA-256 `2b2befa5…` and `8eb4c0d6…`, matching the
originals). It did not exist at copy/verification time (the
source walked 107 files, matching this package), it postdates
the exit run by ~21 minutes, and no command in this assembly
wrote to the source tree. The package therefore preserves the
107-file tree **as run**; the duplicate is excluded and is
recorded here and in `association.json` rather than silently
absorbed or silently deleted. Its origin is for Wren to
investigate in the build workspace.

## Machine-readable form

`association.json` (beside this file) carries: the candidate
pin, the eight changed parts with manifest and recomputed
hashes, the 31-part check result, the admitted-tree diff result,
the copy-verification counts, and a per-file SHA-256 + size
listing of every file in this evidence package. It lists every
file except itself (a file cannot carry its own hash); its own
integrity is covered by the evidence pin Wren makes from this
package.
