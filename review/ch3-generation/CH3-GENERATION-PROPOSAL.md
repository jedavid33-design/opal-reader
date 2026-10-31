# CHAPTER 3 GENERATION GATE — Forever Pucked (Opal Roundtable Case #10)

**Status:** PROPOSAL — prepared for Rowan's review. Nothing in this document
authorizes anything. Prep was read-only: live reads + deployed-source trace,
2026-10-31. No resume, no submission, no generation, no production write of
any kind was performed during preparation.

**Scope in one line:** generate the ungenerated segments of Forever Pucked
Chapter 3 (chapterIndex 2) — which first requires building the resume
mechanism the current build does not have (§2 verdict), then a single
release + a single chapter submission under the usual gate discipline.

---

## 0. For Julie — the plain version

Chapter 3 is stuck behind a fence that was put there on purpose during the
big migration: 24 of its 27 segments have no audio yet, and the system was
built so that *nothing* can generate them until you say so. Chapters 1 and 2
are done; the first 3 segments of Chapter 3 already have audio from before.

Today I checked whether the current system has any "un-park Chapter 3"
button. **It does not.** The parked job is sealed by construction — every
possible "resume" command bounces off it, and no screen, route, or automatic
process can move it. That was deliberate design at migration time, not a
bug. So this proposal has two clearly separated parts:

1. **Build the key** (repo-only work, then the usual reviewed halted
   deploy): a small, operator-only "park release" that names exactly which
   Chapter 3 segments are unfenced. It does not touch the frozen parked
   record itself and cannot be used on anything else.
2. **Use it once**: release the segments, submit Chapter 3 once, watch it
   run, and you check playback — the same shape as the Chapter 2 run.

The cost is small: about **$0.45 expected** for 23 segments (the math and
the honest worst cases are in §7). One small decision is yours (DP-1, §12):
the chapter's final short segment (569 characters, about 35 seconds of
audio) was never part of the original job's list, so it is fenced
separately. My recommendation is to leave it out of this gate — it can be
released later on its own — but you should know leaving it out means
Chapter 3's last little piece stays silent for now.

Everything else in this document is the engineering record for Rowan.

---

## 1. Exact scope (if approved)

- **Book:** Forever Pucked, bookId `5c589095-f812-48a2-8ab2-03ba2791f2b2`.
- **Chapter:** chapterIndex **2** (Chapter 3), lane **standard**, phase
  **forever-pucked**, `keepGoing: false`.
- **Work set:** the 23 unbound segments idx 3–25 of the chapter — the
  parked job's own definition set minus its 3 already-bound segments.
  (idx 26 is OUT of scope; see §4 and DP-1.)
- **Sub-step R (the resume step, its own named step):** one operator
  park-release call naming job `1832c21fcf0425454227c4736048a8a632f422abca4a2685ddb775bb1681406a`
  and exactly the 23 occurrence ids of idx 3–25, executed only after the
  §5 mechanism is built, reviewed, and deployed under its own sub-gates.
- **Sub-step S (submission):** exactly ONE SubmitJob intent
  `{scope: "chapter", chapterIndex: 2, phase: "forever-pucked",
  lane: "standard", keepGoing: false}` after the release read-back
  verifies. Ambiguity at any step = no mutating retry (§6).
- **Nothing else.** The NOT-authorized list is §11.

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
approved freeze pin — never submitted, never queued. The only generation-
layer code that reads the job is `parkedJobOf`
(content-plane-adapter.mjs:111), which feeds the eligibility fence.

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
the content plane. Among the 23 in-scope segments, NONE carries block
history (census-verified, §4): any POLICY_BLOCK they hit will be a fresh
event at synthesis time, handled by the shipped recursive splitting path
(§8).

**(f) Quarantine.** Birth-marks are written only by `submitIntent`
(service.mjs:844, subjectKind "plan") and the grant guards
(grant-guards.mjs:176,213) — paths this job has never passed through; it
was inserted by the migration before that machinery could touch it, and
gate-(c) R0 recorded no quarantine holds over the inventory. No read
surface enumerates a per-job hold for a coordinator job (diagnostics:
`found:false`). Position: **INFERRED not quarantine-held**, and in any
case immaterial to this gate — generation flows through a new plan, and
the grant guard fences held subjects at grant time regardless.

