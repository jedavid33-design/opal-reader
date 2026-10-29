# D6 Build — Pins Package (first deliverable)

Produced Oct 29, 2026, under Julie's repo-only D6 BUILD Go. Investigation and
computation only: no code was changed, nothing was deployed, and the only
account access was read-only queries. Every number below carries its source.
Where a number could not be verified against the account or the source tree,
it is marked UNVERIFIED rather than estimated silently.

**Headline result, up front:** the format and queue pins resolve cleanly —
but the storage pin does not. Verified against ACTUAL account usage (Rowan's
build condition), the bucket already holds **9.4828 GB of the 10 GB free
tier (94.8%)**, because 3.7463 GB of legacy v1 whole-chapter audio
(`chapter-audio/`) shares the bucket — data the §12 census estimate never
counted. At the pinned format, **the fail-closed rule permits neither the
Forever Pucked phase nor all-books generation against the bucket as it
stands.** The arithmetic and the decision-shaped options are in §3. Nothing
here disposes of any existing object; any disposition of legacy data is
Julie's separate decision, outside D6's authorization.

---

## 1. V2 worker source of record

**Verdict: ESTABLISHED with confidence.**

- **Path:** `~/workspace/d5-worker-work/` — a git working tree whose `v2/`
  directory is the v2 worker source.
- **Correspondence to the deployed pin:** the tree's git HEAD is exactly
  `1bee2490a35aae971855214b2ce0e6cd43526116` ("D5-A repair: production R2
  namespace fail-closed at audio boundary (A1) + GET/HEAD ETag validator
  integrity (A2) + 405 Allow/gate-order proof (A3)"), the recorded deployment
  pin for `opalreader-api-v2-prod`, and the working tree is **clean** (zero
  modified/untracked paths at inspection time). The deployment artifact's
  etag (`d0bf5fef…`) is a hash of the bundled upload, not of any single
  source file, so the correspondence rests on the commit identity + clean
  tree + the in-tree deploy spec, which is the strongest available chain.
- **In-tree deploy spec:** `v2/p8/deploy-spec-prod.json` names script
  `opalreader-api-v2-prod`, `main_module: v2/worker-entry-prod.js`, bindings
  COORDINATOR (its own DO namespace) + OPALREADER_STORAGE
  (`opalreader-storage`), `GENERATION_HALT = "1"`, no queue producers or
  consumers, no provider secrets — matching the recorded live configuration.
  A read-only `script-settings` query on Oct 29 confirmed observability
  enabled with persisted logs on the live script, as recorded.
- **Module layout** (all under `~/workspace/d5-worker-work/v2/`):
  - `worker-entry-prod.js` — production entry; defines
    `OpalReaderCoordinatorProd` (subclass of the staging coordinator class)
    with the production fences (scope `production`, instance `account`,
    unprefixed R2 namespace enforced fail-closed); default fetch export.
  - `worker-entry.js` — staging entry; defines the base
    `OpalReaderCoordinator` class the production entry subclasses.
  - `coordinator.mjs` (~268 KB) — the coordinator: state plane, commands,
    quota/cap accounting, outbox, settings.
  - `api.mjs` — HTTP API surface.
  - `executor.mjs` — the generation executor (`createExecutor`): per-grant
    `runStandard` / `runBatch` / `pollBatch`, `storeVerifyReport`
    (synthesize → store → verify → report — the kernel the D6 §4
    flush-before-commit design builds on), message handler.
  - `audio-route.mjs` — the authenticated audio-byte route; serves exactly
    `audio/<64-hex>.(mp3|wav)` with content types `audio/mpeg` / `audio/wav`.
  - `client-store.mjs`, `client/*.mjs` — client store + client modules
    (projection, funnel, transport, shelf bridge, surfaces, removals).
  - `host/adapters.mjs` — provider adapters (Gemini standard + batch,
    OpenAI, others) and the R2 cache host: conditional create-if-absent PUT
    (`onlyIf: etagDoesNotMatch: "*"`), content type set from the record's
    format, sha256 + duration in custom metadata, fail-closed on
    indeterminate writes.
  - `host/build-identity.mjs` — build version/commit identity.
  - `migration/*.mjs` — the P8 migration machinery (transform, verify,
    adjudicate, rollback, shelf-outbox import).
  - `p8/` — deploy specs (staging + prod), freeze/migration tooling,
    addenda.

The D6 implementation phase builds in this tree, on this commit.

## 2. Output audio format pin

**What the existing library actually is** (three independent views agree):

- *Source* (`host/adapters.mjs`): each provider adapter declares its output
  format. The **Gemini** adapters (standard, line ~220; batch, line ~363)
  receive raw PCM (`audio/L16;rate=…`) and wrap it with `pcmToWav`
  (defaults: **24,000 Hz, 1 channel, 16 bits/sample**) → format `wav`.
  The OpenAI adapter requests `response_format: "mp3"` → format `mp3`.
  Storage writes `audio/wav` or `audio/mpeg` accordingly. The library's
  format mix is therefore provider history, not a per-book choice.
- *Census* (`~/workspace/opal-reader-p8-data/audio-results.jsonl`, 1,798
  unique bound objects, 5,349,372,909 bytes): **WAV 1,469 objects**,
  4,427,698,138 bytes; **MP3 329 objects**, 921,674,771 bytes. Forever
  Pucked's 50 bound objects are **all WAV**.
- *Live bucket* (§3 listing): under `audio/`, WAV 1,567 objects /
  4,680,105,332 bytes, MP3 418 / 1,009,195,341 bytes (the live counts
  exceed the census by exactly the 193 preserved orphan objects).

**Measured rates** (census bytes ÷ census wav-header/mp3 durations):

| Format | Bytes/sec | MB per audio hour | Chars/sec | Bytes/char |
|---|---|---|---|---|
| WAV (Gemini path) | 48,073.8 | 173.1 | 15.96 | **3,012.6** |
| MP3 (non-Gemini paths) | 15,085.0 | 54.3 | 16.21 | 930.4 |

The WAV byte rate is PCM 24 kHz × 16-bit × mono (48,000 B/s) plus ~0.15%
header overhead — the source defaults are what the library actually
contains. Forever Pucked's own bound objects measure 3,031.0 bytes/char
(48,169.9 B/s), within 0.6% of the library-wide WAV rate.

**PIN — executor output format for D6:** **WAV, PCM 16-bit mono at
24,000 Hz, `.wav`, `audio/wav`** — i.e. exactly the existing Gemini
adapter's native output, unchanged. Justification: (1) it is what the
preserved kernel produces — D6 adds no transcoding machinery; (2) it is
the format of 82% of the library and of every bound Forever Pucked
segment, so Julie's listening has no format seam; (3) the projection
basis is measured, not nominal. Projection rate pinned at **3,012.6
bytes/char (173.1 MB per audio hour)**.

An MP3 alternative was costed and NOT pinned: at 930.4 bytes/char it
would shrink new audio ~3.2×, but it requires a transcode step that does
not exist in the preserved Gemini path, it would make every D6-generated
segment a different format from the bound segments beside it, and — see
§3 — it still does not make all-books fit. It is recorded here only so
the option is visible to Julie and Rowan with its real numbers.

## 3. R2 projection from ACTUAL account usage

**Method.** Two independent read-only views of account
`b35ff435ff24d134ff640e0099dd13fc`, taken Oct 29, 2026, agree
**byte-for-byte**:

1. A full cursor-paginated object listing of bucket `opalreader-storage`
   (the account's **only** bucket — verified via the buckets list, so no
   other bucket's usage counts toward this account's tier):
   **6,199 objects, 9,482,777,460 payload bytes.**
2. Cloudflare's own GraphQL billing dataset (`r2StorageAdaptiveGroups`,
   the GB-month billing view): **objectCount 6,199, payloadSize
   9,482,777,460** — identical. (Plus 279,957 bytes of object metadata,
   negligible but real; totals below use payload, the conservative-but-
   standard basis, and the difference is 0.003%.)

