# A-3 STAGING COMPATIBILITY PROPOSAL — DEDICATED STAGING R2 BUCKET

Case #10 / P8 (issue #15). Prepared by Wren (subagent investigation),
2026-11-16, under Julie's authorization of the isolated-staging
compatibility investigation (her decision, 2026-11-16 ~16:18 ET) and
Rowan's disposition of the R2-prefix finding (board 6929640247, §3).

**Status: DOCUMENTARY INVESTIGATION ONLY.** This proposal creates,
modifies, and provisions nothing. Every Cloudflare operation performed
for it was a read. It authorizes no act; the acts in §5 are an
inventory for a future execution gate under a fresh Julie GO and
Rowan review, in that order.

Basis documents: the S-A2 finding
(`trial/SA2-FINDING-R2-PREFIX-GUARD.md`); Rowan's guard disposition
(`ROWAN-A3-R2-PREFIX-GUARD-DISPOSITION.md`); the operative trial
package as amended (consolidated package pin `91bf4f3a…` + C-addendum
`ed9718c7…` + final addendum `c5c4cf85…`); the corrected Resolution A
variant tree (`trial/staging-variant-tree/`); the pre-trial staging
build's deploy spec (commit `2fe71b5f…`, `v2/p8/deploy-spec.json`,
fetched read-only via the GitHub API for this investigation).

---

## Executive summary

The blocked trial's incompatibility is exactly one binding deep. The
production construction refuses to run with an `R2_KEY_PREFIX`
binding; staging's environment carries one into the shared production
bucket. The construction proposed here removes the conflict without
touching the guard, the code, or the shared bucket:

> **Create one dedicated staging bucket, `opalreader-storage-staging`;
> bind the staging worker's `OPALREADER_STORAGE` to it; and remove the
> `R2_KEY_PREFIX` binding.** The production construction then runs in
> its own production shape (no prefix — the shape its deploy spec
> calls canonical), and every R2 operation it can perform resolves,
> by binding, to a bucket production never touches.

Headline verdicts, each established in the section cited:

- **Availability (§1):** the account holds exactly one bucket today
  (`opalreader-storage`); a second bucket is unambiguously within
  documented limits (default limit 100,000 per account, included in
  the plan) and costs nothing. The future creation act is one API
  call, specified exactly.
- **Cost (§2):** R2's free tier is account-wide — a second bucket
  adds **no** allowance. The shared 10 GB-month ceiling is already
  ≈ 94.8% consumed by production (≈ 9.48 GB, 2026-10-29 full
  pagination), leaving ≈ 0.5 GB headroom. In the scheduler-trial
  posture the staging bucket holds **zero objects** (both R2 write
  sites are generation paths, unreachable under halt), so the trial
  itself consumes none of that headroom. ⚠️ Any future staging
  *generation* would eat production headroom byte-for-byte; a
  book-scale staging run (≈ 4–8 GB) is impossible under the current
  ceiling and is flagged as such, not planned around.
- **Guard compatibility (§3):** with the binding absent, the guard's
  input is `""` by the code's own derivation and the throw is
  unreachable; the guard remains **byte-unchanged**. Every R2 call
  site in the tree (enumerated: 2 puts, 6 gets, 4 heads, 1 list, 0
  deletes) takes its bucket handle from `env.OPALREADER_STORAGE` —
  there is no second handle and no hardcoded bucket name anywhere in
  the tree — so rebinding the one binding re-points **all** R2
  traffic, including every empty-prefix path, exclusively to the
  staging bucket.
- **Environment (§4):** the binding delta against the pre-trial 8 is
  exactly two lines: `OPALREADER_STORAGE` bucket_name →
  `opalreader-storage-staging`, and `R2_KEY_PREFIX` removed.
  Coordinator namespace, halt, absent provider key, inert queue path,
  and absent phase policy are all untouched.
- **Cleanup (§6):** restoring the pre-trial build with the original
  8 bindings (which reinstate the prefix and the shared bucket in the
  same upload) fully restores the pre-trial state **regardless of
  whether the staging bucket exists** — the old build never
  enumerates unbound buckets.
- **Reusability (§7):** yes — this is a standing staging environment,
  and it is not optional for the next staging consumer: the B-G3
  Batch staging variant carries the identical guard and its drafted
  Δ-4 (preserve the prefix) would hit this identical blocker. This
  construction serves it unchanged.