## 3. Live evidence (read-only, 2026-10-31, after gate (c))

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
- Ch 3 job pre-state (gate-(c) R0, corroborated today by the eligibility
  reads above): `parked_policy` rev 1, 27 rows (3 ready / 24 pending),
  fingerprint `b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`.
  No client surface recomputes that fingerprint; today's identical
  eligibility digest is the live corroboration that the fence picture
  has not moved.

## 4. The chapter as recorded (census + live, structural data only)

Chapter 3 has 27 segments, 35,149 chars total (frozen P8 census,
`~/workspace/opal-reader-p8-data/`; per-segment char counts are
speechText lengths per the adapter's `charCountOf` convention — the same
basis the live builder quotes on; the live text basis differs by 63
chars across the work set, ≈ 900 units, immaterial and noted in §7):

| idx | occurrence | parked row | chars | disposition today |
|---|---|---|---|---|
| 0 | `6bd358a7…` | ready (bound) | 652 | bound_already — POLICY_BLOCK anchor (§2e) |
| 1 | `16e860aa…` | ready (bound) | 742 | bound_already — anchor's split child |
| 2 | `467174dd…` | ready (bound) | 1,181 | bound_already |
| 3–25 | 23 occurrences | pending (unbound) | 1,215–1,493 ea. | excluded_parked — **the work set: 32,005 chars** |
| 26 | `2a85f74f…` | pending (unbound) | 569 | fenced — see below |

**idx 26, in one line:** it was never in the parked job's own 26-segment
definition (the reconciliation treats it as absent-from-parked,
disposition `excluded_ch3` — BUILD-REPORT §7 / ARMING-REPORT), so this
gate leaves it fenced; its live pending row is a carry artifact, and the
§5 release is occurrence-enumerated precisely so it cannot slip in.

A precision note for the reviewer: on the LIVE plane, `parkedJobOf`
reads live rows (idx 26 included), so the builder's live label for
idx 26 is `excluded_parked`, where the census-derived plane said
`excluded_ch3`. The endpoint folds both into `parked: 24` either way.
The distinction is inert today and decisive only for release design —
§5 keys the chapter rule so idx 26 stays fenced under both labels.

## 5. Resume-mechanism DESIGN (the build this gate first requires)

**Design principle:** the parked job is a frozen record, not a vehicle.
Nothing in this design moves it, settles it, or executes its rows. The
mechanism releases the *fence*, and generation then flows through the
ordinary, fully-guarded plan machinery — the same machinery that ran
Chapter 2.

**Variant A — explicit park release (RECOMMENDED).**
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
   occurrence is a `pending` row of THAT job; the set is non-empty and
   duplicate-free; a live (non-tombstoned) release for the job does not
   already exist. Refusals are named domain rejections (HTTP 200
   `rejected`), never partial writes; the write and its audit land in
   one transaction.