**Unit.** Cloudflare's R2 pricing calculator defines **1 GB =
1,000,000,000 bytes**; the free tier is **10 GB-month = 10,000,000,000
bytes**. All figures here are decimal GB on that basis.

**Where the bytes actually are** (live listing, Oct 29, 2026):

| Prefix | Objects | Bytes | GB | What it is |
|---|---|---|---|---|
| `audio/` | 1,991 | 5,708,040,143 | 5.7080 | The v2 library namespace: 1,798 census-bound objects (5,349,372,909 B) + 193 preserved orphans (358,667,234 B) |
| `chapter-audio/` | 257 | 3,746,296,158 | 3.7463 | **Legacy v1 whole-chapter renders** (last-modified 2026-09-11 → 2026-10-20, the v1 era). Not part of the v2 library; not counted in the §12 census estimate |
| `generation/` | 1,109 | 9,233,831 | 0.0092 | v1 generation payloads/lock |
| `usage/` | 2,834 | 2,984,863 | 0.0030 | v1 usage-event JSON |
| `epubs/` | 7 | 16,222,434 | 0.0162 | Book EPUBs |
| `smoke-p8/` | 1 | 31 | 0.0000 | P8 smoke object |
| **Total** | **6,199** | **9,482,777,460** | **9.4828** | **94.83% of the 10 GB free tier; headroom 517,222,540 B (0.5172 GB)** |

