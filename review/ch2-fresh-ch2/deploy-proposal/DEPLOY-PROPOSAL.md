# DEPLOYMENT PROPOSAL — combined cache-remediation + quota-guard build, halted pause-first

**Status: PROPOSAL ONLY — repo-only document.** Prepared by Wren
under Rowan's SOURCE PASS (issue #15,
`jedavid33-design/opal-roundtable`, comment **6545910782**),
which passed the combined cache-remediation + quota-guard tree
at source level and named this proposal as the next gate. **This
proposal is not deployment authorization.** It goes to Rowan for
operational-plan review first; Julie's explicit approval then
comes **per gate** (§8). Nothing in this document, its pin, or
its filing authorizes any production call, read, write, deploy,
bootstrap, disposition, generation, or spend. This drafting made
**no production contact of any kind** — every production figure
below is carried from the recorded execution history and is
re-verified at execution time before anything is trusted.

**Shape:** a Worker-only deploy in **three separately gated
stages**, modeled on the disposition deploy (proposal pin
`ea654d20…`; executed Oct 31, 2026, record 6536769361) and the
gate-7 re-arm (proposal pin `75368c31…`; record 6537844885):

- **Gate (a)** — a halted, pause-first **code deploy** that ends
  **UNARMED**: the new code lands, the quota guard stays dormant
  (no bootstrap record exists), and the system stays halted +
  queue-paused. One stage differs from the disposition deploy:
  production is currently **armed and unpaused** (gate 7 re-armed
  it, and the Gate-8 Chapter 2 run completed on it), so gate (a)
  must first **create** the halt + pause hold (Step P) rather
  than merely verify it.
- **Gate (b)** — a separately authorized production **operator
  bootstrap + read-only reconciliation**: run `bootstrapQuota`
  once against real history, read `reconcileQuota`'s report, and
  decide any bootstrap-exception dispositions — each disposition
  a **named sub-decision of its own**. Gate (b) has a hard
  dependency: **no invocation mechanism for these functions
  exists in the build** (§4). Gate (b) cannot execute until
  Rowan rules on §4 and the ruled mechanism exists in the
  deployed code.
- **Gate (c)** — any controlled provider-facing test, any
  generation intent (including the rest of Forever Pucked),
  Chapter 3, re-arm, Batch: **explicitly OUT of this proposal's
  execution scope**. Each remains its own future proposal +
  Rowan review + Julie GO, exactly as before.

There is **no client publication** in any gate (the deploy is
Worker-only; nothing user-visible changes) and **no playback
smoke is claimed** for gate (a) (see §3a D4: a halted code deploy
proves Worker identity and state containment; playback surfaces
are read-verified, and Julie may listen freely throughout, as in
every prior halted window).

---

## 0. Julie-facing summary (plain language)

**What this is.** Two fixes Rowan has now fully passed at the
code level are sitting in a finished, tested build that is not
live yet:

1. **The cache fix** — repairs the defect that made Chapter 2's
   first generation attempt fail at the final step for all 18
   segments (the audio was made, but the program talked itself
   into believing it wasn't there). Chapter 2 still completed
   through the recovery path and you've accepted it; this fix
   removes the defect itself so a future run doesn't waste the
   attempts again.
2. **The quota guard** — a new internal counter that counts
   *actual attempts to reach Google* (up to 12 can hide inside
   one "grant" the old counter saw), capped at 100 per day, so
   generation can never quietly blow past the daily request
   budget. It also slices oversized jobs into daily-sized pieces
   automatically instead of refusing them forever.

**What would happen, in order, if you approve each stage:**

- **Stage (a) — put the new code live, safely parked.** First
  the system is switched OFF (generation halted, delivery queue
  paused — it's currently on and idle). Then the new code is
  uploaded in one step, the deployed bytes are checked against
  the reviewed code file by file, and everything is proven
  untouched: no generation, no spending, Chapter 3 exactly as
  parked, your listening unaffected. The system **stays off**
  at the end of this stage, and the quota guard stays **asleep**
  — the new code behaves exactly like today's code until stage
  (b) wakes the counter. Your approval of (a) authorizes only:
  the switch-off, the one upload, and the checks.
- **Stage (b) — wake the counter and reconcile the books.**
  This needs a small extra tool that doesn't exist yet (a
  tightly locked operator button to run the one-time setup);
  Rowan decides how that gets built (§4), so (b) can't be
  scheduled until she rules. When it runs: the setup counts all
  past Google attempts from the records, exactly once each,
  and a read-only report proves the counting is clean. Any past
  attempt whose day can't be *proven* from the records is
  flagged — and for the ones whose possible days straddle a
  midnight, the rules Rowan set say **nobody may guess the
  day, ever**; those simply stay flagged until they age out.
  Each provable one would come to you as its own named decision
  before anything is recorded. The system stays off throughout
  (b) too. Your approval of (b) authorizes only the setup run,
  the read-only report, and the specific dispositions you name.
- **Stage (c) — actually generating anything** (the rest of
  Forever Pucked, a provider-facing test, Chapter 3) is **not
  in this proposal at all**. It comes back later as its own
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
project outside the Reader is invisible to the counter (§6).

---

## 1. Lineage, build identity, and the exact deployable envelope

### 1.1 Lineage (all pins on `ui1-review`, `jedavid33-design/opal-reader`, single-parent chain)

```
3e6fd3af69fc5643acaca8caf74b7dc523808bfb   quota-fix2 (Holds A+B) ← SOURCE PASS 6545910782 — DEPLOY THIS TREE
3e19d1fdee2501ca542c81186b97e52b7c91d591   quota-fix (corrections 1–3)
461b38aab676cc80b9f3e5c1c28a054c024090d6   quota build (guard implementation + T1–T8)
6a926de498b372cabcd245147de3788eb5a1e1c0   quota addendum + doc correction (design)
dcce900f4a3ccec2c6cbeef7aedf959d81ceebde   remediation package (cache fix) — SOURCE PASS 6544821907
74b43a75…                                   reliability diagnosis
   … Gate-8 / gate-7 / gate-6 / gate-5 lineage …
6a73d9622e1b4eac00c58e289de1c674ed6b3d6b   disposition build = CURRENT LIVE WORKER (rollback floor, §5)
```

**Build marker.** Per the standing build-marker rule, the
deployed Worker's `/health` build will read **the pin commit of
the final tree** — the pin that carries this proposal and the
complete `quota-fix2` tree on `ui1-review`. That pin does not
exist yet at proposal-drafting time; **the marker is set at pin
time**, exactly as at every prior deploy: the tree on disk keeps
`BUILD_COMMIT = "UNBUILT"` in `host/build-identity.mjs`
(verified), and the assembled envelope's sole stamp part carries
the pin exactly once. Gate (a) step D1 re-reads the pin and
re-validates the envelope against it before any upload; nothing
in this proposal depends on the pin's value, only on its
existence and ancestry (child of `3e6fd3af…`).

**Tree identity.** The deployable tree is
`~/workspace/ch2-program/quota-fix2/worker-build/` — 804 files,
9,919,655 bytes, inventoried with per-file SHA-256 + sizes in
the companion **`tree-inventory.json`** (same package). Inside
it, `v2/` is a symlink to `worker/` (one physical tree); the
envelope parts below are the `worker/` files under their `v2/`
upload names. The SOURCE-PASS pins carry review *snapshots* of
the changed files; this proposal deploys the **complete tree**,
hashed in full in the inventory.

### 1.2 What the combined build contains (delta vs the live build)

Exactly **6 modified envelope parts + 1 new part + the stamp
part**; the other 20 parts are byte-identical to the live
envelope (hash-verified against the disposition deploy's
parts-manifest for build `6a73d962…`):

- **Cache remediation** (SOURCE PASS 6544821907):
  `host/adapters.mjs` gains `cache.refreshKey(key)` — it
  discards only an exact-`null` memoized miss and rehydrates
  into the same snapshot Map the commit probe reads — and
  `generation/d6-executor.mjs`'s `hydrateProbeKey` prefers it.
  This removes the poisoned-negative-cache defect (Signature B
  of the diagnosis): a first-pass miss can no longer survive
  the flush and fail the commit probe with `object_missing`.
- **Quota guard** (design PASS 6544950778; build approval
  6545090525): new module `generation/quota-budget.mjs` — the
  per-dispatch ledger (`d6_provider_dispatches`, keyed by
  attempt_id) + outstanding-reservation ledger
  (`d6_grant_reservations`, identity
  `qres:${grantId}:${occurrenceId}:${day_key}`), additive
  lazy DDL + bootstrap, derived totals only, closure fence,
  disposition + reconciliation. Hooks: `genstore.mjs`
  (`markDispatching` enforces inside its single transaction —
  the only path that may precede a provider call),
  `coordinator.mjs` (reserves at grant time — refusal rolls the
  whole grant back with zero partial rows; closes `quota_park`
  at park, settles at report, `grant_voided` at void;
  `quotaView` keeps grants vs dispatch-authorizations distinct),
  `generation/d6-executor.mjs` (`wrappedSynthesize` releases
  refused attempts and surfaces honest app-side refusal evidence
  — never a fabricated 429, never an unknown-billing halt),
  `generation/service.mjs` (parks on the refusal reasons;
  closes `halt_settled` at halted-plan retirement).
  `generation/gen-constants.mjs` gains the pinned constant
  `PROVIDER_ATTEMPT_DAILY_LIMIT = 100`, labeled in code as an
  **app-selected Reader policy cap, not a verified Google
  limit** (§6).
- **Corrections 1–3** (quota-fix; Rowan's three holds of
  6545387295): cohort-bounded grants (`boundGrantTargets` —
  the longest ordered prefix whose worst-case slots fit the
  day's derived headroom; `reserveForGrant` re-verifies the
  exact cohort in-transaction); disposition day validation
  (real-calendar dates; out-of-interval refusal; wrong-day
  attempt changes nothing); reconciliation truth
  (`reconcileQuota.ok` = drift empty AND not current-day
  blocked; `day_over_limit` named refusal on every dispatch
  path, grants, and the disposition record).
- **Re-review fixes** (quota-fix2; Rowan 6545597263): **Hold
  A** — on armed D6 non-probe grants, `_issueGrant` resolves
  the bounded cohort *before* the 100-grant daily count check
  and counts the cohort, not the full pending set (unarmed /
  non-D6 callers keep full-set semantics; the monthly money
  guard is unchanged). **Hold B** —
  `disposeBootstrapException` refuses *any* day assignment for
  a multi-day `[created_at, updated_at]` interval
  (`quota_disposition_ambiguous_interval`, checked before the
  bounds check, nothing written); the disposition path survives
  only for provably same-day intervals.
- **Arming law (unchanged across all three builds):**
  enforcement arms only after the durable bootstrap record
  exists (coordinator meta key `d6_quota_bootstrapped_at`,
  written only by `bootstrapQuota()`). Pre-bootstrap, every
  hook is a no-op — `applyDispatchQuota` returns
  `{ armed: false }` first — and behavior is equivalent to the
  floor build: no quota tables exist, no reservations are
  created, `quotaView` carries no provider fields. **This
  deploy creates no schema and no bootstrap record** (the
  quota DDL is ensured only inside `bootstrapQuota` §4/gate
  (b)).

**Documentation correction (Rowan 6545910782, carried here as
required):** the quota-fix2 build report's C1 note states the
older 18-occurrence regression cohorts as **8/8/2**. That is
wrong. The actual pinned `quota-corrections.test.mjs` asserts
**8/7/3** — 8 requests already dispatched reduce the same-day
reservation headroom, so the cohorts are **8, then 7, then 3**.
The correction is recorded in this deployment record instead
of rewriting the immutable prior pin; the 101-occurrence A2
test and Rowan's safety ruling are unaffected.

**Battery on the final tree (Wren-run, Rowan-inspected):**
134 suites 112 pass / 22 fail; 1,079 tests 1,057 pass / 22 fail;
runner exit 0 (**wrapper completion — not a claim that all
suites passed**); the 22 failing suites are programmatically
set-identical to the recorded baseline across all three builds;
zero `AssertionError` in the combined log. This is
fake-provider / harness evidence only (§6).

### 1.3 The envelope (exact part list)

Assembled from the tree in the established upload format by the
proven actual-envelope harness (the disposition package's
harness, adapted for the new part count), validated at gate
(a) step D1 with its negative mutations; the envelope SHA-256
is produced there and must match exactly at D2, as in every
prior deploy. **28 module parts, 1,311,847 module bytes** on
tree bytes (the stamp part at its tree size; its assembled
length shifts by the pin string, and the exact envelope byte
count + SHA are D1 outputs):

| Part | Bytes | SHA-256 | vs live |
|---|---|---|---|
| `v2/api.mjs` | 13,632 | `9b1d0eba128c972b5329020018fefc10b0db9250f3134393de190d54e4e3237d` | identical |
| `v2/audio-route.mjs` | 15,965 | `b6383d21be32f119271e1d39f3894bd7f84b15ac1be4c38655601d1dee20d616` | identical |
| `v2/coordinator.mjs` | 274,953 | `5d0727638b24e497c7b7ca73d6deead411a5ebc8e475163f78aa0b01d72a3de5` | **CHANGED** |
| `v2/executor.mjs` | 13,974 | `5c6db175e68abdf727bf2e1d1a23626be0651db3c6eb48dd4af9e7f7d4ee14c9` | identical |
| `v2/generation/binding-projection.mjs` | 12,818 | `d100f02ce199bbcd6935569c8daabadbd6783d79b0bf1abd41f811e5763d8654` | identical |
| `v2/generation/content-plane-adapter.mjs` | 7,577 | `51c177dd8d2c4c85dbd1ce19180f60f70b3d037c53081be17c9762f93e7b8f38` | identical |
| `v2/generation/d6-executor.mjs` | 46,660 | `c3613a818f598a2fc9f0f975312ad76879edab6bdffcdd06fe3fb2e3b123984c` | **CHANGED** |
| `v2/generation/d6-work-source.mjs` | 5,981 | `8fa929b2d283084542d9dc76c1e75278d9f5ea4ed7a8d94540e55bef45e05006` | identical |
| `v2/generation/eligible-set.mjs` | 5,978 | `87b4b09ad08a23160a8b473bd0ecb88cf2f7b1d5fcf1ec0d52dbb96920e51a7c` | identical |
| `v2/generation/flush-store.mjs` | 8,497 | `e8f622bf4ed8745dd342cdbdd8d66f2a59a586ce034e8e1b1e21d68a2460f325` | identical |
| `v2/generation/gen-constants.mjs` | 4,936 | `9af664fafc61dff1c16de8f94d06c0097271313bae7327d2a9a9d16efe14c77d` | **CHANGED** |
| `v2/generation/gen-schema.mjs` | 5,307 | `d7ae4936b11fe0d01c9ff8a6e1ccbb7364541ecad7d012b8fc3e712a453aacc5` | identical |
| `v2/generation/genstore.mjs` | 48,703 | `811b6b15b790097ad0010be3c71881c5024331143b4b0e2031392287bb839c2a` | **CHANGED** |
| `v2/generation/grant-guards.mjs` | 12,936 | `9249539fb867fb086338c72840539dcd130062772631a523e2b4373fc5487629` | identical |
| `v2/generation/phase-policy.mjs` | 7,299 | `09883c40e365815f48cc9cb9d3bfdf1908f994b809c73ba27535638c7607f37f` | identical |
| `v2/generation/policy-split.mjs` | 15,074 | `61dc00148c803cb7f6b2eead2ca12caf707a3653bb3d0f7f5c97c9d8fa997876` | identical |
| `v2/generation/quarantine.mjs` | 15,752 | `64a491f3b1345219cb8816b80252908df9aaaadbd67e910547658aa9ade0fe62` | identical |
| `v2/generation/quota-budget.mjs` | 42,048 | `2b39924579e5af2d5d20eea01122d2323ccedac9fe9ff9f7026c49af14770820` | **NEW** |
| `v2/generation/service.mjs` | 77,995 | `aeeee06c8af9789426ae8135bd020be77e8ef3ea350de744472743e3dd14bd1d` | **CHANGED** |
| `v2/host/adapters.mjs` | 39,224 | `f8ac357e3ca4d23bb9edd46dab1843257d26c6fafe6a52b3fffaff676a749368` | **CHANGED** |
| `v2/host/build-identity.mjs` | 378 (tree) | `bcb29105888bdd91ff9e33650f6d1fb57b4262c2674ca6e70f0076e5a8c6840d` (tree) | stamp part |
| `v2/p8/approved-freeze-carry.mjs` | 57,703 | `24ddc8ee428e6e161fc2114af9a572f348db5959977402090539163cacb5bb46` | identical |
| `v2/p8/approved-freeze-chunks.mjs` | 6,101 | `b49cfcfcaf656d957f0c828566d390d6b2bc4b25238885fa60c3e3293563f06a` | identical |
| `v2/p8/approved-freeze-manifest.mjs` | 467,075 | `e59ab3d37245cc049d23215e0538933d633621ceb3fd29e48afdcda07e519edd` | identical |
| `v2/p8/migration-chunk-limits.mjs` | 4,733 | `886c8ea6d79dd6d2014976c50e23fe6553fd3d0ff81dd1f5f2337bf109b0fe41` | identical |
| `v2/worker-entry-prod-d6.js` | 64,548 | `079e982bee8135a95240cd1ac4f22d5a02b28f65b945f3b2a8050c702403c154` | identical |
| `v2/worker-entry-prod.js` | 14,480 | `1d2f333a75a3ffff3d4e7c9454f218ba8a8042fab179fcd4f50031c6d80a27c5` | identical |
| `v2/worker-entry.js` | 21,520 | `91daefdd4778599db83024b074a5c4e78ef4d396a5d815712b381d40f72bd6e5` | identical |

**Metadata** (same shape as the live deploy spec
`worker/p8/deploy-spec-prod-d6.json` and the disposition
deploy's assembled metadata; assembled and hash-checked at
D1): `main_module: v2/worker-entry-prod-d6.js`;
`compatibility_date: 2026-08-29` + `nodejs_compat`; **10
bindings** — 7 spec bindings (COORDINATOR durable-object
namespace `OpalReaderCoordinatorProd`; OPALREADER_STORAGE R2
bucket `opalreader-storage`; ALLOWED_ORIGIN plain text;
OPALREADER_V2_SCOPE plain text `production`; **GENERATION_HALT
plain text `"1"`** — this deploy lands halted, a *change* from
the currently live `"0"`, effected at Step P/D2 as specified;
OPALREADER_PHASE_POLICY plain text `enforce`;
OPALREADER_GENERATION_V2 queue `opalreader-generation-v2`) +
**3 secrets as `{"type":"inherit"}` by name only**
(GEMINI_API_KEY, OPALREADER_ACCESS_TOKEN,
OPALREADER_MIGRATION_OPERATOR_TOKEN — values never read, never
carried); observability enabled + logs enabled + persist; **no
`migrations` key** (no DO migration — the class, namespace, and
account instance are unchanged, and the quota schema is lazy
DDL inside the existing store, created only at gate (b)).

**Live identity superseded:** Worker `opalreader-api-v2-prod`,
build `6a73d9622e1b4eac00c58e289de1c674ed6b3d6b`, etag
`a9a4c0c40ceefa6138c1cc8ebb3f0ab5b2205e7b7a057b865c8c312cbb13c39e`,
latest deployment `8a83afd0b82944a1801a6d25c84e4749` (the gate-7
A4 metadata upload; module bytes unchanged since the
disposition deploy). Re-verified fresh at gate (a) D0.

---

## 2. Expected pre-state (last recorded; re-verified at D0)

Basis: the gate-7 re-arm execution record (6537844885), the
Gate-8 execution record (pin `ba7bd1e9…`, filed 6538952252),
and the quota-monitor reads of Oct 31, 2026. **These figures
are the last recorded values, not live reads taken for this
proposal** (this drafting made no production contact); D0
re-captures everything and STOPs on drift. Normal listening
since then may legitimately have moved the bindings watermark
and session surfaces — D0 distinguishes *expected listening
drift* (bindings/sessions only) from *generation-plane drift*
(anything in plans/grants/attempts/figures), and only the
latter is a STOP by itself; the former is recorded and carried.

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
  floor shape; its post-deploy shape is specified at D4.
- Watermarks: content **18** / bindings **1818** (bindings
  moved 1800 → 1818 by the Gate-8 run's 18 d6-provenance
  bindings; listening may have added session rows since —
  see the drift rule above).
- `/v2/conflicts`: exactly the two recorded `schedule_dead`
  lease rows.
- **Zero quota footprint:** the live build contains no quota
  code; no `d6_provider_dispatches` / `d6_grant_reservations`
  tables, no bootstrap record, no dispositions exist. This is
  the precondition §5's pre-bootstrap rollback window depends
  on; gate (a) preserves it (the deploy never invokes the
  bootstrap), and D4 re-verifies it through the quota view's
  floor shape (no provider fields while unarmed).
- Neighbors unchanged: v1 Worker etag `ea6f8196…`, v1 queue
  paused; staging etag `61553a07…`; client `main` @ `232cc00e…`
  (untouched by every gate of this proposal).

---

## 3. The three gates

### 3a. Gate (a) — halted/paused CODE DEPLOY, ends UNARMED

Julie's gate-(a) approval authorizes exactly: Step P (the halt
flip + queue pause — operational steps she approves as part of
this gate), the D2 upload, and the conditional D3 observability
PATCH. Nothing else. **Steps: P → D0 → D1 → R → D2 → D3 → D4.**

