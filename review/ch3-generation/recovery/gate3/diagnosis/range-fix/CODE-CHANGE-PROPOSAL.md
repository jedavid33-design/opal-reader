# CODE-CHANGE PROPOSAL — Option B: replace the five LIKE prefix scans with PK range scans (repo-only candidate)

**Status:** PROPOSAL + LOCALLY BUILT CANDIDATE, prepared under
Julie's recorded GO (board issue #15, comment **6560015979**) and
Rowan's **ANALYSIS PASS** on REMEDIATION-OPTIONS.md (recorded
**6560003451**; analysis pin
`c3f58ad84c3a56216fc913bedd6d95bc95f1f48c`, repo
`jedavid33-design/opal-reader`, branch `ui1-review`).

**What this document asks for:** Rowan's source review of the
patch and its evidence. **What it does not ask for:** deployment.
No production access, preview retry, finalization, re-arm,
generation, or spend is requested or authorized by this proposal;
any deploy is a separate future gate (§6, for reference only).
The system remains HELD — generation halted, queue paused.

**Candidate tree:** `ch3-recovery/range-fix-build/worker-build/` —
a byte-identical copy of the live build `408f9149` tree
(`finalizer-build/worker-build`) plus the patch in §2. The base
tree was never edited. Build evidence: BUILD-REPORT.md (companion
to this proposal, same pin).

---

## 1. Scope

Exactly the five verified LIKE sites — the complete inventory
(grep-verified in the analysis and re-verified for this build) —
replaced by one shared range-scan helper. Nothing else: no schema
change, no write-path change, no control-flow change, no other
module touched.

| ID | Location (patched tree) | Caller / consumption |
|---|---|---|
| L1 | `worker/generation/grant-finalizer.mjs` §4.3.5 (was :417-419) | Finalizer derivation; `detail_json`, `ORDER BY op_key` |
| L2 | `worker/coordinator.mjs` `_voidDispatch` (was :1979-1980) | Full rows; per-op release + defer |
| L3 | `worker/coordinator.mjs` `handleReport` (was :2145-2146) | `detail_json`; grant-closure sweep, in-transaction |
| L4 | `worker/coordinator.mjs` `_processScheduleRow` lease case (was :2591-2592) | `detail_json` → Set intersection |
| L5 | `worker/coordinator.mjs` `handleReport` repair branch (was :2185) | `COUNT(*)` over `jobs.job_id` |

All five sites are changed (the analysis §8.3 recommendation; no
staging — the proof burden is identical per site and L5's is the
smallest).

## 2. The patch

### 2.1 The shared helper — `worker/generation/prefix-range.mjs` (new, 70 lines)

```js
export function prefixSuccessor(prefix)          // least string > every string with this prefix, or null
export function prefixRangeClause(column, prefix) // { clause, params } for `column >= ? AND column < ?`
```

`prefixSuccessor` works over Unicode code points: drop trailing
U+10FFFF code points, increment the last remaining code point.
This is the analysis's byte-successor rule (drop trailing 0xFF,
increment the last byte) stated for TEXT values; the two coincide
exactly on ASCII, which covers every prefix this system builds
(all end in `:` → successor ends in `;`). `prefixRangeClause`
returns the half-open predicate with the bounds as bound
parameters; when no finite successor exists (empty / all-max
prefix — unreachable for any production prefix) it returns the
unbounded-above form `column >= ?`. The `column` argument is an
internal constant at each call site (a primary-key column name),
never caller input; the prefix is always a bound parameter, never
interpolated into SQL text.

Correctness basis (analysis §4): SQLite compares TEXT under
BINARY collation bytewise over UTF-8; UTF-8 byte order preserves
code-point order; therefore `{ k : lo ≤ k < hi }` is exactly the
byte-prefix set — including the empty suffix (a key equal to the
prefix itself is included, precisely as LIKE's trailing `%`
matches empty). Both key columns are table PRIMARY KEYs, so the
range is index-served by the existing PK index; no
optimizer-dependent LIKE prefix optimisation is involved.
Discovery semantics are preserved at every site: the scan returns
whatever rows exist under the prefix, including rows no in-hand
record predicts, so every downstream cross-check (§4.3.5 vs
census, §4.3.6 vs outbox, L3's sweep, L4's intersection) keeps
its full independence.

### 2.2 Per-site changes

Each site replaces `AND <col> LIKE ?` (one bound pattern param)
with `AND ${pred.clause}` (two bound params: lo, hi) plus a short
RANGE-FIX comment naming the option and the consumption property
that makes the swap safe. Imports: one line added to each of
`coordinator.mjs` and `grant-finalizer.mjs`.

- **L1:** clause unchanged otherwise; `ORDER BY op_key` retained.
  Order: the range over the PK returns index order, identical to
  the ordered LIKE result — asserted byte-for-byte in the suite.
