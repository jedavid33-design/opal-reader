# R5a revision package — candidate identities (offline)

All values measured firsthand on the local scratch trees,
2026-11-02. Nothing here is deployed.

## Trees

- Baseline tree: `r5a-revision/baseline-tree/` — byte copy of the
  live instrumented build's assembled tree
  (`p2-gate-execution/build/deploy-tree/`, 31 parts, manifest
  `deploy-manifest-stamped.json`).
- Candidate tree: `r5a-revision/candidate-tree/` — the baseline tree
  with exactly one part replaced.

## The one changed part

- Part: `v2/coordinator.mjs`
- Baseline (live): 276,256 B, SHA-256
  `bca88fe92bfd316c727866f7f69817e290fc8167006d32362577010c2037e20a`
  (byte-identical across parts-e0, the P2 candidate tree, and the
  live deploy tree — the P2 instrumentation diff did not touch it).
- Candidate: 278,396 B, SHA-256
  `d3d9005b9c2f83cd9a47ef7012b7cea5ed21d73886626d6e24bb655ee90389a3`
- Diff: `coordinator.diff`, 5,871 B, SHA-256
  `9720c34800eded95b419f089562076cac127f19444a7a4d039c1423a2e2e09aa`,
  +51 / −12 lines. `patch -p1` round-trip from the pristine baseline
  part reproduces the candidate byte-for-byte (battery R5A-T0).
- `node --check` passes on the candidate part.
- The other 30 parts are byte-identical between the trees
  (battery R5A-T0 asserts the full 31-part comparison).

## Tests

- Harness: `r5a-revision/tests/harness.mjs` — the instrumentation
  battery's harness plus a setAlarm call log, a raw alarm seeding
  method, and a log reset (3 marked extensions). SHA-256
  `c261f33486f878853a3033428cc2c3e4bf37957197ca0abe5acfd709fa1a0147`.
- R5a battery: `r5a-revision/tests/r5a-battery.test.mjs`, SHA-256
  `af760172e4966a68408dd81870950c2f29c5ad61b82f2dbec5a5129496c75504`.
- P2 regression battery as run: `r5a-revision/p2twin/tests/battery.test.mjs`
  — a copy of the instrumentation battery with exactly one line
  changed (the PARTS path, one directory level), run against
  baseline = parts-e0 and candidate = the R5a tree. SHA-256
  `80fcccb9503bc502d454c0b8b1ac3d2b13224adb13d75950594a16f74870888b`.
- Combined run log: `r5a-revision/BATTERY-RUN-LOG.txt`, 11,809 B,
  SHA-256
  `51c4f879786122ba724b705870fe423b99905ecab219b969428ca63aad78f6c2`.
  Result: 55 tests, 53 pass, 2 fail, exit code 1. The 2 failures are
  the P2 suite's T0 candidate-identity assertions for the superseded
  P2 candidate (see the revised spec §8); all behavioral tests in
  both suites pass.
