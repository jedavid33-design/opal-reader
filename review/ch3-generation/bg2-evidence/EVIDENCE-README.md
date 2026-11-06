# WS2 B-G2 — evidence package for independent verification

Assembled 2026-11-06 in response to Rowan's EVIDENCE HOLD ruling
(`ROWAN-WS1-SPEC-PASS-WS2-EVIDENCE-HOLD.md`, Part 2). The ruling
held the reported results — containment 42/42, P2 32/32,
R5A 23/23, V3 5/5, B-G2 110/110 — as *reported, not yet
independently verified*, because the implementation pin
(`9d6f6b850960e2ea85210df2da04f8d8dce6b5ee`) carried the code and
the record but not the executable tests or the complete exit
logs. This package supplies them, for pinning as one follow-up
immutable evidence commit.

**No rerun.** Nothing in this package was produced by re-running
a suite. The logs in `exit-run-logs/` are the ORIGINAL captured
logs of the reported exit run — one invocation of
`tests/run-all.sh`, 2026-11-06T15:43:04Z, overall exit 0 — copied
verbatim and hash-verified against
`bg2-build/test-logs/exit-run/` at assembly. Assembly performed
file copies and read-only hash recomputation only.

## The ruling's six items, mapped

> 1. Complete B-G2 test source and runner.

`tests/` — the complete `bg2-build/tests/` directory, copied
verbatim (107 files, hash-verified): `run-all.sh` (the runner),
`batch-bg2-battery.test.mjs` (the BG2 suite, 110 tests),
`harness.mjs` (the house harness: real `node:sqlite`, throwing
`.one()`), `regen-fixtures.mjs`, the four standing batteries,
fixtures, and generated artifacts (see the layout note below).

> 2. All standing-battery tests and necessary fixtures,
> including documented adaptations.

`standing-batteries/` — the four standing suites exactly as
`run-all.sh` invoked them (`containment/`, `p2/`, `r5a/`, `v3/`),
the shared `harness.mjs`, `regen-fixtures.mjs`, and
`fixtures/identity-bg2.json`. (These files also appear inside
`tests/`; the duplication is deliberate — item 1 is the complete
test tree, item 2 is the standing set made self-contained.)
Adaptations are documented in §2 below.

> 3. Full captured logs from the reported final-tree exit run.

`exit-run-logs/` — all 12 files of the exit run: `SUMMARY.txt`
(run-all summary, 2026-11-06T15:43:04Z, overall exit 0), the
per-suite `.log` + `.exit` files (containment, p2, r5a, v3,
bg2), and `regen-fixtures.log`. Suite counts from the logs' own
tallies: containment 42 pass / 0 fail, p2 32/0, r5a 23/0,
v3 5/0, bg2 110/0.

> 4. A machine-checkable association between the tested tree
> and the eight-file candidate manifest.

`ASSOCIATION.md` + `association.json`. Summary: all 31 candidate
parts re-hash to the `MANIFEST.md` values; the 8 changed parts
are the manifest's delta; the exit run's own regen log lists the
same 8 hashes; the tested tree is the tree the candidate pin
carries.

> 5. Test evidence for the B2-R1 through B2-R4 conditions and
> all 29 crash windows.

`COVERAGE-INDEX.md`, first two tables — each condition and each
window (CW-01..23, AW-01..05, FW-01) mapped to its test(s) in
`tests/batch-bg2-battery.test.mjs` and to its pass record in
`exit-run-logs/bg2.log`, with the mapping basis labeled (NAMED /
BEHAVIORAL / INDIRECT).

> 6. Explicit coverage of the reported implementation
> deviations: staged quota refusal, drive-pass-only poll
> observations, and receipt recovery by re-poll.

`COVERAGE-INDEX.md`, final section — one subsection per named
deviation. Two of the three are **partial**, and the index says
exactly which half is untested (also listed under Gaps below).
Receipt recovery by re-poll is covered completely (the CW-18 and
CW-19 tests).

## §2 — Standing-battery adaptations (as run)

From the implementation record (deviation 3) and BUILD-LOG
Phase 0; each adaptation is also marked in the copied files with
a `B-G2 SCAFFOLDING ADAPTATION` comment (in
`p2/battery.test.mjs`, `r5a/r5a-battery.test.mjs`, and
`v3/v3-cold-restart.test.mjs`, one marker each):

