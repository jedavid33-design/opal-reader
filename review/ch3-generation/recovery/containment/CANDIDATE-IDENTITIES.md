# Containment package — candidate identities (offline)

All values measured firsthand on the local scratch trees,
2026-11-02. Nothing here is deployed. Production build remains
`86ad06aba6083f7ea84d64b08eac1788d5bf570c` (the live instrumented
build); GENERATION_HALT "1", queue paused, production HELD.

## Trees (scratch, `containment/`)

- `baseline-tree/` — byte copy of the live instrumented tree
  (31 parts; identical to `r5a-revision/baseline-tree/`).
- `candidate-tree/` — the CONTAINMENT candidate: baseline + the
  containment change in exactly 3 parts (below). Independent of
  the R5a candidate.
- `composed-tree/` — the COMPOSED candidate: the R5a candidate
  tree (`r5a-revision/candidate-tree/`) + the same containment
  change. Its entry and service parts are byte-identical to the
  containment candidate's; its coordinator carries R5a and
  containment together. This is the tree the gate sequence would
  actually deploy (containment first, R5a second, per ruling
  decision 5 — see PHASEB-RECOVERY-GATES-V2.md).

## Baseline part identities (live build)

- `v2/coordinator.mjs`: 276,256 B, SHA-256
  `bca88fe92bfd316c727866f7f69817e290fc8167006d32362577010c2037e20a`
- `v2/worker-entry-prod-d6.js`: SHA-256
  `45daf26ca850835c698863cb08ca39a8c6f1b2f1450488d1e710f0cd87d7c4ab`
  (the P2 instrumentation candidate part, live)
- `v2/generation/service.mjs`: SHA-256
  `41f27492447296f25f958836a65d8e04592c2ba3cd330a2d2854ed98433eefda`
  (the P2 instrumentation candidate part, live)

## Containment candidate — changed parts (vs live)

- `v2/coordinator.mjs`: 287,537 B, SHA-256
  `12d73bef90b84b0d119d1b5391615ea305ad797aa13b4414443c3d19bcb73109`
  — diff `coordinator.diff` (12,738 B, SHA-256
  `6d8b9c6d539b098e54ad09628a6acdfdebcaeda5ab1c848cfee625425a56df06`),
  **+242 / −0** (pure insertion: state store + helpers + gates +
  transition method).
- `v2/worker-entry-prod-d6.js`: 134,298 B, SHA-256
  `0183aabfcb8b57312c97102da021f0925a2fabb47c78fa65d333224e2337bc81`
  — diff `entry.diff` (9,929 B, SHA-256
  `ee66b4b1bc3200ab6e284c684253f69faa086e36ed12f136a14ac95f4934eee5`),
  +138 / −3.
- `v2/generation/service.mjs`: 89,186 B, SHA-256
  `ebed452a83cfa4ef0f2b0d5c31b1f77cf69f12a455dc6c32f8f661cba9227f3d`
  — diff `service.diff` (1,754 B, SHA-256
  `c4ed61c25702a5ff2c156d35ea2d16889235f5da90baa835fa16358c68b5cc99`),
  +26 / −1 (the `contained` recorder-stage vocabulary entry + the
  drive=1 `containment` projection).
- The other 28 parts are byte-identical to the live tree
  (asserted by the containment battery CT0 and the parameterized
  P2 suite T0 on this tree).

## Composed candidate — changed parts (vs live)

- `v2/coordinator.mjs`: 289,802 B, SHA-256
  `c097061a3712b3a21058b5d7b790b9cf5314463a664d4fbc3d01bf27f33542ae`
  — diff vs live `composed-coordinator.diff` (17,847 B, SHA-256
  `b65b564bf92d5446166ddc49dbf8b82f2429a4ce5468575ba2040cf0ed226456`),
  +295 / −12 (the R5a +51/−12 and the containment +242/−0 occupy
  disjoint regions except the shared `_armAlarmIfEarlier`, where
  the containment gate precedes the R5a memo logic).
- `v2/worker-entry-prod-d6.js` and `v2/generation/service.mjs`:
  byte-identical to the containment candidate's parts (above).
- The R5a candidate coordinator (`d3d9005b9c2f…`) is the composed
  coordinator's other parent: composed = R5a coordinator +
  containment insertions (verified by the R5a suite running green
  on the composed tree).

## Round-trip diffs vs the deployed parts (parts-e0)

Under `diffs-e0/`: `entry.diff` (31,998 B, `7a940ac6…`),
`service.diff` (12,610 B, `a8f044b4…`), `coordinator.diff`
(12,738 B, `6d8b9c6d…` — identical to the live-relative diff,
because the deployed and live coordinators are the same bytes),
`composed-coordinator.diff` (17,847 B, `b65b564b…`). The
parameterized P2 suite's T0 round-trip tests apply each of these
to pristine parts-e0 files and reproduce the candidate parts
byte-for-byte (all runs green; see `suites/logs/`).

## Test suites (canonical copies in `suites/`)

- `suites/harness.mjs` — SHA-256
  `c261f33486f878853a3033428cc2c3e4bf37957197ca0abe5acfd709fa1a0147`
  (the R5a harness, a strict superset of the instrumentation
  harness: 3 marked extensions).
- `suites/p2-battery.test.mjs` — 43,458 B, SHA-256
  `b489d216c4d138adeefc39b1d3d4ef7fa9133dc5176f0d89ec9ad2e0ee621aae`
  (parameterized edition; fixtures in `suites/fixtures/`).
- `suites/r5a-battery.test.mjs` — 19,658 B, SHA-256
  `a552241431a80f4977c6730ed03873be5613c23c2a789abd001b942191fc1397`.
- `containment/tests/containment-battery.test.mjs` — 24,050 B,
  SHA-256
  `3f18b81d679b979389974e2e8eec2605132882dc764c6f63ce11e04f52893ebb`;
  its harness (`containment/tests/harness.mjs`, SHA-256
  `6ea8b067440649db7e21e964b0b573b69ff5ae1ee04f67245b49c7cb015fc17e`)
  is the suites harness plus a deleteAlarm fault switch, a
  deleteAlarm log, and an entryPost helper (marked extensions).

## Battery results (one complete run per suite per tree)

| suite | tree | result | exit | log |
|---|---|---|---|---|
| P2 (parameterized) | P2 original candidate | 32/32 pass | 0 | `suites/logs/p2-on-original.log` |
| P2 (parameterized) | R5a candidate (pin d9269517 tree) | 32/32 pass | 0 | `suites/logs/p2-on-r5a.log` |
| P2 (parameterized) | containment candidate | 32/32 pass | 0 | `suites/logs/p2-on-containment.log` |
| P2 (parameterized) | composed | 32/32 pass | 0 | `suites/logs/p2-on-composed.log` |
| R5a (parameterized) | R5a candidate | 23/23 pass | 0 | `suites/logs/r5a-on-r5a.log` |
| R5a (parameterized) | composed | 23/23 pass | 0 | `suites/logs/r5a-on-composed.log` |
| Containment | containment candidate | 17/17 pass | 0 | `containment/logs/containment-on-candidate.log` |
| Containment | composed | 17/17 pass | 0 | `containment/logs/containment-on-composed.log` |

The R5a suite was NOT run against the containment-only tree: its
subject (the R5a condition) is absent there by construction, so a
run would measure the wrong tree; the containment tree is covered
by the P2 regression suite and the containment battery. Log
SHA-256s are recorded in the package's board summary.
