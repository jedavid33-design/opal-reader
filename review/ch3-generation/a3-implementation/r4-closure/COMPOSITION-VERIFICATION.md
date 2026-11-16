# A-3 Composition Verification (HOLD ruling R1)

The separate composition check the ruling requires: each
corrected tree verified against the CORRECT baseline — the
live build `8a16def4`'s source, preserved as `pre-a3-tree/`
(hash-verified against `BASELINE-MANIFEST.txt`, 31/31) — with
explicit dispositions for the four historical regression
assertions. The historical fixtures and their logs are NOT
touched; the overall runner exit remains **1** and is never
described as all-green.

Mechanical check: `verify-composition.mjs` (run as the
`composition` suite in `run-all.sh`; exit 0 in
`evidence/final-run-corrections/` and again, on the
R4-closure trees, in `evidence/final-run-r4closure/`). It
walks both trees, hashes every file, and asserts the differ
set is exactly the three implementation parts.

## Candidate tree vs the live-build baseline

Files: 31 baseline, 31 candidate. Differ set (exactly 3):
`v2/worker-entry-prod-d6.js`, `v2/coordinator.mjs`,
`v2/generation/service.mjs`. The other 28 files are
byte-identical to the baseline.

| Part | Baseline sha256 | Corrected candidate sha256 | Diff (zero-context) |
|---|---|---|---|
| `v2/worker-entry-prod-d6.js` | `4e2bed3c7e976db7f514e7d43a92af7d1c6a2a8afcd6d98c62c980aa2d54858b` | `c5853a70b683fec10ff635fea27302822e910b08173e3987d14a0e5874cfd601` | +1730 / −77 |
| `v2/coordinator.mjs` | `39486a7078c6b162520161064613b7488d762067d8e62ba9f9da1b6d933fbf81` | `ce90852ac4fbd37e222d4bf442327266de6a0949ac1b37c501febb4b40781b00` | +145 / −10 |
| `v2/generation/service.mjs` | `a77765910cdbcf283d2b475b47d97067587d4b4b799eb15dd40d58efcdf10d64` | `e9f99bd2d308be2d679fa2dec5205d60caf99847de7d27a01093dc0c342ad92c` | +34 / −0 |

## Rollback tree vs the live-build baseline

Differ set: exactly the same three parts. Parts 2 and 3 are
byte-identical to the candidate's (same sha256 as above —
the shared-code claim, asserted mechanically by the check).
Part 1 differs from the candidate's: it is the pre-A-3 entry
carrying recorder-only changes (+245 / −22; sha256
`faae80af18c9185f119261e38ed9fcea152c6754f06622b219927221efb3bc48`).
See `ROLLBACK-MANIFEST.md`.

## Dispositions for the four historical assertions

Each failure below appears identically in the preserved
first-run logs (`evidence/final-run/`), in the corrections
run (`evidence/final-run-corrections/`), and in the R4
closure run (`evidence/final-run-r4closure/`), against BOTH
the candidate tree and the rollback tree. In every case the
failing subtest is an assembly & identity check whose fixture
pins the exact sha256 / diff of an EARLIER tree; every
behavioral subtest in the same suite passes.

1. **Containment CT0 — "changed parts are exactly the fixture
   set; all others byte-identical to the live tree"**
   (containment 41/42, exit 1). The fixture
   (`regressions/fixtures/identity-s1.json`) pins the S1-era
   changed-part set and hashes. The A-3 candidate changes
   three parts, not the fixture's set, so the identity
   assertion cannot hold for ANY A-3-shaped tree.
   **Disposition: historical assembly-fixture
   incompatibility, not a behavioral regression.** All 41
   behavioral containment tests pass.
2. **P2 T0 identity — "candidate tree: 31 parts; differ set
   == fixture changed parts; changed parts match fixture
   hashes; all others byte-identical to the pre-build tree"**
   (P2 31/33, exit 1). Same fixture class: the fixture pins
   the tree the P2 battery was built against.
   **Disposition: historical assembly-fixture
   incompatibility.** All 31 behavioral P2 tests pass.
3. **P2 T0 round-trip — "patch round-trip: combined.diff
   applied to pristine parts reproduces the candidate
   byte-for-byte"** (the second P2 failure). The suite's own
   historical `combined.diff` reconstructs ITS tree, not the
   A-3 candidate. **Disposition: historical fixture
   incompatibility.** The A-3 composition is instead verified
   directly against the live-build baseline by
   `verify-composition.mjs` (above), which is the check this
   assertion's modern counterpart should be.
4. **R5A T0 — "candidate coordinator identity + design
   markers"** (R5A 22/23, exit 1). The fixture pins the
   coordinator sha256 of the tree R5A was built against; the
   A-3 coordinator differs by design (RC-2 reading rules, and
   in this round the R2 corrections). **Disposition:
   historical assembly-fixture incompatibility.** All 22
   behavioral R5A tests pass.

The fixtures are preserved byte-for-byte and the raw nonzero
suite exits are preserved in both evidence directories, per
the ruling. Nothing in this document re-pins, edits, or
re-describes them.