One bounded caveat is carried at full strength in §3.4 (the frozen
`RECORDED_STORAGE_BASE` constant makes the operator storage-seed
route refuse against an empty staging bucket — fail-closed, writes
nothing, on no trial path) and three execution-time unknowns are
declared in §9 rather than assumed (chiefly: whether the cf-api
credential's scopes permit bucket creation — never tested; the
dashboard fallback has the identical landing proof).

---

## 1. Bucket availability and provisioning

**Observed (read-only, 2026-11-16T21:24Z, via cf-api):** the account
(`b35ff435ff24d134ff640e0099dd13fc`) holds exactly **one** R2 bucket:

| name | created | location | storage class | jurisdiction |
|---|---|---|---|---|
| `opalreader-storage` | 2026-08-29T23:42:10Z | ENAM | Standard | default |

No staging bucket exists. R2 is active on the account (the production
bucket has been in continuous use since August 2026), so no
subscription, checkout, or enablement step stands between the account
and a second bucket.

**Limits.** Cloudflare's R2 Limits documentation (updated
2026-10-30) states the maximum number of buckets per account is
"Unlimited, with a default limit of 100,000"; the R2 Pricing
documentation (updated 2026-10-30) states the first 100,000 buckets
per account are included and each bucket above that costs
$0.10/month. A second bucket is therefore within limits by five
orders of magnitude and carries **no** per-bucket charge. (Bucket
management operations are rate-limited at 50/second/bucket and the
R2 REST API at 1,200 requests/5 minutes account-wide — neither is
approached by a single creation.)

**Proposed name:** `opalreader-storage-staging` — 25 characters,
lowercase letters and hyphens only, within the documented 3–63
character bucket-name rules, and confirmed not taken (the account
listing above is complete).

**The future creation act (exact operation):**

```
POST /client/v4/accounts/b35ff435ff24d134ff640e0099dd13fc/r2/buckets
body: {"name": "opalreader-storage-staging"}
```

This is the documented Create Bucket operation (`PutBucket`, a
Class A operation — one call against the 1M/month free Class A
allowance). No storage-class or jurisdiction parameter: Standard and
default, mirroring the existing bucket. Location: the existing
bucket sits in ENAM; creation without a `locationHint` uses
automatic placement. Placement is immaterial here (the trial posture
stores nothing; no data-residency requirement attaches to synthetic
staging data) — see §9.2.

**Landing proof (for the future act):** a buckets list read shows
both buckets; a GET on the new bucket returns its name with storage
class Standard and jurisdiction default.

Sources: Cloudflare R2 Limits,
https://developers.cloudflare.com/r2/platform/limits/ ; Cloudflare
R2 Pricing, https://developers.cloudflare.com/r2/pricing/ (both
updated 2026-10-30; read 2026-11-16).

---

## 2. Storage allowance and cost

**The allowance does not multiply.** R2's free tier is a single
account-wide monthly meter set (R2 Pricing documentation): **10
GB-month of Standard storage, 1M Class A operations, 10M Class B
operations, egress free**. Buckets are organizational, not
metering, units: a second bucket adds no storage, no operations,
and no allowance of any kind. Everything below is therefore
accounted against the one shared ceiling.

**Where the account stands.** The production bucket holds
≈ **9.48 GB across 6,199 objects** — the standing figure from the
weekly free-tier check's last full pagination (2026-10-29; this
investigation cites that dated figure and did not re-run the slow
full pagination). That is ≈ **94.8%** of the 10 GB-month free
storage allowance, leaving ≈ **0.5 GB** of headroom. Production
generation is LIVE and its remaining *Forever Pucked* work will
draw on that headroom from the production side regardless of
anything staging does.

⚠️ **Cost flag (pre-existing, not created by this proposal):**
storage beyond 10 GB-month bills at $0.015/GB-month (Standard).
At ≈ 95% consumed, production growth alone can cross the line in a
coming month. That exposure exists today, with or without a staging
bucket; the weekly free-tier watch (alert threshold 70%) is its
standing monitor. This proposal adds no bytes in trial posture
(below) and must not be read as adding to that exposure.

