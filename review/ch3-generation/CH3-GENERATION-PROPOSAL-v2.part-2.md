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