3. Builder/adapter change (the only generation-logic change):
   `parkedJobOf` additionally loads the job's live release (if any) and
   returns the entry map MINUS released ids, plus a separate
   `parkedChapter` marker that remains set while the job is
   `parked_policy`. Builder precedence becomes: bound_already →
   excluded_parked (unreleased entries) → excluded_ch3 (parked chapter,
   not an entry — idx 26's exact case, unchanged) → voice_prompt →
   eligible. A released, unbound, live-POV occurrence therefore takes
   its natural `eligible` disposition; a released but bound occurrence
   was already bound_already. With no release record, behavior is
   byte-identical to today (regression-pinned).
4. Reversal: a release is tombstoned, never deleted (second operator
   call, same fence, audited). Tombstoning re-fences the chapter
   exactly; it cannot un-spend anything already generated, and bindings
   already published stay published (they are content, not fence).
5. No FSM change. No change to the parked job, its rows, the carry, or
   the freeze verification. No new grant path: post-release grants flow
   through the existing guards (quota guard, phase budget, storage,
   quarantine birth-mark — the system is unhalted at execution time, so
   the Ch 3 plan is born unmarked; the execution sequence verifies the
   halt state at submission regardless).

**Variant B — FSM extension + execute the parked job in place
(REJECTED).** Adding a `parked_policy` outbound edge (e.g. `release →
queued`) is one line, but the D6 executor executes *plan* jobs with
plan-keyed executions, billing records, and phase accounting; the
parked job has no plan, no phase binding, and no budget hooks.
Executing it in place means building a second execution path around
every guard this program has spent a month hardening. Not smallest,
not safe.

**Variant C — supersede the parked job, then submit (REJECTED).**
`parkedJobOf` selects `WHERE state='parked_policy'`, so superseding
would lift the fence as a side effect. But it rewrites the frozen
record's state (the carry's truthful home), risks the §3A.5 carry
verification that recomputes from stored rows, lifts the chapter rule
for idx 26 as collateral, and makes a *record-keeping* act carry a
*spending* consequence implicitly. The release must be an explicit,
enumerated, auditable act — Variant A.

**Build scope honesty:** one route, one table, one builder/adapter
change, plus tests (builder: released→eligible, unreleased→fenced,
idx-26-shape→excluded_ch3, no-release→byte-identical set + digest;
route: fence classes, subset validation, duplicate/idempotency,
tombstone; service: post-release chapter quote shows exactly the
released set). It then follows the standing pipeline unchanged:
Rowan source review → final envelope → halted deploy gate (its own
Julie GO) → this gate's execution gate (§6, its own Julie GO). The
deploy changes the live build stamp; §6's preconditions are written
against "the approved post-deploy build, hash-verified at execution,"
not against 945875bc.

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
queue delivering; Batch still unarmed.

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
- **E4 — Close-out.** Completion criteria (§10) verified by read-back;
  execution record filed for Rowan's review; Julie's playback check
  requested. The record states plainly that the parked job still reads
  `parked_policy` with 24 pending rows — by design (§2d) — alongside
  the release record and the completed plan that together are the
  audit trail.

## 7. Fresh quote, budget and cap math

**Quote basis.** No live read surface exposes char counts for fenced
rows (the eligibility quote sums ELIGIBLE entries only — verified in
source, service.mjs `eligibilityQuote`). The figures below are
census-derived (§4) from the frozen P8 snapshot — the same data the
migration carried — cross-checked against today's live eligibility
digest, which is unchanged. **The binding quote is the E1 read-back**:
submission rebuilds the set from the live plane, and E2 verifies the
plan's own entries before any grant can issue.

| figure | 23 segments (idx 3–25) | (24 incl. idx 26, DP-1 only) |
|---|---|---|
| chars (eligibility basis) | 32,005 | 32,574 |
| expected cost = round(chars/15.96 × 225) | **451,198 (≈ $0.451)** | 459,220 (≈ $0.459) |
| single-attempt upper = round(chars/10 × 225) | 720,112 (≈ $0.720) | 732,915 (≈ $0.733) |
| guard ceiling = Σ 12 × per-occurrence upper | 8,641,344 (≈ $8.64) | 8,794,980 (≈ $8.79) |

**Phase-budget guard check** (the guard's own formula: settled +
reservedUnverified + inFlightUpper + this plan's pendingUpper ≤
13,500,000): 579,339 + 5,648 + 0 + 8,641,344 = **9,226,331 ≤
13,500,000 — PASSES**, with 4,273,669 to spare even at the absolute
12-attempts-everywhere ceiling. Expected-case phase settled after the
run ≈ 579,339 + ~451,198 ≈ **1,030,537 of 13,500,000 (7.6%)**. The $50
monthly cap is a non-binding outer backstop (month-to-date 725,221).

