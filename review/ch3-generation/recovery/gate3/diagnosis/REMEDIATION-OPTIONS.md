# Gate 3 E3 diagnosis — REMEDIATION OPTIONS ANALYSIS (source-only)

**Status:** ANALYSIS ONLY. Prepared under Rowan's Stage 1 review ruling
(board issue #15, comment 6559766643): *"Wren should prepare a
source-only remediation options analysis comparing replacement of the
LIKE prefix scans with a non-pattern approach, including query
semantics, exact-match safety, impact on coordinator twins, regression
tests, and rollback. No implementation or production access is
authorized by this ruling."*

**Scope of this document:** no code was changed, no production system
was accessed, no preview or finalizer was invoked in its preparation.
Every claim below is from reading the source tree named in §1 and the
already-pinned diagnosis record. Nothing here is a code-change
proposal; that would be a separate document, separately reviewed,
separately approved.

**Basis documents:** Gate 3 diagnosis proposal, Amendment 1 (pin
`1e18269c24b91b8035fe9f8acc38ab696f9839ca`, repo
`jedavid33-design/opal-reader`, branch `ui1-review`); Stage 1 record
(pin `b0446f7942ee831c6f5f3bf15709433a46ae7640`, filed 6559748096);
Rowan's Stage 1 review (6559766643).

---

## 1. Source basis and verified LIKE/GLOB inventory

Source tree: the live build `408f9149…` tree at
`ch3-recovery/finalizer-build/worker-build/` (the finalizer build
tree). Method: recursive grep for `LIKE` / `GLOB` over `worker/`,
followed by a firsthand read of every hit in context (this pass).

**Result: the diagnosis inventory is CONFIRMED exactly.** There is
**no SQL GLOB anywhere** in `worker/` (the only `GLOB` character
sequences in the wider tree are inside the identifier `GLOBAL` in the
legacy v1 `cloudflare-worker.js` — not SQL). There are exactly
**five** SQL LIKE sites:

| ID | Location (verified) | Enclosing function | Pattern (bound parameter) | Table |
|----|--------------------|--------------------|---------------------------|-------|
| L1 | `worker/generation/grant-finalizer.mjs:417-419` | `deriveGrantFinalizationState` (starts :267) | `` `op:${grantId}:%` `` | `ledger_ops` |
| L2 | `worker/coordinator.mjs:1979-1980` | `_voidDispatch` (:1951) | `` `op:${grantId}:%` `` | `ledger_ops` |
| L3 | `worker/coordinator.mjs:2145-2146` | `handleReport` (:2057) | `` `op:${grant.grant_id}:%` `` | `ledger_ops` |
| L4 | `worker/coordinator.mjs:2591-2592` | `_processScheduleRow`, `case "lease"` (:2509 / :2521) | `` `op:${grant.grant_id}:%` `` | `ledger_ops` |
| L5 | `worker/coordinator.mjs:2185` | `handleReport` (repair-chain branch) | `grant.job_id + ":follow:%"` | `jobs` |

Refinements over the diagnosis inventory (additions, not corrections —
every diagnosis line number checked out exactly):

- **L4's call path:** `_processScheduleRow` is invoked per due row
  from `alarm()` (`coordinator.mjs:2474`, call at :2481). `alarm()`'s
  per-row `catch` (:2482-2499) applies backoff retries and, when
  `attempts >= SCHEDULE_MAX_ATTEMPTS` (= 8, `coordinator.mjs:147`),
  parks the row `dead` and performs the death-insert into
  `binding_conflicts` at **:2490-2492** (`reason 'schedule_dead'`,
  `found = String(e.message)`). This is the mechanism that produced
  the four production conflict rows.
- **L3 runs inside a transaction:** `handleReport`'s body executes
  inside `this._tx(() => { … })` (:2060). A throw at L3 aborts the
  whole report application — the grant stays `issued`, no occurrence
  changes commit.
- **The death-insert is at :2490-2492**, inside `alarm()`, storing
  `row.ref` as `occurrence_id`, `row.kind` as `cache_key`,
  `String(row.attempts)` as `expected`, and the error message as
  `found` — matching the four baseline rows field-for-field.

### 1.1 Reachability

- **(a) Finalization preview derivation:** L1 only. The preview route
  and the finalizer action's in-transaction re-derivation both call
  `deriveGrantFinalizationState`; L1 (§4.3.5 of the derivation) is the
  only pattern query on that path. L2–L5 are unreachable from it.
- **(b) Report / lease paths:** L3 and L5 run inside `handleReport`.
  L4 runs in the lease schedule case. L2 runs from two callers: the
  lease case's pre-delivery branch (dispatch never invoked → void)
  and the `handoff_check` case's `not_accepted` verdict path.
- **(c) Anything else:** none. No other caller reaches any of the
  five sites.

---

## 2. The shared key construction, and what each caller consumes

### 2.1 How attempt rows are written (verified)

Attempt ledger rows are written at exactly **one** site:
`coordinator.mjs:1748-1752`, inside `_issueGrant`, in the same
transaction as the `grants` INSERT and the `outbox` INSERT:

```sql
INSERT INTO ledger_ops (op_key, at, day_key, month_key, kind, est_micro_cents, detail_json)
VALUES (?, ?, ?, ?, 'attempt', ?, ?)
-- op_key = `op:${grantId}:${o.occurrence_id}`, one row per target occurrence
```

The outbox payload written in that same transaction lists exactly the
same set: `occurrences: targets.map(o => o.occurrence_id)`. A grep
for `INSERT INTO ledger_ops` across the tree returns exactly two
sites: :1748 (`attempt`) and :1988 (`attempt_release`, inside
`_voidDispatch`, key `` `rel:${op.op_key}` ``). No other writer of
`kind = 'attempt'` rows exists.

Two further code paths already treat the attempt key as **exactly
derivable** and use equality, never a pattern:

- `noteProviderRequest` (:2024) and `noteProviderOutcome` (:2040)
  read and UPDATE the attempt row by `` `op:${grantId}:${occurrenceId}` ``
  with `WHERE op_key = ?`.
- `reconcileUnknown` (:2330) fetches the spend row by the identical
  exact key.

### 2.2 Schema facts (verified)

- `ledger_ops.op_key` is `TEXT PRIMARY KEY` (`coordinator.mjs:173-176`)
  — a unique index exists on the key; equality and range predicates
  on it are index-served.
- `jobs.job_id` is `TEXT PRIMARY KEY` (`coordinator.mjs:153-156`) —
  same property for L5.
- Key alphabet in production: grant ids of the form
  `grant:plan:<lowercase hex>:ch<n>:<n>:full` (plus `:probe`
  variants), occurrence ids are UUIDs. Every component any pattern is
  built from is ASCII, lowercase, and contains **no `%`, no `_`, no
  non-ASCII**. All five patterns are passed as **bound parameters**;
  the only wildcard in any pattern is the trailing literal `%`.

### 2.3 What each caller actually consumes

- **L1 (derivation §4.3.5):** `detail_json` only. It parses each
  row's `occurrenceId` into a set (`ledgerIds`/`ledgerSet`), requires
  the set non-empty and duplicate-free, requires every member to be
  in the plan's eligible set for the job, and hands the set to
  §4.3.6, which requires the outbox payload's occurrence set to equal
  it exactly. `ORDER BY op_key` is present but the order is discarded
  — target order is re-derived from plan order. **The query is a
  DISCOVERY query:** its safety value is that it finds whatever
  attempt rows exist for the grant, including any row no other record
  predicts, and the derivation refuses on any divergence among three
  independently written records (ledger ops, plan census, outbox).
  Records the derivation already holds before §4.3.5: the grant row,
  the plan link, the job row, all plan entries (incl. the eligible
  set), the claim row, and — on armed stores — all
  `d6_grant_reservations` rows for the grant (each carrying an
  `occurrence_id`). The outbox row is read at §4.3.6, **after**
  §4.3.5.
- **L2 (`_voidDispatch`):** full rows (`SELECT *`). Per op it consumes
  `op_key` (to build the idempotent release key `rel:${op.op_key}`),
  `day_key`, `month_key`, `est_micro_cents` (negated into the release
  row), and `detail_json.occurrenceId` (to defer still-`granted`
  occurrences). The function receives only `{ grantId, jobId }` —
  no occurrence list is in hand at entry.
- **L3 (`handleReport`):** `detail_json` only. It builds the set of
  dispatched occurrence ids and, for each one **not** in the report's
  result set whose occurrence is still `granted`, applies a `defer`
  (returns it to pending) — "a report closes its grant." The grant
  row and the report are in hand; the dispatch set as recorded in the
  outbox payload is one equality read away (`outbox.id = grant_id`)
  but is not read on this path today.
- **L4 (lease, delivered branch):** `detail_json` only. It builds
  `grantedIds` and intersects it with the job's occurrences in state
  `granted` — which the caller has **already read** at :2588-2589,
  before the LIKE. Matching occurrences get `lease_expired` →
  `outcome_unknown` + immediate `reconcileUnknown`.
- **L5 (`handleReport`, repair chains only):** a COUNT only:
  how many jobs exist with id `<jobId>:follow:<n>`, used to name the
  next follow-on job `${jobId}:follow:${prior + 1}`. Follow-on ids
  are open-ended in `n`; no in-hand list of candidates exists.

### 2.4 LIKE semantics that matter for exact-match safety

SQLite `LIKE` is **case-insensitive for ASCII** by default (no
`case_sensitive_like` pragma is set anywhere in the tree), `%`
matches any run of characters including empty, and `_` matches
exactly one character. The patterns are built by interpolating a
grant/job id into the pattern string. Consequences:

- On every key the shipped writers can produce, the LIKE row set
  equals the intended byte-prefix set — the ids contain no pattern
  metacharacters and are lowercase.
- Nominally, LIKE is **broader** than byte-prefix equality: were an
  id ever to contain `_` or `%`, it would act as a wildcard and could
  match **more** rows (e.g. a `_` would match a sibling grant
  differing in exactly that position); case variants would also
  match. No production id does this, but every non-pattern option
  below is **strictly tighter-or-equal** than LIKE on every input —
  none can return a row LIKE would not, except where noted, and the
  differences are exactly LIKE's over-reach, never the intended set.

---

## 3. Option A — exact-key enumeration

**Construction:** derive the candidate key set from records already
in hand, then fetch by equality — one `WHERE op_key = ?` per key or
a single `IN` list. In-tree precedent: :2024, :2040, :2330.

**Per-site completeness:**

- **L1:** candidate sources in hand: (i) the eligible plan entries;
  (ii) the grant's reservation rows (armed stores only — the
  derivation explicitly tolerates unarmed stores with an empty list,
  so this source alone is incomplete by design); (iii) the outbox
  payload occurrence set — complete for the dispatch, but read at
  §4.3.6, after §4.3.5, so using it means reordering derivation
  steps. Any single source converts §4.3.5 from **discovery** to
  **verification**: an attempt row whose occurrence id is in **none**
  of the sources becomes invisible instead of refusing the
  derivation. The union of all three sources (eligible ∪ reservations
  ∪ outbox) covers every row the only shipped writer can create —
  `_issueGrant` writes exactly the target set, targets ⊆ eligible,
  targets = outbox occurrences, atomically in one transaction. The
  residual gap is strictly rows no shipped code path can write. But
  the pairwise cross-checks lose independence: today ledger, census,
  and outbox are three records compared against each other; deriving
  the lookup keys from two of them makes the third comparison
  partially circular — a row missing from both sources and the ledger
  is undetectable (it also cannot exist, per the writer analysis),
  and a ledger row outside the union is missed rather than refused.
