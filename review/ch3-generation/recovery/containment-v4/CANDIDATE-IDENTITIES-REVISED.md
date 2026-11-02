# Containment V4 candidates — identities addendum for the V4 CORRECTIONS round

Offline work only. No production calls were made. This
addendum supplements `containment-v4/CANDIDATE-IDENTITIES.md`
(the V4 package record, pin `b818f5b3…`); it does not
replace it.

## Candidate code: UNCHANGED — no diff, no new identities

Rowan's V4 ruling corrections V4-1, V4-2, V4-4, and V4-5 are
documentation corrections. Correction V4-3 was checked
against the code firsthand: `deriveStopConfidence`
(candidate `v2/coordinator.mjs`, line 422) opens with the
unreadable-record return (`!read || !read.verified ||
!read.known` → `unknown`) BEFORE the enum branch
(`state !== "CHAIN_STOPPED"` → `not_applicable`) — exactly
the precedence truth-table rows 1/2 (as revised) describe.
The code already conformed; the defect was in the table's
wording, not the branch order. **No candidate file changed
in this round.** All six changed-part identities are
byte-identical to the V4 package record (re-hashed in this
round):

| tree | part | bytes | SHA-256 |
|---|---|---|---|
| candidate | `v2/coordinator.mjs` | 313,063 | `6c19a50e88d8bc00d357f7a5facf33ed8425b53daa20e8d700037f9fd121b2f2` |
| candidate | `v2/worker-entry-prod-d6.js` | 136,357 | `2bb0608b589a084ca275428c3236c24680f4a4692afe2245dfcb2880257983c1` |
| candidate | `v2/generation/service.mjs` | 91,500 | `5c5183e664218b9746c497e9456af45c7467a8ace66fd1b9ef0928eccb3c7c14` |
| composed | `v2/coordinator.mjs` | 314,712 | `5303cb6323da01c21a5ebe9a7983f87abe08e14945660daaebce99734849e1ed` |
| composed | `v2/worker-entry-prod-d6.js` | 136,357 | `2bb0608b589a084ca275428c3236c24680f4a4692afe2245dfcb2880257983c1` |
| composed | `v2/generation/service.mjs` | 91,500 | `5c5183e664218b9746c497e9456af45c7467a8ace66fd1b9ef0928eccb3c7c14` |

Consequently there are NO new diffs in this round: the
vs-live and vs-v3 diffs in `containment-v4/` (hashes in the
V4 identities record) remain the complete deployable delta,
with their round-trips already verified byte-for-byte in
the V4 package.

## Battery: one new test (CT14d); complete re-runs on both v4 trees

The ONLY executable-artifact change in this round is in the
containment battery: new test **CT14d** (V4-3 — pins
truth-table row 1's readable-record precondition against
the exported derivation; battery header discloses the
addition). No existing test or assertion was modified,
deleted, or loosened; the battery count rises 41 → 42.

| artifact | bytes | SHA-256 |
|---|---|---|
| `containment-v4/tests/containment-battery.test.mjs` (extended) | 67,037 | `2b2befa5291a43d4b44346f8306ae55a4b1af48002d974ea24ef6b5cd2fd4aa5` |

One complete run of the extended battery on each exact v4
tree, full log + exit code captured:

| suite | tree | result | exit | log SHA-256 (path) |
|---|---|---|---|---|
| containment battery v4 + CT14d | v4 candidate | **42/42 pass** (CT14d ✔) | 0 | `96c76d17446b9821f519bdbb5ed9673c7c205d8769eac35c8a6f66794bf9fd8b` (`containment-v4/logs/containment-v4-corrections-candidate.log`) |
| containment battery v4 + CT14d | v4 composed | **42/42 pass** (CT14d ✔) | 0 | `a3b5e310720146e70a245e8a097b107abbf64fef64a252c05883b0dba595421f` (`containment-v4/logs/containment-v4-corrections-composed.log`) |

The P2 parameterized regression (32/32 on both trees) and
the R5a suite (23/23 on the composed tree) were NOT re-run
in this round: no code they exercise changed, and their
V4-package logs (hashes in the V4 identities record) stand
as the record for these exact trees.

## Documents in the corrections package

| document | bytes | SHA-256 |
|---|---|---|
| `PHASEB-CONTAINMENT-DESIGN-V4-REVISED.md` | 26,738 | `aa878fda41a9464ded03761c506a98d58f972a050625bb2e737b488407e81acc` |
| `PHASEB-RECOVERY-GATES-V4-REVISED.md` | 50,219 | `37054a552c8e90d146e19dd3c343bda80dd148eb4b70067002bc342cc67972b0` |
| `PHASEB-UNRESOLVED-RISK-REGISTER-REVISED.md` | 13,019 | `29f239a75b8ebd20595293a259a664c97e5cd87563214c3b31b288547fd8f311` |
| `PHASEB-CONTAINMENT-ASYNC-ANALYSIS-V4.md` (UNCHANGED from the V4 package) | 13,684 | `9f93f158750276b6dd57b2d6694fa6cc388e8ce761d9d74e4b0c94505ad39ca2` |
| `ROWAN-CONTAINMENT-V4-RULING.md` (the ruling under answer) | 2,668 | `b08fb162298f6a1768987fead816d416f00c5f0d05116b66a3ca024f11e08329` |

## Open risks (register as revised)

15 register entries, ids stable (R-01…R-15); **R-14 is
marked RESOLVED** (the ruling's R1 acceptance of row 11),
leaving **14 open**. Corrected in place: R-02 (detection
bound), R-08 (exhaustion visibility), R-13 (no dual-surface
corroboration), R-15 (commit-to-record known/unknown). All
other platform-only uncertainties from the V4 package stand
unchanged (A-3 serialization, storage-effect ordering,
provisional 3,600,000 ms threshold, missing
traffic-independent rate bound, retry-supersession
residual, recorder blind spot, C3 live-chain remainder,
B2 open, D unobservable pre-R5a, post-exhaustion
`getAlarm()` semantics, lying-read residual).
