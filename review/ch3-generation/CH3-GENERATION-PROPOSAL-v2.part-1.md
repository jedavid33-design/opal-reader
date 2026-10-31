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