**Provider-attempt math vs the 100/day cap.** Every in-scope segment
exceeds the 1,200-char pre-split ceiling (policy-split.mjs:222), so each
is pre-split into 2 exact-concat chunks: **≈ 46 first-pass calls**.
Today's count is 0. Headroom after first passes: ~54 calls for
POLICY_BLOCK splitting (depth ≤ 4, ≤ 16 leaves) and repairs, inside the
per-segment budget of 12 calls (split tree + repair chain combined).
Expected case: **fits one PT day comfortably.** Worst case: the quota
guard refuses dispatch #101 *before any provider contact* (provably no
billing) and the plan parks `parked_quota` — it resumes on the next PT
day by the shipped driver behavior; that is a schedule outcome, never
an overspend and never an unknown.

**Mandatory disclosures.**
- All figures above are **models, not provider-confirmed prices**:
  expected cost is the realized-rate estimate (chars/15.96 × 225); the
  uppers are model bounds (chars/10), not provider ceilings. Ledger
  units behave as micro-dollars despite the `MicroCents` naming.
- The Gemini prepay balance was **$17.83 on Oct 29 — STALE, not
  re-verified**; it is a hard physical limit with auto-reload OFF. The
  expected ~$0.45 sits far inside it on any plausible drift, but the
  balance itself is asserted nowhere in this proposal.
- **The Chapter 2 lesson, as a rule of this gate:** a segment whose
  billing comes back unconfirmed halts the run for adjudication
  (§8). Nothing auto-continues past an unknown, and no figure is ever
  written as a known charge on a model's say-so.

## 8. POLICY_BLOCK and unknown-billing expectations

- A provider refusal (`contentBlocked`) is confirmed in the attempt log
  as `policy_block` at cost 0 and enters recursive splitting
  (policy-split.mjs): same cast voice, original text preserved exactly
  across splits (concatenation is identity), depth ≤ 4, floor 50 chars,
  shared 12-call segment budget. A part still blocked at the floor is
  `TerminalBlock` → execution `policy_block`, occurrence
  `report_blocked` → `blocked_policy` (terminal), plan ends `partial`.
  That is a STOP (E3): resolving a terminally blocked segment is a
  separate gated program. **Never** voice substitution, **never** text
  edits to slip the filter (feature law F3).
- Segments over 1,200 chars are pre-split before dispatch (incidence
  reduction for the 120 s fetch ceiling; the ceiling remains a
  fail-closed backstop, not a guarantee).
- A non-HTTP provider throw confirms the attempt `unknown` at cost
  NULL → `markUnknownBilling` (d6-executor.mjs:594) halts the phase and
  stops the whole message; later occurrences are untouched. Unwinding
  (reconciliation / estimated_unverified adjudication) is the separate,
  already-precedented gated program — never part of this gate.
- Retryable HTTP failures ride the server-owned repair chain (F6);
  flush/commit failures ride intent-recovery, as Chapter 2's 18/18
  demonstrated on this machinery's predecessor build.

## 9. Fingerprint exposure — disclosure in lieu of preflight

What is knowable read-only: idx 0–2 hold bindings and are never
regenerated (live `bound_already: 3`; census audioKey/fingerprint
present). Fingerprint keys for the 23 derive from the dispatch payload
(text + voice + provider + model + style direction), computed at
execution time in the work source. Whether an R2 object already sits
at any of the 23 keys is **not** knowable from any read surface — that
is exactly the separately-gated R2-HEAD provenance read, which this
proposal does **not** take. Chapter 2's precedent on the pre-fix build:
8 `winner_digest_mismatch` collisions, 167,922 units (≈ $0.168) of
recorded defect waste, and all 18 segments still completed via repair.
On the CURRENT build the cache defect behind half those failures is
fixed (`refreshKey`); a digest-matching pre-existing object is adopted,
a mismatch fails `failed_known` and the repair chain retries — a
bookkeeping cost, never a billing unknown. **This gate therefore
proceeds on the unverified-exposure disclosure** (DP-3): collisions, if
any, surface in diagnostics during E3 and are reported with the record;
if Rowan requires the preflight instead, it is requested as its own
read-only authorization before E1.

## 10. Completion criteria