- **L2:** sources: outbox payload for the grant, the job's occurrence
  rows, reservation rows. Same union argument, same narrowing. All
  fields L2 consumes are on the fetched rows, so consumption is
  unaffected once the set is right.
- **L3:** the dispatch set is the outbox payload set by construction;
  union with the report's own result ids and reservations covers
  every writer-producible row. Same narrowing as L1.
- **L4:** the caller already holds the job's `granted` occurrences;
  union with the outbox set loses nothing the caller consumes (the
  result is only ever intersected with the `granted` set). Same
  narrowing in principle.
- **L5:** **poor fit.** Follow-on indices are open-ended; there is no
  in-hand enumeration. Probing `n = 1, 2, …` until the first miss
  assumes contiguity — a new invariant shipped code nowhere states
  (follow jobs are never deleted today, but "never deleted" is an
  observation, not a fence).

**Exact-match safety:** returns exactly the enumerated keys' rows —
never more than the intended set; **fewer** than the intended set
iff the enumeration has a gap (the discovery→verification narrowing
above). Adversarial cases (prefix-sibling grants, metacharacters,
case variants, empty suffix) cannot occur *within* the enumerated
set because equality is byte-exact; the risk is entirely omission,
never over-match.

**Verdict:** viable for L1–L4 with a real, bounded semantic
narrowing that must be argued from the writer invariant and pinned
by fixtures; not viable for L5.