- **L2:** full-row consumption unchanged. The loop's effects are
  per-op independent (one idempotent `rel:<op_key>` release row
  per attempt; per-occurrence defer), so result order cannot
  affect the outcome; the suite asserts the release-exactly-once
  property end to end.
- **L3:** inside `handleReport`'s transaction, as before — the
  swap changes only the predicate; a throw (of any kind) still
  aborts the whole report application, unchanged.
- **L4:** the result is consumed as a `Set` of occurrence ids;
  order-independent by construction.
- **L5:** `SELECT COUNT(*) AS n FROM jobs WHERE ${clause}` — a
  count has no order semantics; the range counts exactly the
  byte-prefix set (suite: `follow:1/2/10` count identically under
  both constructions, bare-prefix key included identically,
  sibling `plan:XY` excluded).

Diff totals: `coordinator.mjs` −7/+26 lines (5042 → 5061);
`grant-finalizer.mjs` −2/+7 (830 → 835); helper +70; new suite
+399. Full unified diff: `range-fix-build/evidence/worker-tree.diff`.

## 3. The case-sensitivity delta — named, bounded, justified

SQLite `LIKE` without `PRAGMA case_sensitive_like` (no such pragma
exists anywhere in the tree) is **case-insensitive for ASCII**.
The old predicates therefore match not only the byte-prefix set
but also case-variant keys — and, because the id is interpolated
into the pattern, `_`/`%` characters inside an id would act as
wildcards. The range scan is byte-exact: it returns the
byte-prefix set, full stop.

Consequences, stated plainly:

- On every key the shipped writers can produce — grant ids of the
  form `grant:plan:<lowercase hex>:ch<n>:<n>:full`, UUID
  occurrence ids, `plan:` job ids — the two row sets are
  **byte-identical** (proven in the suite at SQL level and in
  situ, §5).
