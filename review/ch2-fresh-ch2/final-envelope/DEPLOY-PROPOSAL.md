# DEPLOYMENT RE-PROPOSAL — FINAL combined build (cache fix + quota guard + operator routes), halted pause-first, gate (a) only

**Status: PROPOSAL ONLY — repo-only document, no effect.**
Prepared by Wren under Rowan's **COMBINED SOURCE PASS**
(issue #15, `jedavid33-design/opal-roundtable`, comment
**6546514192**), which passed the combined cache-fix +
quota-budget + operator-route code and named this artifact —
the final combined deployable package and no-effect deployment
re-proposal from the exact final corrected source tree — as the
next required step. **This proposal is not deployment
authorization.** It goes to Rowan for operational readiness
review first; Julie's explicit approval then comes **per gate**
(§8). Nothing in this document, its pin, or its filing
authorizes any production call, read, write, deploy, bootstrap,
disposition, generation, or spend. This drafting made **no
production contact of any kind** — every production figure
below is carried from the recorded execution history and is
re-verified at execution time (P0) before anything is trusted.

**Supersedes:** the quota-fix2-snapshot proposal
(`deploy-proposal/DEPLOY-PROPOSAL.md`, pin `6a7301dc…`, filed
6545996086) and the routes-tree revised plan
(`quota-routes/REVISED-DEPLOY-PLAN.md`, carried forward through
`quota-routes-fix2/REVISED-DEPLOY-PLAN.md`, unchanged in
substance). This re-proposal is that same accepted plan —
Option 3, one combined code deploy; P0 census; strict
provenance drift rule; halt+queue-pause containment; paginated
B2 census; `ok:true` re-arm law — re-based on the **final**
tree, with the final envelope assembled and validated here
(§1.3, §3 D1). Where the older documents' numbers differ from
this one, this one governs; every difference is enumerated in
the companion `REPORT.md`.

**Shape:** a Worker-only deploy in three separately gated
stages:

- **Gate (a)** — a halted, pause-first **code deploy** that ends
  **UNARMED**: the new code lands, the quota guard stays dormant
  (no bootstrap record exists), and the system stays halted +
  queue-paused. Production is currently **armed and unpaused**
  (gate-7 re-arm; the Gate-8 Chapter 2 run completed on it), so
  gate (a) first **creates** the halt + pause hold (Step P).
- **Gate (b)** — a separately authorized production **operator
  bootstrap + read-only reconciliation** (§4, summarized; the
  invocation mechanism now exists in the deployed code — the
  three operator routes).
- **Gate (c)** — any provider-facing test, any generation
  (including the rest of Forever Pucked), Chapter 3, re-arm,
  Batch: **explicitly OUT of scope** (§5).

There is **no client publication** in any gate and **no
playback smoke is claimed** for gate (a) (§3 D4).

---

## 0. Julie-facing summary (plain language)

**What this is.** Three pieces Rowan has now passed together,
at the code level, as one combined tree — sitting in a finished,
tested build that is not live yet:

1. **The cache fix** — repairs the defect that made Chapter 2's
   first generation attempt fail at the final step for all 18
   segments (the audio was made, but the program talked itself
   into believing it wasn't there). Chapter 2 still completed
   through the recovery path and you accepted it; this fix
   removes the defect itself so a future run doesn't waste the
   attempts again.
2. **The quota guard** — a new internal counter that counts
   *actual attempts to reach Google* (up to 12 can hide inside
   one "grant" the old counter saw), capped at 100 per day, so
   generation can never quietly blow past the daily request
   budget. It also slices oversized jobs into daily-sized pieces
   automatically instead of refusing them forever.
3. **The three operator buttons** — narrow, operator-only
   routes to switch the counter on (one time), read its report,
   and settle one flagged old entry by hand. Rowan accepted the
   operator-only lock class; the buttons refuse malformed
   requests by name, can never be fed numbers by the caller, and
   the read button is provably read-only and fully pageable, so
   a large report can be audited to the last entry.

**What would happen, in order, if you approve each stage:**

- **Stage (a) — put the new code live, safely parked.** First a
  read-only roll call (P0) proves nothing is running or
  mid-flight; then the system is switched OFF (generation
  halted, delivery queue paused — it's currently on and idle);
  then the new code is uploaded in one step, the deployed bytes
  are checked against the reviewed code file by file, and
  everything is proven untouched: no generation, no spending,
  Chapter 3 exactly as parked, your listening unaffected. The
  system **stays off** at the end of this stage, and the quota
  guard stays **asleep** — the new code behaves exactly like
  today's code until stage (b) wakes the counter. Your approval
  of (a) authorizes only: the roll call, the switch-off, the
  one upload, and the checks.
- **Stage (b) — wake the counter and reconcile the books.**
  When it runs: the one-time setup counts all past Google
  attempts from the records, exactly once each, and a read-only
  report — paged through completely, never a truncated first
  page — proves the counting is clean. Any past attempt whose
  day can't be *proven* from the records is flagged; for the
  ones whose possible days straddle a midnight, **nobody may
  guess the day, ever** — those simply stay flagged until they
  age out. Each provable one would come to you as its own named
  decision before anything is recorded. If the report comes
  back "not clean but fully explained," that can close stage
  (b) only as a **documented accounting hold** — it can **never**
  be used to turn generation back on; turning back on always
  needs a fully clean report read at that moment, plus your
  separate go-ahead. The system stays off throughout (b). Your
  approval of (b) authorizes only the setup run, the read-only
  report, and the specific dispositions you name.
- **Stage (c) — actually generating anything** is **not in
  this proposal at all**. It comes back later as its own
  decision, with fresh numbers, after (a) and (b) are done.

**What stays untouched throughout:** your books and audio, the
Chapter 3 parked job, the app on your phone/iPad, the frozen
v1 system, your settings and budget figures, and the settled
Chapter 2 accounting (including the one mystery attempt, which
stays recorded exactly as it is — an honest estimate, never a
proven charge).

**One honest caveat up front:** the "100 per day" figure is a
cap *we* chose inside the app. It is **not** a verified Google
limit — nobody has confirmed what Google actually allows this
project per day, and anything else using the same Google
project outside the Reader is invisible to the counter (§7).

---

## 1. The final tree, build identity, and the exact deployable envelope

### 1.1 Lineage (pins on `ui1-review`, `jedavid33-design/opal-reader`, single-parent chain)

```
fbedab3f524333a6fa108087c48b3ebb7f6d5a99   FINAL source head (BUILD-REPORT correction child) ← COMBINED SOURCE PASS 6546514192
02d8473decec570cf10ffe20792fa872e60a3c17   routes-fix2 implementation + tests (QROUTE-20)
76b838b8e5d4d74974074c62c75a9523f054aa77   routes-fix (strict body / pagination / read purity)
60c5b9006aa51abffb747ccb39cdfc3d5128c2d8   operator routes build
6a7301dca1b0f411b773c85e4c9d77620039270b   deploy proposal + envelope snapshot (quota-fix2 tree; SUPERSEDED numbers)
3e6fd3af69fc5643acaca8caf74b7dc523808bfb   quota-fix2 (Holds A+B) — SOURCE PASS 6545910782
3e19d1fdee2501ca542c81186b97e52b7c91d591   quota-fix (corrections 1–3)
461b38aab676cc80b9f3e5c1c28a054c024090d6   quota build (guard implementation + T1–T8)
6a926de498b372cabcd245147de3788eb5a1e1c0   quota addendum + doc correction (design)
dcce900f4a3ccec2c6cbeef7aedf959d81ceebde   remediation package (cache fix) — SOURCE PASS 6544821907
   … Gate-8 / gate-7 / gate-6 / gate-5 lineage …
6a73d9622e1b4eac00c58e289de1c674ed6b3d6b   disposition build = CURRENT LIVE WORKER (rollback floor, §6)
```

**Build marker.** Per the standing build-marker rule, the
deployed Worker's `/health` build will read **the pin commit of
THIS final package** (the pin that carries this proposal, the
harness, and the inventory on `ui1-review`). That pin does not
exist yet at drafting time; **the marker is set at pin time**,
exactly as at every prior deploy: the tree on disk keeps
`BUILD_COMMIT = "UNBUILT"` in `host/build-identity.mjs`
(verified by the harness, E5/E6), and the assembled envelope's
sole stamp part carries the pin exactly once. The harness in
this package was run with a 40-character **placeholder** pin
(the same length as a real commit SHA, so every byte count
below is the byte count the real stamped envelope will have;
only the stamp's content — and therefore the envelope SHA-256 —
changes when the real pin is substituted). Gate (a) step D1
re-reads the real pin, re-runs the harness with it, and records
THAT run's envelope SHA-256; D2 must match it exactly.

**Tree identity.** The deployable tree is
`~/workspace/ch2-program/quota-routes-fix2/worker-build/` —
**805 files, 9,981,856 bytes**, inventoried with per-file
SHA-256 + sizes in the companion **`tree-inventory.json`**
(same schema as the earlier proposal's inventory). Inside it,
`v2/` is a symlink to `worker/` (one physical tree); the
envelope parts below are the `worker/` files under their `v2/`
upload names. The SOURCE-PASS pins carry review snapshots; this
package deploys the **complete tree**, hashed in full in the
inventory. The source tree was only READ during this packaging;
it was not modified.

### 1.2 What the combined build contains (delta vs the live build)

Exactly **7 modified envelope parts + 1 new part + the stamp
part**; the other 19 parts are byte-identical to the live
envelope (hash-verified against the earlier proposal's recorded
live hashes — every needed live hash was recorded there; none
had to be guessed):

- **Cache remediation** (SOURCE PASS 6544821907):
  `host/adapters.mjs` gains `cache.refreshKey(key)` — it
  discards only an exact-`null` memoized miss and rehydrates
  into the same snapshot Map the commit probe reads — and
  `generation/d6-executor.mjs`'s `hydrateProbeKey` prefers it.
  This removes the poisoned-negative-cache defect (Signature B
  of the Chapter 2 diagnosis).
- **Quota guard** (design PASS 6544950778; build approval
  6545090525): new module `generation/quota-budget.mjs` — the
  per-dispatch ledger (`d6_provider_dispatches`, keyed by
  attempt_id) + outstanding-reservation ledger
  (`d6_grant_reservations`, identity
  `qres:${grantId}:${occurrenceId}:${day_key}`), additive lazy
  DDL + bootstrap, derived totals only, closure fence,
  disposition + reconciliation. Hooks in `genstore.mjs`,
  `coordinator.mjs`, `generation/d6-executor.mjs`,
  `generation/service.mjs`; `generation/gen-constants.mjs`
  gains the pinned constant `PROVIDER_ATTEMPT_DAILY_LIMIT =
  100`, labeled in code as an **app-selected Reader policy cap,
  not a verified Google limit** (§7).
- **Corrections and re-review fixes** (quota-fix, quota-fix2):
  cohort-bounded grants (`boundGrantTargets`; `reserveForGrant`
  re-verifies in-transaction); Hold A — grant evaluation runs
  against the bounded cohort on armed D6 non-probe grants;
  Hold B — `disposeBootstrapException` refuses *any* day
  assignment for a multi-day interval
  (`quota_disposition_ambiguous_interval`); disposition day
  validation (real-calendar dates; out-of-interval refusal);
  reconciliation truth (`reconcileQuota.ok` = drift empty AND
  not current-day blocked; `day_over_limit` named refusal).
- **Operator routes** (DP1 Option 1, Rowan 6546037460; Julie's
  build approval 6546054510), all in the entry part, in the
  **operator-alone fence class** Rowan accepted (production
  gate skips the client token; the migration-operator
  credential admits; the entry stamps
  `x-opalreader-operator-admitted` server-side, overwriting any
  caller value; each DO handler re-checks the stamp):
  - `POST /v2/d6-quota-bootstrap` → `bootstrapQuota` —
    **halt-only** and **figureless** (empty body allowlist;
    figure keys refuse as
    `quota_bootstrap_figure_caller_supplied`).
  - `POST /v2/d6-quota-dispose-exception` →
    `disposeBootstrapException` — **halt-only**; closed
    allowlist `{attemptId, dayKey, authorizationRef, source,
    note}`; store refusals pass through unchanged (Hold B
    intact); unexpected store/runtime faults surface as real
    faults (HTTP 500), never laundered into ordinary refusals.
  - `GET /v2/d6-quota-reconcile` → `reconcileQuota` —
    SELECT-only, no halt fence (a read), **no cache flush**
    (read purity independent of cache state), detail arrays
    **paginated** (`exceptionOffset`/`driftOffset`, strictly
    validated integers, fixed page ≤100, per-array totals +
    next-offset signals + `censusComplete`); pre-bootstrap it
    returns the floor shape `{armed:false, ok:false,
    reason:"not_armed"}` verbatim.
- **Route corrections** (routes-fix, Rowan 6546277727;
  routes-fix2, Rowan 6546431837): strict bootstrap body
  handling — the public forward passes the body as **raw text**
  (no parse-and-coerce), the DO handler distinguishes genuinely
  absent/empty or `{}` from malformed JSON
  (`quota_bootstrap_body_malformed`) and explicit `null`
  (`quota_bootstrap_body_null`), both refused **before any
  state exists**; and a body **read failure** is never an empty
  body — both read sites refuse by name
  (`quota_bootstrap_body_read_error`; the public forward
  answers HTTP 400 and forwards nothing).
- **Arming law (unchanged across all builds):** enforcement
  arms only after the durable bootstrap record exists. Pre-
  bootstrap every hook is a no-op and behavior is equivalent
  to the floor build: no quota tables exist, no reservations
  are created. **Gate (a) creates no schema and no bootstrap
  record.**

**Documentation correction (carried as required):** the
18-occurrence regression cohorts are **8 / 7 / 3** (not 8/8/2).
The correction is recorded here instead of rewriting any
immutable prior pin.

**Battery — NOT re-run for this package.** The worker test
battery was **not** run again: the source is unchanged since
the pinned run on this exact tree. That run (Wren-run,
Rowan-inspected, Rowan 6546514192) reports: **135 suites
113 pass / 22 fail; 1,099 tests 1,077 pass / 22 fail**; runner
exit 0 (**wrapper completion — not a claim that all suites
passed**); route suite `quota-operator-routes` **20/20**; the
22 failing suites programmatically set-identical to the
recorded baseline across every build in this chain; zero
`AssertionError`. This is fake-provider / harness evidence
only (§7). **Harness green ≠ production smoke.**

### 1.3 The envelope (exact part list, as produced by the final tree)

Assembled from the final tree's `v2/` layer by this package's
D1 harness (`harness/validate-final-envelope.mjs`, §3 D1):
module parts = the import closure rooted at
`v2/worker-entry-prod-d6.js` over the tree's `worker/` module
set, genuine part names (part name = `v2/` + path under
`worker/`), every part `application/javascript+module` with
`filename` == part name. **28 module parts** — the count is a
harness output on this tree, not an assumption carried from
the earlier snapshot (it happens to match: the routes and
their fixes changed the entry part's *content*, not the module
set). **1,332,876 module bytes on tree bytes**; **1,332,909
module bytes stamped** (the stamp part at 411 B with a 40-char
pin in place of the 378 B UNBUILT tree file, +33 B).

| Part | Bytes (tree) | SHA-256 (tree bytes) | vs live |
|---|---|---|---|
| `v2/api.mjs` | 13,632 | `9b1d0eba128c972b5329020018fefc10b0db9250f3134393de190d54e4e3237d` | identical |
| `v2/audio-route.mjs` | 15,965 | `b6383d21be32f119271e1d39f3894bd7f84b15ac1be4c38655601d1dee20d616` | identical |
| `v2/coordinator.mjs` | 274,953 | `5d0727638b24e497c7b7ca73d6deead411a5ebc8e475163f78aa0b01d72a3de5` | **CHANGED** (live `c31359ae…`, 268,522 B) |
| `v2/executor.mjs` | 13,974 | `5c6db175e68abdf727bf2e1d1a23626be0651db3c6eb48dd4af9e7f7d4ee14c9` | identical |
| `v2/generation/binding-projection.mjs` | 12,818 | `d100f02ce199bbcd6935569c8daabadbd6783d79b0bf1abd41f811e5763d8654` | identical |
| `v2/generation/content-plane-adapter.mjs` | 7,577 | `51c177dd8d2c4c85dbd1ce19180f60f70b3d037c53081be17c9762f93e7b8f38` | identical |
| `v2/generation/d6-executor.mjs` | 46,660 | `c3613a818f598a2fc9f0f975312ad76879edab6bdffcdd06fe3fb2e3b123984c` | **CHANGED** (live `68e3f84e…`, 44,181 B) |
| `v2/generation/d6-work-source.mjs` | 5,981 | `8fa929b2d283084542d9dc76c1e75278d9f5ea4ed7a8d94540e55bef45e05006` | identical |
| `v2/generation/eligible-set.mjs` | 5,978 | `87b4b09ad08a23160a8b473bd0ecb88cf2f7b1d5fcf1ec0d52dbb96920e51a7c` | identical |
| `v2/generation/flush-store.mjs` | 8,497 | `e8f622bf4ed8745dd342cdbdd8d66f2a59a586ce034e8e1b1e21d68a2460f325` | identical |
| `v2/generation/gen-constants.mjs` | 4,936 | `9af664fafc61dff1c16de8f94d06c0097271313bae7327d2a9a9d16efe14c77d` | **CHANGED** (live `6922ad74…`, 3,944 B) |
| `v2/generation/gen-schema.mjs` | 5,307 | `d7ae4936b11fe0d01c9ff8a6e1ccbb7364541ecad7d012b8fc3e712a453aacc5` | identical |
| `v2/generation/genstore.mjs` | 48,703 | `811b6b15b790097ad0010be3c71881c5024331143b4b0e2031392287bb839c2a` | **CHANGED** (live `8602e45e…`, 47,108 B) |
| `v2/generation/grant-guards.mjs` | 12,936 | `9249539fb867fb086338c72840539dcd130062772631a523e2b4373fc5487629` | identical |
| `v2/generation/phase-policy.mjs` | 7,299 | `09883c40e365815f48cc9cb9d3bfdf1908f994b809c73ba27535638c7607f37f` | identical |
| `v2/generation/policy-split.mjs` | 15,074 | `61dc00148c803cb7f6b2eead2ca12caf707a3653bb3d0f7f5c97c9d8fa997876` | identical |
| `v2/generation/quarantine.mjs` | 15,752 | `64a491f3b1345219cb8816b80252908df9aaaadbd67e910547658aa9ade0fe62` | identical |
| `v2/generation/quota-budget.mjs` | 42,048 | `2b39924579e5af2d5d20eea01122d2323ccedac9fe9ff9f7026c49af14770820` | **NEW** (not in the live envelope) |
| `v2/generation/service.mjs` | 77,995 | `aeeee06c8af9789426ae8135bd020be77e8ef3ea350de744472743e3dd14bd1d` | **CHANGED** (live `c4008d98…`, 76,860 B) |
| `v2/host/adapters.mjs` | 39,224 | `f8ac357e3ca4d23bb9edd46dab1843257d26c6fafe6a52b3fffaff676a749368` | **CHANGED** (live `9d07f8db…`, 38,162 B) |
| `v2/host/build-identity.mjs` | 378 (tree) | `bcb29105888bdd91ff9e33650f6d1fb57b4262c2674ca6e70f0076e5a8c6840d` (tree) | stamp part (assembled: 411 B, pin exactly once) |
| `v2/p8/approved-freeze-carry.mjs` | 57,703 | `24ddc8ee428e6e161fc2114af9a572f348db5959977402090539163cacb5bb46` | identical |
| `v2/p8/approved-freeze-chunks.mjs` | 6,101 | `b49cfcfcaf656d957f0c828566d390d6b2bc4b25238885fa60c3e3293563f06a` | identical |
| `v2/p8/approved-freeze-manifest.mjs` | 467,075 | `e59ab3d37245cc049d23215e0538933d633621ceb3fd29e48afdcda07e519edd` | identical |
| `v2/p8/migration-chunk-limits.mjs` | 4,733 | `886c8ea6d79dd6d2014976c50e23fe6553fd3d0ff81dd1f5f2337bf109b0fe41` | identical |
| `v2/worker-entry-prod-d6.js` | 85,577 | `410dfa410abfdb4bfeb81ac1a9c102b89ec6ce68c352b6b6fe3360d7dfe0b017` | **CHANGED** (live `079e982b…`, 64,548 B — the routes + both route fixes live in this part) |
| `v2/worker-entry-prod.js` | 14,480 | `1d2f333a75a3ffff3d4e7c9454f218ba8a8042fab179fcd4f50031c6d80a27c5` | identical |
| `v2/worker-entry.js` | 21,520 | `91daefdd4778599db83024b074a5c4e78ef4d396a5d815712b381d40f72bd6e5` | identical |

Classification totals: **7 CHANGED + 1 NEW + 1 STAMPED +
19 identical = 28 parts.** Reachability is proven, not
assumed: the harness's import closure from the entry resolves
every relative import to an exactly-named part (E3), with the
only bare specifier `node:crypto` (E4); no envelope part is
unreachable and no closure member is missing. Worker files
present in the tree but outside the closure (client modules,
migration modules, `generation/proofs.mjs`,
`generation/settings-reconcile.mjs`, deploy-spec JSON, etc.)
are **not** uploaded — the same discipline as every prior
deploy; they are inventoried in `tree-inventory.json` and
excluded by the closure, exactly as the live envelope was
assembled.

**Metadata** (derived from the tree's D6 spec
`worker/p8/deploy-spec-prod-d6.json`, assembled and validated
by the harness, E7–E18): `main_module:
v2/worker-entry-prod-d6.js`; `compatibility_date: 2026-08-29`
+ `nodejs_compat`; **10 bindings** — the spec's 7 (COORDINATOR
durable-object namespace `OpalReaderCoordinatorProd`;
OPALREADER_STORAGE R2 bucket `opalreader-storage`;
ALLOWED_ORIGIN plain text; OPALREADER_V2_SCOPE plain text
`production`; **GENERATION_HALT plain text `"1"`**;
OPALREADER_PHASE_POLICY plain text `enforce`;
OPALREADER_GENERATION_V2 queue `opalreader-generation-v2`) +
**3 secrets as `{"type":"inherit"}` by name only**
(GEMINI_API_KEY, OPALREADER_ACCESS_TOKEN,
OPALREADER_MIGRATION_OPERATOR_TOKEN — values never read, never
carried); observability enabled + logs enabled + persist;
**no `migrations` key** (no DO migration — the class,
namespace, and account instance are unchanged, and the quota
schema is lazy DDL inside the existing store, created only at
gate (b)). Metadata top-level keys are exactly
`{main_module, compatibility_date, compatibility_flags,
bindings, observability}` (E18).

**Harness outputs on this tree (placeholder pin):** positive
run **PASS 23/23**; assembled multipart envelope **1,339,824
bytes**, SHA-256
`90bdfbe16655692e94b865d048f57ad2027d1ed5bafc6f22663b048856868c7b`
— that SHA is the **placeholder-pin** envelope's and is
recorded for reproducibility of this package only; the
operative envelope SHA is produced at gate (a) D1 with the
real pin (identical byte length) and must match at D2. All
seven negative mutations **FAIL validation** as required (§3
D1, `REPORT.md`).

**Live identity superseded:** Worker `opalreader-api-v2-prod`,
build `6a73d9622e1b4eac00c58e289de1c674ed6b3d6b`, etag
`a9a4c0c40ceefa6138c1cc8ebb3f0ab5b2205e7b7a057b865c8c312cbb13c39e`,
latest deployment `8a83afd0b82944a1801a6d25c84e4749` (the gate-7
A4 metadata upload; module bytes unchanged since the
disposition deploy). Re-verified fresh at gate (a) P0.

---

## 2. Expected pre-state (last recorded; re-verified at P0)

Basis: the gate-7 re-arm execution record (6537844885), the
Gate-8 execution record (pin `ba7bd1e9…`, filed 6538952252),
and the quota-monitor reads of Oct 31, 2026. **These figures
are the last recorded values, not live reads taken for this
proposal** (this drafting made no production contact); P0
re-captures everything and STOPs on any material difference
(§3 P0). There is **no** presumed-listening drift rule: §3 D0's
strict provenance rule governs every comparison.

- `/health`: build `6a73d962…`, generation **"enabled"**
  (`GENERATION_HALT "0"`), scope production, coordinator
  "armed". Bindings: exactly the 10 expected names;
  `OPALREADER_PHASE_POLICY "enforce"`.
- Queue `opalreader-generation-v2` (id
  `93b6a35fb8cf4788a91a2c90b748ae66`): **delivery_paused:
  false** (unpaused at gate-7 A6); sole consumer
  `f260f2188d80426bb0588685e9d084eb`
  (`opalreader-api-v2-prod`); retention 86,400 s.
- Settings: revision **1** (lane standard, cap $50).
- System posture: **armed + unpaused + idle** — no active plan.
- Plans: smoke plan `complete`; old Chapter 2 plan
  `plan:603ab416bd67ab1b25de97be` `retired` /
  `retired_unknown_billing` (38 entries preserved; its stale
  job still `generating` rev 2 with 18 `granted` rows + one
  grant still `issued` rev 2 — proven non-executable by the
  gate-7 fence demonstration, untouched by design); fresh
  Chapter 2 plan `plan:b2dc2a3d1cd367a0245b9102` **`complete`**
  (38 entries: 20 bound_already + 18 eligible, all 18 done,
  accepted — Rowan RECORD PASS 6544061295 + Julie's playback
  check Oct 31, 2026).
- Chapter 3 job
  `1832c21fcf0425454227c4736048a8a632f422abca4a2685ddb775bb1681406a`:
  **`parked_policy`** rev 1, 27 rows (3 ready / 24 pending),
  fingerprint
  **`b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`**
  (exact through every gate since G8).
- Phase accounting (`forever-pucked`, micro-cents,
  recorded/known kept separate from modeled): settled
  **579,339**; estimatedUnverified **19,018**;
  reservedUnverified **5,648**; unknownOpen **0**; remaining
  **12,915,013** of 13,500,000; `unverifiedStatus:
  provider_unverified`. (Billing truth, carried verbatim in
  substance from gates 5–7: the 19,018 estimate is an
  occurrence-length model proxy, **not** an observed Google
  charge; the 5,648 reservation is a persisted modeled
  allowance, **not** a verified upper bound; the two sit on
  unlike bases; **the actual Google charge for the disposed
  attempt remains UNKNOWN**.)
- Phase binding recorded: `forever-pucked` ↔ bookId
  `5c589095-f812-48a2-8ab2-03ba2791f2b2` (registry is the
  complete authority; unbound phases fail closed).
- Quota view (coordinator ledger — **grant-time estimates, not
  provider spend**; last recorded Oct 31, 2026 ~12:48 a.m. ET,
  dayKey `2026-10-30`): attemptsToday 18 / dailyLimit 100,
  spentMicroCents 725,221, ledgerSeq 37. **No provider-attempt
  fields exist in the live build** — the live quota view is the
  floor shape; its post-deploy unarmed shape is specified at
  D4.
- Watermarks: content **18** / bindings **1818** (bindings
  moved 1800 → 1818 by the Gate-8 run's 18 d6-provenance
  bindings).
- `/v2/conflicts`: exactly the two recorded `schedule_dead`
  lease rows.
- **Zero quota footprint:** the live build contains no quota
  code; no `d6_provider_dispatches` / `d6_grant_reservations`
  tables, no bootstrap record, no dispositions exist. This is
  the precondition §6's pre-bootstrap rollback window depends
  on; gate (a) preserves it (the deploy never invokes the
  bootstrap), and D4 re-verifies it through the reconcile
  route's floor shape.
- Neighbors unchanged: v1 Worker etag `ea6f8196…`, v1 queue
  paused; staging etag `61553a07…`; client `main` @ `232cc00e…`
  (untouched by every gate of this proposal).

---

## 3. Gate (a) — the operational checklist (revised, final tree)

Julie's gate-(a) approval authorizes exactly: P0 (read-only),
Step P (the halt flip + queue pause), D0–D1 (read-only /
local), the D2 upload, and the conditional D3 observability
PATCH. Nothing else. **Sequence: P0 → Step P (P1–P3) → D0 →
D1 → R → D2 → D3 → D4.** Every step's result is read back
before the next begins. Any STOP condition ends the run in the
safest state reached; nothing is retried under the same
approval.

### P0 — Read-only live census + race fence (Amendment 1)

Before P1 touches anything, a **read-only** census establishes
the exact pre-state. GETs and connector reads only; P0
performs no mutation of any kind. P0 records:

1. **Worker identity:** the exact live build (`/health`: build
   `6a73d962…`, generation state) and the script **etag**
   (`a9a4c0c4…` at last verification; re-read, never assumed).
2. **Bindings + operator readiness:** the bindings list from
   `GET /workers/scripts/{name}/settings` (names + types only —
   secret values are never exposed or read), confirming the
   bindings the combined build expects, **including the
   presence of the migration-operator credential binding** the
   new routes (and gate (b)) depend on. Readiness is
   presence/shape only; no credential value is displayed,
   logged, or tested against production in P0.
3. **Hold state:** `GENERATION_HALT` current value (expected
   `"0"` — production is currently armed and idle; P0 records
   whatever it actually is).
4. **Queue state:** the queue's consumer list (sole consumer
   `f260f2188d80426bb0588685e9d084eb` expected) and
   `delivery_paused` (expected `false`).
5. **Fresh generation-plane census:** active plans and jobs
   (expected: none active — smoke `complete`, old Ch 2
   `retired`, fresh Ch 2 `complete`, Ch 3 job `parked_policy`);
   in-flight dispatches/attempts (expected: **zero**); claims
   and grants outstanding (expected: only the retired plan's
   known stale rows, proven non-executable by the gate-7 fence
   demonstration); Chapter 3 state + fingerprint (expected:
   `parked_policy`,
   `b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`);
   unknown-billing status (expected: `unknownOpen 0`); phase +
   settings spending controls (expected: forever-pucked settled
   579,339 / estimatedUnverified 19,018 / reservedUnverified
   5,648 / remaining 12,915,013; settings revision 1).

**P0 STOP conditions** — any one of these ends the run before
P1:

- any **active generation** (a plan or job in a dispatching
  state, or any sign of a live run);
- any **unknown in-flight provider call** (a dispatching
  attempt whose outcome is not recorded, or a claim/grant that
  could still dispatch);
- any **new dispatch risk** or **material difference** from
  the recorded idle pre-state (build, etag, bindings, queue,
  plan/job states, Ch 3 fingerprint, unknown-billing, spending
  controls);
- any census item that **cannot be established** (a read
  fails, a surface is unreachable, a value is ambiguous).

Why the fence exists (stated plainly): the halt at P1 prevents
NEW dispatches from the moment it lands; it is **not** proof
that a provider request already in flight before P1 was
canceled. P0 therefore has to show zero in-flight work BEFORE
the halt is flipped, and P3 re-reads the same census after the
hold to prove **nothing slipped across the halt transition**.

### Step P — Create the hold (P1–P3)

Production is armed + unpaused + idle (§2), so gate (a) begins
by reversing the gate-7 A4/A6 acts:

- **P1 — Halt flip (metadata-only).** Freshly download the
  live parts (first verified byte-identical to the recorded
  live envelope — 27/27 parts); re-upload them
  **byte-identical** with the live metadata, changing exactly
  one value: `GENERATION_HALT` `"0"` → `"1"` (the proven gate-7
  A4 mechanism, reversed). A code PUT is NOT used for the halt.
  Expected: PUT HTTP 200; **script etag UNCHANGED**
  (`a9a4c0c4…` — the etag is content-derived and the module
  bytes do not change, exactly as at A4); a new deployment id
  is recorded; observability expected to survive. Read-backs:
  `/health` generation "halted", build still `6a73d962…`;
  bindings name-keyed diff vs §2 = exactly one entry. **STOP**
  if the etag changes, the parsed-JSON metadata diff is not
  exactly one value, or any read-back disagrees.
- **P2 — Queue pause.** PUT the queue with `queue_name` +
  `settings.delivery_paused: true` (cf-api body as the
  positional argv JSON — a `--data` flag is silently ignored by
  this CLI; the mutation is never trusted without read-back).
  Read-back: `delivery_paused == true`, sole consumer
  unchanged, retention unchanged. **STOP** on any mismatch.
- **P3 — Halted-idle verification.** Re-run the P0
  generation-plane census. Required: `/health` generation
  `"halted"`; the diagnostics/quota views show no active plan
  or job; Chapter 3 fingerprint unchanged; unknown-billing
  unchanged; **and the census is identical to P0's** — nothing
  slipped across the halt transition. Any delta = **STOP**
  with the hold in place.

The hold then persists through D0–D4, the rollback decision
point R, and — if gate (a) completes — **indefinitely, until a
later gate's own approval changes it.** Gate (a) never
un-holds.

### D0 — Two-sample before-state, STRICT drift rule (Amendment 2)

Two independent samples of production state, taken minutes
apart, both AFTER the hold is proven (P3). Sample contents
(each): script etag + `/health`; full settings read-back
(bindings names/types via `/settings`); queue state; sync
snapshots for `content` and `bindings` families (full
payloads, digested); plans list + the Ch 3 job; settings
revision + quota view; phase accounting. D0's verified state
becomes the **baseline** for D4 and for any rollback
accounting.

The drift rule for every comparison in this plan (D0, D4,
rollback accounting) — the prior "listening drift is carried"
rule is **struck**; bindings drift is **not** auto-classified
as listening:

- **Generation plane** (plans, jobs, attempts, grants, claims,
  quota counters, phase accounting, settings revision, Ch 3
  state/fingerprint): **strict identity.** Any delta = STOP.
- **Bindings / content** (audio bindings, book content,
  occurrence data): **no automatic classification.** Every
  differing entity requires a **per-entity source/provenance
  diff** demonstrating the change is an approved,
  non-generation mutation (e.g. a Shelf listening-session
  append through the frozen bridge, a client sync write) —
  with the evidence recorded. **Any unexplained binding/content
  change, and any change consistent with unapproved synthesis,
  binding overwrite, new generation, or data loss = STOP**,
  not a carried-forward baseline.
- **Session / playback-position state** may differ only with
  the same source evidence (which surface wrote it, when, under
  whose action). "It looks like listening" is not evidence.
- **Chapter 2 and parked Chapter 3 keep strict identity** in
  all cases — no provenance exception applies to their
  generation-relevant state.

### D1 — Validate the FINAL combined tree (Amendment 4; this package's harness, re-run)

D1 validates the **final combined tree** — the exact tree
Rowan source-passed (6546514192). Nothing about the envelope
is inherited from any prior plan's D1. D1 produces, as harness
outputs (counts are outputs, never assumptions):

1. **Fresh lineage:** this package pinned as ONE single-parent
   child on `ui1-review` (per-blob SHA assertions; commit
   message verified; pin read back). The pin is the build
   marker (§1.1).
2. **Machine-readable inventory:** the pinned package's
   `tree-inventory.json` (every file of the final tree,
   SHA-256 + bytes — 805 files, 9,981,856 B), checked against
   the pinned snapshot.
3. **The assembled envelope, re-validated with the real pin:**
   re-run `harness/validate-final-envelope.mjs --pin <pin>`
   against the final tree. Required: **PASS 23/23** (the check
   count this package's harness produces — E1–E23: spec
   identity, entrypoint, import-closure resolution,
   node:-only bare specifiers, per-part hash comparison, stamp
   exactly once, 7 spec bindings exact, phase-policy shape,
   3 inherit secrets / 10 bindings / no `secret_text`, no
   `migrations` key, DO topology, queue topology, compatibility
   2026-08-29 + `nodejs_compat`, observability, multipart
   round-trip, `GENERATION_HALT "1"`, exact metadata key set,
   inventory agreement (E19), and the operator-fence source
   assertions E20–E23). Record: final part count (**28** as
   produced), stamped module bytes (**1,332,909**), assembled
   envelope bytes and **envelope SHA-256** (the operative one
   D2 must match).
4. **Rowan's changed-file blob comparison:** fetch the 7
   CHANGED parts + the NEW part as Git blobs from the pinned
   source lineage (`fbedab3f…` / `02d8473d…` review paths) and
   compare against §1.3's hashes — all eight must MATCH
   byte-for-byte (the entry part `410dfa41…`, coordinator
   `5d072763…`, d6-executor `c3613a81…`, gen-constants
   `9af664fa…`, genstore `811b6b15…`, service `aeeee06c…`,
   adapters `f8ac357e…`, quota-budget `2b399245…`); the
   remaining parts are proven by the harness manifest +
   inventory. (The package-level pin's own changed files —
   this proposal, the harness, the inventory, the report — are
   verified by the same per-blob discipline at pin time.)
5. **Negative mutations** — the assembly must REFUSE each of,
   re-run at D1 (this package's harness, `--mutate <name>`;
   every one FAILed validation in this package's run — see
   `REPORT.md` for the verbatim failing checks):
   - **missing part** (`drop-part`: `v2/generation/quota-budget.mjs` removed);
   - **duplicate part** (`duplicate-part`: `v2/host/adapters.mjs` assembled twice);
   - **wrong part hash** (`wrong-hash`: one byte flipped in `v2/host/adapters.mjs`);
   - **spoofed operator route** (`spoofed-operator-route`: the
     DO bootstrap handler's admitted-stamp check removed —
     refused by the E20 fence assertions, so a fence-weakened
     entry can never assemble; this includes any variant that
     would trust a caller-supplied stamp, since the stamp is
     set server-side exactly once in `forward()` — E23);
   - **wrong `GENERATION_HALT`** (`wrong-halt`: `"0"`);
   - **unexpected metadata** (`unexpected-metadata`: an extra
     top-level key);
   - **`migrations`** (`migrations`: a migrations key added).
6. **Fake/harness rehearsal record:** the route + quota suites
   of the pinned battery (§1.2) stand as the rehearsal evidence
   for halt enforcement, pre-bootstrap data-unchanged, and
   no-provider-call behavior on this exact source (all fakes;
   zero provider calls). Queue-pause is a runbook precondition,
   not a code property (the Worker cannot read queue state —
   its binding is send-only). Rollback STOP behavior is
   source-traced against §6. A harness result is process
   evidence only — it is not a provider-facing smoke and is
   never reported as one.

**STOP** on any mismatch in D1.

### R — Rollback decision point

After D1 and before D2, the run pauses and the D0/D1 evidence
is reviewed. Proceeding to D2 requires the gate-(a) approval's
own terms (Julie's approval for gate (a) names D2 explicitly,
as in prior deploys). No new approval is minted by R; it is
the last no-consequence exit.

### D2 — The single code PUT

- ONE multipart PUT of the D1-assembled envelope with the D1
  metadata: `main_module` + a `filename` attribute on every
  file part, secrets inherit-by-name, `GENERATION_HALT "1"` in
  metadata (lands halted — the value Step P already set; this
  deploy's code change is the only new thing). No second PUT
  under this approval for any reason.
- Precondition read-back immediately before the PUT:
  `delivery_paused == true`, halt "1". Re-verify the envelope
  SHA-256 immediately before upload. Record: HTTP status, new
  etag, deployment id. Read-backs: `/health` build == this
  package's pin, generation "halted"; bindings exactly the 10
  expected names with halt "1" and phase policy "enforce".
- On ANY failure or ambiguity at D2: **stop and only look** —
  no retry, no rollback PUT, no fix-forward without a fresh
  approval (the C2 discipline of the Oct 30 deploys). **STOP**
  on any read-back mismatch (rollback per §6, separately
  authorized).

### D3 — Observability (conditional PATCH)

After the PUT, GET `/workers/scripts/{name}/script-settings`:
observability must show enabled + logs enabled + persist
(carried in the upload metadata; it survived at G4, the
seed-fix deploy, Gate 1, the combined deploy, the disposition
deploy, and the A4 flip). **If and only if** the upload reset
observability to null: re-apply it with ONE observability-only
settings PATCH — multipart PATCH to
`/workers/scripts/opalreader-api-v2-prod/settings` (the write
path is `/settings`, NOT `/script-settings`), a single
`settings` part (Content-Type application/json) holding the
approved observability object only; no other settings edits.
Then verify the script etag is **unchanged** by the PATCH
(the settings PATCH does not touch code) and read the restored
observability back. If observability survived, D3 is a
recorded no-op. **STOP** if observability cannot be restored
with the etag unchanged.

### D4 — Post-state verification (read-only)

All reads; the run ends **halted + paused + UNARMED**.

1. **Deployed parts:** download the live script; all **28
   parts byte-identical** to the D1 envelope (stamp = this
   package's pin); script etag on download equals the D2 PUT
   etag; `/health` build = the pin; generation `"halted"`.
   Representation note, stated plainly (from the prior
   records): the GET script response carries the module parts
   only — no `metadata` part is returned in that
   representation; the metadata's operative content is proven
   by the D2 PUT response and the GET /settings bindings
   read-back (exactly the 10 expected bindings, halt "1",
   policy "enforce").
2. **Data integrity vs the D0 baseline**, under the §3 D0
   strict rule: plans/jobs/Ch 3/settings/watermarks compared
   per-entity; any unexplained delta = STOP (the deploy record
   reports it; no remediation under this approval). Data
   comparison follows Rowan's standing interpretation:
   **unchanged DATA, not identical JSON shapes** — the new
   build's legitimate additive keys are named and stripped in
   the comparison tool, never silently flagged away.
3. **Unarmed quota view:** `GET /v2/d6-quota-reconcile` via
   the operator connector returns the **floor shape** —
   `{ armed: false, ok: false, reason: "not_armed" }` —
   proving the route and its fence work live AND that the
   guard is present but **UNARMED**: no bootstrap record
   exists, no quota table was created by gate (a), the counter
   is not yet counting. (A read of a SELECT-only surface — the
   one route gate (a) exercises. It is not a generation smoke
   and proves nothing about provider behavior.)
4. **Playback sanity (READ):** the sync surfaces are
   read-verified (content watermark 18, bindings watermark
   1818 and a bindings snapshot read through the client
   connector) — playback data is intact and servable. **No
   playback smoke is claimed for this halted deploy**: the
   deploy swaps Worker code only, the client and the state
   plane are unchanged, and Julie may listen freely at any
   time, as throughout every prior halted window; a device
   playback check is available to her on request but is not a
   gate-(a) step.

**Gate-(a) end state:** new build LIVE (this package's pin),
generation HALTED (`GENERATION_HALT "1"`), queue delivery
PAUSED, settings rev 1, **quota guard UNARMED** (no bootstrap
record, no quota tables, no reservations — the deployed code
is behavior-equivalent to the floor build until gate (b)),
Ch 2 plans `retired` + `complete` as before, Ch 3
`parked_policy`. Nothing bootstrapped, nothing dispositioned,
nothing reconciled against production (beyond the D4 floor-
shape read), nothing retired, nothing released, nothing
generated, nothing spent.

**STOP conditions (any step of gate (a)):** any value
differing from §2/§3 expectations; any envelope hash, part, or
identity mismatch; any non-200 or ambiguous mutation response
(read back before concluding anything — a bodiless or failed
call is never assumed to have landed or not landed); queue or
halt state UNKNOWN at any point; observability unrestorable
with etag unchanged; any urge to widen scope (client change,
data write, bootstrap, a "test" disposition — all outside
gate (a)). On STOP: preserve all evidence, change nothing
further; containment is read-back only — **no automatic retry,
rollback, or fix-forward**; any of those requires fresh Julie
authorization. Report to Julie and the board. A stopped deploy
is never restarted on the executor's own call; a fresh Julie
Go covers one attempt.

---

## 4. Gate (b) — bootstrap, reconcile, dispositions (SEPARATE approval — summarized)

Gate (b) begins only after gate (a) completes and its record
is reviewed. Production enters gate (b) **halted + paused**,
and leaves it the same way. Julie's gate-(b) approval
authorizes exactly: B0, the one B1 bootstrap invocation, the
B2 read-only reconciliation, and **only those B3 dispositions
she names individually**. All three acts run through the
existing operator connector
(`custom.opalreader-v2-prod-operator`), one credential
surrogate per request, with the production scope/instance
headers:

- **Bootstrap:** `POST /v2/d6-quota-bootstrap` — **no body
  fields** (figureless; absent/empty or `{}` is the only
  admissible shape).
- **Reconcile:** `GET /v2/d6-quota-reconcile` — paginated
  (`?exceptionOffset=N&driftOffset=N`, fixed page ≤100,
  per-array totals + next-offset signals + `censusComplete`).
- **Disposition (per attempt):** `POST
  /v2/d6-quota-dispose-exception` with exactly
  `{ attemptId, dayKey, authorizationRef, source, note }`.

- **B0 — Preconditions re-verified (same session).** `/health`
  build = the gate-(a) pin; generation `"halted"`;
  `GENERATION_HALT` read-back `"1"`; queue `delivery_paused ==
  true` read back by cf-api (this is P2/P3's hold, re-proven —
  not assumed to have persisted). The Worker **cannot read
  queue state** (its queue binding is send-only), so halt is
  enforced in code (the state-changing handlers refuse unless
  `GENERATION_HALT` is exactly `"1"`, inside the DO before any
  store contact) and **queue-pause is an execution-time
  precondition**, re-verified by cf-api read-back **immediately
  before B1 and again before each B3 call**, in the same
  session. A failed re-verification = STOP, no call. The D4
  unarmed floor shape is re-read (reconcile: `not_armed`); any
  other answer = STOP.
- **B1 — The bootstrap (ONE call).** Exactly one figureless
  bootstrap call. It ensures the quota schema (additive lazy
  DDL), backfills historic attempts from their own surviving
  evidence (provable same-day or dispatching-phase assignments
  stamped exactly; **ambiguous rows are assigned nothing** and
  reported as exceptions, never guessed), writes matching
  dispatch-ledger rows, and writes the arming marker last. It
  takes **no caller figures**. It is idempotent (an accidental
  second call assigns nothing twice and never rewrites the
  record) — the approval still authorizes exactly one
  deliberate call. **Honesty note:** this is the quota code's
  **first real-DO execution** — the lazy DDL inside its
  transaction is proven against the harness's throwing-`.one()`
  SQLite semantics, the same posture as the adjudication
  lazy-DDL precedent, but no harness result is a production
  smoke (§7). The invocation happens halted + paused, so a
  failure here can strand nothing: the transaction either
  commits whole or not at all. The response's bounded exception
  detail is a finding to enumerate fully at B2, never a
  complete census by itself.
- **B2 — Complete paginated reconcile census.** Page the
  exceptions and drift arrays via `exceptionOffset` /
  `driftOffset` until each array's next-offset signal is null,
  collecting every page. The census is valid only if the pages
  are disjoint, their union is the full set, the per-array
  totals reported on every page agree with the number
  collected, and a final read-back reconciles. **STOP and
  archive the report as INCOMPLETE — the gate does not close
  and no B3 decision rests on it — if any page is missing or
  fails, if a total count changes unexpectedly mid-census, if
  pages overlap or do not sum to the reported totals, or if
  read-back fails.** A truncated first page is never treated
  as a fully explained census, and un-dispositionable
  (midnight-straddling) exceptions are enumerated by paging
  like everything else. Outcomes of a COMPLETE census:
  - **`ok === true`:** the ledger, reservations, and stamps
    agree and no current-day exception blocks. Gate (b) may
    proceed to B3 decisions on a clean report.
  - **`ok === false`, fully explained:** gate (b) may complete
    **only as a DOCUMENTED ACCOUNTING HOLD**: every discrepancy
    and every open exception is enumerated in the gate-(b)
    record; no unexplained drift exists; the system is left
    **halted + paused** with the hold recorded in explicit
    terms. **This is not re-arm clearance** — see the re-arm
    law below.
  - **`ok === false` with anything unexplained:** STOP; the
    hold is recorded as unexplained; no B3 under this
    approval.
  Bootstrap is **not** arming for generation: it turns on
  accounting only. Generation stays halted + paused regardless
  of B2's outcome.
- **B3 — Dispositions (each one a named sub-decision).** For
  each bootstrap exception Julie chooses to settle, ONE
  disposition call naming that attempt, its day, and her
  recorded approval reference (`authorizationRef`). Hard rules
  (store-enforced; the route cannot weaken them):
  **same-day intervals only** — a multi-day (PT-straddling)
  exception refuses `quota_disposition_ambiguous_interval`,
  permanently, by design (Hold B); it is never dispositioned
  and cannot be overridden by any approval; the named day must
  lie inside the attempt's own evidence interval and be a real
  calendar day (the store proves both); an unattributable
  exception refuses `quota_disposition_unattributable`;
  exactly-once (a second disposition of the same attempt
  refuses `quota_disposition_not_an_exception`); any recorded
  counter realignment is part of that disposition's record,
  never silent. Each B3 call is preceded by the B0 halt+pause
  re-verification and followed by a reconcile read showing the
  exception list shrink by exactly that attempt. No bulk
  disposition exists or may be improvised: one attempt, one
  sub-decision, one invocation.
- **Gate-(b) end state:** quota guard **ARMED** (bootstrap
  record exists; enforcement live in code), generation still
  HALTED, queue still PAUSED. Bootstrap is **not** a re-arm:
  the halt flip and queue unpause are gate-(c)-class acts and
  are not part of gate (b). Nothing generated, nothing spent,
  no plan state changed.

**The re-arm law (Amendment 3 — binding everywhere in this
plan).** No step of any gate in this plan re-arms generation.
Any FUTURE re-arm must satisfy **all** of: (1) the guarded
build (this combined build or a successor Rowan has
source-passed) is the live build; (2) a reconcile read **at
the re-arm moment** returns **`reconcileQuota.ok === true`** —
an explained `ok === false`, including a gate-(b) documented
accounting hold, **never** satisfies this, at any gate, in any
window (including a rollback window; §6 conforms); (3)
**Julie's separate explicit GO** for that re-arm, naming it;
(4) all quota/halt/queue checks of that re-arm's own runbook
pass at execution time; (5) a multi-day exception's accounting
hold expires **only when the clock leaves its interval** (the
current PT day is past the interval's last day) **and** a fresh
reconcile then reads `ok === true` — nothing else clears it;
(6) **missing route or failed bootstrap = do not re-arm** (if
the reconcile surface is unavailable or the bootstrap record
is absent at re-arm time, re-arm is refused outright).

---

## 5. Gate (c) — generation (OUT OF SCOPE)

Explicitly **not** part of this proposal's execution scope,
and not authorized by approving gates (a) or (b): any
controlled provider-facing test; any generation intent
(including the rest of Forever Pucked at book scope); the
Chapter 3 parked-job resume; re-arm (halt flip + queue
unpause — governed by §4's re-arm law when its own time
comes); Batch arming; any quarantine release. Each requires
its own proposal, Rowan's review, a fresh live quote where
costs are involved, and Julie's fresh GO — in that order.
Standing notes carried for that future gate, not decided
here: a generation proposal must also resolve the
fingerprint-key occupancy preflight (separately authorized
read-only R2 HEAD) **or** carry the unverified-exposure
disclosure + distinct decision; Chapter 3 resumes only on
Julie's explicit word with its mechanism verified first; the
Gate-8 GO covered exactly one submission and is spent.

---

## 6. Rollback law

- **The floor — PERMANENT.** The disposition build
  **`6a73d9622e1b4eac00c58e289de1c674ed6b3d6b`** (deployed
  script etag **`a9a4c0c4…`**) plus its data is the rollback
  floor: adjudication rows exist in the store (the gate-5
  disposition executed), so **no pre-disposition build may
  ever run against this data again**. Any rollback target must
  be at or above the floor, where "at or above" means **proven
  adjudication compatibility of the exact target build** — its
  accounting demonstrated to expose
  `estimatedUnverifiedMicroCents` /
  `reservedUnverifiedMicroCents` exactly and to keep
  `provider_unverified` visible — **not** merely a newer SHA,
  date, or branch position. (The floor build itself is
  compatible by identity: it *is* the adjudication build.)
  This combined deploy does not lower the floor; it raises the
  guarded ceiling.
- **The floor does NOT enforce the provider-attempt counter —
  stated plainly.** The floor build has no quota code at all.
  Never claim otherwise, in any record, at any point. While the
  floor build runs, dispatches are **uncounted by the guard**
  — not prevented, not budgeted. Rollback safety therefore
  rests **entirely** on the holds (below), never on the floor's
  accounting.
- **Primary posture: fix-forward.** If gate (a) D4 or gate (b)
  fails on a defect in the new code, the system is already in
  its safest state (halted + paused; gate (a) writes no data;
  gate (b)'s bootstrap is one whole transaction), so diagnosis
  proceeds without time pressure and any corrective deploy is
  a new, separately authorized act.
- **Clean pre-bootstrap rollback window (gate (a) only).**
  From D2 until the gate-(b) bootstrap runs, **no quota schema
  or data exists** (the tables are created inside the
  bootstrap transaction; D4 verifies the unarmed floor shape).
  A rollback inside this window is therefore data-clean: it
  needs only (i) Julie's separate authorization, (ii) the hold
  (halt + pause) in place, (iii) a code PUT of the floor
  build's envelope (deterministically re-assemblable from its
  pin; 27 parts + metadata, validated at the disposition
  deploy) or the then-current guarded build, (iv) D3-style
  observability verification with etag-unchanged proof, (v)
  figure read-backs matching the D0 baseline under the §3 D0
  strict rule. The window's precondition (zero bootstrap
  footprint) must be re-verified from the store-facing reads
  before any rollback upload. A rollback upload is itself a
  deploy.
- **Post-bootstrap rollback (after gate (b) has run).** The
  store then contains the quota tables, the bootstrap record,
  derived ledgers, and any B3 disposition records. Those tables
  are additive-only and are **never read by the floor build's
  code** — a rollback to the floor build does not corrupt them
  and they remain on record for a later re-upgrade. Governing
  rules: (1) the **hold (halt + queue-pause) is held for the
  entire floor window** — a rollback never transits an armed or
  unpaused state; no halt flip, no queue unpause, no grant, no
  generation, no spend, for any reason, including "test"
  unpauses; (2) an **external accounting archive** (the
  reconcile report — complete, paginated — + the bootstrap
  record + every disposition record, plus the adjudication
  rows and the affected phase's full five-figure accounting)
  is exported and pinned **before** the rollback PUT, and is
  the exit gate's comparison baseline; (3) the rollback target
  must have **proven compatibility** with the quota records
  (source-level proof, not commit recency) — in practice the
  guarded build itself or a successor that reads the same
  tables; (4) re-arming out of a floor window is governed by
  §4's re-arm law **in full**: guarded build restored **and**
  `reconcileQuota.ok === true` read at the re-arm moment
  **and** Julie's separate GO — an explained `ok === false`
  never suffices; (5) a floor-build dispatch made in defiance
  of the holds would be *detected* on re-upgrade as an
  unstamped bootstrap exception (detection and accounting, not
  prevention) and would block its day until dispositioned or
  aged out — it is not silently absorbed.
- **Pre-rollback holds (before ANY rollback, either window):**
  (1) capture the external accounting archive (above); (2)
  verify and hold `GENERATION_HALT = "1"` (bindings read-back
  + `/health` halted; set and read back first if not set);
  (3) verify the queue PAUSED (`delivery_paused` = true,
  cf-api read-back); (4) generic re-arm BLOCKED for the whole
  window.
- **Rollback STOP conditions:** hold cannot be established or
  proven; the accounting archive cannot be produced;
  target-build compatibility is unproven; read-backs after the
  PUT differ from expectations under the §3 D0 strict rule. A
  stopped rollback leaves the system **halted + paused on the
  current build** — always a safe resting state.
- **Exit gate (verifiable):** the rollback is not complete
  until the post-rollback inventory matches the archive
  baseline under the strict rule and the system rests halted +
  paused on the target build, with the record filed.

---

## 7. Disclosures (standing honesty lines)

- **100/day is an application-selected cap**, not a verified
  Google limit. The project-specific Google limit is **not
  known**; the provider's 429 remains the final external
  backstop only. Nothing in this plan claims the counter proves
  compliance with an external limit — it proves the
  application's own dispatches stay within the application's
  own budget.
- **Outside-Reader usage is uncountable.** Anything else using
  the same Google project outside the Reader is invisible to
  the counter, permanently.
- **Winner provenance stays UNRESOLVED** (the diagnosis's
  Signature A question: which side won the fingerprint-key
  collisions). No R2 read is folded into any gate of this plan;
  closing it needs its own authorization, only if Rowan
  requires it. **The historical (disposed) attempt's actual
  Google charge likewise remains UNKNOWN** — the recorded
  estimate is a model proxy, never a proven charge (§2).
- **Harness green ≠ production smoke.** Every test and every
  validation in this program is a fake/harness artifact with
  zero provider calls: the pinned battery (§1.2), this
  package's envelope harness (§1.3/§3 D1), and the D1 rehearsal
  record. None of them is a real-DO execution or a provider
  verification; gate (b)'s bootstrap is flagged as the quota
  code's first real-DO execution (§4 B1), and no gate of this
  plan claims a provider-facing smoke.
- **Ledger figures are recorded/known application accounting**
  in micro-dollars despite the `MicroCents` names — never
  provider-confirmed spend. Recorded charges, unverified
  estimates/reservations, and remaining authorization are
  always shown as three separate lines.
- **Bootstrap census unknowable in advance.** The exact
  assigned/exception split of the historic attempts is known
  only when B1 runs; this plan commits to the *rules* (exact
  evidence or exception, never a guess), not to a predicted
  split.

---

## 8. Non-authorizations and the approval sequence

This proposal authorizes **nothing** by itself. It does not
authorize: any deploy, halt flip, queue pause, bootstrap,
reconcile or disposition invocation against production, merge,
settings change, client publication, generation, Chapter 3
movement, Batch arming, quarantine release, rollback, or spend.

The sequence from here:

1. **Rowan's operational readiness review** of this final
   package (envelope, harness outputs, this checklist) — no
   Julie action; Wren pins + files.
2. **Gate (a) approval (Julie)** — P0 → Step P → D0 → D1 → R →
   D2 → D3 → D4 exactly as §3. Ends halted + paused + unarmed.
3. **Gate (b) approval (Julie)** — B0 → B1 (one bootstrap
   call) → B2 (complete paginated census; an incomplete census
   STOPs and is archived as INCOMPLETE; an explained
   `ok:false` on a complete census closes only as a documented
   accounting hold) → any B3 dispositions, **each named
   individually**. Ends halted + paused.
4. **Gate (c) (Julie, separate, later)** — any generation,
   re-arm (under §4's re-arm law), or Chapter 3 movement. Not
   scoped here.

— End of re-proposal —
