# A-3 IMPLEMENTATION PACKAGE — offline build, for review

Case #10 / P8 (issue #15). Prepared by Wren, 2026-11-16, under Julie's
offline implementation GO (board 6922008740) and Rowan's design-pass
ruling with binding conditions I1–I8 (verbatim board 6921985393).
Design of record: amended design pin `d3de2def…` + addendum pin
`51f0158c…` (repo `jedavid33-design/opal-reader`, branch `ui1-review`).
Handoff: RT-H-20261116-6731f4
Review pin: PIN-SLOT (repo `jedavid33-design/opal-reader`, branch `ui1-review`;
the Dropbox copy carries the filled pin — the only difference between copies).

## 1. What was built

The A-3 candidate: the live build `8a16def4` source tree with exactly
THREE parts changed; the other 28 files are byte-identical to the
baseline (mechanically proven by the battery's T-A3-01 on every run and
by the manifest). The candidate is dormant by construction: the
scheduler starts inactive, no trigger exists, and nothing in this
package arms anything.

| Part | Diff | Contents |
|---|---|---|
| `v2/worker-entry-prod-d6.js` | 1,569 diff lines | `scheduled()` export (tick stub with `retry: {maxRetries: 0}`); DO-internal tick route — the public dispatcher 404s every `/internal/*` path; activation route (closed allowlist; authorizationRef + reason mandatory on every action) and read-only status route; `_drivePass(entryKind)` extraction of the existing alarm body; per-instance FIFO guard (native WAIT / scheduled TRY, identity-checked release); narrow exit assurance (one getAlarm read; `_armAlarm()` only when null AND pending rows exist); scheduler state/events/log/active-pass tables; WAIT hold; recorder migration (independently durable seq counter incremented inside the recording transaction; historical watermark; one-transaction backfill); the total tick predicate + the single synchronous admission stretch; I3 containment re-checks for scheduled passes only; owner-safe active-pass clearing |
| `v2/coordinator.mjs` | 53 diff lines | RC-2 derivation reading rules ONLY: qualifying pairs must be seq-adjacent (`seq2 = seq1 + 1`) and both native-qualified; post-watermark NULL/unknown kinds fail the derivation closed; legacy fallback for pre-A-3 rows. Predicates, halt logic, strike logic, effect sites untouched |
| `v2/generation/service.mjs` | 23 diff lines | Diagnostics projection only: `entryKind`, `seq`, `admittedAt`, `exitArmed`, `assuranceFired` on pass rows |

Full per-condition accounting (I1–I8 → source locations) is in
IMPLEMENTATION-NOTES.md, pinned alongside this package with the
candidate tree, the manifest, the test sources, the runner, and the
unabridged final-run logs.

## 2. Battery — final complete run on the exact final tree

Run 2026-11-16T17:09:15Z via `run-all.sh`; unabridged logs + exit codes
in the pinned evidence. Independently re-run by Wren after the build:
the A-3 battery reproduced 40/0/0 exit 0.

| Suite | Result | Exit |
|---|---|---|
| A-3 battery (T-A3-01…38 + I8 extensions) | **40 pass / 0 fail / 0 skipped** | 0 |
| A-1 battery (adapted, disclosed) | 48 pass / 0 fail / 5 skipped (its standing deferred register) | 0 |
| S1 enforcement | 9/9 | 0 |
| V-3 cold restart | 5/5 | 0 |
| Containment | 41 pass / 1 fail | 1 |
| P2 | 31 pass / 2 fail | 1 |
| R5A | 22 pass / 1 fail | 1 |

**The three non-zero suites fail ONLY in their T0 assembly/identity
subtests** — those fixtures pin the exact sha256 of the trees they were
built for (the coordinator's hash legitimately changed: Part 2 is an
authorized change; P2's T0 additionally round-trips P2's own historical
combined.diff, which cannot reproduce a later build by construction).
Every behavioral test in all three suites passes. The fixtures were
deliberately NOT re-pinned: re-pinning would falsify them as regression
evidence. Verified firsthand by Wren in the logs.

## 3. Findings and disclosed items (detail in IMPLEMENTATION-NOTES.md)

1. **Adoption cannot fire — pre-existing, NOT an A-3 regression.**
   `reconcileUnknown`'s "adopted" exit requires `env.probe.keyFor()`,
   whose only implementation in the tree returns null unconditionally.
   Verified identical on the pre-A-3 build (T-A3-25b). A fallback pass
   reaches exactly the outcomes a native pass could — no more. (This
   bounds what A-3 activation would do for Chapter 6's unknown
   occurrence: adjudication to `outcome_unknown`, not adoption.)
2. **I2 channel decision:** assurance failures record in the scheduler
   event stream, NOT the recorder-health channel — the standing P2 T4
   pin (a getAlarm fault must produce no recorder-health increment)
   caught the first draft conflating them. Failures stay visible and
   distinguished, per I2.
3. **Classifier row 7a tightened** (inside the predicate boundary,
   disclosed): ABSENT_NOT_OVERDUE additionally requires a non-null
   earliest due; without it, an observation inconsistency (pending
   count with no due time) classified there and I4's UNMATCHED
   catch-all was unreachable.
4. **Retry option:** `{ retry: { maxRetries: 0 } }` is expressible
   under the tree's compatibility configuration (deploy spec
   compatibility_date 2026-08-29). The harness records the option;
   runtime honoring is platform behavior — a staging-gate measurement,
   not claimed offline.
5. **I6 rollback demonstrated mechanically:** the pre-A-3 build
   operating on a migrated database produces NULL-seq rows that fail
   later derivations closed (A-1 T-36 / A-3 T-A3-36) — the concrete
   basis for the rollback restrictions.
6. Disclosed test adaptations: three in the copied A-1 battery
   (header-documented); exclude-list extensions only in the copied
   P2/containment suites (the five scheduler tables).

## 4. Boundary

Offline only. No deployment, staging contact, trigger configuration,
activation, or production action is authorized by this package or
requested by it. The next gates, in order, each separately Julie's:
Rowan's implementation review → a deployment proposal → deployment →
a staging/platform-measurement step for the runtime behaviors offline
tests cannot prove → an activation proposal (which must also address
the I5 hold-write contingency). Chapter 6 and WS2/Batch are untouched.

Turn: Rowan's (implementation review). Julie pokes.
