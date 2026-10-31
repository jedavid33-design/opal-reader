# BUILD REPORT — D6 Reliability Remediation (repo-only)

**Scope:** the Signature B fix from the Gate-8 reliability
diagnosis (passed by Rowan, issue #15 comment 6544587753;
Julie's repo-only build approval, comment 6544638937).
**This package is a local build only: no production calls were
made, nothing was deployed, nothing was posted or pinned, and
no generation was run.** Signature A
(`winner_digest_mismatch`) is untouched and stays fail-closed
by design. The quota redesign is a separate design document
(`../QUOTA-PROPOSAL.md`), with no code in this package.

---

## 1. Base tree identity

- Base: the deployed build **`6a73d9622e1b4eac00c58e289de1c674ed6b3d6b`**
  tree at `~/workspace/ch2-program/disposition/worker-build/`
  (the standing rollback floor). It was **copied, never edited
  in place**, to `~/workspace/ch2-program/remediation/worker-build/`;
  the copy was verified byte-identical to the base (`diff -qr`
  clean) before patching.
- Cross-check: the base copy's `worker/generation/d6-executor.mjs`
  hashes to `68e3f84ed6ee9bd4ac59c4732f72ab1c53661df00798ad7cbe23a9a5a2c881b9`,
  the deployed envelope part hash recorded for build `6a73d962…`.

## 2. The patch — chosen option and rationale

**Chosen: executor-side targeted refresh (invalidate only a
memoized miss, at the commit gate).** The work source primes a
fresh occurrence's key before synthesis and `hydrateKey`
memoizes the miss as snapshot `null`; `flushAndVerify` writes
the object directly to R2 without touching the snapshot; the
executor's `hydrateProbeKey` then called plain `hydrateKey`,
which returns the cached null on sight, so `validateAndBind`'s
probe answered `object_missing` for an object that was durable
the whole time. The patch adds `cache.refreshKey(key)` —
which discards **only** an entry that is exactly `null` and
rehydrates — and makes the executor's commit gate prefer it.
The rehydration mutates the **same snapshot Map that
`cache.probe` closes over** (production wiring:
`worker/worker-entry-prod-d6.js` builds one cache per `_execute`,
hands `cache.probe` to the coordinator via `d6HostEnv`, and the
same cache to the work source and the executor), so the
refreshed entry is itself what `validateAndBind` sees — not an
independent HEAD result; `flushStore.headVerify` and the prime
digest remain separate, unchanged checks.

### Changed files (complete list)

Final-tree `diff -qr` against the base shows **exactly two
physical production files changed** (the `v2/…` paths in the
diff are the same files reached through the tree's `v2 ->
worker` symlink) **plus one new test file**. Everything else is
byte-identical to the base.

| File | Change | SHA-256 base → patched |
|---|---|---|
| `worker/host/adapters.mjs` | Adds `refreshKey(key)` to `createR2AudioCache` (+21 lines incl. comment) and exports it. `hydrateKey` itself is **unchanged** — miss memoization is retained for every other consumer. | `9d07f8db…` → `f8ac357e…` |
| `worker/generation/d6-executor.mjs` | `hydrateProbeKey` prefers `cache.refreshKey` when present, falling back to `cache.hydrateKey` for test doubles (+8/−3 lines, comment included). Both call sites (fresh commit, recovery commit) flow through this one helper. | `68e3f84e…` → `9cc90fe9…` |
| `tests/remediation-cache-refresh.test.mjs` | **New** regression suite (6 tests, §4). | — → `b70ff126…` |

`refreshKey` semantics, exactly:

- snapshot entry is a real object (hydrated or pending
  write-behind) → returned untouched, **zero bucket reads**;
- snapshot entry is exactly `null` (a memoized miss) → the
  entry is deleted and the key is rehydrated from the bucket:
  at most one GET per extension tried (2 for a `.wav` object:
  `.mp3` miss + `.wav` hit);
- key absent from the snapshot → ordinary `hydrateKey`.

## 3. Option comparison — targeted refresh vs global non-memoization

The alternative (the diagnosis §7.1 narrowest candidate) is to
stop memoizing misses in `hydrateKey` altogether: return `null`
without `snapshot.set(key, null)`. It is a smaller diff in one
file, and it would also fix the commit path. It was **not**
chosen, on read-amplification grounds:

| Consumer | Targeted refresh (chosen) | Global non-memoization |
|---|---|---|
| D6 commit gate (the defect site) | ≤ 2 GETs, **only** for a key holding a memoized miss, once per commit attempt | Same ≤ 2 GETs at commit — but paid by *every* repeated miss everywhere, forever |
| `hydrateKeys` (`worker/host/adapters.mjs` L561–564; called by both worker entries to hydrate a job's recorded keys per invocation, e.g. `worker-entry-prod-d6.js` L823) | Unchanged: first pass ≤ 2 GETs/key, repeats 0 (proven in test (e): 24 keys = 48 GETs, repeat = 0) | Every absent key re-costs 2 GETs on **every** call — cost scales with *call count × absent keys*, not key count; jobs whose occurrences are mostly unbound are exactly the read-heavy case |
| `hydrateIndex` (adapters L548–558; loops every `cache_index` row) | Unchanged: memoized misses stay free after the first pass | Any indexed-but-missing object re-costs 2 GETs per index hydration, per invocation |
| `byteCheck` (adapters L689–693; the API surface at `worker/api.mjs` L212, callable repeatedly per request) | Unchanged: an absent key costs 2 GETs **once** per snapshot, then 0 (test (e)) | An absent key costs 2 GETs on **every** `byteCheck` call — an unbounded per-request amplification on a client-reachable surface |
| Migration paths | `primeForMigration` never consulted the snapshot and still doesn't (test (e): direct reads, snapshot unmutated). Migration/coordinator hydration that primes not-yet-imported keys keeps memoized misses | The same paths re-read every not-yet-imported key on every pass — rehearsal/import loops are the most read-heavy code in the tree |
| Work-source prime | Unchanged (one memoized miss per fresh key per invocation — the entry the commit gate now refreshes) | Unchanged at prime; the saving is illusory because the *other* consumers above pay repeatedly |

In short: the defect is local to one sequence
(prime → flush → commit inside one invocation), so the
invalidation is placed exactly there, at a bounded cost of
≤ 2 GETs per affected commit — the same cost a fresh
invocation's prime would have paid — while every other
consumer keeps the memoized-miss economics the G1 correction
established. Global non-memoization fixes the same bug by
making the whole cache's miss behavior more expensive,
indefinitely.

## 4. Regression tests

New suite: `tests/remediation-cache-refresh.test.mjs`
(**6 tests, all passing**). Unlike the older
`d6-executor-fi` suite — whose probe bridges straight to the
bucket and therefore cannot see this defect — this suite wires
executor, work source, and coordinator probe to **one shared
`createR2AudioCache` instance**, the production `_execute`
shape. Synthetic fixture text only; no segment text from any
book appears anywhere in the suite.

| Test | Proves |
|---|---|
| (a) single-invocation first-pass commit | prime → synthesize → flush → commit in ONE invocation ends `committed` with one binding, one provider call; the refreshed entry is visible in the same snapshot `validateAndBind` reads |
| (b) preexisting-winner adoption | a digest-equal pre-existing object is adopted by the conditional-PUT path and commits first-pass; winner bytes untouched |
| (c) different-byte winner | still fails closed: stage `flush`, code `winner_digest_mismatch`, no binding, winner never overwritten (Signature A preserved) |
| (d) fresh-invocation intent recovery | a noted-success spend intent with a durable object commits in a **fresh** invocation/cache with **zero** provider calls and zero attempt-log rows |
| refreshKey unit bounds | only a memoized miss is invalidated (≤ 2 GETs); positive and pending entries cost 0 reads and are never evicted; ordinary consumers keep the memoized miss |
| (e) read-heavy bounds | `hydrateKeys` over 24 keys (12 present / 12 absent) costs exactly the baseline 48 GETs, repeats cost 0; `byteCheck` miss costs 2 GETs once, then 0; `primeForMigration` reads directly (2 GETs/call) and does not mutate the snapshot |

**Regression validity check:** the identical suite was also run
against an unpatched disposable copy of the base tree
(`/tmp`, deleted after): test (a) **fails** there (the defect),
the refreshKey unit test fails (method absent, as expected),
and (b), (c), (d), (e) pass — i.e. the suite discriminates the
bug, and the behavior it pins as unchanged was already true.
Log: `~/workspace/ch2-program/remediation/basecheck-new-suite.log`.

## 5. Full battery — baseline vs patched

Runner: the tree's established per-file pattern
(`node --test --test-timeout=120000` over `tests/*.test.mjs`,
one log per suite), run **once, completely, on the exact final
patched tree**. Runner exit code **0** (recorded in
`logs/battery-exit-code.txt`); the combined log is
`logs/full-battery.log` with per-suite logs in `logs/per-file/`
(130 files), all under `~/workspace/ch2-program/remediation/logs/`.

| | Suites | Tests |
|---|---|---|
| Baseline (unpatched `6a73d962…` tree; `~/workspace/ch2-program/disposition/logs/final/summary.txt`) | 129 files: **107 pass / 22 fail** | 1,041: **1,019 pass / 22 fail** |
| Patched (this package) | 130 files: **108 pass / 22 fail** | 1,047: **1,025 pass / 22 fail** |

- The delta is **exactly** the new suite: +1 suite file,
  +6 tests, all passing. No existing suite changed status.
- The 22 failing suites are **set-identical** to the baseline
  failing set (verified programmatically against
  `disposition/logs/final/failing-files.txt`; no additions, no
  removals): adaptive-background-repair, audio-chunk-playback,
  chapter-quota-banner, continue-preparation-progress,
  continue-setup-recovery, continue-to-quota,
  cross-device-chapter-handoff, dormant-playback-start,
  first-chapter-segment-joining, gemini-400-hydration,
  gemini-batch-lane, gemini-quota-diagnostics,
  generation-manual-queue-reuse, generation-playback-concurrency,
  generation-session-sync-guard, p8-d3-prod-envelope,
  p8-upload-envelope, playback-bookmarks, restore-sound-rewind,
  silent-audio-recovery, split-first-update-stop,
  sync-diagnostics. These are the known pre-existing failures
  (they reference absolute paths in the original build
  workspace); they are **not** introduced or worsened by this
  patch, and no baseline test was edited to absorb them.
- **Zero assertion failures** in the combined log
  (`AssertionError` occurs 0 times), matching the baseline's
  failure character.

## 6. Caveats, stated plainly

- **Harness ≠ production.** These results are DO-harness
  evidence. This tree's harness does implement the throwing
  `.one()` semantics of real DO SQLite (the F1 fix), so the
  historical empty-result blind spot is narrower here than in
  older trees — but harness-green is still not a production
  smoke. A staging/provider-facing verification of this patch
  is a separate, separately authorized gate, exactly as Rowan's
  review states.
- **No production calls were made** by this build: no API
  reads or writes, no R2 access, no provider calls, no queue
  operations. All bucket/provider behavior in tests is the
  tree's own in-memory fakes.
- **No deploy, no merge, no pin, no board post.** The patched
  tree exists only at
  `~/workspace/ch2-program/remediation/worker-build/`. Deploying
  it — like the fingerprint-key occupancy preflight and any
  winner-provenance read — remains a separate decision.
- Winner provenance (diagnosis §1.2) remains **UNRESOLVED**;
  this package neither settles it nor depends on settling it.
- The execution-record correction the diagnosis requires (the
  +25,948 attribution) is carried by the diagnosis addendum
  package (`../DIAGNOSIS-ADDENDUM.md` covers the status line);
  no historical document was rewritten by this build.

— Wren (repo-only remediation build)