> **Why the §12 estimate missed this:** the census counted only the bound
> v2 library objects (≈5.35 GB). The bucket is shared with the frozen v1
> system's data, and `chapter-audio/` alone is 3.7463 GB. Rowan's build
> condition — verify against actual account usage and billing units — is
> exactly what caught the difference.
>
> **Side finding for the parent:** the standing free-tier watch
> (`~/workspace/ops/free-tier-check.py`) cannot see this. Its R2 check
> requests `limit=1000`, but the objects endpoint caps pages at 20 and
> the script sums only the first page — it currently "sees" ~0.06 GB and
> reports ~0.6% usage, so its 70% alert can never fire. The GraphQL
> billing dataset above is the reliable source. (Not fixed here — outside
> this package's scope; flagged for a separate decision.)

**What D6 would add** (unbound occurrences from the frozen census book
files, synthesis-basis `speechText` character counts; projection at the
pinned 3,012.6 bytes/char):

| Book | Unbound segments | Unbound chars |
|---|---|---|
| Forever Pucked | 357 | 472,974 |
| Pucked | 347 | 299,894 |
| The Goal | 99 | 261,820 |
| Pucked Up | 8 | 1,770 |
| **All eligible** | **811** | **1,036,458** |

(FP's 472,974 chars reproduces the proposal's figure exactly on the
speech-text basis. New audio ≈ 8.23 audio hours for FP; ≈ 18.04 hours
all-books.)

**Retries/orphans allowance: 10% of new-audio bytes.** Basis: the P8
migration itself left orphan objects equal to 6.7% of bound bytes
(358,667,234 / 5,349,372,909), and the D6 design by intent preserves
flushed-but-unverifiable objects rather than deleting them (§4), while
POLICY_BLOCK split trees and repair chains create intermediate attempts.
10% covers the observed orphan rate with margin.

**Projections** (current actual 9.4828 GB + new audio):

| Case | New audio | Projected total | vs 10 GB |
|---|---|---|---|
| FP phase | 1.4249 GB | **10.9077 GB** | **over by 0.9077 GB** |
| FP phase + 10% allowance | 1.5674 GB | **11.0501 GB** | **over by 1.0501 GB** |
| All-books | 3.1224 GB | **12.6052 GB** | **over by 2.6052 GB** |
| All-books + 10% allowance | 3.4347 GB | **12.9175 GB** | **over by 2.9175 GB** |

**Verdicts under the fail-closed rule** (the coordinator refuses to
start, and stops granting on, any job whose projected storage would
cross 10 GB):

- **(a) Forever Pucked phase: NOT PERMITTED** against the bucket as it
  stands, at the pinned format — over the boundary before the allowance,
  further over with it.
- **(b) All-books: NOT PERMITTED**, by a wide margin.

**Decision-shaped arithmetic** (facts only; this package recommends no
disposition and D6 authorizes none): the entire blocker is the legacy
`chapter-audio/` namespace. Were those 3.7463 GB not in the bucket, the
base would be 5.7365 GB and the same projections become FP 7.1614 GB
(7.3039 GB with allowance) and all-books 8.8589 GB (9.1712 GB with
allowance) — both inside the free tier. Any disposition of v1 legacy
data (keep, archive elsewhere, delete) is Julie's separate decision at
a later gate; the D6 build proceeds on the design's fail-closed rule
either way, and arming cannot pass its storage precondition until the
projection fits. (For completeness: even at the unpinned MP3 rate, FP
would total 9.9228 GB — inside by 0.077 GB with zero allowance headroom
— and all-books 10.4471 GB, still over.)

R2 operations are not a constraint: the free tier also includes 1M
Class A and 10M Class B operations/month; D6's writes/reads are in the
hundreds-to-thousands.

## 4. Queue pin

**The new queue** (to be created by the D6 build; name/ID pinned at
creation, before deployment, per Amendment A-1):

- **Free-tier allowance (Workers Free): 10,000 operations/day**,
  message retention 24 hours (non-configurable on Free). Source:
  Cloudflare Workers pricing documentation
  (developers.cloudflare.com/workers/platform/pricing/, Queues section,
  read Oct 29, 2026). An operation is counted per 64 KB of data written,
  read, or deleted, **per message** (batching does not reduce the
  count); a normal delivery costs **3 operations** (1 write + 1 read +
  1 delete/ack); each retry adds 1 read operation; a dead-letter write
  adds 1 write.
- **Per-operation cost on the free tier: $0** within the daily
  allowance. The Free plan has no metered queue overage (the allowance
  is the cap; the $0.40/million rate exists only on Workers Paid, which
  this project does not use).
- **Per-occurrence operations estimate** (from the design's message
  flow): one message per execution — enqueue on coordinator outbox
  drain (1 write), consume/dequeue (1 read), ack on settle (1 delete)
  = **3 operations**, messages being small ID-bearing payloads far
  under 64 KB. Split trees (POLICY_BLOCK) and repair retries add
  messages/reads; a planning factor of ×1.3 messages per occurrence is
  applied, mirroring §3's conservatism.
- **Projected operations:**
  - FP phase: 357 occurrences → 1,071 base operations; ≈ **1,392**
    with the ×1.3 factor. Spread over ≥4 days by the 100-attempts/day
    Gemini quota, peak day ≈ 100 executions × 3 ≈ **300 operations**
    plus retry reads — ≈3% of the daily allowance.
  - All-books: 811 occurrences → 2,433 base; ≈ **3,163** with the
    factor; same quota-bound daily peak.
  - Even the pathological bound (every occurrence exhausting the
    ≤12-attempt ceiling: 811 × 12 messages × 3 ops = 29,196 operations)
    spreads across ≥98 quota-days — under ~300/day average. **The queue
    allowance is not a binding constraint at any realistic shape.**
  - Design note: 24-hour Free retention is safe because the durable
    work plan lives in the coordinator (Amendment A-1 §6.5 redesign);
    queue messages are re-derivable from the plan, never the record.
- **Consumer routing (pinned):** producer = `opalreader-api-v2-prod`'s
  coordinator outbox drain; consumer = `opalreader-api-v2-prod` itself
  (the queue handler is added by the D6 build — the deployed script has
  none, by design).
- **The v1 queue stays untouched — verified live, Oct 29, 2026:** the
  account holds exactly one queue, `opalreader-generation`
  (id `e2706b79473d4ece90f37bd784c83386`), `delivery_paused: true`,
  sole consumer the v1 worker `opalreader-api` (batch 1, max retries 3),
  producers `opalreader-api` and the staging `opalreader-api-v2` (the
  production v2 script is neither producer nor consumer). This package
  made no change to it, and the D6 design never resumes or shares it
  (Rowan Q1).

## 5. Split ceilings + remaining build pins

**Pinned exactly in build, from Amendment A-1 (§6.4 ceilings, adopted
as the build values within Rowan's conditional pass):**

- Recursion/split depth: **≤ 4** (≤ 16 leaf parts per segment).
- Minimum part floor: **50 characters** (a refusal at the floor is
  terminal for that part; original text and voice preserved across
  every split; terminal refusals reported by ID; no voice substitution,
  no silent skips).
- Per-segment attempt budget: **≤ 12 attempted calls** across the
  segment's entire split tree and repair chain combined.

**Resolved by this package:** output audio format (§2); R2 projections
and the fail-closed storage verdicts (§3); queue allowance, per-op
cost, ops projections, and consumer routing (§4); the new queue's
name/ID is pinned at creation in the build's queue step (before
deployment), per §4.

**NOT resolved here — owned explicitly by the implementation phase**
(from the proposal's TO BE PINNED IN BUILD list):

1. Whether the deployed R2 head/verify path exposes object size + ETag
   exactly as §4's verify step specifies, on the production binding
   (the adapter layer already performs ETag-conditional writes; the
   read-side verify check on the deployed path remains to be proven in
   build).
2. The repair-chain retry bound (the exact bounded retry count inside
   the §6.4 attempt budget).
3. The executor lane-allowlist representation (how the Standard-only
   allowlist `["standard"]` is represented and enforced in code).
4. The generation-capable client's identities/markers (entry / service
   worker / stylesheet successors, build and packaging markers) on the
   ui-pkg-3 base.
5. The new queue's concrete name/ID (created and pinned in build, §4).
6. **The storage precondition itself:** the projections in §3 do not
   fit the bucket as it stands. The implementation phase builds the
   fail-closed enforcement regardless; the FP phase cannot arm until
   the storage question is decided at Julie's gate (see §3).

---

*Sources: D6 proposal as amended (`~/workspace/d6-proposal/D6-PROPOSAL.md`);
frozen census (`~/workspace/opal-reader-p8-data/`: `audio-results.jsonl`,
`books/`, `snapshot-manifest.json`); v2 source tree at pin
`1bee2490…` (`~/workspace/d5-worker-work/`); Cloudflare account read-only
queries via the `custom.legacy-cloudflare` connector (buckets list,
paginated objects listing, GraphQL `r2StorageAdaptiveGroups`, queues
list, script-settings) on Oct 29, 2026; Cloudflare Workers pricing
documentation (Queues) and the R2 pricing calculator's GB definition,
read Oct 29, 2026. No segment text was read or quoted anywhere in this
package — book data is counts, character totals, and IDs only.*