**What the staging bucket would hold — trial posture.** The variant
deployed on staging, `GENERATION_HALT` "1", no submissions, no
provider credential: the tree contains exactly two R2 write sites
(adapters.mjs:669, flush-store.mjs:90 — §3.2), and both are
generation paths. Generation admission refuses under halt; the
queue send path is structurally inert (absent binding, §4); there
is no provider key to synthesize with. The sync, bindings, and
content planes live in Durable Object SQLite, not R2. Scheduler
ticks and drive passes under halt perform no R2 writes. **Expected
staging-bucket content for the entire scheduler trial: 0 objects,
0 bytes.** Read traffic is likewise negligible (the audio route and
cache hydration touch only keys a surface names; on an empty bucket
they return absence). Total trial R2 operations sit orders of
magnitude inside the 1M/10M monthly operation allowances, which
production usage does not approach either.

**Worst case — a future staging *generation* trial.** Audio objects
in the production bucket average ≈ 1.5 MB (9.48 GB / 6,199 objects,
2026-10-29); the freeze-era corpus ran ≈ 3 MB/object (1,798 objects
≈ 5.35 GB). At 1.5–3 MB per generated segment:

- B-G3-scale synthetic proof (7 test segments, its authorized
  envelope): ≈ 10–20 MB — immaterial even against 0.5 GB headroom.
- A chapter-scale staging run (~20 segments): ≈ 30–60 MB —
  survivable only with a pre-flight headroom read.
- A book-scale staging run (~2,600 segments): ≈ 4–8 GB —
  **impossible** under the current account ceiling. It would
  require reducing the production bucket or paying for storage;
  neither is proposed, and any future proposal of that shape must
  carry this arithmetic on its face.

**Mitigations inherent in the construction.** (i) The trial posture
writes nothing — the ceiling question does not arise for the
scheduler trial itself. (ii) Staging usage becomes *separately
visible*: a dedicated bucket's objects are enumerable on their own,
unlike the prefix scheme, where staging bytes hide inside the
production bucket's listing under `smoke-p8/`. (iii) Cleanup can
return every staging byte to the shared pool immediately (emptying
the bucket; object deletes are unbilled under R2's published
pricing) or delete the bucket outright (§5, C-12).

---

## 3. Guard compatibility and R2 path enumeration

All line references are to the corrected Resolution A variant tree
(`trial/staging-variant-tree/`), verified by direct read and full
grep for this investigation.

### 3.1 The guard can never fire with the binding absent

The enforcement chain has exactly three links:

1. **Derivation** — `OpalReaderCoordinator._cache()`
   (worker-entry.js:184): `const keyPrefix = this.env.R2_KEY_PREFIX || "";`
   With no `R2_KEY_PREFIX` binding, `env.R2_KEY_PREFIX` is
   `undefined`, so `keyPrefix` is `""`.
2. **Enforcement** — the production class override
   `_enforceR2Namespace(keyPrefix)` (worker-entry-prod.js:103–105):
   `if (keyPrefix !== "") throw new ProductionR2NamespaceError(keyPrefix);`
   On `""` it does not throw. `_cache()` then constructs the cache
   over `this.env.OPALREADER_STORAGE` with `{ keyPrefix: "" }`
   (worker-entry.js:195).
3. **The one bypass path checks itself** — the audio route, which
   does not go through `_cache()`, carries its own copy of the rule
   (audio-route.mjs, `handleAudioRequest`): it refuses only when
   `scope === "production"` **and** the passed prefix is non-empty.
   The entry passes `r2KeyPrefix: env.R2_KEY_PREFIX ?? ""`
   (worker-entry-prod-d6.js:3858–3861) — `""` when the binding is
   absent — so the refusal is unreachable under any scope value.

The remaining `R2_KEY_PREFIX` readers in the tree are informational
(the health/status surfaces at worker-entry-prod.js:198 and the
prod-d6 status region report the configured value; both render
absence as `""`). A full-tree grep for `R2_KEY_PREFIX` returns no
other consumer.

