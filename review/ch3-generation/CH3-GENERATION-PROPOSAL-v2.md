# CHAPTER 3 GENERATION GATE — Forever Pucked (Opal Roundtable Case #10)

**Status:** REVISED PROPOSAL (v2) — prepared for Rowan's review, revising
v1 (pin `a8fed3d0…`) per Rowan's REVISE BEFORE PASS ruling (board
comment `6548543534`). Nothing in this document authorizes anything.
The revision is repo-only: it re-derives nothing live — §3's evidence is
v1's 2026-10-31 read-only record, carried unchanged; all new work is
deployed-source trace in the same hash-verified tree. No resume, no
exemption, no submission, no generation, no production write of any
kind was performed during preparation or revision.

**Scope in one line:** finish Forever Pucked Chapter 3 — which requires
building TWO small, disjoint, operator-only fence mechanisms the
current build does not have (§2, §5), then (a) releasing and generating
the parked job's own idx 3–25, and (b) exempting and generating idx 26
under its own separate scope, quote, verification, and fresh Julie
approval.

---

## 0. For Julie — the plain version

Chapter 3 is stuck behind a fence that was put there on purpose during
the big migration: 24 of its 27 segments have no audio yet, and the
system was built so that *nothing* can generate them until you say so.
Chapters 1 and 2 are done; the first 3 segments of Chapter 3 already
have audio from before.

Rowan reviewed the first version of this plan and sent it back with one
main correction: the plan left the chapter's very last segment (idx 26,
569 characters, about 35 seconds of audio) behind the fence — and a
chapter missing its last piece is not "finished." She also ruled,
firmly, that the fix is NOT to stretch the main key to cover it: that
segment was never on the parked job's own list, so it gets its own
separate little key instead. This revised plan does exactly that:

1. **Build two keys** (one repo-only build, then the usual reviewed
   halted deploy): a "park release" that names exactly the parked job's
   own ungenerated segments (idx 3–25), and a separate "chapter
   exemption" that names only the last segment (idx 26). Each key
   refuses the other's segments by construction.
2. **Use the first key once**: release idx 3–25, submit the chapter
   once, watch it run, check playback. Expected cost about **$0.45**.
3. **Then, only with a fresh yes from you**, use the second key:
   exempt idx 26, generate just that one segment, and verify the
   chapter now reads complete end to end. Expected cost about
   **$0.01**. Rowan requires this second yes to be separate — the
   first yes never covers it.

There is also an optional safety check before any generation (DP-3,
§9): a read-only "preflight" that checks whether any of the audio
slots for these segments are already occupied by leftovers from the
old system (the thing that caused extra repair work in Chapter 2).
Rowan prefers we run it; it needs its own separate okay from you
because it reads the storage bucket directly, and if you'd rather not,
the plan still works without it — the collisions, if any, just surface
during the run and get repaired, as they did in Chapter 2.

Total expected cost for the whole chapter: about **$0.46** (the honest
math and worst cases are in §7).

Everything else in this document is the engineering record for Rowan.

## 0.1 Revision note — what changed from v1, and why

Per Rowan's REVISE BEFORE PASS ruling (board comment `6548543534`):

- **Ruling, in substance:** the operator-only, audited, enumerated
  park-release design is directionally sound and preferable to
  rewriting the parked FSM or silently superseding it. HOWEVER, v1's
  DP-1 (idx 26 OUT) left idx 26 (569 chars) fenced, so the claimed
  user goal "finish Chapter 3" was not satisfied. The parked-job
  release must NOT be broadened to an occurrence absent from the job's
  own definition. The revision must distinguish (a) safe
  release/submission of original idx 3–25 from (b) separately scoped,
  independently quoted and verified handling of idx 26, with clear
  completion/playback criteria and fresh Julie approval for any paid
  generation. DP-2 (one GO with hard E1 read-back checkpoint) is
  acceptable in principle. DP-3's fingerprint-exposure disclosure
  should be explicit at decision time, and a preflight is preferable
  if collision exposure can be checked safely with separate
  authorization. Fresh census, billing-unknown STOP, no Batch, no
  unrelated generation, and halted deployment gates are preserved.
  The ruling is a proposal-review HOLD for revision — not permission
  to build, deploy, release, submit, or spend.
- **Changes made:**
  1. Scope restructured into (a) idx 3–25 and (b) idx 26 throughout
     (§1, §4, §6, §10, §12). "Finish Chapter 3" now requires BOTH.
  2. (b) mechanism designed from source (§5B): a distinct audited
     chapter-exemption record + route, disjoint from the release by
     construction. The two alternative shapes (occurrence-scoped
     submission; sequencing after (a)) are traced and rejected with
     reasons (§5B.1).
  3. The release route gains an explicit, checkable design invariant:
     it refuses any occurrence outside the parked job's own definition
     set, where "definition set" is derived mechanically from durable
     pinned records (§5A.2) — idx 26 is refused by name under that
     rule, and a test pins the refusal.
  4. (b) carries its own quote (§7), its own execution phase with a
     hard read-back checkpoint (§6 Phase B), its own STOP rules (§8),
     its own completion criteria (§10), and a **fresh Julie GO of its
     own** — (a)'s GO never covers (b).
  5. DP-3 upgraded (§9): the fingerprint-collision preflight is now
     specified as an executable read-only procedure (P1–P5) that
     Julie can authorize separately at decision time; disclosure-only
     remains the fallback. DP-1 is REMOVED (Rowan ruled the outcome:
     idx 26 is IN, via (b)). DP-2 retained as accepted in principle.
  6. §10 completion now ends with a combined final chapter
     verification: post-completion chapter quote bound 27 / parked 0,
     plus Julie's playback check covering the chapter including its
     end.
- **Unchanged from v1:** the §2 verdict (no resume mechanism exists),
  §3 live evidence, §7 (a) quote, §8's billing-unknown STOP law, the
  fresh-census precondition, no Batch, no unrelated generation, and
  the halted deployment gates for the mechanism build.

## 1. Exact scope (if approved)

- **Book:** Forever Pucked, bookId `5c589095-f812-48a2-8ab2-03ba2791f2b2`.
- **Chapter:** chapterIndex **2** (Chapter 3), lane **standard**, phase
  **forever-pucked**, `keepGoing: false`.
- **Part (a) — the parked job's own remaining work:** the 23 unbound
  segments idx 3–25 — the parked job's definition set (§5A.2) minus its
  3 already-bound segments.
  - **Sub-step R (release, its own named step):** one operator
    park-release call naming job
    `1832c21fcf0425454227c4736048a8a632f422abca4a2685ddb775bb1681406a`
    and exactly the 23 occurrence ids of idx 3–25, executed only after
    the §5 mechanisms are built, reviewed, and deployed under their
    own sub-gates. The release refuses idx 26 by construction (§5A.2).
  - **Sub-step S (submission):** exactly ONE chapter-scope SubmitJob
    intent `{scope: "chapter", chapterIndex: 2,
    phase: "forever-pucked", lane: "standard", keepGoing: false}`
    after the release read-back verifies (§6 Phase A).
- **Part (b) — idx 26, separately scoped:** occurrence
  `2a85f74f-353d-4c25-a86a-4a4db392868b` (569 chars), the chapter's
  final segment, which is NOT in the parked job's definition set.
  - **Sub-step X (exemption, its own named step):** one operator
    chapter-exemption call naming exactly that one occurrence (§5B),
    executed only after (a) has completed and verified (§6 E4a) AND
    Julie has given (b) its own fresh GO.
  - **Sub-step T (submission):** exactly ONE segment-scope SubmitJob
    intent `{scope: "segment", occurrenceId: "2a85f74f…",
    phase: "forever-pucked", lane: "standard", keepGoing: false}`
    after the exemption read-back verifies (§6 Phase B).