---

## 4. Option B — prefix RANGE scan on the key column

**Construction:** replace the pattern predicate with a half-open
range on the indexed key:

```sql
WHERE kind = 'attempt' AND op_key >= ? AND op_key < ?
-- lo = `op:${grantId}:`        hi = successor(lo)
```

`successor(prefix)`: increment the prefix's last byte (dropping any
trailing `0xFF` bytes first, per the general byte-successor rule).
Every production prefix here is pure ASCII ending in `:` (0x3A), so
the successor is exact and trivial: `hi = prefix[:-1] + ';'`
(0x3B). For L5 identically: `lo = ${jobId}:follow:`,
`hi = ${jobId}:follow;`.

**Correctness:** SQLite compares TEXT under the default BINARY
collation bytewise (memcmp over the UTF-8 encoding). The set
`{ k : lo ≤ k < hi }` is **exactly** the set of byte strings having
`lo` as a prefix — for every suffix: empty suffix (a key exactly
equal to `lo` is included, exactly as LIKE's `%` matches empty),
ASCII suffixes, and non-ASCII suffixes (UTF-8 byte order preserves
the prefix property byte-for-byte). The trailing `:` in `lo` is the
namespace guard, exactly as it is in today's pattern: `op:<gidA>:`
is not a prefix of any `op:<gidB>:…` key where `gidB` merely extends
`gidA`'s text, because the byte after the id must be `:`. A shorter
grant id that is a byte-prefix of a longer one therefore cannot
bleed across — the colon terminator does the work in LIKE today and
does the identical work here.

**Exact-match safety:** the returned set is the intended prefix set
on **every** input — never more, never fewer. Where it differs from
LIKE's set (an id containing `%`/`_`, or case-variant keys), LIKE is
the one over-matching; B returns the intended set. On every key the
shipped writers can produce, B's set is **byte-identical to LIKE's
set**, including row order under L1's `ORDER BY op_key` (the range
is served in PK index order).