- **Cured identity fixtures.** `tests/regen-fixtures.mjs` runs
  before every suite run and regenerates, from the two trees on
  disk: `tests/fixtures/identity-bg2.json` (changed-parts set +
  SHA-256s + the full pinned baseline manifest),
  `tests/p2/combined.diff`, and `tests/r5a/coordinator.diff`.
  The P2/R5A identity groups read that fixture instead of the
  stale baked-in values. The copies in this package are the exit
  run's regenerated outputs.
- **Behavioral twins.** The P2/R5A behavioral groups keep their
  historic pre-change trees as behavioral twins, copied beside
  the batteries (`tests/p2/baseline-tree/`,
  `tests/r5a/baseline-tree/` — 31 files each, included). These
  are the batteries' own historic trees, distinct from
  `bg2-build/baseline-tree/` (the composed pre-build tree).
  Behavioral groups are byte-identical to the originals.
- **R5A round-trip** runs against the generated diff; its
  baseline-marker-absence assertion was dropped (the composed
  baseline already carries the R5A revision).
- **V3** needed only its harness import and default tree path
  re-pointed. **Containment** needed no edits (its identity
  fixture is env-driven); `tests/containment/harness.mjs` is
  included with its battery.

## Layout notes (generated artifacts inside `tests/`)

- `tests/admitted-tree/` is a **generated artifact**: the BG2
  battery deletes and rebuilds it at load from `candidate-tree/`
  and flips the allowlist line in the copy only (the §3.13
  mechanism; record deviation 2). The copy included here is the
  exit run's rebuilt instance, included because item 1 asks for
  the test tree exactly as run. Its only difference from the
  candidate tree is that one line (verified at assembly — see
  ASSOCIATION.md).
- `tests/fixtures/identity-bg2.json`, `tests/p2/combined.diff`,
  `tests/r5a/coordinator.diff` are likewise regenerated at every
  run start (by `regen-fixtures.mjs`, invoked first by
  `run-all.sh`); the included copies are the exit run's outputs.

## Gaps and weaknesses found at assembly (named, per instruction)

1. **Staged quota refusal (deviation 7) — partially untested.**
   No test stages a fence-time quota refusal inside a cohort and
   asserts the reportable-only-when-nothing-in-flight behavior
   or the later re-fence. The nothing-durable half and the
   surrounding cohort/daily_limit machinery are each directly
   tested. See COVERAGE-INDEX, deviation section 1.
2. **Drive-pass-only poll observations (deviation 6) — a narrow
   negative assertion is missing.** No test asserts the
   observations table is empty after a queue-branch poll; the
   scoping is proven from the drive-pass side and by the queue
   test's durable-state assertions. See COVERAGE-INDEX,
   deviation section 2.
3. **Crash windows CW-09, CW-01, CW-02..CW-06 are not isolated
   by dedicated labeled tests.** CW-09's rollback claim is
   subsumed by the W6 fault tests' byte-identical assertions;
   CW-01 has no injected fault between claim and bundle (no
   durable write intervenes); CW-02..CW-06 are proven as a group
   at every bundle write boundary rather than under their IDs.
   Each is labeled INDIRECT or BEHAVIORAL (group) in the index —
   none is presented as NAMED.
4. **Interim phase-run logs are not in this package.** The
   ruling asked for the reported final-tree exit run's logs,
   which are complete here. For the record: BUILD-LOG's interim
   checkpoint counts (CP-1..CP-7) were narrative; the only other
   captured log set on disk is `test-logs/phase0/` (the Phase 0
   scaffolding run on the then-unmodified tree), which is not
   part of the reported exit run and is not included.
5. **A stray duplicate appeared in the source tree during
   assembly.** At 2026-11-06T16:04:33Z — after this package's
   copies were taken and hash-verified — a nested
   `bg2-build/tests/containment/containment/` directory appeared
   in the source, holding byte-identical copies of the
   containment battery and harness. It was not part of the tree
   the exit run invoked (107 files then; this package preserves
   exactly that set), it was not created by this assembly, and
   it is excluded and documented (ASSOCIATION.md,
   `association.json`) rather than copied in or deleted.
6. **`association.json` cannot hash itself.** It lists every
   other file in the package; its own integrity rides on the
   evidence pin made from this package (see ASSOCIATION.md).

Nothing in this package advances B-G3; it is evidence for
Rowan's independent source and evidence review, as ruled.
