# GATE-8 FOLLOW-UP — RELIABILITY DIAGNOSIS (DRAFT, repo-only)

**Status: DRAFT for Rowan's review. Investigation only — no code
changed, no production call made, nothing posted or pinned.**
Scope: the Gate-8 fresh Chapter 2 run of 2026-10-31
(plan `plan:b2dc2a3d1cd367a0245b9102`, live build
`6a73d9622e1b4eac00c58e289de1c674ed6b3d6b`), whose execution
record Rowan passed (issue #15 comment 6544061295) as a RECORD
PASS but not a clean first-pass pass: 18/18 first-pass
executions failed (8 × stage `flush` /
`winner_digest_mismatch`; 10 × stage `commit` /
`object_missing`), then 18 further executions committed with
zero new attempts.

Every conclusion is labeled **CONFIRMED** (source line or
capture cited), **INFERRED** (reasoning shown), or
**UNRESOLVED** (missing evidence named, with how to get it).
No book segment text is quoted anywhere; structural metadata,
digests, counts, and durations only.

Sources: `~/workspace/ch2-program/fresh-ch2/EXECUTION-RECORD.md`;
raw captures under `~/workspace/ch2-program/fresh-ch2/execution/`
(chiefly `e4/diag-fresh-final.json`, which embeds all 36
execution records and all 79 attempt rows, and
`e4/diag-fresh-final.json.per-exec.json`); deployed-build
source in `~/workspace/ch2-program/disposition/worker-build/`
(the build-`6a73d962` tree). Line numbers below are from that
tree.

---

## 0. The headline correction to the record's own framing

**CONFIRMED** — There was no second synthesis pass. All 79
provider attempts (22 `policy_block` @ 0 + 57 `success`) and
the entire recorded cost of 379,674 micro-cents sit on the 18
first-pass executions. The 18 `committed` executions recorded
**0 attempts and 0 cost each**, share the first-pass
executions' cacheKeys exactly, and completed in a 13-second
burst (04:10:44–04:10:57Z) immediately after the first pass
ended (04:10:44Z) — roughly 0.7 s per occurrence, against
25–45 s per first-pass execution.
Evidence: `e4/diag-fresh-final.json` (per-execution
createdAt/updatedAt, attempts arrays, cacheKeys);
`e4/diag-fresh-final.json.per-exec.json` (failed executions
carry all 79 attempts / 379,674; committed carry 0 / 0).

**CONFIRMED** — The committed executions are the executor's
intent-recovery path, not re-synthesis: in
`worker/generation/d6-executor.mjs` `runFresh`, when
`acquireSpendIntent` returns an existing intent whose outcome
is already `success` (the first pass notes `d6_synthesized`
success *before* flush), the executor re-commits from the
durable R2 object via `primeDigest` → `verifyAndCommit` with
**no provider call**. `verifyAndCommit` itself never
synthesizes (executor header + `verifyAndCommit` /
`recover()` bodies). The re-drive arrived as a fresh executor
invocation for the same job (committed executions carry the
same jobId `plan:…:ch1`, new execution ids — consistent with
the service re-driving the job after the first message's
report; the coordinator's repair follow-on path,
`worker/coordinator.mjs` L2083–2108, would have minted a
`:follow:N` jobId, which the captures do not show).

**Consequence for the record:** the execution record's
sentence attributing the +25,948 over expected to "the
confirmed recorded cost of the superseded first-pass attempts"
is not accurate — see §6 for the full attribution. Nothing
was superseded-and-replaced by a second synthesis; and the
real waste in the run is a different quantity (§3).

---

## 1. Failure signature A — stage `flush`, `winner_digest_mismatch` (8 executions)

### 1.1 What the code does

**CONFIRMED** — `worker/generation/flush-store.mjs`
`flushAndVerify` (L89–121): the synthesized bytes are PUT to
`audio/<cacheKey>.wav` with the conditional
`onlyIf: { etagDoesNotMatch: "*" }` (create-if-absent, never
retried unconditionally). If the PUT returns null (key already
occupied), the winner's bytes are re-read and adopted **only**
if their SHA-256 equals the synthesized bytes' SHA-256;
otherwise it throws `FlushError("flush",
"winner_digest_mismatch")` (L114), which `runFresh` records
via `failExecution(executionId, "flush", { code, objectKey })`.

**CONFIRMED** — The cacheKey is a pure fingerprint of the
request, not of the audio: `fingerprintFor(payload)` =
SHA-256(text + JSON{provider, voice, model, rate: 1, style})
(`worker/executor.mjs` L36–45). Two syntheses of the same
occurrence under the same voice configuration therefore
target the **same** R2 key, while Gemini TTS output bytes are
not deterministic across calls.

### 1.2 What happened in the run

**CONFIRMED** — For each of the 8 flush-group occurrences, an
object already existed at the fingerprint key before the
first-pass PUT, and its bytes differ from the bytes
synthesized on 2026-10-31. Discriminator (durations derived
without quoting any content): a success attempt's recorded
cost is `round(durationSec × 225)`
(`worker/generation/gen-constants.mjs`, `knownCostMicro`), so
Σ success-attempt cost / 225 reconstructs the synthesized
audio duration; the bound object's duration is
(sizeBytes − 44) / 48,000 (WAV PCM 16-bit mono 24 kHz format
pin, gen-constants). For the 8 flush-group occurrences the
bound-object duration differs from the 2026-10-31 synthesized
duration by 1–13% (ratios 0.87–1.08) — a *different synthesis
of the same fingerprint payload*. For all 10 commit-group
occurrences the ratio is exactly 1.00 (§2).
Data: `e4/diag-fresh-final.json` attempt rows + committed
executions' sizeBytes.

**CONFIRMED** — The audio now bound for the 8 flush-group
occurrences is therefore the **pre-existing winner object's
audio**, adopted by the intent-recovery commit
(`primeDigest(cacheKey)` returns whatever object is at the
key; `verifyAndCommit` commits with the primed SHA-256). The
2026-10-31 synthesized bytes for these 8 were never written
(conditional PUT lost) and were discarded. The winner is
content-equivalent *by construction of the key* (same text,
voice, model, style fingerprint) but is not byte-identical
and was not synthesized under this plan's grants.

**UNRESOLVED** — Which writer, and when, placed the 8 winner
objects. What the local evidence establishes:
- The 8 keys do **not** appear in the P8 migration census
  audio inventory (`~/workspace/opal-reader-p8-data/audio-results.jsonl`,
  `listings.json` — zero hits for all 18 of the run's keys),
  so the objects most likely post-date the census
  (2026-10-27) — with the caveat that the census inventory is
  keyed to known/recorded objects and may not enumerate true
  orphans.
- The only Chapter 2 generation activity between the census
  and this run was the 2026-10-29 D6 follow-on run (the
  retired plan). Its job would have granted occurrences in
  the same `ORDER BY occurrence_id` order the 2026-10-31 grant
  used (`worker/coordinator.mjs`, `_issueGrant`), and the
  flush group is exactly the first 8 occurrences in that
  order, with the 9th (the adjudicated unknown-billing
  occurrence) leading the commit group. That ordering
  coincidence is suggestive — but the 2026-10-29 diagnosis
  classified its 8 failures at the synthesis stage, and in
  the D6 executor a synthesis-stage failure cannot reach
  flush, so the follow-on run is **not** a clean explanation
  either.
- How to settle it: a read-only R2 HEAD on the 8 object keys
  returns `customMetadata` (sha256, identity,
  duration_seconds) and the object's upload timestamp; the
  timestamp alone discriminates 2026-10-29 vs any earlier
  writer. That is a production read — not performed here,
  listed for Rowan/Julie as a gated evidence step. (The
  bound bindings in `e4/snapshot-bindings-after.json` already
  carry the winner SHA-256s and sizes if a comparison target
  is needed.)

### 1.3 Assessment

**INFERRED** — Signature A is the designed fail-closed
outcome of a dirty key namespace: unbound legacy objects from
an earlier synthesis era share fingerprint keys with fresh
work. The safety properties all held (no overwrite, no
double-bind, no unknown billing); the cost is efficiency —
one full synthesis per affected occurrence produced discarded
bytes (§3).

---

## 2. Failure signature B — stage `commit`, `object_missing` (10 executions)

### 2.1 The mechanism — a poisoned negative cache entry

**CONFIRMED (code path)** — Four source facts chain together:

1. The coordinator's R2 cache is a **request-scoped snapshot**
   that "starts empty per request" — `createR2AudioCache` is
   constructed fresh by `_cache()` on every Durable Object
   invocation (`v2/worker-entry.js` L167–196).
2. `hydrateKey(key)` short-circuits on a cached entry —
   `if (snapshot.has(key)) return snapshot.get(key)` — and a
   miss is **cached as null**: after trying both extensions
   and finding nothing, it executes `snapshot.set(key, null)`
   (`worker/host/adapters.mjs` L518–538).
3. Before synthesis, the work source **primes** the
   occurrence's fingerprint key: `createD6WorkSource` calls
   `await cache.prime(payload)` on every `ok` payload
   (`worker/generation/d6-work-source.mjs` L116), and
   `prime` is exactly `hydrateKey(fingerprintFor(payload))`
   (adapters.mjs L735–739). For a never-generated occurrence
   the object does not exist yet, so priming caches a null
   miss for precisely the key the execution is about to
   create.
4. After `flushAndVerify` succeeds (it talks to R2 directly
   and never touches the snapshot), the executor calls
   `hydrateProbeKey(cacheKey)` and then
   `store.commitVerified` (`worker/generation/d6-executor.mjs`,
   `runFresh` flush/commit section; `hydrateProbeKey`
   L291–299). `commitVerified`
   (`worker/generation/genstore.mjs` L226–262) calls
   `coord.validateAndBind`, whose first check is
   `if (!probe || !probe.exists(cacheKey)) return { bound:
   false, reason: "object_missing" }`
   (`worker/coordinator.mjs` L2128–2129). `probe.exists` is
   `snapshot.has(key) && snapshot.get(key) !== null` — the
   primed null makes it false no matter what R2 now holds.
   `commitVerified` throws with `.reason = "object_missing"`,
   and `runFresh` records `failExecution(executionId,
   "commit", { reason: "object_missing", objectKey })`.

**CONFIRMED (fit to captures)** — Every commit-group
execution recorded a `sizeBytes` (i.e., it had passed flush
and verify and reached `verified` state) before failing at
commit, and its bound object's duration equals its own
synthesized duration exactly (ratio 1.00, §1.2 method) — the
object was in R2 the whole time; only the probe could not
see it. Data: `e4/diag-fresh-final.json`.

**INFERRED** — In a single executor invocation, a fresh
occurrence whose object does not already exist **cannot**
commit: priming guarantees the null entry before synthesis
begins. The only first-pass commit an invocation can ever
produce is for a pre-existing object with byte-identical
content (flush adopts it; the probe entry primed from R2 is
real). This defect — not provider behavior, not R2
consistency — is why the first-pass failure rate was 18/18
rather than occasional. (Consistency check, INFERRED: the
2026-10-29 G10 smoke's single segment shows one attempt and a
committed result; under this diagnosis its commit must also
have landed on a later invocation via intent recovery, which
adds an execution but no attempts — indistinguishable in the
smoke's reporting.)

### 2.2 Why the repaired commit succeeded

**CONFIRMED (code path) + INFERRED (attribution)** — The
committing executions ran in a **later invocation with a
fresh snapshot**. In that invocation, priming the same key
performed a real bucket GET and found the object (written by
the first pass for the commit group; the pre-existing winner
for the flush group), caching a real entry. The
intent-recovery branch then ran `primeDigest` →
`verifyAndCommit`: `headVerify` (existence + size/etag) and
the prime-digest comparison passed against R2 directly, and
`validateAndBind`'s probe found the real snapshot entry, so
`commitVerified` bound, updated `occurrences.cache_key`, and
transitioned the execution to `committed` — with zero
provider attempts, exactly as captured (§0).

---

## 3. Repeat provider-call / cost risk, and the real waste figure

**CONFIRMED** — The failure wave did **not** double provider
spend. Total provider attempts for the chapter: 79, all in
the first pass. Recovery/intent-recovery commits make no
provider calls by construction (executor source, §0). If the
§2 defect persists at book scale, the expected pattern per
fresh occurrence is: one synthesis pass (with its split
tree), a first-pass commit failure, and a zero-call recovery
commit — provider cost ≈ 1× the synthesis cost per
occurrence, **not** 2×.

**CONFIRMED** — The genuinely wasted spend is narrower and
different: for the 8 flush-group occurrences, the entire
first-pass synthesis produced bytes that were discarded
(the bound audio is the prior winner's). Σ recorded cost of
the 8 flush-group executions = **167,922 micro-cents
(≈ $0.168)**. That is the run's true defect-attributable
waste — subject to one judgment call for Rowan: the winner
audio is content-equivalent by fingerprint, so the chapter
lost money, not correctness.

**INFERRED** — Residual repeat-call risk at book scale is
concentrated in the flush signature: every remaining
occurrence that has a pre-existing unbound object at its
fingerprint key will burn one discarded synthesis. How many
such keys exist among Forever Pucked's remaining 314
eligible occurrences is **UNRESOLVED** from local evidence
(the census inventory does not enumerate them; see §1.2).
It is quantifiable before any book run by a read-only
comparison of the remaining occurrences' fingerprint keys
against an R2 listing — a gated production read, proposed
in §7.

## 4. Storage-orphan risk

**CONFIRMED** — This run created no orphans. The flush
losers wrote nothing (conditional PUT). Σ committed
sizeBytes = 80,275,992 B, exactly the execution record's
"new audio total" — every byte written or adopted is now
bound (18 bindings, watermark 1800 → 1818).

**INFERRED** — The standing orphan risk is the pre-existing
one, unchanged: an execution that flushes an object and then
fails terminally for a non-commit reason leaves an unbound
object at its fingerprint key (the class of the 193
preserved orphans from the migration census). The storage
guard's ×1.10 retries/orphans allowance
(`gen-constants.mjs`, `RETRIES_ORPHANS_ALLOWANCE`) is the
designed bound. Signature A is, in effect, that historical
orphan population taxing a later run — the orphans were
adopted and bound here, so this run *reduced* the unbound
population by 8.

## 5. The 10-micro-cent reconciliation — RESOLVED

**CONFIRMED** — Two different estimators, one rounding step
apart:

- The eligibility quote's expected cost is the per-occurrence
  sum: `expectedCostMicroCents = Σ round(chars_i / 15.96 ×
  225)` = **353,726** for the 18 eligible occurrences
  (recomputed from the charCounts in
  `execution/e2/plan-fresh.json`; matches
  `execution/e0/quote-ch2.json` exactly). Formula:
  `gen-constants.mjs` `expectedCostMicro`.
- The quota view's `spentMicroCents` is the **grant ledger**:
  `_issueGrant` inserts one `ledger_ops` row of kind
  `attempt` per granted occurrence at the job's flat
  `estMicroCents` (`worker/coordinator.mjs` L1671–1693;
  quota view at L2659–2664 reads `_spendIn` over those rows).
  The job's flat estimate is set by the service as
  `Math.ceil(average of expectedCostMicro over the job's
  entries)` (`worker/generation/service.mjs` L141–155):
  ceil(353,726 / 18) = ceil(19,651.44…) = **19,652** per
  occurrence × 18 grants = **353,736**.
- Difference: 353,736 − 353,726 = **10**, exactly the
  accumulated ceil-of-the-average rounding (0.555… × 18).
  The genstore itself notes the distinction:
  `genstore.mjs` L749, "grant-time flat estimate 19652 NOT
  used" (in phase accounting).

No money discrepancy; the two surfaces answer different
questions (per-occurrence model sum vs flat grant-time
debit).

## 6. What actually enforces the 100/day limit — and the +25,948 attribution

### 6.1 The quota metric

**CONFIRMED** — The Reader-side 100/day limit is enforced on
**grant ledger rows, not provider calls**.
`worker/coordinator.mjs`: `DAILY_QUOTA_LIMIT = 100` (L142);
`_attemptsOn(day)` (L1860–1865) counts `ledger_ops` rows of
kind `attempt` minus `attempt_release` for the PT day key;
`_issueGrant` refuses at `attempts >= 100` and at
`attempts + targets.length > 100` (L1643–1644, L1663). One
ledger row is written per granted **occurrence**. The
genstore attempt log (the 79 provider attempts) is a
different table and never feeds `_attemptsOn`. The quota
view's `attemptsToday: 18` and diagnostics' 79 attempts are
both accurate — of different things.

**INFERRED (risk statement)** — The enforcement gap is
structural: one granted occurrence may make up to
`SEGMENT_ATTEMPT_BUDGET = 12` provider calls (split tree +
repair chain; gen-constants), and policy-split recursion was
responsible for most of this run's multiplicity (57 success
attempts for 18 occurrences). 100 granted occurrences in a
day could therefore mean up to ~1,200 provider calls against
Google's own Tier-1 100-requests/day quota, which the
Reader-side counter cannot see. The only in-system backstop
is the provider's own 429, which the executor classifies as
`quotaExceeded` → plan parks on quota (d6-executor
quota branch). In this run no 429 occurred. Whether to close
the gap (e.g., count genstore attempts per PT day in the
grant guard) is a design decision for Rowan/Julie — flagged,
not assumed (§7).

### 6.2 Attribution of the +25,948 (379,674 recorded vs 353,726 modeled)

**CONFIRMED** — Full per-occurrence attribution is
computable from the captures (recorded cost from
`e4/diag-fresh-final.json` attempt rows; expected from
`round(chars/15.96×225)` on `e2/plan-fresh.json` charCounts).
All 18 deltas sum to exactly +25,948. Per occurrence
(occ = occurrenceId prefix; grp F = flush, C = commit;
succ/PB = success / policy_block attempts):

| occ | grp | chars | expected | recorded | delta | succ | PB |
|---|---|---|---|---|---|---|---|
| 4f35bc00 | F | 1,475 | 20,794 | 25,767 | +4,973 | 2 | 0 |
| b42a64ab | C | 1,341 | 18,905 | 23,679 | +4,774 | 4 | 2 |
| be263419 | C | 1,493 | 21,048 | 24,291 | +3,243 | 4 | 2 |
| 3095422d | F | 1,413 | 19,920 | 22,743 | +2,823 | 4 | 2 |
| abae8a3e | C | 1,437 | 20,258 | 22,257 | +1,999 | 4 | 2 |
| de0436f4 | C | 1,456 | 20,526 | 22,176 | +1,650 | 4 | 2 |
| 84ff25f0 | C | 1,184 | 16,692 | 18,279 | +1,587 | 2 | 1 |
| c4475eda | C | 1,498 | 21,118 | 22,491 | +1,373 | 3 | 1 |
| 26a37980 | F | 1,352 | 19,060 | 20,151 | +1,091 | 3 | 1 |
| 6b7ea94c | C | 1,352 | 19,060 | 19,998 | +938 | 3 | 1 |
| 67d4b319 | C | 1,367 | 19,272 | 20,142 | +870 | 4 | 2 |
| 3929c8a1 | F | 1,367 | 19,272 | 19,890 | +618 | 3 | 1 |
| 59acff00 | C | 1,349 | 19,018 | 19,620 | +602 | 4 | 2 |
| 0343a3a1 | F | 1,389 | 19,582 | 19,872 | +290 | 3 | 1 |
| 4b2b3699 | F | 1,448 | 20,414 | 20,511 | +97 | 3 | 1 |
| 117ef377 | F | 1,294 | 18,242 | 18,279 | +37 | 2 | 0 |
| 2997a9b4 | F | 1,477 | 20,822 | 20,709 | −113 | 2 | 0 |
| bfabaa59 | C | 1,399 | 19,723 | 18,819 | −904 | 3 | 1 |
| **total** | | **25,091** | **353,726** | **379,674** | **+25,948** | **57** | **22** |

**CONFIRMED (decomposition)** — The delta is what the model
cannot express, in two parts: (i) **split-tree multiplicity**
— the quote prices exactly one call per occurrence at the
measured 15.96 chars/sec rate, but POLICY_BLOCK recursion
synthesized most occurrences as multiple leaf calls (up to 4
success attempts), each billed on its own realized duration;
(ii) **rate variance** — realized durations run slightly
slower than the 15.96 chars/sec model for most occurrences
(and faster for two, hence the negative deltas). It is
**not** the cost of superseded attempts: no attempt was
superseded by a re-synthesis, the committed executions made
no attempts, and for the commit group the very audio paid
for in the first pass is the audio now bound (duration ratio
1.00). What *is* defect-attributable waste is the separate
167,922 flush-group figure in §3, which the +25,948 does not
measure.

## 7. Proposed remediation / operational disposition

### 7.1 Signature B (commit `object_missing`) — code fix proposed, narrowly testable

**Proposed (for Rowan's review; nothing built):** stop the
negative cache entry from outliving the moment it was taken.
Narrowest candidate: in `createR2AudioCache.hydrateKey`
(adapters.mjs), do not memoize misses — return null without
`snapshot.set(key, null)`. The commit path's
`hydrateProbeKey` then performs a real bucket read for
just-flushed keys, while keys primed from existing objects
still hit the cache. Blast radius to be reviewed: miss
memoization may be load-bearing for read-heavy surfaces
(byteCheck / migration prime call hydrateKey repeatedly);
the alternative candidates are (a) an explicit
force-refresh in the executor's `hydrateProbeKey`, or (b)
the work source not priming keys the plan has already
classified as unbound/eligible. Test that decides it
(repo-only, existing harness shapes —
`tests/d6-executor-fi.test.mjs`,
`tests/coordinator-bindings.test.mjs`): prime a key before
its object exists → synthesize → flushAndVerify → commit in
**one** invocation must end `bound: true`; and the
pre-existing-object adoption case must still commit
first-pass. Both scenarios are expressible against the
in-memory bucket doubles already used by those suites
(DO-harness caveat applies: harness-green is not proof for
empty-result paths — a staging smoke would be the real
proof, and is a separate gate).

### 7.2 Signature A (flush `winner_digest_mismatch`) — documented operational reason, plus one optional pre-flight

**Proposed disposition:** no code change required for
correctness. The fail-closed design did exactly its job —
no overwrite, adoption only on digest equality, recovery
bound the winner, zero unknown billing. The defect is
economic, bounded at one discarded synthesis per affected
occurrence, and self-clearing (once bound, eligibility
excludes the occurrence permanently). **Optional,
separately gated improvement** (behavior change, needs
Julie's approval, not a bug fix): a pre-synthesis
`primeDigest` adoption check in the intent-recovery style,
so an occurrence with an existing fingerprint object adopts
it with zero provider calls instead of synthesizing first
and losing the race. Trade-off Rowan should rule on: that
audio was paid for under an earlier era's authorization,
not this plan's — adopting it is already what recovery does
today, only later and after redundant spend.
**Pre-flight evidence (recommended before any book-scope
proposal):** a read-only fingerprint-key × R2-listing
comparison for the remaining 314 eligible occurrences, to
size the discarded-synthesis exposure before Julie is asked
to price a book run. Gated production read; not performed
here.

### 7.3 Quota metric — documentation, and a decision item

The 100/day enforcement is a **grant** counter (§6.1). If
that is the intended semantics (it matches the D6 proposal's
grant-time estimate discipline), the only change needed is
documentary: surfaces should stop presenting `attemptsToday`
and provider attempts side by side without naming which is
which. If Rowan/Julie intend the provider's 100/day to be
the enforced quantity, that is a design change (a per-PT-day
genstore attempt count consulted by the grant guard), to be
proposed separately — not folded into the §7.1 fix.

## 8. What Rowan needs to review, and open questions

For Rowan's review of this draft:
1. The §2.1 mechanism (primed null miss → `object_missing`)
   and the §7.1 fix candidates — is non-memoization of
   misses safe for the migration/byteCheck read paths, or is
   the executor-side force-refresh the right layer?
2. The §1.2/§3 reframing: bound audio for 8 occurrences is a
   prior synthesis adopted by recovery; wasted spend is
   167,922, and the +25,948 is split-tree multiplicity +
   rate variance — does she accept the duration-ratio
   evidence as sufficient for that attribution?
3. The §7.2 disposition of signature A (no correctness fix;
   optional pre-synthesis adoption as a separate gated
   behavior change).
4. The §6.1 quota semantics: grant counter by design, or
   provider-call enforcement as a new design item?

Genuinely blocking question (one): the §1.2 winner-object
provenance cannot be closed from local evidence. If Rowan
requires it closed before any further generation proposal,
the settling evidence is a read-only R2 HEAD/listing over
the 8 keys (upload timestamps) — a gated production read
that needs Julie's authorization. Everything else in this
diagnosis stands on repo source + the run's own captures.

— Wren (draft, unposted)