**Discovery semantics preserved:** B remains a discovery query — it
returns whatever rows exist under the prefix, including rows no
in-hand record predicts. Every downstream cross-check (§4.3.5 vs
census, §4.3.6 vs outbox, L3's unreported-occurrence sweep, L4's
intersection) keeps its full independence. No derivation reordering,
no new invariant to argue.

**Index behaviour:** `op_key` / `job_id` are the tables' primary
keys; a half-open range on the PK is the most ordinary index range
scan SQLite performs. (LIKE's prefix-index optimisation is
optimizer- and pragma-dependent; the range does not depend on it.)

**Verdict:** exact semantic replacement at all five sites; the diff
per site is the predicate plus one additional bound parameter; one
shared helper can serve L1–L4 and the same construction serves L5.

---

## 5. Option C — substr() / instr() prefix equality

**Construction:** `WHERE kind = 'attempt' AND substr(op_key, 1, ?) = ?`
(prefix length + prefix), or `instr(op_key, ?) = 1`.

**Semantics:** for TEXT, `substr` counts **characters**, not bytes.
On every writer-producible key (ASCII prefix, ASCII-or-UUID suffix)
the result set equals the intended prefix set. Divergence from the
byte-prefix set is possible only for a key with a multi-byte
character inside the first N characters — a shape no writer
produces, but one a reviewer must argue about, where Option B needs
no argument. `instr` on TEXT likewise reports character positions.

**Index behaviour:** the column is wrapped in a function, so the PK
index cannot serve the predicate — the query becomes a scan of
`ledger_ops` (kind-filtered). The table is small per coordinator, so
the cost is bounded and this is not a correctness objection; it is
strictly worse than B for zero semantic gain.

**Verdict:** semantically adequate, strictly dominated by B.

---

## 6. Option D — derived column extracted at write time + equality

**Construction:** add a column (e.g. `grant_id`) to `ledger_ops`,
populated by the :1748 insert (and the :1988 release insert), then
query `WHERE kind = 'attempt' AND grant_id = ?`.

**The backfill problem is dispositive for this recovery.** Existing
rows — including the stalled grant's eight attempt rows, written by
the live build — have no value in a new column; `ALTER TABLE … ADD
COLUMN` leaves them NULL (a constant default cannot encode per-row
grant ids). Equality on the new column returns **zero rows for the
stalled grant**: the finalizer derivation would refuse
`grant_finalization_target_set_mismatch`, and the twins would find
nothing to close or release. **Option D cannot serve the current
grant at all** without one of:

- **(i) a backfill migration** — an UPDATE parsing each existing
  `op_key` (string surgery over the very table whose pattern access
  is in question) inside a gated deploy. That is a production data
  mutation of the heaviest class this project's gates recognise,
  undertaken to fix a *read* path; or
- **(ii) a lazy fallback** for NULL-column rows — which must locate
  this grant's legacy rows by *some* prefix construction, i.e. it
  reintroduces exactly the problem for exactly the rows that matter
  most.

A generated-column variant moves the same extraction into the schema
and adds its own fragility (the grant id contains `:` separators;
extracting it from `op:<grant>:<occurrence>` requires splitting at
the **last** colon, for which SQLite has no direct function).

**Verdict:** rejected for this recovery. (As long-term hardening in
some other season it is unobjectionable; it does nothing for the
grant this recovery exists to finalize.)

---

## 7. Option E — keep-LIKE variants (baseline)

The pattern is already minimal: **51 characters** for the stalled
grant, one trailing `%`, no `_`, bound as a parameter. SQLite's
documented `SQLITE_MAX_LIKE_PATTERN_LENGTH` is 50,000 — three orders
of magnitude above this pattern. Against that:

- **Escaping** (`ESCAPE` clause) matters only if the variable part
  contained `%`/`_` — it contains `:` and lowercase hex. There is
  nothing to escape that changes the pattern's meaning or cost.
- **`PRAGMA case_sensitive_like`** changes matching semantics, not
  pattern-complexity accounting.
- **Pattern splitting** (a shorter LIKE plus post-filtering) still
  executes a LIKE.
- **Shortening** is impossible: the prefix *is* the namespace.

Every E variant keeps the construction family that production has
now rejected five times with a byte-identical message (four recorded
lease deaths + the Gate 3 E3 preview 500). **E does not answer the
failure; it re-rolls it.** Its honest role in this analysis is the
baseline — and the implicit choice if Rowan or Julie judge the
construction family is not the problem (see §10: that judgement
cannot be proven either way from available evidence).

---

## 8. Scope: which sites to change — impact on the coordinator twins

The four `op:` sites (L1–L4) share one construction and one helper
shape. L5 is the same construction over a different table. The scope
question is separable from the option question:

### 8.1 Fix L1 only (finalizer module)

Smallest possible diff: one module that has never executed its
action in production; `coordinator.mjs` untouched. The finalizer
path becomes pattern-free. **What remains:** L2, L3, L4 keep the
construction that has already thrown in production four times.

- **L3 is on the normal closure path.** Every future executor report
  runs it inside the report transaction. If the production engine
  rejects the pattern there, the report application rolls back
  wholesale and the grant stays `issued` — the same *shape* as the
  Phase A stall (whose micro-cause is unproven; L3's family is a
  candidate member, stated as such, not as the proven cause).
- **L4's throws are contained but never harmless.** `alarm()` catches
  them, so nothing crashes — instead the lease row backs off, dies
  after 8 attempts, and writes another `schedule_dead` conflict row,
  while the grant's occurrences stay `granted` forever (the
  `lease_expired` events after the LIKE never run). Operationally:
  every future lost-report grant accretes one more conflict row,
  which churns the exact-match census baseline every future gate
  depends on, and leaves occurrences that can never lease-expire
  cleanly.
- **L2's throws** land on the void paths (lease pre-delivery,
  handoff verdict): the schedule row dies the same way before the
  void completes — reservations unreleased, occurrences undeferred,
  one more conflict row.

### 8.2 Fix L1–L4 (the `op:` family, one shared helper)

Removes the construction family from every path that has actually
thrown in production, plus the finalizer. Diff: three predicate
swaps in `coordinator.mjs`, one in `grant-finalizer.mjs`, one shared
helper. **Regression surface, stated honestly:** `coordinator.mjs`
is the live heart of the system — report closure, lease expiry, and
dispatch voiding are exercised by every future grant. The mitigation
is that the change is a pure predicate swap with provably identical
row sets (§9 fixtures), no control-flow change, no schema change,
no change to any write.

### 8.3 Fix all five (add L5)