**Step P — Create the hold (two mutations, both inside Julie's
gate-(a) approval).** Production is armed + unpaused (§2), so
unlike the disposition deploy this step *acts*:

- **P1 — Halt flip.** `GENERATION_HALT "1"` ← `"0"` by the
  proven gate-7 A4 mechanism, reversed: the freshly downloaded
  live parts (first verified byte-identical to the disposition
  envelope parts-manifest, 27/27) are re-uploaded with the live
  upload metadata, the parsed-JSON metadata diff being
  **exactly one value** (the halt binding). With the value
  restored to `"0"` the assembled envelope must reproduce the
  live build's bytes; the flip is therefore provably a
  metadata-only change. Expected: PUT HTTP 200; **script etag
  UNCHANGED** (`a9a4c0c4…` — the etag is content-derived and
  the module bytes do not change, exactly as at A4); a new
  deployment id is recorded. Read-backs: `/health` generation
  "halted", build still `6a73d962…`; bindings name-keyed diff
  vs §2 = exactly one entry. **STOP** if the etag changes, the
  diff is not exactly one value, or any read-back disagrees.
- **P2 — Queue pause.** PUT the queue with `queue_name` +
  `settings.delivery_paused: true` (cf-api body as the
  positional argv JSON — a `--data` flag is silently ignored
  by this CLI; the mutation is never trusted without
  read-back). Read-back: `delivery_paused == true`, sole
  consumer unchanged, retention unchanged. **STOP** on any
  mismatch.
