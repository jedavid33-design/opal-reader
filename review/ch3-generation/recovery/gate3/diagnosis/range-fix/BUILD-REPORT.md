# RANGE-FIX BUILD REPORT — Option B prefix RANGE scans (repo-only)

**Authorization:** Julie's recorded GO, board issue #15 comment
**6560015979** ("prepare the proposal and build the patch locally,
repo-only"). Design basis: REMEDIATION-OPTIONS.md, Rowan **ANALYSIS
PASS** (recorded 6560003451; analysis pin
`c3f58ad84c3a56216fc913bedd6d95bc95f1f48c`).

**Scope discipline:** local only. No production access of any kind,
no deployment, no preview/finalizer call against production, no
generation, no spend. The base tree was never edited: all work is
in the copy at `ch3-recovery/range-fix-build/worker-build/`
(byte-identical copy of `finalizer-build/worker-build`, the live
build `408f9149` tree, verified by `diff -rq` before patching).

---

## 1. What changed

One new shared helper + five predicate swaps. No schema change, no
write-path change, no control-flow change anywhere.

| File | Change | Lines |
|---|---|---|
| `worker/generation/prefix-range.mjs` | **NEW** — shared helper: `prefixSuccessor(prefix)` + `prefixRangeClause(column, prefix)` | 70 |
| `worker/coordinator.mjs` | +1 import; L2/L3/L5/L4 predicate swaps, each with a RANGE-FIX comment | 5042 → 5061 (−7 / +26 diff lines) |
| `worker/generation/grant-finalizer.mjs` | +1 import; L1 predicate swap with comment | 830 → 835 (−2 / +7 diff lines) |
| `tests/range-fix-equivalence.test.mjs` | **NEW** — equivalence + regression suite, 19 tests | 399 |

SHA-256 (base → patched):

- `worker/coordinator.mjs`: `5d072763…` → `bca88fe9…`
- `worker/generation/grant-finalizer.mjs`: `15dd575f…` → `0da45d8e…`
- `worker/generation/prefix-range.mjs` (new): `a6546b3e…`
- `tests/range-fix-equivalence.test.mjs` (new): `2eb58114…`

(Full hashes in the proposal §8. Full unified diff:
`range-fix-build/evidence/worker-tree.diff`, 176 lines.)

**Tree note (v2/ mirror):** the build tree carries `v2/` as a
hardlinked mirror of `worker/` (same inodes — one underlying
file), so the mirror is in sync by construction. The deploy
envelope assembler reads `worker/` and renames parts to
`v2/<rel>`; tests import from `worker/`. Nothing separate was
patched, and nothing needed to be.

**Per-site order semantics (verified per site):**

- **L1** (finalizer §4.3.5) is the only site with `ORDER BY
  op_key`; the clause is unchanged and the range is served in the
  same PK index order — the equivalence suite asserts the ordered
  row arrays are byte-identical.
- **L2** (`_voidDispatch`) iterates ops writing per-op release rows
  and per-occurrence defers — each op independent; order cannot
  affect the outcome (asserted behaviourally: exactly one
  `rel:<op_key>` release per attempt).
- **L3** (`handleReport` sweep) is set-membership + independent
  per-occurrence events; order-independent.
- **L4** (lease delivered branch) consumes the result as a `Set`;
  order-independent by construction.
- **L5** is a `COUNT(*)`; no order semantics exist.

**Successor edge cases:** the analysis's byte rule (drop trailing
0xFF, increment last byte) is implemented over Unicode code points
(drop trailing U+10FFFF, increment last code point). For every
ASCII prefix — the entire production namespace — the two rules are
identical (`:` → `;`). The helper handles: prefix ending in 0x7E
(`~` → 0x7F), empty suffix (key == prefix is included, matching
LIKE's `%`-matches-empty), a prefix that is itself a full key, and
non-ASCII last code points (U+00E9 → U+00EA, U+00FF → U+0100). A
prefix with no finite successor (empty, or all U+10FFFF) yields an
unbounded-above clause (`key >= ?`); no production prefix reaches
that branch. **No edge in the analysis's construction was found
wrong**; the code-point formulation is the same rule stated for
TEXT values, and the suite pins both formulations' agreement on
the ASCII universe plus the non-ASCII cases above.

## 2. Test evidence

### 2.1 New suite — `tests/range-fix-equivalence.test.mjs`: 19/19, exit 0

- **Part A (6 tests)** — helper: production prefix shapes, 0x7E/0x7F
  boundary, U+10FFFF dropping, no-successor → null + unbounded
  clause, non-ASCII increments, clause shape/params.
- **Part B (5 tests)** — SQL-level equivalence on a scratch store,
  old LIKE queries reproduced verbatim beside the new predicates:
  L1 shape row-for-row **in ORDER BY order** on the machine universe
  (stalled-grant sibling shapes, one-hex-char sibling, `full` vs
  `full2`, colon-guard prefix sibling `grant:plan:ab` vs
  `grant:plan:abc`, empty-suffix key, non-ASCII suffix, `rel:` rows
  excluded, successor-bound key excluded); L2/L3/L4 shape as sets;
  **adversarial metacharacters** (`_`/`%` in a hypothetical grant
  id: LIKE demonstrably over-matches a sibling grant, the range
  returns exactly the intended set); **case-variant keys** (LIKE
  matches the uppercase sibling, the range returns the intended
  lowercase set — the named delta, asserted as intended tightening);
  L5 COUNT shape incl. `follow:1/2/10` and the bare-prefix key
  counting identically under both constructions.
- **Part C (4 tests)** — the patched coordinator paths end to end:
  L3 report-closure sweep defers unreported granted occurrences;
  L4 lease expiry marks exactly the firing grant's occurrences
  `outcome_unknown` (a second grant's occurrence untouched); L2
  undelivered-dispatch void releases each attempt exactly once and
  re-pends the work; L5 repair-chain numbering counts an existing
  chain child (prior = 1 → next is `:follow:2`) under the parent
  job's own prefix, with a sibling job not inflating the count.
- **Part D (4 tests)** — finalizer equivalence on Fixture S
  (live-shaped stalled grant; 8 executions / 44 attempts / 52
  residual):
  - classification `finalizable` and precondition digest
    **`00db68a8d8a2cb7350f16064f933b4f33b6438659c554a05d9cd48f4e1f53674`**
    — the digest captured from the **unpatched LIKE build** over
    the identical seed before the patch existed. The patched
    derivation reproduces it byte-for-byte.
  - Unarmed Fixture S refuses identically
    (`grant_finalization_quota_unarmed`).
  - The §4.3.5 row set: literal old LIKE vs patched range on the
    seeded store — identical 8 rows, identical order.
  - The patched finalizer **action accepts the LIKE build's
    digest** as `expectedPreconditionDigest` and finalizes
    (`outcome: "applied"`; post-state classifies
    `already_finalized`) — the in-transaction re-derivation through
    the range scan agrees with the LIKE preview.

Log: `range-fix-build/logs/range-fix-suite.log` (19 / 19 / 0).

### 2.2 Full battery on the exact final patched tree

Command (build tree root): `node --test --test-timeout=120000
tests/*.test.mjs`. Complete log captured:
`range-fix-build/logs/full-battery.log`; runner exit code **1**
(the 22 baseline file failures drive it, exactly as in every
baseline run — noted in Gate 2 BUILD-RECORD §3).

| Run | Tests | Pass | Fail |
|---|---:|---:|---:|
| Baseline, Amendment-1 final tree (documented) | 1,178 | 1,156 | 22 |
| **Patched tree (this build)** | **1,197** | **1,175** | **22** |

Delta is exactly the new suite: +19 tests / +19 pass / +0 fail.

**Failing-set diff (names, not just counts):** the failing-file
sets extracted from both full logs are **identical** — 22 files,
none added, none removed (`range-fix-build/logs/failing-set-diff.txt`).
The 22 are the documented baseline set (whole-file load/envelope
failures outside the generation path). The finalizer suites and
the new range-fix suite are all green inside the full run.

### 2.3 Grep proof

Recursive grep for `LIKE` / `GLOB` over `worker/` on the patched
tree (the diagnosis inventory method), excluding the identifier
`GLOBAL`: **14 hits, every one a comment line** — the RANGE-FIX
comments at the five sites and the helper's header documentation
(which quotes the retired construction). **Zero SQL LIKE/GLOB
sites remain.** Raw output:
`range-fix-build/logs/grep-proof.txt`.

## 3. What this build does NOT do

- It does not prove the production engine accepts the range
  construction on the preview path — no local test can (the
  harness accepts the LIKE production rejected). The affirmative
  argument remains the analysis §9 one: range/equality predicates
  on indexed text keys are what this codebase already runs against
  the production engine everywhere else.
- It does not touch the base tree, any pin, production, or the
  board beyond the filing that accompanies the proposal.
- The patched tree is a candidate only. It is not an envelope, not
  assembled for upload, and carries the base tree's build identity
  unchanged; any future deploy gate re-stamps and re-counts parts
  (the new helper module adds one part to the import closure:
  30 → 31).

— Wren