L5's throw would land inside `handleReport`'s transaction in the
repair branch — after the grant has been marked `reported` in that
same transaction, so a throw rolls back the closure itself. Its
marginal cost over §8.2 is one more predicate swap using the
identical range construction over the `jobs` PK. Deferring it
leaves exactly one LIKE in the tree, on a path that runs only for
repair jobs with follow-ons.

**Scope recommendation:** all five in one change (§11). If Rowan
prefers staging, L1–L4 is the acceptable core and L5 a named,
tracked remainder — but there is no technical reason to stage: the
proof burden (§9) is identical per site and L5's is the smallest.

---

## 9. Regression tests — what can and cannot be proven locally

**The harness limitation, plainly:** the local DO test harness's
SQLite **accepts** the exact LIKE construction production rejects —
the Gate 2 battery ran the §4.3.5 query green, including on
production-shaped fixtures, and production returned the 500. No
local test can reproduce the failure, and no local test can prove a
replacement "works" against the production engine's quirk. Tests
can prove **semantic equivalence** and nothing more. Production
proof of any fix exists only at the separately gated deploy + a
Gate 3 retry preview.

What CAN be built and run locally:

1. **Semantic-equivalence fixtures (new suite).** For each site,
   insert an adversarial key set into a scratch store, run the old
   LIKE query and the replacement side by side, and assert the
   returned row sets are byte-identical (same keys; same order
   where the original query orders). The set must include:
   - the stalled grant's exact shape — eight
     `op:grant:plan:e377a5559961b294154276b6:ch2:1:full:<uuid>` rows;
   - prefix-sibling grants: ids differing in exactly one hex char;
     an id that is a strict textual prefix of another **with and
     without** the `:` terminator catching the boundary; a sibling
     whose segment reads `full2` against `full`;
   - keys with `%` and `_` in the suffix, and in a hypothetical id
     component — here the assertion is against the **intended**
     (byte-prefix) set, stated openly: on these inputs LIKE and the
     intended set diverge *by design of the fix* (LIKE over-matches),
     and the fixture asserts the intended set. On every
     writer-producible key the two coincide, and the fixture asserts
     that too;
   - case-variant keys (uppercase hex sibling) — same intended-set
     assertion;
   - the empty-suffix key (`op:<gid>:` exactly);
   - interleaved `rel:op:…` release rows and other kinds — the
     `kind = 'attempt'` predicate must still exclude them;
   - non-ASCII bytes in a suffix;
   - for L5: `plan:X`, `plan:X:follow:1`, `plan:X:follow:2`,
     `plan:X:follow:10` (count = 3 under both constructions) and a
     sibling `plan:XY:follow:1` that must not count for `plan:X`.
2. **Production-shaped finalizer fixtures.** The existing finalizer
   suites already carry the stalled-cohort fixture (Fixture S, per
   Gate 2 Amendment 1). Requirement: on every existing finalizer
   fixture, the derivation's classification **and precondition
   digest** are byte-identical before and after the swap. Digest
   equality across the whole fixture set is the strongest local
   evidence obtainable.
3. **Existing coordinator suites** covering report closure
   (unreported occurrence returns to pending), lease delivered-branch
   expiry, and dispatch voiding (release-exactly-once) must pass
   unchanged — these exercise L2/L3/L4 consumption, not just the
   predicate.
4. **Full battery on the exact changed tree.** Baseline for this
   lineage, verified from the build records (`finalizer-build/
   AMENDMENT-1.md`): **1,178 tests / 1,156 pass / 22 fail**, the 22
   being a known, verbatim-identical failing-file set. The bar for
   any change: the identical 22, no new failures, finalizer suites
   green, and **one complete run's full log + exit code** captured
   on the final tree before anything is called green.

**Evidence ceiling, stated for the record:** items 1–4 are
source-level equivalence evidence. The affirmative argument for the
replacement is not "the harness proves it" — it is that
range/equality predicates on indexed text keys are the constructions
this same codebase already runs against the production engine
everywhere else (every `WHERE op_key = ?` read, every census read
that returned 200 at Gate 3 E0 and throughout Stage 1), while the
LIKE family is the only construction with recorded production
rejections. That is an argument from production evidence about
construction families, not a harness result.

---

## 10. Rollback, per option

Standing floor law (unchanged by anything here): build
`6a73d962…` is the minimum that may ever run against this data; any
rollback is separately Julie-authorized, with halted/paused
pre-holds and post-rollback read-back. The finalizer build
(`408f9149…`, current live) added the lazily created audit table
`d6_grant_finalizations`; once a finalizer audit row exists, rolling
back below the finalizer build while that record exists requires
the same compatibility care as the standing settlement-era rollback
floor — no option below changes that either way.