**Verdict: the guard remains byte-unchanged — the modification
Rowan rejected as Option B is not needed — and with the binding
absent its throw is unreachable by construction, not by
configuration discipline.** Absence (rather than an empty-string
binding) is specified deliberately: it is the production shape
("The deploy spec carries no such binding; its absence IS the
production shape" — worker-entry-prod.js header), and it is what
makes every derivation above yield `""`.

### 3.2 Every R2 path resolves to the bound bucket

R2 access in Workers is by **binding handle**, never by name. The
tree obtains that handle from `env.OPALREADER_STORAGE` at exactly
five sites, and every bucket method call in the tree flows from one
of them:

| handle site | consumer |
|---|---|
| worker-entry.js:195 — `createR2AudioCache(this.env.OPALREADER_STORAGE, { keyPrefix })` | the coordinator audio cache (adapters.mjs) |
| worker-entry-prod-d6.js:2123 — `createFlushStore(this.env.OPALREADER_STORAGE, { keyPrefix: "" })` | the D6 flush store (flush-store.mjs); prefix hardwired `""` |
| worker-entry-prod-d6.js:391 — `recountBucket: env.OPALREADER_STORAGE` | the storage recount (service.mjs) |
| worker-entry-prod-d6.js:3859 / worker-entry-prod.js:197 — `bucket: env.OPALREADER_STORAGE` | the audio route (audio-route.mjs) |

Complete method-call enumeration (full-tree grep; `bucket.` calls):

| site | methods |
|---|---|
| host/adapters.mjs (keys `` `${keyPrefix}audio/<cacheKey>.<ext>` ``, prefix `""`) | get :522, get :631, head :658, **put :669**, get :733 |
| generation/flush-store.mjs | get :68, **put :90**, head :122, head :167 |
| generation/service.mjs (recount, fully paginated) | list :1477 |
| audio-route.mjs (key `audio/<cacheKey>.<format>` built internally) | head :238, get :287–288 |

Totals: **2 puts, 6 gets, 4 heads, 1 list — and no `bucket.delete`
call site anywhere in the tree, and no multipart API use.** (The
only other `.put(` in the tree, worker-entry-prod-d6.js:2179, is
Durable Object storage, not R2.)

Because every handle **is** the binding and every key is built with
prefix `""`, rebinding `OPALREADER_STORAGE` to
`opalreader-storage-staging` re-points **all** of the above —
reads, writes, and lists, including every empty-prefix path —
exclusively to the staging bucket. There is no second handle, no
fallback bucket, and no code path that can address the production
bucket while the staging binding stands.

### 3.3 No code path addresses the production bucket by name

A full-tree grep for the string `opalreader-storage` across all
`.js`/`.mjs` parts returns **zero hits**. The code never names a
bucket; bucket identity exists only in deploy-time binding
configuration. Isolation under this construction is therefore a
property of the binding, enforced by the platform — the same
strength of isolation the production worker itself relies on.

### 3.4 Bounded caveat — RECORDED_STORAGE_BASE (stated, not smoothed)

`gen-constants.mjs:57–60` freezes `RECORDED_STORAGE_BASE =
{ baseBytes: 5,736,481,302, objectCount: 5,942 }` — production
bucket figures — as the expected base for the operator
`seedStorageBase` route, which recounts `env.OPALREADER_STORAGE`
and refuses (zero tolerance, `recount_mismatch`, writes nothing)
unless the recount equals the recorded base. Its sole call site is
the operator quota-bootstrap route handler
(worker-entry-prod-d6.js:2095); grep verifies no scheduler, drive,
tick, or trial path invokes it. Consequences, at true strength:
the scheduler trial is **unaffected**; a seed invocation against
the empty staging bucket would be refused fail-closed; and any
*future* proposal wanting the quota-bootstrap/seed surface on
staging needs its own disposition of this constant. It is flagged
here so the trial report never claims that surface as verified.

---

## 4. Environment compatibility and the exact binding delta

Nothing in this construction touches the staging worker's other
boundaries; each is unchanged, for the reasons already established
in the operative package and re-verified against the variant source
for this investigation:

- **Coordinator:** `COORDINATOR` binding unchanged — namespace
  `40873aba35a24de0a79f7bad03b9077d`, class `OpalReaderCoordinator`
  (the name the variant's main module exports, per Resolution A).
  The staging DO instance and its state are the same before, during,
  and after.
- **Halt:** `GENERATION_HALT` remains `"1"`. No act in §5 lifts it.
- **Provider boundary:** `GEMINI_API_KEY` remains **absent** — the
  provider call path stays closed by the same independent closure
  as in the blocked attempt.
- **Queue boundary:** the D6 code reads its queue through the
  constant-named binding `OPALREADER_GENERATION_V2`, which remains
  **absent** on staging, so the queue send path stays structurally
  inert. Staging's own `OPALREADER_GENERATION` binding (queue
  `opalreader-generation`) is a different name the D6 code never
  reads; it stands unchanged.
- **Phase policy:** `OPALREADER_PHASE_POLICY` remains absent (the
  non-enforcing branch — the recorded staging/production
  divergence, immaterial under halt with no submissions).

**The exact binding delta** — against the pre-trial 8 (staging
census 2026-11-16; the same 8 observed restored in this
investigation's settings GET at 2026-11-16T21:24Z):

| binding | pre-trial | under this construction | change |
|---|---|---|---|
| ALLOWED_ORIGIN (plain_text) | `https://jedavid33-design.github.io` | same | — |
| COORDINATOR (DO namespace) | `40873aba…`, class `OpalReaderCoordinator` | same | — |
| GENERATION_HALT (plain_text) | `"1"` | `"1"` | — |
| OPALREADER_ACCESS_TOKEN (secret) | staging's own | same (inherit) | — |
| OPALREADER_GENERATION (queue) | `opalreader-generation` | same | — |
| **OPALREADER_STORAGE (r2_bucket)** | **`opalreader-storage`** | **`opalreader-storage-staging`** | **bucket_name** |
| OPALREADER_V2_SCOPE (plain_text) | `staging-smoke` | same | — |
| **R2_KEY_PREFIX (plain_text)** | **`smoke-p8/`** | **— absent —** | **removed** |

Net: **7 bindings** under the construction. (The trial's
operator-token addition remains a separate trial act on top of the
construction, exactly as in the operative package — 8 bindings
during the trial window — and is not part of this delta.)

---

## 5. Required acts for a future trial under this construction

For a future execution gate under a **fresh** Julie GO and Rowan
review. This proposal authorizes none of them. Trial-internal acts
(S-A3 onward) inherit the operative package + addenda unchanged;
only the construction-specific acts are new or altered, and are
marked ◆.

| # | act | landing proof |
|---|---|---|
| ◆ C-1 | **Create bucket** `opalreader-storage-staging` (POST …/r2/buckets, §1; one Class A op). If the API credential refuses on scope, Julie creates it in the dashboard — identical proof (§9.1). | Buckets list shows both buckets; GET on the new bucket returns name / Standard / default jurisdiction. |
| C-2 | **S-A0 (re-establish trial automation):** recreate the trial watch + sampler crons under the new GO (cleanup removed the originals). | Cron list shows both jobs present + enabled; bootstrap export filed to the trial log. |
| C-3 | **S-A1 (operator token):** staging-only operator token re-added — Julie's dashboard act + connector reconnect; the value never transits tooling. | Settings GET shows the binding (name/type); the operator fence admits the credential (build-appropriate proof, as established in the blocked attempt). |
| ◆ C-4 | **Variant upload, construction bindings (ONE attempt; the attempt counts):** the corrected Resolution A variant tree; upload metadata bindings = the §4 set (storage → staging bucket; **no R2_KEY_PREFIX row**; secrets as `inherit`; compatibility + observability carried verbatim from the pre-upload settings GET and re-checked after, per the standing deploy discipline). | Deployments list + ETag change; /health build = the operative pin, scope `staging-smoke`, generation halted; settings GET re-verified (bucket_name = `opalreader-storage-staging`; no `R2_KEY_PREFIX` row; halt `"1"`; observability enabled). **And the proof the blocked attempt could not produce: operator diagnostics (drive=1) read SUCCEEDS with no 500; repair status answers; scheduler status = shape A.** Any 500 here contradicts the construction's premise → STOP before any trigger exists. |
| C-5 | **Baselines + readiness:** post-upload operator baseline (diagnostics, repair status, conflicts, recorder census — on staging, the fresh-create shape: watermark 0, empty tuple set, per the variant-deviation disposition); watch operational-readiness cycle; sampler pretrial demonstration (read-only; not a qualifying V3 sample). | Readiness record filed before any trigger act. |
| C-6 | **S-A3 (trigger create):** exactly one `*/30` trigger, staging worker only. | Schedules GET shows exactly the one trigger on staging; production schedules still []. |
| C-7 | **S-A4 → window → S-A7:** activation (authorizationRef + reason), sampling epochs, S-A5/S-A6 WAIT-hold round trip, deactivation — as the operative package + addenda define, unchanged, including all usage caps, the cleanup reserve, WAIT supremacy, and the B1–B3 conditions of the final addendum's ruling. | Per the package, act by act; state taken only from status read-backs. |
| C-8 | **S-A8 (trigger delete).** | Schedules GET [] on staging; production schedules []. |
| ◆ C-9 | **Restore (S-A9-equivalent; ONE upload):** the pre-trial build `2fe71b5f…` with the **original 8 bindings in the upload metadata** — `OPALREADER_STORAGE` → `opalreader-storage`, `R2_KEY_PREFIX` `"smoke-p8/"` reinstated in the same act (the pairing the finding required is satisfied by construction, because bindings ride the upload), secrets inherit, observability carried. | /health build = `2fe71b5f…`; settings GET = the original 8 exactly; the restored build's health + available service surfaces answer (its mirror guard is satisfied by the reinstated prefix — §6); restoration verified by build identity, health, and available diagnostics (the restored build has no recorder, so no legacy-pass item applies — variant-deviation disposition §3). |
| C-10 | **Token removal (S-A10-equivalent):** after every read requiring the token, including the trial report's evidence export; deferred while any pending-watch lives. If the token binding is still present at C-9, C-9's metadata omits it and C-10 is discharged by C-9's settings read-back; otherwise a settings-only multipart PATCH to `/settings` (the learned write path) removes it. | Settings GET shows the binding absent. |
| C-11 | **Observer-job removal:** remove the trial watch + sampler crons (and any pending-watch continuation, per its bounded termination). | Cron list read-back shows both absent. |
| ◆ C-12 | **Bucket disposition — Julie's choice at the cleanup gate. RECOMMENDED: retain-empty** as the standing staging bucket (§7). Alternative: delete the bucket (DELETE …/r2/buckets/opalreader-storage-staging; the bucket must be empty — under trial posture it already is). | Retain: paginated objects list for the bucket = empty; buckets list shows it present. Delete: buckets list shows only `opalreader-storage`. |

Mechanism notes (learned facts, applied above): non-secret binding
changes ride the upload metadata atomically with the code act — no
separate settings act is needed for the §4 delta, in either
direction; dashboard-set secrets survive uploads when carried as
`inherit`, and are never readable or settable by tooling; a
settings-only change, where one is needed (C-10 fallback), uses the
multipart PATCH to `/workers/scripts/{name}/settings` and is always
verified by read-back.

---

## 6. Restoration and cleanup compatibility

The pre-trial build's requirements are established from its own
deploy spec (commit `2fe71b5f…`, `v2/p8/deploy-spec.json`, read for
this investigation): bindings `COORDINATOR` (class
`OpalReaderCoordinator`), `OPALREADER_STORAGE` → bucket
**`opalreader-storage`**, `OPALREADER_GENERATION` (queue),
`ALLOWED_ORIGIN`, `OPALREADER_V2_SCOPE` `staging-smoke`,
`GENERATION_HALT` `"1"`, `R2_KEY_PREFIX` `"smoke-p8/"`, plus the
dashboard-set secret `OPALREADER_ACCESS_TOKEN` (staging's own
distinct value — never removed by any act here; it survives uploads
as `inherit`). Its code carries the mirror guard
(worker-entry.js:152–153 of that tree): under `staging-smoke` scope
the cache refuses construction unless the prefix is exactly
`"smoke-p8/"`.

The C-9 restore act reinstates **exactly** that configuration in
one upload: shared bucket bound, prefix present and exact, every
other binding identical. The old build's R2 access is binding-only
through the same shared cache construction, so its namespace —
`smoke-p8/*` keys inside `opalreader-storage` — is restored whole;
nothing in this construction ever wrote to the shared bucket (under
the construction the variant cannot address it at all, §3.2), so
there is nothing to unwind inside it.

**The staging bucket's existence is invisible to the restored
build.** Worker code reaches R2 only through its own bindings; an
unbound bucket is never enumerated, listed, or read by the old
build (or by production). The coordinator namespace and instance
are the same throughout, so the old build resumes its own DO state
exactly as the operative package's restoration analysis already
established — this construction changes none of that analysis,
because it changes only which bucket a binding names and whether a
plain-text binding exists.

**Verdict: restoring the prior build + the original 8 bindings
fully restores the pre-trial state, whether the staging bucket is
retained empty or deleted.** Bucket disposition is therefore a free
choice at the cleanup gate (C-12), not a compatibility constraint.

---

## 7. Reusability — a standing staging verification environment

**Yes.** The construction is not trial-specific: it is the general
answer to "run a production-construction build on the staging
worker," and it persists at zero recurring cost (an empty bucket
stores nothing and the bucket count is five orders of magnitude
inside the included allowance). Retained, `opalreader-storage-staging`
is the standing staging bucket for every future staging deployment
of a production-lineage build; each future trial re-derives only
its own acts (token, upload, trigger, activation) against it.

**The next consumer is already known, and it needs this.** The
B-G3 Batch staging proof deploys a variant of the B-G2 candidate
with the production entry (`worker-entry-prod-d6.js`, its Δ-2). For
this investigation the B-G2 candidate tree was checked directly:
it carries the **identical** guard
(`bg2-build/candidate-tree/v2/worker-entry-prod.js:84–105` —
`ProductionR2NamespaceError`; `_enforceR2Namespace` throws on any
non-empty prefix; the same `_cache()` derivation at
worker-entry.js:184). And B-G3's Δ-4 as drafted **preserves
`R2_KEY_PREFIX "smoke-p8/"`** on the staging script. As drafted,
then, B-G3's staging deploy would construct cleanly, answer
/health — and fail its first service-layer read with the identical
500, exactly as the A-3 trial did. The same construction serves it
unchanged (storage → the staging bucket; prefix omitted), with two
B-G3-specific notes: (i) B-G3 would need a Δ-4 revision or a
compatibility addendum adopting this construction before its
deploy act — that revision is B-G3's own gate business, flagged
here as a downstream consequence, not decided here; (ii) B-G3 runs
real (synthetic-content) generation, so its flushes would land in
the staging bucket — isolated from production audio by bucket
rather than by prefix, which is the stronger posture — at its
authorized envelope of ≈ 10–20 MB (§2), with bucket-emptying as
part of its cleanup.

The same applies, at the same strength, to any WS2 composition
staging deployment and to a re-run of A-3 platform verification:
same entry construction, same guard, same resolution.

---

## 8. Alternatives if a dedicated bucket is unavailable

Unavailability is narrow and unlikely: the documented limits pose
no bar (§1), R2 is active on the account, and the only realistic
failure is the cf-api credential lacking bucket-creation scope
(§9.1) — which has a same-construction fallback (first item below).
For completeness, the alternatives are recorded at their true
strength:

- **Dashboard creation (fallback mechanism, same construction).**
  Julie creates `opalreader-storage-staging` in the Cloudflare
  dashboard. The end state, bindings, proofs, and cleanup are
  identical to C-1 in every particular; only the creating hand
  differs. This is the genuine fallback, and it keeps Option C
  intact.
- **A second Cloudflare account — NOT free-tier-clean, and not
  actually available as a construction.** (i) R2 bindings are
  same-account: a bucket in another account **cannot be bound** to
  this account's staging worker at all, so the "alternative"
  collapses into migrating the entire staging presence (worker,
  DO namespace and its state, queue, connector registrations,
  tooling credentials) to another account — a migration project,
  not a compatibility construction. (ii) It would also mint a
  second set of free allowances, which is allowance multiplication
  against the spirit of Julie's free-tier-only rule — the shared
  ceiling is a discipline this setup keeps deliberately. Recorded
  as rejected on both grounds.
- **Prefix-free operation against the shared bucket** is Option A,
  already **rejected by Rowan** (disposition §2: storage isolation
  is not substitutable). It is named here only to close the set;
  it is not re-proposed.
- **A staging-shaped entry construction** (the base
  worker-entry.js class with its staging guard and a prefix,
  instead of the production class) is Option C's original re-plan
  branch. It preserves isolation but changes the code under test —
  and the trial's entire premise is verifying the **production**
  construction as built. Recorded as the last-resort branch if no
  bucket can be created by any mechanism; not recommended while
  the bucket path is open.

---

## 9. Open questions — execution-time verifications, not assumptions

1. **Bucket-creation credential scope (the one material unknown).**
   Whether the cf-api credential may create an R2 bucket cannot be
   established by reads. The credential has performed worker script
   uploads, settings reads and PATCHes, queue operations, and R2
   bucket/object **reads**; it has never created a bucket (the
   production bucket dates to 2026-08-29 and predates this
   tooling's use for provisioning; no Oct-era or later work created
   one). C-1 therefore treats creation as an execution-time
   verification: the attempt's response is the evidence; a scope
   refusal routes to the dashboard fallback (§8) with an identical
   landing proof, and no dependent act is affected by which hand
   created the bucket.
2. **Bucket location.** The existing bucket is in ENAM. Creation
   without a `locationHint` places automatically; the new bucket's
   region is not determined in advance and is immaterial to every
   trial property (nothing is stored in trial posture). If a
   future gate wants ENAM specifically, `locationHint` is the
   documented creation parameter — an execution detail.
3. **The standing storage figure's age.** The ≈ 9.48 GB figure is
   from the 2026-10-29 full pagination; production has generated
   since (including Chapter 6's partial run). Any future gate
   whose arithmetic depends on headroom — above all a
   generation-on-staging proposal (§2) — must take a fresh
   pagination at its own pre-flight rather than rely on the figure
   quoted here. The scheduler trial's arithmetic does not depend
   on it (it writes nothing).
4. **Free-tier watch coverage.** The weekly free-tier script
   enumerates the production bucket. If the staging bucket is
   retained and ever holds data, account-total accounting must
   include it; the trial's own usage accounting already counts
   staging usage separately. Noted for the watch's next revision;
   not a premise of this construction.
5. **Storage-seed surface.** The `RECORDED_STORAGE_BASE`
   disposition (§3.4) is open only for a hypothetical future use
   of the quota-bootstrap seed on staging. The scheduler trial
   does not need it, and this proposal does not propose changing
   the constant (a code change to the accepted candidate is
   outside this investigation's scope by its terms).

---

## Appendix — evidence index

- Variant source (all §3 references): `trial/staging-variant-tree/`
  — worker-entry.js:184,195; worker-entry-prod.js:103–105,197–198;
  worker-entry-prod-d6.js:391,2123,2179,3858–3861;
  host/adapters.mjs:522,631,658,669,733;
  generation/flush-store.mjs:68,90,122,167;
  generation/service.mjs:1477,1505; audio-route.mjs:238,287–288;
  generation/gen-constants.mjs:57–60. Greps: `bucket.(put|get|head|list|delete)`,
  `R2_KEY_PREFIX`, `OPALREADER_STORAGE`, `opalreader-storage`
  (zero hits), `seedStorageBase` (sole caller prod-d6:2095).
- B-G2 candidate guard: `~/workspace/ch2-program/bg2-build/candidate-tree/v2/worker-entry-prod.js:84–105`;
  B-G3 staging construction as drafted:
  `~/workspace/ch2-program/bg2-build/BATCH-BG3-READINESS-PACKAGE.md` §2.2 (Δ-2, Δ-4).
- Pre-trial build deploy spec: commit `2fe71b5f3194f0c022a5959f1206c57e7a3240f2`,
  `v2/p8/deploy-spec.json` (GitHub API read, 2026-11-16); mirror
  guard at that tree's `v2/worker-entry.js:152–153` (per the S-A2
  finding's source verification).
- Cloudflare reads (2026-11-16T21:24Z, cf-api, read-only): GET
  `/accounts/{acct}/r2/buckets` (one bucket); GET
  `/accounts/{acct}/r2/buckets/opalreader-storage` (ENAM, Standard,
  default); GET `/accounts/{acct}/workers/scripts/opalreader-api-v2/settings`
  (the restored original 8 bindings).
- Cloudflare documentation (read 2026-11-16; both updated
  2026-10-30): R2 Limits —
  https://developers.cloudflare.com/r2/platform/limits/ ; R2
  Pricing — https://developers.cloudflare.com/r2/pricing/ .
- Standing storage figure: weekly free-tier check, full pagination
  2026-10-29 — ≈ 9.48 GB, 6,199 objects, `opalreader-storage`
  (cited with its date in §2; not re-run for this investigation).