- **Nothing else.** The NOT-authorized list is §11. Ambiguity at any
  step = no mutating retry (§6).

## 2. VERDICT — the resume mechanism DOES NOT EXIST in build 945875bc

Traced in the deployed source tree
(`~/workspace/ch2-program/quota-routes-fix2/worker-build/`); the nine key
files were hash-verified byte-identical to the gate-(c) R0 operative parts
manifest for live build `945875bc26b0e2ca965d5c0f710f11c0164025f8`
(coordinator, service, eligible-set, content-plane-adapter, d6-executor,
policy-split, grant-guards, quota-budget, gen-constants — all MATCH).

**(a) How the parked job is represented.** A row in the coordinator `jobs`
table (state `parked_policy`, revision 1) plus 27 rows in `occurrences`
(3 `ready` / 24 `pending`), INSERTed directly by the migration carry
(`_migrateImportJobs`, coordinator.mjs:4489; inserts at :4554ff) from the
approved freeze pin — never submitted, never queued. The job's
`data_json` stores its definition verbatim from the pin
(`canonicalJson(pinAgg.definition)`). The only generation-layer code
that reads the job is `parkedJobOf` (content-plane-adapter.mjs:111),
which feeds the eligibility fence.

**(b) Every path that could move it — all closed.**
- The job state machine's transition row is empty:
  `parked_policy: {}` (coordinator.mjs:80), under the standing comment
  (coordinator.mjs:36–41): the state "is never submitted, never queued,
  and (empty transition row below) no lifecycle event can move it …
  generation over it is impossible by construction, not by policy."
- ALL job state changes funnel through the single applier
  `applyJobEvent` (coordinator.mjs:432); for `parked_policy` every event —
  resume, pause, cancel, resolve, park, grant, supersede, settle reports —
  returns `{ok:false, reason:"illegal_transition"}` and logs the rejection.
- The client command `RequestResume` reaches `_resume`
  (coordinator.mjs:1565): its settle-first derivation
  (`_deriveJobCompletion`) also funnels through `applyJobEvent` and is a
  no-op here (24 open rows; state not `outcome_unknown`), after which the
  `resume` event is rejected as above. Net effect of a resume command
  against this job: one logged rejection, nothing moves.
- The complete operator-route inventory of the build (phase-binding,
  retire-halted-plan, release-quarantine, reconcile-unknown,
  adjudicate-estimated, quota-bootstrap, quota-dispose-exception,
  quota-reconcile, seed-storage, diagnostics) contains **no** job-state
  surface. Diagnostics by this jobId returns `found:false` (verified live,
  §3): the D6 service layer has no record of this job at all.
- The driver (`driveOnce`) iterates `d6_plans`; the parked job has no
  plan and is invisible to it. The watchdog/alarm grant paths operate on
  plan jobs and queued jobs; the parked job is neither.
- Re-running `MigrateImportJobs` converges on its audit row (same set
  hash) or refuses; the freeze pin fixes `v2State: "parked_policy"` — it
  cannot re-issue the job in another state.
- The service layer says it in its own words (service.mjs:701–706): the
  parked job "is a different mechanism entirely: its occurrences never
  enter an eligible set … so they can neither fence nor be fenced, and
  nothing here touches that job." The builder's own exclusion reason
  string (eligible-set.mjs:80) reads: *"the parked job resumes only on
  Julie's explicit word"* — a word the shipped code has no mechanism to
  act on.

**(c) A chapter SubmitJob while parked (traced end-to-end).**
`submitIntent` (service.mjs) builds the eligible set from the live plane;
all 24 unbound chapter occurrences fence out (§4), so `eligibleIds` is
empty; the intent mints a plan whose entries are all exclusions and is
immediately set `complete` / `nothing_eligible` (service.mjs:855). No
job is created, no grant exists, the parked job is untouched. (The app
client additionally excludes FP Ch 3 from its submission affordances —
gen-client proof, D6 BUILD-REPORT.) Note for later: the intent key covers
the eligible-id set, so a post-release submission with 23 eligible ids
keys differently and cannot converge onto the no-op plan shape.

**(d) The 3 ready rows vs the 24 pending rows.** The 3 `ready` rows
(idx 0–2) already have bindings (live eligibility counts them
`bound_already`, precedence 1 — §4); no candidate path regenerates them,
and under the §5 design their parked rows are never touched. The 24
`pending` rows are the fence's substance. Under the §5 design, generation
runs through a NEW plan and its OWN job/occurrence rows
(`createJobForEntries` inserts fresh occurrence rows keyed by the new
jobId); the parked job's rows stay `pending` in the frozen record
**forever** — completion is proven by the plan, the bindings, and
playback, not by the parked record changing. Any design that instead
tries to execute the parked job's own rows (an FSM extension +
executor surgery) is a much larger build and is rejected in §5.

**(e) The POLICY_BLOCK anchor (idx 0).** Occurrence
`6bd358a7-f590-4c49-8c07-dacf558c2721`: the chapter's only
`geminiBlockHistory` entry and the split-lineage root (its `blockRootId`
is self-referential; idx 1's `blockRootId` points to it — ARMING-REPORT
reconciliation). Its parked row is `ready` with a real revision key; it
is **bound** — it is NOT dispatchable in any path and needs no
generation. Its split child (idx 1, `16e860aa-66c5-4a1a-a06b-ae0931b06bc3`)
is likewise bound. The parked rows carry no split/exclusion markers —
occurrence rows hold only (revision_key, state); split lineage lives in
the content plane. Among the 23 in-scope (a) segments, NONE carries block
history (census-verified, §4): any POLICY_BLOCK they hit will be a fresh
event at synthesis time, handled by the shipped recursive splitting path
(§8). The same holds for idx 26 in (b): no block history; a block would
be a fresh event for the same path (§8).

**(f) Quarantine.** Birth-marks are written only by `submitIntent`
(service.mjs:844, subjectKind "plan") and the grant guards
(grant-guards.mjs:176,213) — paths this job has never passed through; it
was inserted by the migration before that machinery could touch it, and
gate-(c) R0 recorded no quarantine holds over the inventory. No read
surface enumerates a per-job hold for a coordinator job (diagnostics:
`found:false`). Position: **INFERRED not quarantine-held**, and in any
case immaterial to this gate — generation flows through new plans, and
the grant guard fences held subjects at grant time regardless.

**(g) Why idx 26 is fenced — the precise conditions (new in v2).**
The builder (eligible-set.mjs) computes, per book:
`parkedApplies = !!parked && parked.bookId === bookId` (:65), where
`parked` is `parkedJobOf`'s result. `parkedJobOf`
(content-plane-adapter.mjs:111–128) runs exactly one selection —
`SELECT * FROM jobs WHERE state = 'parked_policy' ORDER BY created_at
LIMIT 1` — and maps **every** occurrence row of that job into its
entries map (`ready` → `parked-ready`, everything else →
`parked-pending`). Dispositions then apply in precedence order
(eligible-set.mjs:18–23, :72–103):

1. `bound_already` — the occurrence has a bindings-table row;
2. `excluded_parked` — `parkedApplies && parked.entries.has(id)` (:76);
3. `excluded_ch3` — `parkedApplies && chapterIndex ===
   parked.chapterIndex` for a non-entry in the same chapter (:82);
4. `voice_prompt`; 5. `eligible`.

Three consequences, all CONFIRMED from source:

- The fence depends **only** on the parked job row's continued
  existence **in state `parked_policy`** (and the book match). It does
  not depend on how many entries are pending, bound, or released —
  `parkedJobOf` never inspects entry states for the selection, and the
  entries map includes bound rows too.
- idx 26 sits behind **both** parked fences at once: on the live plane
  its row exists in the job, so the entry fence (rule 2) fires and its
  live label is `excluded_parked`; in the census-derived plane the
  reconciliation treated it as a non-entry, so the chapter rule
  (rule 3) fired and its label was `excluded_ch3`. The endpoint folds
  both into `parked: 24`. Any mechanism for idx 26 must lift **both**
  layers for that one occurrence — lifting only the chapter rule
  changes nothing live, because rule 2 fires first.
- The fence **survives (a)'s release in full**: Variant A (§5A) leaves
  the job row, its state, and its rows untouched, and its
  `parkedChapter` marker persists while the state is `parked_policy`.
  Releasing idx 3–25 subtracts exactly those ids from the effective
  entry map; idx 26 is not in the release set, so both of its fence
  layers remain exactly as they are. (a) neither helps nor harms (b);
  (b) needs its own mechanism (§5B).

## 3. Live evidence (read-only, 2026-10-31, after gate (c); carried from v1)

- `GET /health`: build `945875bc26b0e2ca965d5c0f710f11c0164025f8`,
  coordinator `armed`, generation `enabled` — system LIVE-BUT-IDLE.
- `GET /v2/d6-eligibility?scope=chapter&chapterIndex=2`:
  `eligibleCount 0, totalChars 0, expectedCostMicroCents 0`,
  exclusions `{bound_already: 3, voice_prompt: 0, parked: 24, other: 0}`,
  digest `12930307b7bda4cb438e2f981a62e052f40ede5dd5533be1a3b5c3fc67b4e71d`.
- `GET /v2/d6-eligibility?scope=book` (context): 314 eligible /
  414,050 chars / expected 5,837,168; exclusions bound 69, parked 24 —
  identical to the earlier Oct 31 preflight; the book has not drifted.
- `GET /v2/d6-plans`: exactly the 3 recorded plans (fresh Ch 2
  `complete`, old Ch 2 `retired`, G10 smoke `complete`). **No Ch 3 plan
  exists.**
- `GET /v2/d6-diagnostics?jobId=1832c21f…` (operator read):
  `found:false`, no plan, no executions — the D6 layer holds nothing
  for this job (§2b).
- `GET /v2/d6-quota-reconcile` (operator read): `armed: true`,
  **`ok: true`**, drift `[]`, census complete; sole exception the known
  adjudicated attempt `att-37d63768-db4b-447d-8150-580b7c6ee257`
  (estimated_unverified, interval Oct 29–30 PT, never dispositionable);
  `currentDayBlocked: false`; day totals: Oct 29 = 57, Oct 30 = 79,
  Oct 31 = 0 dispatched.
- `GET /v2/quota`: today (PT) attempts 0 / provider dispatches 0 of the
  100/day app cap; month spent 725,221 units against the $50 outer cap;
  settings revision 1; `parked: null`.
- `GET /v2/conflicts`: exactly the 3 known `schedule_dead` lease rows
  (ids 1/2/3, same SQLITE signature) — unchanged; they are preserved
  evidence, never cleared by this gate.
- Phase accounting (gate-(c) R0, unchanged since): settled **579,339** /
  estimatedUnverified **19,018** / reservedUnverified **5,648** /
  unknownOpen **0** / remaining **12,915,013** of 13,500,000.
- Ch 3 job pre-state (gate-(c) R0, corroborated by the eligibility
  reads above): `parked_policy` rev 1, 27 rows (3 ready / 24 pending),
  fingerprint `b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`.
  No client surface recomputes that fingerprint; the identical
  eligibility digest is the live corroboration that the fence picture
  has not moved. (§6 re-verifies all of this fresh, in-session, before
  any mutation — the fresh-census precondition is unchanged.)

## 4. The chapter as recorded (census + live, structural data only)

Chapter 3 has 27 segments, 35,149 chars total (frozen P8 census,
`~/workspace/opal-reader-p8-data/`; per-segment char counts are
speechText lengths per the adapter's `charCountOf` convention — the same
basis the live builder quotes on; the live text basis differs by 63
chars across the (a) work set, ≈ 900 units, immaterial and noted in §7):

| idx | occurrence | parked row | chars | disposition today |
|---|---|---|---|---|
| 0 | `6bd358a7…` | ready (bound) | 652 | bound_already — POLICY_BLOCK anchor (§2e) |
| 1 | `16e860aa…` | ready (bound) | 742 | bound_already — anchor's split child |
| 2 | `467174dd…` | ready (bound) | 1,181 | bound_already |
| 3–25 | 23 occurrences | pending (unbound) | 1,215–1,493 ea. | excluded_parked — **part (a): 32,005 chars** |
| 26 | `2a85f74f…` | pending (unbound) | 569 | fenced twice (§2g) — **part (b)** |

**idx 26, precisely:** the parked job's own definition — carried
verbatim into `jobs.data_json` from the approved freeze pin
(`worker/p8/approved-freeze-carry.mjs`, Ch 3 aggregate) — declares
`total: 26` segments (definitionDigest
`b90c3cb3ba63796e5e00f1cc0960e5415dcc629d725040ba4728494b0c7ec9b6`).
The pin aggregate's canonical occurrence list carries **27** ids
(occurrenceSetSha256
`03bb07b8f7ceb6fc94d7e970eabf8bd23fbc8bed6e2ce490bcbde48c7a6cc787`),
in reading order: idx 0–25 are the definition's 26; `2a85f74f…` is the
27th, **beyond the definition**. The census reconciliation records the
same boundary (idx 26 absent-from-definition, disposition
`excluded_ch3` — BUILD-REPORT §7 / ARMING-REPORT). Its live pending row
is therefore a carry artifact: a row of the job, but not a member of
the job's definition. §5A.2 turns this boundary into a mechanically
checkable invariant; §5B builds (b) on the same pinned records from
the other side.

## 5. Mechanism DESIGN (the build this gate first requires)

**Design principle:** the parked job is a frozen record, not a vehicle.
Nothing in this design moves it, settles it, or executes its rows. The
mechanisms release *fences*, and generation then flows through the
ordinary, fully-guarded plan machinery — the same machinery that ran
Chapter 2. There are TWO mechanisms because there are two disjoint
sets (§4): the definition set and the single beyond-definition
occurrence. Each mechanism's admissible set is derived from the same
durable pinned records, and each refuses the other's set by
construction.

### 5A. Part (a) mechanism — explicit park release (Variant A, as v1)

1. New durable table `d6_park_releases` (job_id, released occurrence-id
   set, authorization_ref, source, note, released_at, tombstone flag),
   created by the proven DDL-only idempotent bootstrap pattern
   (throw-safe on the real DO; no `.one()` on possibly-empty results).