1. Plan `complete` with totals: eligible 23, done 23, failed 0,
   blocked 0; bindings published 23 (bindings watermark advances by
   exactly 23; content watermark unchanged).
2. Chapter eligibility re-quote: chapterIndex 2 shows bound_already 26,
   parked 1 (idx 26), eligible 0.
3. Phase read-back: settled increased by the plan's recorded
   settlements only; unknownOpen still 0; `reconcileQuota` still
   `ok: true` with no new exceptions.
4. Parked job state, conflicts set (3 rows), settings revision, and
   queue state all identical to the preconditions.
5. Julie's playback check of Chapter 3 audio on her device: PASS.
   (The run is not called complete on server evidence alone.)

## 11. NOT authorized by this gate

Batch arming or any Batch lane use; any other chapter or book
(rest-of-Forever-Pucked remains its own later gate, and idx 26 does not
ride along with it — it stays fenced until a release decision names
it); any change to the parked job's state or rows; quarantine releases
of any other subject; settings changes; the R2-HEAD provenance read;
any rollback; any second intent, second release, or retry beyond §6's
convergence rule; legacy snapshot retirement; Issue #16.

## 12. Decision points

- **DP-1 — idx 26 in or out of the release set.** Out: 23 segments /
  32,005 chars / expected 451,198; the chapter's 569-char tail segment
  stays fenced and silent until a future release names it. In: 24
  segments / 32,574 chars / expected 459,220; the chapter completes as
  it exists live today. **Lean: OUT** — the segment was never in the
  parked job's definition set (§4); this gate resumes *that job's*
  work, and widening a release beyond the record it resumes is exactly
  the kind of quiet scope growth this board exists to prevent. The
  listening consequence is stated plainly in §0 so the choice is
  informed either way.
- **DP-2 — one GO or two for E1+E2.** **Lean: ONE GO** covering the
  release and the submission as a single named sequence with the E1
  read-back as a hard checkpoint between them (mismatch = STOP, §6) —
  the gate-(c) pattern. A separate release-only GO is available if
  Rowan or Julie prefers the seam.
- **DP-3 — fingerprint preflight or disclosure.** **Lean: disclosure**
  (§9), on the Chapter 2 precedent numbers; the R2-HEAD read remains
  available as a separately authorized read if Rowan requires it.

## 13. Source index (build 945875bc tree; all hash-verified per §2)

- `worker/coordinator.mjs` — JOB_STATES/parked comment :36–41;
  JOB_TRANSITIONS `parked_policy: {}` :80; `applyJobEvent` :432;
  `_resume` :1565; `_deriveJobCompletion` (funnels through the
  applier); `_migrateImportJobs` :4489 (direct INSERT :4554ff).
- `worker/generation/eligible-set.mjs` — disposition precedence :18–23;
  parked reason string :76–85.
- `worker/generation/content-plane-adapter.mjs` — `parkedJobOf` :111;
  `charCountOf` / `blockHistoryOf` conventions.
- `worker/generation/service.mjs` — parked-job fence comment :701–706;
  `submitIntent` (convergence, overlap fence, `nothing_eligible` :855);
  `createJobForEntries` :150 (fresh job + fresh occurrence rows);
  `eligibilityQuote` (eligible-only char sums); `driveOnce` :888
  (plans only).
- `worker/generation/d6-executor.mjs` — attempt wrap + `policy_block`
  confirm :522; TerminalBlock → `policy_block_terminal` :553;
  quota-refusal shape; `markUnknownBilling` :594.
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
- `worker/worker-entry-prod-d6.js` — full route inventory (no
  job-state surface); operator fence classes.
- Records: D6 BUILD-REPORT §7 + ARMING-REPORT (Ch 3 reconciliation:
  27 rows, anchor `6bd358a7…`, idx 26 absent-from-definition);
  approved freeze carry (`worker/p8/approved-freeze-carry.mjs`, jobs
  aggregate: 27 occurrences, 3 ready / 24 pending); gate-(a)/(b)/(c)
  execution records (pins `68776e41…`, `26b5b5ee…`, `5d6fd25a…`).
