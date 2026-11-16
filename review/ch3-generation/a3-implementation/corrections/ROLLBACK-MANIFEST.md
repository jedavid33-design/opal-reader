# A-3 Rollback Candidate Manifest (HOLD ruling R6(c), design I6)

Candidate: `rollback-tree/` in
`~/workspace/ch2-program/a3-build/`. Baseline: the live build
`8a16def4`'s source (`pre-a3-tree/`, hash-verified against
`BASELINE-MANIFEST.txt`).

This is a CODE candidate, not a configuration: the pre-A-3
build with ONLY the A-3 recorder and the corrected RC-2
derivation carried forward. The scheduler and the shared-drive
mechanism are removed by construction — there is nothing to
disable, because there is nothing present:

- no `scheduled()` export (the default export is exactly
  `{ fetch, queue }`, as in the pre-A-3 build; asserted by
  test RB-1);
- no tick route, no activation/status routes, no scheduler
  tables (a rollback world creates no `d6_scheduler_*` table
  and no `d6_active_pass`; asserted by test RB-3);
- no pass guard, no `_drivePass(entryKind)` machinery — the
  native `alarm()` path is the pre-A-3 shape, changed only in
  the recorder fields its pass rows carry.

## Differ set vs the live-build baseline: exactly three parts

Files: 31 total; 3 changed; 28 byte-identical to baseline
(mechanically verified by `verify-composition.mjs`; see
`COMPOSITION-VERIFICATION.md`).

| Part | sha256 (rollback) | Diff vs baseline | Content |
|---|---|---|---|
| `v2/worker-entry-prod-d6.js` | `faae80af18c9185f119261e38ed9fcea152c6754f06622b219927221efb3bc48` | +245 / −22 | Recorder-only: full-column `DRIVE_PASS_SCHEMA`; `_ensureRecorderSchema()` (the candidate migration's recorder half — meta table, column ALTERs, seq backfill, watermark — with NO scheduler tables/seed); the candidate-shaped transactional `_recordDrivePass` (durable seq counter, returns the pass id); the candidate's pair-protecting `_pruneDrivePasses` verbatim; `alarm()`'s rec gains `entryKind: "native_alarm"` and `admittedAt`. Pass rows carry `exit_armed` = the recorder's own readback (the same value as `armed_after`), `assurance_fired` 0 and `assurance_outcome` `"not_required"` — this build has no exit assurance and claims none. |
| `v2/coordinator.mjs` | `fe2e10122573d84bd832c4669460cc82fc271cfa793b06a2a70fa28b260b4840` | +129 / −8 | Byte-identical to the corrected A-3 candidate's Part 2: the corrected RC-2 derivation (explicit schema probe, fail-closed reads, window fail-closed, `failClosedIntentIds` surfaced). |
| `v2/generation/service.mjs` | `e9f99bd2d308be2d679fa2dec5205d60caf99847de7d27a01093dc0c342ad92c` | +34 / −0 | Byte-identical to the corrected candidate's Part 3: diagnostics projection incl. `assuranceOutcome` / `assuranceArmedAfter`. |

## Why this candidate is evidence-compatible (I6)

Once A-3's recorder migration may have occurred, the ORIGINAL
A-1 build is not a permissible rollback: it ignores
entry_kind/seq, and its own writes into a migrated store are
NULL-kind/NULL-seq rows the corrected derivation fails closed
around (battery T-A3-36, as corrected). This candidate instead:

- runs the same migration itself if it has not run
  (idempotent; watermark-preserving);
- writes only well-formed extended rows (native kind, durable
  seq), so evidence recorded while it runs remains readable
  by the corrected derivation — including by the A-3
  candidate's own coordinator (test RB-4: derivations
  identical across builds, in both directions);
- applies the corrected derivation itself, including the R2
  fail-closed read (test RB-5);
- never creates scheduler state, so a later return to the
  A-3 candidate finds the scheduler exactly as it was left.

## Regression evidence (corrections run)

From `evidence/final-run-corrections/` (see
`IMPLEMENTATION-NOTES.md` for the full table): A-1 battery
48 pass / 0 fail / 5 skipped (the standing deferred register),
exit 0; S1 9/9 exit 0; V-3 5/5 exit 0; containment 41/42,
P2 31/33, R5A 22/23 — each failing ONLY its historical
assembly & identity fixture subtest(s), the same disposition
as against the candidate (see `COMPOSITION-VERIFICATION.md`);
rollback RC-2 battery (`tests/rollback-rc2.test.mjs`) 2/2,
exit 0. P2/R5A were run in the `rollback-suites/` shadow root
of real copies because those batteries hardcode
`../candidate-tree` relative to their own location (see
`REPRODUCIBILITY.md`).

One disclosed test-side adaptation: the A-1 battery's
`seedPass` falls back to `_ensureRecorderSchema` when
`_ensureA3Schema` is absent (adaptation 4 in that file's
header); candidate behavior is unchanged.
