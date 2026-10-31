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