2. New operator route `POST /v2/d6-release-park`, in the established
   operator-alone fence class (migration-operator credential +
   `x-opalreader-operator-admitted` stamp re-checked at the class gate —
   the release-quarantine route's exact shape). Closed body allowlist
   `{jobId, occurrenceIds, authorizationRef, source, note}`. Fences,
   in order: the job exists and is `parked_policy`; every named
   occurrence is a `pending` row of THAT job; **every named occurrence
   is inside the job's definition set (§5A.2)**; the set is non-empty
   and duplicate-free; a live (non-tombstoned) release for the job does
   not already exist. Refusals are named domain rejections (HTTP 200
   `rejected`), never partial writes; the write and its audit land in
   one transaction.
3. Builder/adapter change: `parkedJobOf` additionally loads the job's
   live release (if any) and returns the entry map MINUS released ids,
   plus a separate `parkedChapter` marker that remains set while the
   job is `parked_policy`. Builder precedence becomes: bound_already →
   excluded_parked (unreleased entries) → excluded_ch3 (parked chapter,
   not an entry) → voice_prompt → eligible. A released, unbound,
   live-POV occurrence therefore takes its natural `eligible`
   disposition; a released but bound occurrence was already
   bound_already. With no release record, behavior is byte-identical
   to today (regression-pinned).
4. Reversal: a release is tombstoned, never deleted (second operator
   call, same fence, audited). Tombstoning re-fences the chapter
   exactly; it cannot un-spend anything already generated, and bindings
   already published stay published (they are content, not fence).
5. No FSM change. No change to the parked job, its rows, the carry, or
   the freeze verification. No new grant path: post-release grants flow
   through the existing guards (quota guard, phase budget, storage,
   quarantine birth-mark — the system is unhalted at execution time, so
   the Ch 3 plans are born unmarked; the execution sequence verifies
   the halt state at submission regardless).

#### 5A.2 The definition invariant (NEW in v2 — the checkable rule Rowan required)

- **Definition set, mechanically:** for the parked job, take the
  approved freeze pin aggregate for that jobId (deployed source:
  `worker/p8/approved-freeze-carry.mjs`; the coordinator already loads
  it via `_approvedFreeze()` / `_carryBook(bookId)` for carry
  verification). The aggregate's `definition.total` is **26** and its
  canonical occurrence list is pinned by `occurrenceSetSha256`
  (`03bb07b8…`, §4). The **definition set = the first `definition.total`
  (26) occurrence ids of that list, in list order** — idx 0–25. The
  same definition is mirrored durably in `jobs.data_json`
  (definitionDigest `b90c3cb3…`), so the route's derivation is
  checkable against two independent durable records, and the §3A.5
  carry verification already recomputes the stored rows against the
  pin three ways.
  (Honesty note: the definition's own segment entries are text-blind
  structural records — `id: null`, empty-text digests — so the
  definition enumerates a *count*, and the pin's canonical occurrence
  list supplies the ordered ids. The boundary "first 26 of the pinned
  list" is nevertheless fully mechanical, and it is exactly the
  boundary the census reconciliation recorded.)
- **Invariant (test-pinned):** the release route MUST refuse any named
  occurrence outside the definition set with the named rejection
  `park_release_outside_definition`, before any write. In particular,
  a release call naming `2a85f74f-353d-4c25-a86a-4a4db392868b` MUST be
  rejected — today, and under any future release call for this job.
  The build's test battery includes that exact call shape as a named
  case, alongside a definition-member control case that succeeds.
- **Why this is not caller-trust:** the route recomputes the
  definition set from the pin/`data_json` records at call time; the
  caller's list is only ever intersected with it, never believed.

### 5B. Part (b) mechanism — chapter exemption for idx 26

#### 5B.1 Candidate shapes, evaluated against the source

**(i) A distinct audited exemption record consumed by the builder —
CHOSEN, in the refined form of §5B.2.** As literally sketched ("consumed
by the chapter rule only") it is INSUFFICIENT, and the trace shows why:
on the live plane idx 26 is an *entry* of the parked job, so the entry
fence (precedence 2) fires before the chapter rule (precedence 3) is
ever evaluated (§2g). A chapter-rule-only exemption would leave idx 26
fenced. The refinement that makes (i) sound — without touching the
release — is to consume the exemption in the adapter/builder at the
parked fences themselves, for the one named occurrence, under a
validation basis that is the mirror image of the release's: the
exemption is admissible ONLY for an occurrence provably OUTSIDE the
definition set. The two mechanisms then partition the fenced set with
no overlap and no gap: release = inside-definition pending entries;
exemption = the beyond-definition singleton. Neither record can do the
other's job, and each route refuses the other's set by name.

**(ii) Occurrence-scoped SubmitJob — REJECTED (traced, CONFIRMED).**
The eligibility surface's `occurrenceId` parameter does not bypass any
fence. `submitIntent` (service.mjs:748–757) builds the FULL
dispositioned eligible set first, then filters it:
`scoped = all.filter(e => scope === "segment" ? e.occurrenceId ===
occurrenceId : …)`, and `eligibleIds = scoped.filter(e => e.disposition
=== "eligible")`. idx 26's disposition is `excluded_parked` (live), so
a segment-scope intent for it today yields `eligibleIds = []` and the
same `nothing_eligible` no-op plan shape as §2c. `eligibilityQuote`
(service.mjs:1271–1275) scopes identically. Occurrence scope is a
*filter over* the fenced set, not a door through it. (Segment scope is
still (b)'s submission shape in §6 — but only AFTER the exemption has
changed idx 26's disposition to `eligible`.)

**(iii) Sequence (b) after (a) and let the fence lapse — REJECTED
(traced, CONFIRMED).** Nothing about (a)'s completion changes any input
to idx 26's fences. `parkedJobOf`'s selection is state-only
(`WHERE state = 'parked_policy'`); Variant A never changes the job's
state or rows; generation under (a) writes a NEW job's rows, not the
parked job's; and the selection does not depend on pending-entry counts
(§2g). After (a), idx 0–25 read `bound_already` — but that is
precedence 1 (the bindings table), not a fence change; idx 26's own
inputs (job state, its row, the chapter match) are byte-identical.
`parkedApplies` is exactly as true the day after (a) as the day before.

#### 5B.2 The exemption design

1. New durable table `d6_chapter_exemptions` (occurrence_id PRIMARY
   KEY, book_id, chapter_index, job_id, authorization_ref, source,
   note, created_at, tombstone flag), created by the same DDL-only
   idempotent bootstrap pattern as §5A.
2. New operator route `POST /v2/d6-exempt-chapter-occurrence`, in the
   same operator-alone fence class as the release route. Closed body
   allowlist `{jobId, occurrenceId, authorizationRef, source, note}` —
   a SINGLE occurrence per call, by construction. Fences, in order:
   the job exists and is `parked_policy`; the named occurrence is a
   row of THAT job; **the named occurrence is OUTSIDE the job's
   definition set** (§5A.2 derivation — the route recomputes the
   beyond-definition set from the same pinned records; for this job
   that set is exactly `{2a85f74f-353d-4c25-a86a-4a4db392868b}`, and any
   other named id is refused `chapter_exemption_inside_definition` or
   `chapter_exemption_not_beyond_definition` as applicable); the
   occurrence is unbound (no bindings-table row); no live exemption
   already exists for it. Named domain rejections (HTTP 200
   `rejected`), never partial writes; write + audit in one transaction.
3. Builder/adapter change (same adapter touch-point as §5A, disjoint
   data): `parkedJobOf` additionally loads the job's live exemptions
   and returns them as an `exemptIds` set. In the builder, an
   occurrence in `exemptIds` skips BOTH parked dispositions (entry
   fence and chapter rule) and falls through to the normal
   bound/voice/eligible evaluation — `bound_already` still wins first
   (precedence 1 is untouched), so an exempted-but-bound occurrence is
   a no-op, and an exempted occurrence whose POV resolves to a removed
   provider lands on `voice_prompt`, NOT `eligible` (see the OPEN item
   below). With no exemption record, behavior is byte-identical to
   today (regression-pinned).
4. Reversal: tombstone, never delete (second operator call, same
   fence, audited) — re-fences idx 26 exactly. Tombstoning after
   generation cannot un-publish the binding (content, not fence).
5. No FSM change; no change to the parked job, its rows, the release
   mechanism, or the carry. The exemption creates no grant path: the
   subsequent segment submission flows through the existing guards.
- **OPEN item, honestly stated:** idx 26's voice disposition has never
  been evaluated — both fences precede the voice check, so no surface
  has ever reported whether its POV resolves to a live provider. The
  book-scope quote shows `voice_prompt: 0`, but idx 26 is inside the
  parked 24 and was never voice-evaluated. §6 Phase B's read-back
  checkpoint resolves this empirically BEFORE any submission: if the
  post-exemption quote shows idx 26 as `voice_prompt` rather than
  `eligible`, (b) STOPS — a voice-mapping choice is Julie's separate
  decision and is not part of this gate.

### 5C. Build scope (both mechanisms, one build)

One route pair, two tables, one builder/adapter touch-point, plus
tests: builder (released→eligible; unreleased→fenced;
exempted→falls-through; idx-26-shape→still fenced without an
exemption; no-records→byte-identical set + digest); release route
(fence classes; subset validation; **outside-definition refusal naming
idx 26**; duplicate/idempotency; tombstone); exemption route (fence
classes; **inside-definition refusal for every definition member**;
singleton scope; unbound check; tombstone); service (post-release
chapter quote shows exactly the released set; post-exemption segment
quote shows exactly idx 26). The build then follows the standing
pipeline unchanged: Rowan source review → final envelope → halted
deploy gate (its own Julie GO) → this gate's execution phases (§6,
(a) under DP-2's GO; (b) under its own fresh GO). The deployed
exemption route sits dormant — an uncalled operator route spends
nothing (the adjudication tool's precedent) — until (b)'s GO.
**Lean: ONE build for both mechanisms** (they are fence-class siblings
validated against the same pinned records; splitting would double the
deploy gates while the execution GOs remain separate anyway). If Rowan
prefers the exemption route in a second build after (a) completes, the
design does not depend on co-deployment; that sequencing is hers to
rule. The deploy changes the live build stamp; §6's preconditions are
written against "the approved post-deploy build, hash-verified at
execution," not against 945875bc.

**Rejected wholesale alternatives (from v1, still rejected):**
Variant B — FSM extension + execute the parked job in place (a second
execution path around every guard; not smallest, not safe). Variant C —
supersede the parked job to lift the fence as a side effect (rewrites
the frozen record, risks the §3A.5 carry verification, lifts idx 26 as
collateral, and makes a record-keeping act carry a spending
consequence implicitly).

## 6. Execution sequence (after the §5 build is deployed and verified)

**Preconditions (all read back in-session, before any mutation):**
system live-idle on the approved post-deploy build (parts hash-verified
against the deploy's operative manifest); `/health` generation
`enabled`; fresh complete `reconcileQuota` with `ok: true` (the known
adjudicated straddler is the sole tolerated exception — it is
non-current-day and never dispositionable); conflicts still exactly the
3 `schedule_dead` rows; Ch 3 job still `parked_policy` rev 1 with the
recorded fingerprint; phase figures exactly as §3; today's provider
dispatches ≤ 50 at submission time (a fresh PT day is preferred);
queue delivering; Batch still unarmed. If DP-3's preflight was
authorized, its report (§9) is on file before E1.

### Phase A — part (a): release + chapter generation (idx 3–25)

- **E1 — Release.** ONE `POST /v2/d6-release-park` (operator fence)
  naming the job and exactly the 23 occurrence ids of idx 3–25, with
  `authorizationRef` = Julie's recorded GO comment for this gate.
  Read back the release record (route read-back + chapter eligibility
  re-quote): the quote must now show **eligible 23 / 32,005 chars**
  (live-plane figures; ± the §4 text-basis note) with bound 3 and
  parked 1 (idx 26). **Any mismatch = STOP**; no submission; the
  release may be tombstoned under the same GO only to restore the
  pre-state, and that fact is reported before anything else happens.
- **E2 — Submission.** Exactly ONE SubmitJob intent (§1 shape) via
  `/v2/commands`, command id `fresh-ch3-<date>-fp-chapter3-v1`.
  Immediate plan read-back: entries must show 23 `eligible` with the
  quoted char counts, 3 `bound_already`, 1 fenced (idx 26); plan state
  `active`. Ambiguous submission response = read the plan inventory
  first; a converged identical intent returns its own plan (safe);
  **no second intent with altered semantics, ever, under this GO.**
- **E3 — Monitoring.** Plan status + diagnostics + quota reads on the
  Gate-8 cadence until the plan leaves `active`. Expected shape: one
  chapter job, ~46 first-pass provider calls (§7), server-owned repair
  chains for retryable failures, recursive splitting for any
  POLICY_BLOCK. STOP conditions (halt the run, report, no unwinding
  under this GO): any `unknown` billing outcome (phase halts itself —
  §8); a terminal POLICY_BLOCK (plan ends `partial` with a blocked
  segment); quota-guard refusal shape other than the clean daily-cap
  park; any drift in `reconcileQuota`; any change to the parked job's
  state, the conflicts set, or the phase figures beyond this plan's own
  settlements.
- **E4a — (a) close-out.** Part (a)'s completion criteria (§10A)
  verified by read-back, including Julie's playback check of the
  newly generated Chapter 3 audio. The execution record for Phase A is
  filed for Rowan's review. **Phase B does not begin on Phase A's
  momentum** — it requires its own fresh Julie GO (below), given with
  (b)'s quote (§7) and the DP-3 outcome in front of her.

### Phase B — part (b): exemption + segment generation (idx 26)

**Gate: Julie's fresh GO for (b) specifically** — naming idx 26, its
own quote (569 chars; expected 8,022; §7), and the fact that this GO
authorizes paid generation of exactly one segment. (a)'s GO, DP-2's
single-GO shape, and any earlier approval do NOT cover Phase B.
Preconditions re-read in-session: Phase A complete and verified
(E4a); `reconcileQuota` still `ok: true`; conflicts still exactly 3;
parked job unchanged; today's provider dispatches leave room for (b)'s
1 expected call plus repair headroom inside the 100/day cap.

- **E1b — Exemption.** ONE `POST /v2/d6-exempt-chapter-occurrence`
  (operator fence) naming the job and exactly `2a85f74f…`, with
  `authorizationRef` = Julie's recorded (b) GO comment. Read back the
  exemption record + segment eligibility re-quote
  (`scope=segment&occurrenceId=2a85f74f…`): the quote must show
  **eligible 1 / 569 chars** (live-plane figure; the E1b read-back is
  the binding quote — any char mismatch beyond the §4 text-basis note
  = STOP). **If the quote instead shows `voice_prompt` for idx 26 =
  STOP** (§5B.2 OPEN item): no submission; the exemption may be
  tombstoned under the same GO to restore the pre-state; a
  voice-mapping decision is Julie's, separately.
- **E2b — Submission.** Exactly ONE segment-scope SubmitJob intent
  (§1 shape) via `/v2/commands`, command id
  `fresh-ch3-<date>-fp-chapter3-idx26-v1`. Immediate plan read-back:
  exactly 1 `eligible` entry (idx 26, quoted chars); plan state
  `active`. Ambiguity rule identical to E2: read the inventory first;
  no second intent with altered semantics under this GO.
- **E3b — Monitoring.** Same cadence and the same STOP conditions as
  E3 (§8 law applies unchanged: an `unknown` billing outcome halts the
  phase; a terminal POLICY_BLOCK on idx 26 ends the plan `partial` =
  STOP, and the chapter is then NOT finished until a separate gated
  program resolves it — stated plainly, never smoothed over).
  Expected shape: 1 first-pass provider call (569 chars is under the
  1,200-char pre-split ceiling — no pre-split), repairs/splits only on
  failure.
- **E4b — (b) close-out + combined finish.** Part (b)'s criteria
  (§10B) and the combined final chapter verification (§10C) verified
  by read-back, including Julie's final playback check covering the
  chapter **including its end** (idx 26's audio present, in sequence).
  Execution record filed for Rowan's review. The record states plainly
  that the parked job still reads `parked_policy` with 24 pending
  rows — by design (§2d) — alongside the release record, the exemption
  record, and the two completed plans that together are the audit
  trail.

## 7. Fresh quote, budget and cap math

**Quote basis.** No live read surface exposes char counts for fenced
rows (the eligibility quote sums ELIGIBLE entries only — verified in
source, service.mjs `eligibilityQuote`). The figures below are
census-derived (§4) from the frozen P8 snapshot — the same data the
migration carried — cross-checked against the live eligibility digest,
which is unchanged. **The binding quotes are the E1 and E1b
read-backs**: submission rebuilds the set from the live plane, and
E2/E2b verify each plan's own entries before any grant can issue.
All cost figures below were computed with the shipped functions
(gen-constants.mjs: `expectedCostMicro` :81, `upperBoundAttemptMicro`
:88, `upperBoundOccurrenceMicro` :94 — the last is 12 × the attempt
upper, the per-segment attempt-budget ceiling).

| figure | (a) 23 segments (idx 3–25) | (b) idx 26 alone | combined |
|---|---|---|---|
| chars (eligibility basis) | 32,005 | 569 | 32,574 |
| expected = round(chars/15.96 × 225) | **451,198 (≈ $0.451)** | **8,022 (≈ $0.008)** | **459,220 (≈ $0.459)** |
| single-attempt upper = round(chars/10 × 225) | 720,112 (≈ $0.720) | 12,803 (≈ $0.013) | — |
| guard ceiling = Σ 12 × per-occurrence upper | 8,641,344 (≈ $8.64) | 153,636 (≈ $0.154) | 8,794,980 (≈ $8.79) |

**Phase-budget guard check** (the guard's own formula: settled +
reservedUnverified + inFlightUpper + this plan's pendingUpper ≤
13,500,000), evaluated per plan at its own submission:
- (a): 579,339 + 5,648 + 0 + 8,641,344 = **9,226,331 ≤ 13,500,000 —
  PASSES** (4,273,669 spare at the absolute ceiling).
- (b): with (a) settled at its expected ≈ 451,198, the check is
  ≈ 1,030,537 + 5,648 + 0 + 153,636 ≈ **1,189,821 ≤ 13,500,000 —
  PASSES** trivially. Even in the (impossible-together) worst case of
  both plans pending at ceiling simultaneously: 579,339 + 5,648 + 0 +
  8,794,980 = **9,379,967 ≤ 13,500,000 — PASSES** (4,120,033 spare).
- Expected-case phase settled after the whole gate ≈ 579,339 +
  451,198 + 8,022 ≈ **1,038,559 of 13,500,000 (7.7%)**. The $50
  monthly cap is a non-binding outer backstop (month-to-date 725,221).

**Provider-attempt math vs the 100/day cap.** (a): every in-scope
segment exceeds the 1,200-char pre-split ceiling (policy-split.mjs:222),
so each is pre-split into 2 exact-concat chunks: **≈ 46 first-pass
calls**. (b): 569 chars is **under** the pre-split ceiling → **1
first-pass call**, no pre-split. Combined first-pass total ≈ 47 if run
on one PT day; the phases have separate GOs and may land on different
days — each phase's precondition re-checks the day count. Headroom
after first passes covers POLICY_BLOCK splitting (depth ≤ 4, ≤ 16
leaves) and repairs inside the per-segment budget of 12 calls (split
tree + repair chain combined). Expected case: **each phase fits one PT
day comfortably.** Worst case: the quota guard refuses a dispatch
*before any provider contact* (provably no billing) and the plan parks
`parked_quota` — it resumes on the next PT day by the shipped driver
behavior; that is a schedule outcome, never an overspend and never an
unknown.

**Mandatory disclosures.**
- All figures above are **models, not provider-confirmed prices**:
  expected cost is the realized-rate estimate (chars/15.96 × 225); the
  uppers are model bounds (chars/10), not provider ceilings. Ledger
  units behave as micro-dollars despite the `MicroCents` naming.
- The Gemini prepay balance was **$17.83 on Oct 29 — STALE, not
  re-verified**; it is a hard physical limit with auto-reload OFF. The
  expected ~$0.46 sits far inside it on any plausible drift, but the
  balance itself is asserted nowhere in this proposal.
- **The Chapter 2 lesson, as a rule of this gate:** a segment whose
  billing comes back unconfirmed halts the run for adjudication
  (§8). Nothing auto-continues past an unknown, and no figure is ever
  written as a known charge on a model's say-so. This applies to (b)
  exactly as to (a) — one segment is not too small for the law.

## 8. POLICY_BLOCK and unknown-billing expectations (both phases)

- A provider refusal (`contentBlocked`) is confirmed in the attempt log
  as `policy_block` at cost 0 and enters recursive splitting
  (policy-split.mjs): same cast voice, original text preserved exactly
  across splits (concatenation is identity), depth ≤ 4, floor 50 chars,
  shared 12-call segment budget. A part still blocked at the floor is
  `TerminalBlock` → execution `policy_block`, occurrence
  `report_blocked` → `blocked_policy` (terminal), plan ends `partial`.
  That is a STOP (E3/E3b): resolving a terminally blocked segment is a
  separate gated program, and — for (b) — the chapter is not "finished"
  while it stands. **Never** voice substitution, **never** text edits
  to slip the filter (feature law F3).
- Segments over 1,200 chars are pre-split before dispatch (incidence
  reduction for the 120 s fetch ceiling; the ceiling remains a
  fail-closed backstop, not a guarantee). All 23 (a) segments
  pre-split; idx 26 (569 chars) does not.
- A non-HTTP provider throw confirms the attempt `unknown` at cost
  NULL → `markUnknownBilling` (d6-executor.mjs:594) halts the phase and
  stops the whole message; later occurrences are untouched. Unwinding
  (reconciliation / estimated_unverified adjudication) is the separate,
  already-precedented gated program — never part of this gate, for
  either phase.
- Retryable HTTP failures ride the server-owned repair chain (F6);
  flush/commit failures ride intent-recovery, as Chapter 2's 18/18
  demonstrated on this machinery's predecessor build.

## 9. Fingerprint exposure — DP-3: preflight procedure (preferred) or disclosure (fallback)

**The exposure.** Whether an R2 object already sits at any of the
dispatch keys for the 24 generatable occurrences (23 in (a) + idx 26)
is not knowable from any Worker read surface. Chapter 2's precedent on
the pre-fix build: 8 `winner_digest_mismatch` collisions (pre-existing
objects at fingerprint keys, cross-era artifacts), 167,922 units
(≈ $0.168) of recorded defect waste, and all 18 segments still
completed via repair. On the CURRENT build the cache defect behind
half those failures is fixed (`refreshKey`); a digest-matching
pre-existing object is adopted, a mismatch fails `failed_known` and
the repair chain retries — a bookkeeping cost, never a billing
unknown. Rowan's ruling: disclosure must be explicit at decision time,
and a preflight is preferable if it can be checked safely with
separate authorization. It can. The procedure below is **read-only
end to end** — no production writes, no provider contact, no
generation — and is executed ONLY under Julie's separate DP-3
authorization at decision time. It was NOT taken during proposal prep.

**Key derivation (CONFIRMED from source).**
- The dispatch fingerprint is `fingerprintFor(payload)`
  (worker/executor.mjs:36): SHA-256 hex of `String(payload.text)`
  concatenated with `JSON.stringify({provider (default "gemini"),
  voice, model (default "gemini-3.8-flash-tts"), rate: 1,
  style: styleDirection || ""})`. The work source assembles exactly
  this payload per dispatch (d6-work-source.mjs:117 returns
  `fingerprintFor(payload)` alongside it).
- The R2 object key is `objectKeyFor(cacheKey, format)` =
  `` `${keyPrefix}audio/${cacheKey}.${format}` ``
  (host/adapters.mjs:512), with production `keyPrefix = ""`
  (worker-entry-prod-d6.js:1152) and formats from `AUDIO_EXTENSIONS =
  ["mp3", "wav"]` (adapters.mjs:502). So every first-pass dispatch key
  is `audio/<fingerprint>.wav` or `audio/<fingerprint>.mp3` in bucket
  `opalreader-storage`.
- Dispatch payloads are per-CHUNK for pre-split segments: all 23 (a)
  segments exceed the 1,200-char ceiling and dispatch as 2 chunks
  each, so the first-pass key set is **47 keys** ((a) 46 chunk keys +
  (b) 1 whole-segment key) — not 24. Runtime POLICY_BLOCK sub-splits
  create further keys that are NOT enumerable in advance; the
  preflight covers first-pass keys only, and says so.

**Procedure (P1–P5), executable as written.**
- **P1 — Live text basis.** Fetch the content snapshot read-only via
  the client connector (`GET /v2/sync/snapshot?family=content`, the
  same surface used in gates (a)/(c)); record its digest in the
  preflight report. Payloads are computed from the LIVE plane text —
  this eliminates the census text-basis caveat (§4) entirely. Book
  text is processed locally only; no text, and no fingerprint of any
  bound segment beyond the P3 check values, is posted anywhere.
- **P2 — Payload + key enumeration.** Locally, against the pinned
  source tree: assemble each first-pass dispatch payload exactly as
  the work source does (segment speechText, cast voice/provider/model,
  style direction from the snapshot), run the shipped pre-split
  (policy-split.mjs) for >1,200-char segments, and compute
  `fingerprintFor` per payload by importing the shipped
  `worker/executor.mjs`. Output: the 47-key list (key, occurrence idx,
  chunk #, chars).
- **P3 — Replication self-check (STOP gate).** Before trusting the
  computed keys, reproduce the three BOUND Chapter 3 segments' recorded
  revision keys from their snapshot payloads by the same pipeline (the
  binding's revision key IS the payload fingerprint —
  d6-executor.mjs:346 comment and the adapter's `revisionKeyOf`
  convention; the check values are the pin's recorded ready-row
  revision keys for idx 0–2, §13). **If any of the three fails to
  reproduce, STOP: the replication is wrong somewhere, the preflight
  is inconclusive, and the gate falls back to the disclosure route
  below.** A self-check that cannot fail is not a check; this one can.
- **P4 — Occupancy reads.** For each of the 47 keys, one read-only R2
  list call via the Cloudflare connector
  (`GET /client/v4/accounts/{acct}/r2/buckets/opalreader-storage/objects?prefix=audio/<fingerprint>`)
  — list responses are metadata-only (name, size, etag); no object
  body is ever downloaded, nothing is written, and the 20-per-page
  list cap is immaterial (≤ 2 objects can share a fingerprint prefix:
  the `.wav` and `.mp3` forms). Record per key: occupied or empty,
  and for occupied keys the object's size + etag.
- **P5 — Report.** A preflight report (key table from P2/P4, snapshot
  digest from P1, self-check result from P3, timestamp) is filed with
  the gate's execution record before E1. Occupied keys do NOT block
  the gate: they predict adoption-or-repair work, quantified per
  Chapter 2's precedent, and E3/E3b monitoring watches for exactly
  those occurrences.

**What the preflight proves, and what it does not.**
- PROVES (at check time): for each enumerated first-pass key, whether
  an object exists at that exact key in `opalreader-storage`, with its
  size and etag.
- DOES NOT prove adoptability: the executor adopts a pre-existing
  object only on digest match at its verify step; an occupied key may
  still yield `winner_digest_mismatch` → `failed_known` + repair
  (Chapter 2's shape — recorded cost, never a billing unknown).
- DOES NOT prove the converse at dispatch time: an empty key at check
  time is empty *then*. INFERRED practical reading: nothing else
  writes `audio/` keys absent a generation run, and no other
  generation is authorized in the window — so the check-time picture
  is the dispatch-time picture unless Julie authorizes other work in
  between.
- DOES NOT resolve winner provenance (which era/process wrote an
  occupying object, or why) — that remains the separately-gated
  provenance question, untouched by this preflight.
- An occupied key whose object is another occurrence's binding is not
  automatically a collision: identical payload (same text + voice +
  style) yields the identical fingerprint BY CONSTRUCTION, and
  adoption is then legitimate deduplication. The collision case is
  precisely an occupying object whose recorded digest ≠ the payload's
  expected digest — which only the executor's verify step can finally
  determine (see adoptability, above).
- Coverage limit: first-pass keys only (47). A POLICY_BLOCK sub-split
  at runtime dispatches under keys the preflight cannot enumerate;
  those keys' occupancy is simply unexamined, as it was in Chapter 2.

**Fallback — disclosure-only route.** If Julie declines the preflight
authorization (or P3 fails), the gate proceeds on this disclosure,
stated explicitly at decision time: collision exposure for the 24
occurrences is UNVERIFIED; collisions, if any, surface in diagnostics
during E3/E3b as `failed_known` bookkeeping (Chapter 2 precedent:
8 collisions, ≈ $0.168 recorded waste, 18/18 completed via repair) and
are reported with the record. The disclosure route changes no other
part of the gate.

## 10. Completion criteria

### 10A. Part (a) completion (all required)
1. (a) plan `complete` with totals: eligible 23, done 23, failed 0,
   blocked 0; bindings published 23 (bindings watermark advances by
   exactly 23; content watermark unchanged).
2. Chapter eligibility re-quote: chapterIndex 2 shows bound_already
   26, parked 1 (idx 26), eligible 0.
3. Phase read-back: settled increased by the (a) plan's recorded
   settlements only; unknownOpen still 0; `reconcileQuota` still
   `ok: true` with no new exceptions.
4. Parked job state, conflicts set (3 rows), settings revision, and
   queue state all identical to the preconditions; the release record
   reads live and names exactly the 23.
5. Julie's playback check of the newly generated Chapter 3 audio
   (the released set): PASS. (Part (a) is not called complete on
   server evidence alone.)

### 10B. Part (b) completion (all required)
1. (b) plan `complete` with totals: eligible 1, done 1, failed 0,
   blocked 0; bindings published 1 (bindings watermark advances by
   exactly 1 more).
2. Binding read-back for idx 26 specifically: a bindings-table row for
   `2a85f74f…` exists and the chapter quote delta from §10A.2 is
   exactly that one occurrence moving parked → bound.
3. Phase read-back: settled increased by the (b) plan's recorded
   settlement only; unknownOpen still 0; `reconcileQuota` still
   `ok: true` with no new exceptions.
4. Parked job state, conflicts set, settings revision, queue state
   identical to preconditions; the exemption record reads live and
   names exactly idx 26; the release record is unchanged by Phase B.

### 10C. Combined final chapter verification — "Chapter 3 is finished"
1. Post-completion chapter quote: chapterIndex 2 shows
   **bound_already 27, parked 0, eligible 0** — every segment of the
   chapter as it exists live has audio.
2. Bindings watermark advanced by exactly 24 across the whole gate
   (23 + 1); content watermark unchanged; phase and quota read-backs
   per §10A.3/§10B.3 hold at the final read.
3. **Julie's final playback check covering the whole chapter,
   including its end**: the chapter plays in sequence through idx 26,
   whose audio is present and audible as the chapter's final segment:
   PASS. Only when §10A + §10B + §10C all hold is Chapter 3 called
   finished — (a) alone leaves the chapter one segment short, which
   is exactly the gap Rowan's ruling closed.

## 11. NOT authorized by this gate

Batch arming or any Batch lane use; any other chapter or book
(rest-of-Forever-Pucked remains its own later gate, and idx 26 does not
ride along with it — it is handled here, in (b), or not at all); any
change to the parked job's state or rows; quarantine releases of any
other subject; settings changes; any rollback; any second intent,
second release, second exemption, or retry beyond §6's convergence
rules; legacy snapshot retirement; Issue #16. **Design invariants that
are part of this gate's scope, not options:** the release route refuses
any occurrence outside the parked job's definition set
(`park_release_outside_definition`, §5A.2 — idx 26 by name); the
exemption route refuses every definition member
(`chapter_exemption_inside_definition`, §5B.2); the two records and
routes are never merged into one mechanism that could name both sets.
The R2 provenance read (winner provenance) is not authorized here —
§9's preflight is an occupancy check under its own separate
authorization, not a provenance investigation.

## 12. Decision points

- **DP-1 — REMOVED.** v1 asked whether idx 26 is in or out. Rowan
  ruled the outcome (ruling `6548543534`): idx 26 is IN — via the
  separately scoped part (b), never by broadening the release. There
  is no remaining choice here; §0, §1, §6, and §10 are written to that
  ruling.
- **DP-2 — one GO or two for (a)'s E1+E2.** Rowan: acceptable in
  principle. **Lean (retained): ONE GO** covering the release and the
  chapter submission as a single named sequence with the E1 read-back
  as a hard checkpoint between them (mismatch = STOP, §6) — the
  gate-(c) pattern. A separate release-only GO is available if Rowan
  or Julie prefers the seam. **Scope note:** DP-2's GO covers part (a)
  only. It does not extend to (b) under any reading.
- **DP-3 — fingerprint preflight or disclosure.** Restated per the
  ruling: **preflight PREFERRED** (procedure §9, executable as
  written), taken only under Julie's separate authorization at
  decision time (it reads the storage bucket directly); **disclosure
  is the fallback** if she declines, with the exposure stated
  explicitly in the decision text itself. Julie's choice, made at
  (a)'s decision time; the chosen route is recorded in the GO comment.
- **Approval requirement (not a DP) — (b)'s fresh GO.** Before any
  paid generation in Phase B, Julie gives a fresh GO naming idx 26 and
  (b)'s own quote (§7), after (a) has completed and been verified.
  This is Rowan's requirement, recorded here so it cannot be mistaken
  for covered by DP-2.

## 13. Source index (build 945875bc tree; all hash-verified per §2)

- `worker/coordinator.mjs` — JOB_STATES/parked comment :36–41;
  JOB_TRANSITIONS `parked_policy: {}` :80; `applyJobEvent` :432;
  `_resume` :1565; `_deriveJobCompletion` (funnels through the
  applier); `_migrateImportJobs` :4489 (job INSERT with
  `data_json = canonicalJson(pinAgg.definition)`; occurrence INSERTs
  :4554ff); `_approvedFreeze()` / `_carryBook(bookId)` (the pin access
  §5A.2 relies on); §3A.5 carry verification (recomputes stored rows
  against the pin).
- `worker/generation/eligible-set.mjs` — disposition precedence
  :18–23; `parkedApplies` derivation :65; entry fence :76; chapter
  rule :82; parked reason string :76–85.
- `worker/generation/content-plane-adapter.mjs` — `parkedJobOf`
  :111–128 (state-only selection `WHERE state = 'parked_policy'`;
  entries map over ALL of the job's rows); `charCountOf` /
  `blockHistoryOf` / `revisionKeyOf` conventions (bound →
  `generationFingerprint`).
- `worker/generation/service.mjs` — parked-job fence comment
  :701–706; `submitIntent` (full-set build then scope filter
  :748–757; segment first-entry :859; convergence, overlap fence,
  `nothing_eligible` :855); `createJobForEntries` :150 (fresh job +
  fresh occurrence rows); `eligibilityQuote` (eligible-only char sums;
  identical scoping :1271–1275); `driveOnce` :888 (plans only).
- `worker/generation/d6-executor.mjs` — attempt wrap + `policy_block`
  confirm :522; TerminalBlock → `policy_block_terminal` :553;
  quota-refusal shape; `markUnknownBilling` :594; binding revision key
  = payload fingerprint (comment :346).
- `worker/generation/d6-work-source.mjs` — dispatch payload assembly;
  `fingerprint: fingerprintFor(payload)` :117.
- `worker/executor.mjs` — `fingerprintFor(payload)` :36 (SHA-256 of
  text + canonical config JSON: provider, voice, model, rate 1,
  style).
- `worker/host/adapters.mjs` — `AUDIO_EXTENSIONS = ["mp3", "wav"]`
  :502; `objectKeyFor` = `` `${keyPrefix}audio/${cacheKey}.${format}` ``
  :512; `hydrateKey` / `refreshKey` (the fixed cache defect).
- `worker/worker-entry-prod-d6.js` — full route inventory (no
  job-state surface); operator fence classes; production flush store
  `keyPrefix: ""` :1152.
- `worker/generation/policy-split.mjs` — F3 law + pins (depth 4,
  floor 50, budget 12); `PRE_SPLIT_MAX_CHARS = 1200` :222;
  `synthesizeLongSegment` (exact-concat pre-split).
- `worker/generation/gen-constants.mjs` — `PHASE_BUDGET_MICRO_CENTS`
  (forever-pucked 13,500,000); `expectedCostMicro` :81;
  `upperBoundAttemptMicro` :88; `upperBoundOccurrenceMicro` :94.
- `worker/generation/grant-guards.mjs` — phase projection formula
  (`d6PhaseBudgetCheck` :108–117); quarantine hold writes :176,213.
- `worker/generation/quota-budget.mjs` — provider-attempt ledger +
  armed dispatch refusal (provably-never-dispatched semantics).
- `worker/p8/approved-freeze-carry.mjs` — the Ch 3 aggregate: jobId
  `1832c21f…`, chapterIndex 2, `v2State: "parked_policy"`;
  `definition.total: 26`, definitionDigest `b90c3cb3…`; canonical
  occurrence list of 27 ids with `occurrenceSetSha256` `03bb07b8…`
  (idx 0 `6bd358a7…`, idx 1 `16e860aa…`, idx 2 `467174dd…` as the
  ready rows with recorded revision keys `e240adac…`, `8963058e…`,
  `987636ed…` — §9 P3's check values; idx 26 `2a85f74f…` last, beyond
  the definition).
- Records: D6 BUILD-REPORT §7 + ARMING-REPORT (Ch 3 reconciliation:
  27 rows, anchor `6bd358a7…`, idx 26 absent-from-definition);
  gate-(a)/(b)/(c) execution records (pins `68776e41…`, `26b5b5ee…`,
  `5d6fd25a…`); v1 of this proposal (pin `a8fed3d0…`); Rowan's
  REVISE BEFORE PASS ruling (board comment `6548543534`).