- The sets differ only on inputs no writer produces: a
  case-variant key (LIKE matches another grant's row into this
  grant's set — a cross-grant leak, not a feature) or a
  metacharacter-bearing id (LIKE over-matches siblings). In both
  cases the range returns the **intended** set and LIKE is the
  over-match. The fix is strictly tighter-or-equal on every input,
  never looser.
- The suite asserts both directions openly: equivalence on the
  machine universe, and the intended divergence on the adversarial
  rows (with the LIKE result shown to be the superset).

## 4. What is deliberately NOT in this patch

- No change to the death-insert / conflict-row mechanism: if a
  future lease-path throw occurs for some other reason, it is
  still recorded exactly as today.
- No change to `handleReport`'s return-value handling, the
  executor, or any other suspected stall micro-cause — out of
  scope for this proposal; the stall diagnosis stands separately.
- No schema change of any kind; the finalizer's lazy audit table
  and all existing tables are untouched.
- No build-identity re-stamp: the candidate keeps the base tree's
  identity; stamping belongs to a future deploy envelope.

## 5. Test evidence (summary; full record in BUILD-REPORT.md)

- **New suite** `tests/range-fix-equivalence.test.mjs` — **19/19
  pass, exit 0**: helper boundaries (incl. 0x7E→0x7F, U+10FFFF
  dropping, non-ASCII increments, no-successor clause);
  per-site-shape SQL equivalence vs the verbatim old LIKE on an
  adversarial key universe (prefix-sibling grants, colon-guard,
  `full`/`full2`, empty suffix, non-ASCII suffix, successor-bound
  exclusion, `rel:`/kind exclusion); metacharacter and
  case-variant divergence asserted as the intended set; patched
  coordinator behaviour for L2/L3/L4/L5 end to end.
- **Finalizer equivalence (L1)** on Fixture S (live-shaped stalled
  grant, 8 executions / 44 attempts / 52 residual): classification
  `finalizable`; precondition digest
  `00db68a8d8a2cb7350f16064f933b4f33b6438659c554a05d9cd48f4e1f53674`,
  **byte-identical to the digest the unpatched LIKE build produced
  over the identical seed** (captured before the patch existed);
  unarmed variant refuses identically; the patched finalizer
  action accepts the LIKE build's digest and finalizes.
- **Full battery** on the exact final patched tree (complete log
  + exit code captured): **1,197 tests / 1,175 pass / 22 fail**,
  runner exit 1 — baseline was 1,178 / 1,156 / 22. Delta is
  exactly the new suite (+19/+19/+0), and the **failing-file set
  is name-for-name identical to baseline** (machine-diffed from
  both logs; 22 = 22, no additions, no removals).
- **Grep proof:** recursive `LIKE`/`GLOB` grep over `worker/` on
  the patched tree yields 14 hits, **all comment lines** (the
  RANGE-FIX comments and the helper's header). **Zero SQL LIKE or
  GLOB sites remain.**

**Evidence ceiling (unchanged from the analysis):** the local
harness accepts the LIKE construction production rejects, so
nothing here reproduces the 500 or proves the production engine
accepts the range construction on the preview path. The evidence
is semantic equivalence + the production track record of
range/equality predicates on these same indexed keys (every
census read at Gate 3 E0 and throughout Stage 1).

## 6. Deploy shape — FOR FUTURE REFERENCE ONLY (not requested)

If a later, separate proposal seeks deployment, the expected
shape is the Gate 2D pattern: fresh pre-action census → halt flip
→ queue pause → ONE upload of the re-stamped envelope → byte
verification of every part → observability check/repair →
operator-route denied probes → read-backs → re-arm as the gate's
own final steps (reconcile `ok: true` before halt lift, queue
unpause last), system otherwise held throughout, $0 spend,
mutation budget named in that proposal. **Part-count note:** the
new helper module enters the import closure, so the envelope
grows from 30 to **31 module parts**; the future proposal must
derive its counts from the operative assembler output, not from
this document. This proposal requests none of that.

## 7. Rollback plan (floor-respecting)

Standing floor law applies unchanged: build `6a73d962…` is the
minimum that may ever run against this data; any rollback is
separately Julie-authorized, with halted/paused pre-holds,
external accounting archive where the gate requires it, and
post-rollback read-back.

- **This change is read-path only** — every changed query is a
  SELECT; there is **no schema change and no data migration**, so
  rollback is **build-for-build**: redeploying the current live
  build `408f9149…` (or any build ≥ the floor) against the same
  data is fully data-compatible in both directions. No residue:
  nothing written by the patched build differs in shape from what
  the unpatched build writes (the patch changes no writes at all).
- **Rollback BEFORE any future finalization:** the stalled grant
  is untouched by the patch; rolling back returns the system to
  exactly today's held state (grant `issued` rev 2, 8 open
  reservations, plan active 8/23). The preview path would again
  carry the LIKE construction — the known, recorded risk — and
  nothing else changes.
- **Rollback AFTER a future finalization** (executed under a
  patched build, under its own gate): the finalization is
  committed bookkeeping (grant `reported`, reservations closed
  `grant_settled`, one audit row in `d6_grant_finalizations`). A
  code rollback does not and cannot un-finalize it; the rolled-
  back build reads the same tables it always read (the audit
  table is additive/lazy and ignored by builds that predate it,
  subject to the standing compatibility care for that table
  recorded in the analysis §10). No rollback may go below the
  floor build, and rollback below the finalizer build
  (`408f9149…`) while a finalization audit row exists requires
  its own compatibility ruling — unchanged by this proposal.

## 8. File hashes (SHA-256)

Base → patched:

- `worker/coordinator.mjs`
  `5d0727638b24e497c7b7ca73d6deead411a5ebc8e475163f78aa0b01d72a3de5`
  → `bca88fe92bfd316c727866f7f69817e290fc8167006d32362577010c2037e20a`
- `worker/generation/grant-finalizer.mjs`
  `15dd575f77efb0d5159f3674162728662b102891cd95cd7b680bf4a8bd0794ee`
  → `0da45d8e6d156d1fc7441ce97e3338aa2a9e143a5560d640ee909c5727f8c076`
- `worker/generation/prefix-range.mjs` (new)
  `a6546b3e94247adcd4215aa1ed4ab691a2595520a2783dd67849056a498da514`
- `tests/range-fix-equivalence.test.mjs` (new)
  `2eb58114d0cd1169493035887e4a7b2909cd0ad1fbe60c8f399c890653851907`

## 9. Residual uncertainty — what this proposal does not claim

- **H1 remains a supported hypothesis, not a proven root cause.**
  Why the production engine rejects a 51-char single-`%` LIKE
  pattern is unknown; state-dependence and intermittency are not
  excluded; the diagnosis's null hypothesis (the Gate 3 preview
  throw occurred outside the derivation) is not excluded. This
  patch is **construction-family removal**, not a proven
  root-cause fix.
- If the true cause sits elsewhere in the request path, a
  pattern-free build could still return 500 at a future Gate 3
  retry preview — and that gate's STOP law catches exactly that
  shape, with the system held and nothing spent, by design.
- Production proof of the replacement exists only through the
  separately gated chain the analysis §12 names: Rowan's review
  of this proposal → (any revisions) → Julie's halted-deploy
  decision on a future deploy proposal → re-arm decision → a
  fresh Gate 3 proposal + Julie's Gate 3 GO, whose census
  exact-matches the four-row conflict baseline (or a Rowan-ruled
  replacement). No step in that chain is pre-authorized by any
  earlier one.

— Wren