| Option | Schema impact | Rollback shape | Stalled grant under rollback |
|--------|---------------|----------------|------------------------------|
| A (enumeration) | none | build-for-build redeploy of a prior build (≥ floor) | Unaffected: the change is read-path only; grant stays `issued`, reservations open, exactly as today |
| B (range scan) | none | build-for-build, same as A | Unaffected, same as A |
| C (substr/instr) | none | build-for-build, same as A | Unaffected, same as A |
| D (derived column) | **additive column** (+ backfill or fallback) | Asymmetric: old builds ignore an additive column, but a performed **backfill is a data mutation a code rollback does not undo** (and semantically need not — values are derivable facts); new rows written under D carry a column pre-D builds never read | If rolled back mid-recovery the grant is untouched, but any backfill already applied persists — a permanent data change made in service of a read path |
| E (keep LIKE) | none | n/a (no change) | n/a |

For A/B/C the mid-recovery point deserves one explicit sentence:
the fix touches **reads only** — every candidate query is a SELECT.
If a fix build were deployed, a finalization executed, and the build
then rolled back, the finalization is committed bookkeeping (grant
`reported`, reservations closed `grant_settled`, audit row written)
and a code rollback does not and cannot un-finalize it; the rolled-
back build simply reads the same tables it always read.

---

## 11. Recommendation

**Option B — prefix RANGE scan — applied to all five sites through
one shared helper**, for these reasons, in order:

1. **Zero semantic narrowing.** B is the only option that preserves
   DISCOVERY semantics at every site. Option A's enumeration
   converts three independent cross-checks into partially circular
   verifications and needs a writer-invariant argument; B needs no
   argument about what writers can produce — it returns whatever is
   there, exactly as LIKE was meant to.
2. **Provably the intended set on every input** — byte-identical to
   LIKE's set on every writer-producible key, and strictly tighter
   (never looser) exactly where LIKE's pattern semantics over-reach
   (metacharacters in interpolated ids, ASCII case-insensitivity).
3. **It serves the stalled grant as-is.** No schema change, no
   backfill, no fallback — the eight existing attempt rows are found
   by the same namespace logic that wrote them. (This is where
   Option D fails outright.)
4. **Smallest reviewable diff per site:** a predicate swap plus one
   bound parameter, behind one helper, with one equivalence suite
   (§9.1) carrying the proof burden for all five sites at once.
5. **Index-served by the existing primary keys** — no function-
   wrapped column (Option C's scan), no optimizer-dependent LIKE
   prefix optimisation.
6. **Rollback is build-for-build** with no schema or data residue
   (§10).

## 12. Residual uncertainty — what this analysis does not claim

- **H1 remains a supported hypothesis, not a proven root cause.** The
  total evidence is: four recorded production deaths with the
  byte-identical message on L2/L4-family constructions, and one
  HTTP 500 with the identical message on the preview call whose only
  pattern query is L1. *Why* the production engine rejects a 51-char
  single-`%` pattern — when the documented pattern-length limit is
  50,000 — is unknown. State-dependence and intermittency are not
  excluded; the diagnosis's null hypothesis (the throw occurred
  outside the derivation entirely) is not excluded either.
- **Every option here is construction-family REMOVAL, not a proven
  root-cause fix.** If the true cause sits elsewhere in the request
  path, a pattern-free build could still return 500 at a Gate 3
  retry preview — and the retry's STOP law would catch exactly that,
  with the system held and nothing spent, which is the designed
  failure shape.
- **A repeat preview merely to reproduce the error is not proposed**
  — Rowan has ruled against it (6559766643), and this analysis does
  not need it: the first live proof of any replacement construction
  is the preview call inside a future, separately gated Gate 3
  attempt.

**What a subsequent code-change proposal + Gate 3 retry still
needs** (none of it authorized by this analysis): Rowan's review of
this document → a separate code-change proposal (build + §9 battery
+ envelope) → Rowan source review → Julie's halted-deploy GO →
re-arm decision → a fresh Gate 3 proposal whose census exact-matches
the four-row conflict baseline (or a Rowan-ruled replacement
baseline if the set has changed) → Julie's Gate 3 GO. Gates stay
separate and named; no step in that chain is pre-authorized by any
earlier one.

— Wren