- **P3 — Halted-idle verification.** With halt + pause in
  place, capture the full §2 read set and compare: plan list,
  grants, diagnostics attempt census, phase figures, quota
  view, conflicts, Ch 3 fingerprint, settings rev, watermarks.
  The only machinery that can run in the halted interval is
  the alarm driver; it must have selected and moved nothing
  (no active plan exists). Any generation-plane movement =
  **STOP**, preserve evidence, report — do not proceed to D0
  on a moved system.

**Step D0 — Quiescence + closed inventory (read-only).** Two
complete samples ≥10 min apart under containment (halted +
paused); every compared value identical across both samples
and matching §2 as qualified by P3's recorded listening drift:
script etag `a9a4c0c4…`, settings rev 1, quota view (floor
shape — no provider fields), watermarks, plan inventory exact
(smoke `complete`; old Ch 2 `retired`; fresh Ch 2 `complete`;
Ch 3 `parked_policy` + fingerprint recomputed exact by the G8
recipe), diagnostics census, grants, conflicts (exactly the
two rows), phase figures (579,339 / 19,018 / 5,648 / 0 /
12,915,013, `provider_unverified`), observability shape,
neighbors. **STOP** on any drift between samples or from the
qualified §2.

**Step D1 — Identity + envelope re-validation (no production
contact).** Re-read `ui1-review`: head must be the deploy pin
carrying this proposal, with `3e6fd3af…` the SOURCE-PASS tree
pin in its ancestry and the full quota-fix2 tree present under
the pin's review path. **Changed-file byte/blob comparison**
(the disposition deploy's Rowan-mandated addition): fetch the
six changed parts + the new part as Git blobs from the pin and
compare against §1.3's hashes — all seven must MATCH
byte-for-byte; the remaining parts are proven by the harness
manifest. Run the actual-envelope harness against the local
quota-fix2 tree: all checks PASS (the harness's check count
grows with the 28th part; the exact count is a D1 output),
envelope SHA-256 recorded; re-run the harness's negative
mutations (each must FAIL validation). Re-run the quota suites
against the LOCAL tree (`tests/quota-budget.test.mjs`,
`tests/quota-corrections.test.mjs`, `tests/quota-rereview.test.mjs`,
`tests/quota-executor.test.mjs`,
`tests/remediation-cache-refresh.test.mjs` — the suites that
exercise this deploy's delta; run against the local harness,
never production). **STOP** on any mismatch.

**Step R — Re-check (read-only).** Full §2/P3 re-check
immediately before upload: inventory identical to D0; queue
still PAUSED; halt still "1"; live build still `6a73d962…`.
Per the signed Option-B interpretation: a Step-P/R error STOP
takes priority even if a later read-back shows the expected
state. **STOP** on any difference.

**Step D2 — Upload (the deploy's code mutation).** Precondition
read-back immediately before the PUT: `delivery_paused ==
true`, halt "1". Re-verify the envelope SHA-256 immediately
before upload. Multipart PUT of the exact D1-validated bytes
to `opalreader-api-v2-prod`: main_module + a `filename`
attribute on every file part, secrets inherit-by-name,
`GENERATION_HALT "1"` in metadata (lands halted — the value
Step P already set; this deploy's code change is the only new
thing). Record: HTTP status, new etag, deployment id.
Read-backs: `/health` build == the deploy pin, generation
"halted"; bindings exactly the 10 expected names with halt
"1" and phase policy "enforce". **STOP** on any read-back
mismatch (rollback per §5).

**Step D3 — Observability (conditional PATCH).** GET
script-settings: observability must show enabled + logs
enabled + persist (carried in the upload metadata; it survived
at G4, the seed-fix deploy, Gate 1, the combined deploy, the
disposition deploy, and the A4 flip). **If and only if** the
upload reset observability to null: re-apply it with ONE
observability-only settings PATCH — multipart PATCH to
`/workers/scripts/opalreader-api-v2-prod/settings` (the write
path is `/settings`, NOT `/script-settings`), a single
`settings` part (Content-Type application/json) holding the
approved observability object only; no other settings edits.
Then verify the script etag is **unchanged** by the PATCH and
read the restored observability back. **STOP** if
observability cannot be restored with the etag unchanged.

**Step D4 — Post-state verification (read-only).** Download
the deployed script and verify **all 28 module parts
byte-identical** to the validated envelope. Representation
note, stated plainly (from the prior records): the GET script
response carries the module parts only — no `metadata` part
is returned in that representation; the metadata's operative
content is proven by the D2 PUT response (entry point,
compatibility, handlers) and the GET /settings bindings
read-back (exactly the 10 expected bindings, halt "1",
policy "enforce"). Script etag on download must equal the D2
PUT etag. Then: queue still PAUSED, sole consumer unchanged;
settings revision still 1; **quota view in its floor shape —
no provider fields** (the build is unarmed: no bootstrap
record exists, so the view must be indistinguishable from the
live build's; any provider field present = the store is armed
when it must not be = **STOP**); watermarks unchanged from
D0; plan list exactly the D0 plans with identical states;
diagnostics identical; grants unchanged; Ch 3 still
`parked_policy` + fingerprint exact; phase figures identical
(incl. `provider_unverified`); conflicts identical; neighbors
identical (v1, v1 queue, staging, client). Data comparison
follows Rowan's standing interpretation: **unchanged DATA,
not identical JSON shapes** — the new build's legitimate
additive keys are named and stripped in the comparison tool,
never silently flagged away. **Playback sanity read:** the
sync surfaces are read-verified (content watermark, bindings
watermark and a bindings snapshot read through the client
connector) — playback data is intact and servable. **No
playback smoke is claimed for this halted deploy**: the
deploy swaps Worker code only, the client and the state plane
are unchanged, and Julie may listen freely at any time, as
throughout every prior halted window; a device playback
check is available to her on request but is not a gate-(a)
step. **STOP** on any mismatch (rollback per §5).

**Gate-(a) end state:** new build LIVE (the deploy pin),
generation HALTED (`GENERATION_HALT "1"`), queue delivery
PAUSED, settings rev 1, **quota guard UNARMED** (no bootstrap
record, no quota tables, no reservations — the deployed code
is behavior-equivalent to the floor build until gate (b)),
Ch 2 plans `retired` + `complete` as before, Ch 3
`parked_policy`. Nothing bootstrapped, nothing dispositioned,
nothing reconciled against production, nothing retired,
nothing released, nothing generated, nothing spent.

**STOP conditions (any step of gate (a)):** any value
differing from §2/§3a expectations; any envelope hash, part,
or identity mismatch; any non-200 or ambiguous mutation
response (read back before concluding anything — a bodiless
or failed call is never assumed to have landed or not
landed); queue or halt state UNKNOWN at any point;
observability unrestorable with etag unchanged; any urge to
widen scope (client change, data write, bootstrap, a "test"
disposition or reconcile against production — all outside
gate (a)). On STOP: preserve all evidence, change nothing
further; containment is read-back only — **no automatic
retry, rollback, or fix-forward**; any of those requires
fresh Julie authorization. Report to Julie and the board. A
stopped deploy is never restarted on the executor's own call;
a fresh Julie Go covers one attempt.

### 3b. Gate (b) — operator BOOTSTRAP + read-only reconciliation (separately authorized)

Julie's gate-(b) approval authorizes exactly: the one
`bootstrapQuota` invocation, the read-only `reconcileQuota`
report, and **only those bootstrap-exception dispositions she
names individually** as sub-decisions (B3). Gate (b) executes
**only after** the §4 invocation question is resolved: Rowan
rules on the mechanism, the ruled mechanism is built,
source-reviewed, and present in the deployed build, and Julie
approves gate (b) against that mechanism. If Rowan rules for
the fold-in sequencing (§4 Option 3), gate (a) and the route
build merge into one revised proposal and this section is
re-issued; if she rules for the follow-up sequencing (Option
4), gate (b) waits for that deploy.

- **B0 — Fresh pre-state (read-only).** Re-capture the
  gate-(a) D4 end state and require equality: new build live,
  halted, paused, unarmed (quota view floor-shaped), phase
  figures and plan inventory identical, Ch 3 fingerprint
  exact. Any drift = STOP.
- **B1 — Bootstrap (one invocation, figureless).**
  `bootstrapQuota` runs in one transaction: it ensures the
  quota schema (additive lazy DDL: `d6_provider_dispatches`,
  `d6_grant_reservations`, one guarded ALTER adding
  `dispatched_day_key` to `d6_attempt_log`), backfills
  historic attempts (a `dispatching` row is assigned its
  `updated_at` PT day exactly — `updated_at` *is* the
  dispatch moment for that phase; a `confirmed` row whose
  [created_at, updated_at] PT interval is a single day is
  assigned that day exactly; straddling intervals become
  **exceptions**, never guessed), writes matching
  dispatch-ledger rows for every assignable attempt (otherwise
  derived totals would undercount history), and writes the
  arming marker (`d6_quota_bootstrapped_at`) last. It takes
  **no caller figures** — there is nothing to supply and
  nothing to fudge. It is idempotent. Its returned report
  (assigned count + the exception census, each exception with
  its attempt id and evidenced [created_at, updated_at] PT
  interval) is captured and archived **outside the worker**
  with the gate-(b) execution record. **Honesty note:** this
  is the quota code's **first real-DO execution** — the lazy
  DDL inside its transaction is proven against node:sqlite
  transactional DDL in the harness, the same posture as the
  adjudication lazy-DDL precedent, but no harness result is a
  production smoke (§6). The invocation happens halted +
  paused, so a failure here can strand nothing: no grant or
  dispatch can interleave, and the transaction either commits
  whole or not at all.
- **B2 — Read-only reconciliation.** `reconcileQuota` is
  invoked (read-only by construction — SELECTs only, verified
  in source) and its full report is archived externally:
  derived per-day totals, exceptions, current-day blockage,
  drift (slot-counter drift, over-consumption,
  dispatch-row/attempt mismatches in both directions,
  `day_over_limit` entries). **Success criterion:** `ok ===
  true` under the strengthened semantics (drift empty AND no
  current-day block AND no over-limit day) — **or** `ok ===
  false` fully explained by the enumerated exceptions, each
  dispositioned under B3 or recorded as un-dispositionable
  under the Hold-B law with its blocking effect's expiry
  stated. An unexplained `ok === false` = STOP: no
  disposition, no further step, report to Rowan + Julie.
  Read-backs after B1/B2: quota view now carries the provider
  fields (providerDispatchesToday / providerReservedToday /
  providerAttemptDailyLimit 100 / provenance label) alongside
  — never merged with — the grant figure; halt still "1";
  queue still paused; plan inventory, phase figures, Ch 3
  fingerprint unchanged (bootstrap touches attempt-log day
  stamps and the new ledgers only).
- **B3 — Exception dispositions (named sub-decisions, one
  per attempt).** For **each** bootstrap exception, exactly
  one of:
  - **Same-day interval** (the [created_at, updated_at] PT
    interval is a single day): a disposition *may* be
    proposed — as its own named sub-decision identifying the
    attempt id, the provable day, and the basis — and executed
    only under Julie's approval naming that attempt, via
    `disposeBootstrapException` with `authorizationRef` = the
    recorded approval. The store function re-validates
    everything (real calendar day, in-interval, non-blank
    authorization) and records `{ authorizationRef, source,
    note, evidenceInterval }` on the disposition; any recorded
    counter realignment is part of that record, never silent.
  - **Multi-day interval** (the interval spans two PT days):
    **no disposition is possible, ever** — the Hold-B law
    (Rowan 6545597263, implemented in quota-fix2): the store
    refuses every proposed day with
    `quota_disposition_ambiguous_interval`. This is not a
    sub-decision Julie can override; there is nothing to
    approve. The exception stays on the record permanently,
    its dispatch day stays uncounted (a conservative
    undercount of a past day that can no longer accept
    grants), and if its interval includes the current PT day,
    the current day remains bootstrap-blocked until the
    interval rolls off — accepted as designed, never worked
    around, never guessed away.
  - No bulk disposition exists or may be improvised: one
    attempt, one sub-decision, one invocation.
- **Gate-(b) end state:** quota guard **ARMED** (bootstrap
  record exists; enforcement live in code), generation still
  HALTED, queue still PAUSED. Bootstrap is **not** a re-arm:
  the halt flip and queue unpause are gate-(c)-class acts and
  are not part of gate (b). Nothing generated, nothing spent,
  no plan state changed.

### 3c. Gate (c) — provider-facing tests / generation (OUT OF SCOPE)

Explicitly **not** part of this proposal's execution scope,
and not authorized by approving gates (a) or (b): any
controlled provider-facing test; any generation intent
(including the rest of Forever Pucked at book scope); the
Chapter 3 parked-job resume; re-arm (halt flip + queue
unpause); Batch arming; any quarantine release. Each requires
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

## 4. How `bootstrapQuota` / `reconcileQuota` would be invoked — analysis and decision points

**Verified code facts** (read in the quota-fix2 tree during
this drafting; all line references to
`worker/generation/quota-budget.mjs` unless noted):

1. The three functions are **store-level operator functions**:
   `bootstrapQuota(coord)` (L279), `disposeBootstrapException(coord,
   attemptId, { dayKey, authorizationRef, note, source })`
   (L362), `reconcileQuota(coord)` (L478). `bootstrapQuota`
   and disposition run inside `coord._tx(...)`;
   `reconcileQuota` is read-only (SELECTs only).
2. **Nothing in the deployed code calls them.** A full-tree
   search of `worker/` finds **zero callers** outside
   `quota-budget.mjs` itself. The coordinator imports only
   {`reserveForGrant`, `boundGrantTargets`,
   `settleReservationsForGrant`, `closeReservationsForGrant`,
   `closeReservationsForVoidedGrant`, `quotaBudgetView`};
   `genstore.mjs` imports only {`applyDispatchQuota`};
   `service.mjs` imports only {`closeReservationsForPlan`}.
   The only callers anywhere are the test suites, which import
   the functions directly against the harness coordinator.
3. **No existing route reaches them.** The DO class's
   `/internal/d6/*` route set (intent, plan, plans,
   capabilities, eligibility, diagnostics, phase-binding,
   retire-halted-plan, release-quarantine, reconcile-unknown,
   adjudicate-estimated, seed-storage, execute) has no quota
   member; the entry's public operator fence class
   (`/v2/d6-seed-storage`, `/v2/d6-phase-binding`,
   `/v2/d6-retire-halted-plan`, `/v2/d6-release-quarantine`,
   `/v2/d6-reconcile-unknown`, `/v2/d6-adjudicate-estimated`,
   GET `/v2/d6-diagnostics`) has no quota member; the
   `POST /v2/commands` command-type switch has no quota type;
   the coordinator alarm cases (watchdog, lease, retry_grant,
   handoff_check) never touch them; nothing runs them at
   construction. The quota *view* (`quotaBudgetView`, surfaced
   via the coordinator's quota view) exposes derived fields
   once armed, but it is not `reconcileQuota`'s report — it
   carries no drift or exception detail, and pre-bootstrap it
   cannot invoke anything.
4. **No external execution surface exists.** A Durable
   Object's SQLite is reachable only by code executing inside
   the Worker (its fetch/queue/alarm handlers). The Cloudflare
   API surface used by this project (script upload, settings,
   queues) can change code and bindings; it cannot invoke a DO
   method or run SQL against the store. There is no
   direct-to-DO tooling path in this workspace. "Run it from a
   script" is therefore not an available mechanism without new
   code in the Worker.

**Conclusion, stated plainly: in the build as SOURCE-PASSED,
there is NO mechanism — existing route, command, alarm path,
or external tool — by which `bootstrapQuota`,
`disposeBootstrapException`, or `reconcileQuota` can be
invoked against production.** Any invocation requires new
code. That is **Decision Point 1** below; this proposal does
not invent a mechanism the code doesn't support.

**Decision Point 1 — the mechanism (Rowan to rule).** The one
viable mechanism, following the established fence class
exactly (the seed-storage route is the template):

- **Option 1 — minimal operator routes, added as their own
  build + source-review cycle.** New public routes in the
  existing operator fence class — e.g.
  `POST /v2/d6-quota-bootstrap`,
  `POST /v2/d6-quota-dispose-exception`, and
  `GET /v2/d6-quota-reconcile` (read-only; diagnostics fence
  class) — gated at the entry exactly as the existing class:
  production scope + instance headers; the migration-operator
  credential required (the operator token must exist and
  differ from the access token, else 503
  `migration_operator_not_configured`; header mismatch → 403
  `migration_operator_required`); the entry stamps
  `x-opalreader-operator-admitted: 1` on the forwarded
  internal request (overwriting any client-supplied value
  unconditionally, so the stamp cannot be forged); the DO
  class's new `/internal/d6/quota-*` handlers re-check the
  stamp and call the store functions on the real coordinator.
  The bootstrap handler additionally refuses unless
  `GENERATION_HALT === "1"` (the seed precedent: seed refuses
  unless halted) and is **figureless** (bootstrap accepts no
  caller figures — there is nothing to pass). The disposition
  handler passes only `{ attemptId, dayKey, authorizationRef,
  source, note }` into the store function, which re-validates
  everything itself — including the Hold-B refusal, which no
  route can override. The invocation runs through the existing
  operator connector
  (`custom.opalreader-v2-prod-operator`), as gates 5–6 did.
  *Trade-offs:* matches every precedent (seed, phase-binding,
  retire, release-quarantine, reconcile-unknown,
  adjudicate-estimated all live in this exact class); leaves
  an auditable HTTP + Workers Logs evidence trail; the routes
  stay in the build permanently but dormant and fenced, like
  `adjudicate-estimated`. Costs a full build + Rowan source
  review + pin cycle, and a deploy to carry it (see Decision
  Point 2). New code is new review surface — deliberately
  minimal (three thin handlers + entry gate entries + tests).

**Decision Point 2 — the sequencing (Rowan to rule, Julie to
approve the chosen shape as part of gate (a)/(b)):**

- **Option 3 — fold the route build into this deploy.** Build
  Option 1's routes on the quota-fix2 tree now; Rowan
  source-reviews the *combined* tree; one pin, one gate-(a)
  upload carrying code + dormant routes; gate (b) then needs
  no further deploy. *Trade-offs:* one upload, one envelope,
  bootstrap executable as soon as gate (b) is approved.
  Against: it enlarges this deploy beyond the SOURCE-PASSED
  tree — the current SOURCE PASS (6545910782) covers
  quota-fix2 as-is, so the combined tree needs its own source
  review before any deploy; and if Rowan holds the route
  design, the already-passed cache + quota deploy is delayed
  with it.
- **Option 4 — deploy quota-fix2 as-is under gate (a); route
  cycle follows.** The code lands dormant-unarmed (behavior
  equivalent to the floor build until bootstrap — the cache
  fix, the operationally urgent half, goes live); the Option-1
  route build then runs its own build/review cycle and a
  second halted/paused mini-deploy in the gate-(a) pattern;
  gate (b) executes after that. *Trade-offs:* smallest
  reviewed surface per deploy; every step independently
  reversible; the cache fix is live soonest. Against: two
  production uploads in total; the quota guard sits inert in
  production until the route lands — no protection is *lost*
  relative to today (the live floor build has no guard
  either), but none is *gained* until gate (b).

No other options are presented, because no others exist in
the code. Wren's lean, for the record and clearly labeled as
such: **Option 4** — it keeps this deploy exactly the tree
Rowan passed, gets the defect fix live, and lets the route
design be reviewed on its own merits; but this is Rowan's
ruling to make, and Julie's sequencing preference governs if
she states one.

---

## 5. Rollback law

- **The floor — PERMANENT.** The disposition build
  **`6a73d9622e1b4eac00c58e289de1c674ed6b3d6b`** (deployed
  script etag **`a9a4c0c4…`**) plus its data is the rollback
  floor: adjudication rows exist in the store (the gate-5
  disposition executed), so **no pre-disposition build may
  ever run against this data again**. Any rollback target
  must be at or above the floor, where "at or above" means
  **proven adjudication compatibility of the exact target
  build** — its accounting demonstrated to expose
  `estimatedUnverifiedMicroCents` /
  `reservedUnverifiedMicroCents` exactly and to keep
  `provider_unverified` visible — **not** merely a newer SHA,
  date, or branch position. (The floor build itself is
  compatible by identity: it *is* the adjudication build.)
- **Primary posture: fix-forward.** If gate (a) D4 or gate
  (b) fails on a defect in the new code, the system is
  already in its safest state (halted + paused; gate (a)
  writes no data; gate (b)'s bootstrap is one whole
  transaction), so diagnosis proceeds without time pressure
  and any corrective deploy is a new, separately authorized
  act.
- **Pre-bootstrap code rollback (available, time-boxed by
  fact, not by clock).** Between gate (a) and gate (b), the
  new build has created **no quota schema and no quota data**
  (the DDL lives only inside `bootstrapQuota`, which has
  never run; D4 verifies the unarmed floor shape). In that
  window, re-upload of the floor build `6a73d962…` (its
  envelope deterministically re-assemblable from its pin;
  envelope SHA-256 `7d82eccf…`, 27 parts + metadata, validated
  at the disposition deploy) is a clean code rollback — the
  additive-schema honesty of the disposition proposal applies
  in mirror image: nothing the new build *would* create
  exists yet. The window's precondition (zero bootstrap
  footprint) must be re-verified from the store-facing reads
  before any rollback upload. A rollback upload is itself a
  deploy: Julie's authorization, the same D3/D4 verification,
  landing halted + paused identically.
- **Post-bootstrap rollback (after gate (b) has run).** The
  store then contains the quota tables, the bootstrap record,
  derived ledgers, and any B3 disposition records. Those
  tables are additive-only and are **never read by the floor
  build's code** — a rollback to the floor build does not
  corrupt them and they remain on record for a later
  re-upgrade. But three hard truths govern:
  1. **The floor build does NOT enforce the new
     provider-attempt counter.** It has no quota code at all.
     Never claim otherwise, in any record, at any point. While
     the floor build runs, dispatches are **uncounted by the
     guard** — not prevented, not budgeted.
  2. **Rollback safety therefore rests ENTIRELY on the holds:**
     `GENERATION_HALT = "1"` verified and the queue PAUSED,
     **held for the whole rollback window** — from the first
     rollback step until the exit gate passes: no halt flip,
     no queue unpause, no grant, no generation, no spend, for
     any reason, including "test" unpauses. A floor-build
     dispatch is exactly the uncounted case; the holds are
     what make that case unreachable.
  3. **Re-arm after any post-bootstrap rollback requires the
     guarded build restored first** (the new build or a
     proven-compatible successor) **and** a clean
     `reconcileQuota` under the strengthened semantics
     (`ok === true`, or `ok === false` fully explained by
     enumerated exceptions as at B2) read back before any
     generation resumes. A floor-build dispatch made in
     defiance of the holds would be *detected* on re-upgrade
     as an unstamped bootstrap exception (the T8 mechanism:
     detection and accounting, not prevention) and would
     block its day until dispositioned or aged out — it is
     not silently absorbed.
- **Pre-rollback holds (before ANY rollback, either window):**
  (1) capture an **external accounting archive** — the
  adjudication rows, the affected phase's full five-figure
  accounting, and (post-bootstrap) the bootstrap record, the
  exception census, and derived per-day totals via the
  operator/diagnostics reads — archived **outside the
  worker** with the rollback record; it is the exit gate's
  comparison baseline. (2) Verify and hold `GENERATION_HALT =
  "1"` (bindings read-back + `/health` halted; set and read
  back first if not set). (3) Verify the queue PAUSED
  (`delivery_paused` = true, cf-api read-back). (4) Generic
  re-arm BLOCKED for the whole window (above).
- **Exit gate (verifiable):** the rollback is not complete,
  and the halt/queue posture may not change for any reason,
  until all of the following are read back from the live
  build and match the archived baseline: `/health` build
  identity equals the intended target AND the target is at or
  above the floor (proven adjudication compatibility, above);
  the phase accounting exposes the unverified figures
  **exactly equal** to the archive; the disposed plan's
  summary still shows its estimate with `provider_unverified`
  visible. An absent key or a value mismatch means the live
  build cannot account for the store's history: **re-arm
  remains BLOCKED and spend remains prohibited**; the only
  exits are rolling forward (or restoring) to a compatible
  build and re-running the gate.
- **Honest residual:** the floor is a mandatory operator
  procedure — procedural + verification-based, not a
  mechanically enforced cross-version guarantee. An operator
  rollback performed in defiance of this runbook could still
  cause the omission; that is why the floor is recorded here,
  in the disposition execution record, and in the standing
  memory of this project.
- **Data:** gate (a) performs no data writes of any kind, so
  there is nothing to roll back in its data plane. Gate (b)'s
  writes (schema, day stamps, ledgers, marker, dispositions)
  are additive accounting records; no rollback erases them,
  and none may be hand-deleted to make arithmetic pass —
  historical dispatch rows are never erased to fit the cap
  (Rowan's retained safety check, 6545910782).

## 6. Honest disclosures

- **The 100/day figure is an APP-SELECTED cap, not a verified
  Google limit.** `PROVIDER_ATTEMPT_DAILY_LIMIT = 100` is a
  pinned constant in `gen-constants.mjs`, commented in code as
  an app-selected Reader policy cap. Nothing in this package
  — no test, no harness run — verifies Google's actual
  project- or model-level limit for this project. The only
  in-repo "evidence" for 100 ever found is the code's own
  comment. Reports must never present the guard's success as
  provider-limit verification.
- **Outside-Reader usage is unknown and uncountable.** The
  counter sees only dispatches made through Reader's D6
  executor. Any other client of the same Google Cloud project
  consumes real provider quota this guard cannot observe; the
  day's true headroom can therefore be smaller than the
  guard's accounting suggests. A provider 429 remains the
  final backstop, exactly as the design states.
- **Harness green is not a production smoke.** The battery
  (134 suites 112/22; 1,079 tests 1,057/22; runner exit 0 =
  wrapper completion, not all-suites-pass) runs on the tree's
  node:sqlite harness with fake providers and an injected
  clock. The harness mimics the real DO's throw-on-empty
  `.one()` semantics, but per standing rule it is **no
  evidence** for real-DO behavior on paths it cannot reach.
  No test in this package contacted Google or production.
  Gate (a)'s D4 is a state-containment verification, not an
  operational smoke of generation (nothing generates while
  halted); the quota code's first real-DO execution is gate
  (b)'s bootstrap, named as such at B1.
- **Winner provenance remains UNRESOLVED.** The reliability
  diagnosis established *that* pre-existing objects already
  occupied the 8 Signature-A fingerprint keys (the keys
  collide across eras), but *which* era wrote them was never
  settled. Closing it needs a separately authorized,
  read-only R2 HEAD check on those keys. **That check is NOT
  folded into this proposal** — no gate here includes it, and
  nothing in any gate depends on its answer: the cache fix
  removes the defect regardless of provenance, and
  pre-existing objects are adopted by intent-recovery exactly
  as they were in the accepted Chapter 2 run. It remains
  Julie's separate call, only if Rowan requires provenance
  closed.
- **Ledger figures are not provider spend.** The coordinator
  quota view's `spentMicroCents` / `attemptsToday` are
  grant-time estimate debits in the coordinator ledger. The
  Gate-8 run's recorded cost (+379,674 micro-cents ≈ $0.3797
  settled) is recorded/known under the ledger's own basis;
  the one disposed attempt's **actual Google charge remains
  UNKNOWN** (§2). No figure in this proposal is a
  provider-confirmed charge.
- **The bootstrap exception census is unknowable in
  advance.** How many historic attempts will land as
  exceptions, and on which intervals, is determined only when
  `bootstrapQuota` reads the real attempt log at gate (b).
  This proposal promises no count and no day assignment.
  Multi-day exceptions are permanently un-dispositionable by
  design (Hold-B law): the cost is a conservative undercount
  of a past day and a possible current-day block until the
  interval rolls off — Rowan's chosen trade, fail-closed over
  asserting a day.
- **Pre-state figures are last-recorded, not live.** §2's
  values come from the recorded execution history (through
  Oct 31, 2026). This drafting made no production reads. D0
  re-captures everything and STOPs on generation-plane drift;
  nobody executes any step of any gate from §2's numbers
  alone.

## 7. What this proposal does NOT authorize

This proposal authorizes **nothing**. Specifically, none of
the following is authorized by this document, its pin, its
filing, Rowan's source PASS, or Rowan's operational review of
this plan — each needs Julie's own approval at its own gate
(§8):

- gate (a)'s Step P halt flip or queue pause, or the D2
  upload, before Julie's gate-(a) approval;
- the quota bootstrap, any exception disposition, or any
  production reconcile invocation (gate (b)) — and no
  invocation mechanism may be *built* beyond a repo-only route
  build under Julie's separate build approval if §4 Option 1
  is ruled (repo-only builds have consistently required her
  explicit go in this project);
- re-arm (halt flip to "0", queue unpause) in any form;
- any generation intent, provider-facing test, or spend
  (gate (c) class), including the rest of Forever Pucked;
- the Chapter 3 parked-job resume; any quarantine release;
  Batch arming; any settings change; any client publication;
- the winner-provenance R2 HEAD read (§6);
- any rollback (each is a separately authorized deploy-class
  act under §5).

## 8. Gate checklist

1. ☐ **Rowan — operational-plan review of THIS proposal**
   (including her ruling on §4 Decision Points 1 and 2).
   *Her review authorizes nothing by itself.*
2. ☐ **Julie — gate (a) approval**: Step P (halt + pause) →
   D0 → D1 → R → D2 (one upload) → D3 (conditional) → D4.
   Ends: new build live, **halted, paused, UNARMED**.
3. ☐ **(If §4 Option 1 is ruled)** Julie — repo-only route-build
   approval; Rowan — source review of the route build;
   deploy of the route build in the gate-(a) pattern
   (folded into step 2 if Option 3 was ruled; a separate
   mini-deploy if Option 4 was ruled).
4. ☐ **Julie — gate (b) approval**: B0 → B1 (one bootstrap
   invocation) → B2 (read-only reconciliation archived) →
   B3 dispositions **only as individually named sub-decisions**
   (same-day intervals only; multi-day intervals are never
   dispositionable). Ends: guard **ARMED**, still halted +
   paused.
5. ☐ **Gate (c) — NOT in this proposal.** Any provider-facing
   test, generation intent, Chapter 3 action, re-arm, or Batch
   arming: separate proposal → Rowan review → fresh quote
   where costs apply → Julie's fresh GO.

**Turn:** Rowan's — operational-plan review of this proposal,
including the §4 rulings. Then Julie's gate-(a) decision.

— Wren
