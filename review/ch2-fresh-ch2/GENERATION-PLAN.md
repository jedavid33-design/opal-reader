# FRESH CHAPTER 2 GENERATION — intent / budget operational plan

**Status: PROPOSAL ONLY — repo-only. This package submits no
intent, makes no production call, generates nothing, and spends
nothing.** It exists so Rowan can review the exact fresh-generation
submission and budget, and Julie can later give — or withhold —
her distinct go. Execution is a separate gate (§4, §6).

Lineage: design §11 gate 8 (fresh generation). Rowan's gate-7
re-arm execution-record PASS (roundtable issue #15, comment
6537871481) authorized preparing this plan and set its required
contents: *"a distinct minting identity (do not converge on
retired `keepGoing:false` intent), current eligible/bound
re-derivation, safety/duplicate-billing protections, explicit
scope and stop behavior, updated current prepay/budget evidence
before any spend, and a separate Julie approval."* §0 below
corrects one premise of that charge — and of the gate-7 proposal
§3.2 — on computed evidence. The correction changes the *reason*
the fresh intent mints a new plan; it does not change the plan
proposed here, and it does not touch any gate-6/7 safety
conclusion.

Basis: live build `6a73d9622e1b4eac00c58e289de1c674ed6b3d6b`
(deployed source: the §8 disposition build tree), system **armed
and unpaused** (gate-7 re-arm, execution record PASS 6537871481),
fresh read-only capture 2026-10-31T02:43:02Z (GETs only; canonical
assessment in `evidence/rederivation-assessment.json`).

**Conclusion up front:** the correct fresh submission is a
chapter-scope intent for chapterIndex 1 with the *same* requested
semantics as the retired run — lane `standard`, phase
`forever-pucked`, keepGoing `false` — and it mints a **new** plan,
predicted id **`plan:b2dc2a3d1cd367a0245b9102`**, because the
intent-identity formula itself changed (B2) between the build
that minted the retired plan and the live build. Its scope is
provably exactly Chapter 2's **18 eligible segments / 25,091
chars** (§2), its worst-case grant-guard basis passes the phase
budget with 6,520,087 micro-cents of headroom (§5), and its stop
behavior is the deployed fail-closed design (§4).

---

## 0. Correction to the gate-7 record — the convergence premise

Read first; everything else in this plan is consistent with it.

**What was claimed.** The gate-7 re-arm proposal (§3.2, repeated
in Rowan's gate-7 reviews as the operative premise) held that a
byte-identical resubmission of the retired plan's intent —
chapter scope, chapter 1, lane `standard`, keepGoing `false`, the
same 18 eligible ids — would hash identically under the live
build and **converge on the retired plan**, creating nothing; a
fresh submission would therefore need *different* semantics
(e.g. keepGoing `true`) to mint a new plan.

**What the source shows.** Intent identity is
`sha256Hex(canonicalJson({...}))` in `generation/service.mjs`
(`submitIntent`), and the field set is **build-dependent**:

- The build live when the retired plan was created
  (2026-10-29T23:05Z, the seed-fix build `ac451df8…`) computed the
  key over **five** fields: `{bookId, scope, chapterIndex,
  occurrenceId, eligibleIds}`.
- The B2 semantics expansion (Rowan round-1 correction: *"intent
  identity covers the authoritative requested EXECUTION
  SEMANTICS — lane, keepGoing, and the server-derived phase"*)
  landed in gen-pkg-1 and is the live build's formula:
  **eight** fields — the five above plus `lane`, `keepGoing`,
  `phase` (the server-derived admitted phase).

**Proof, not assertion.** Recomputing the retired plan's key
under the five-field formula, over the 18 eligible ids in reading
order (§2), reproduces its stored identity **exactly**:
`plan:603ab416bd67ab1b25de97be`. Recomputing under the live
eight-field formula — with keepGoing `false` *or* `true` —
produces two different keys, neither equal to the stored key
(§1.1). The convergence lookup (`SELECT … WHERE intent_key = ?`)
therefore **cannot** return the retired plan for any submission
made today: the key space itself moved.

**Consequences.**

1. The later fresh-go submission does **not** need altered
  semantics to mint. Both keepGoing values mint a new plan under
  the live formula; §1.2 chooses between them on scope and
  truthfulness, not on convergence.
2. No gate-6/7 conclusion is affected. The retirement guard, the
  executor fence, and the driver exclusion never rested on
  convergence — convergence was a side observation about a future
  submission, and it is that observation alone that is corrected.
3. The correction is recorded here, in the first document whose
  work depended on the premise, and is offered for Rowan's
  acknowledgment with this plan's review. The gate-7 proposal is
  not silently rewritten.

---

## 1. Distinct minting identity

### 1.1 The identity, computed

Under the live build (`service.mjs` `submitIntent`; canonical
JSON = recursively key-sorted `JSON.stringify`; plan id =
`plan:` + first 24 hex of the key), over the §2 eligible set
(18 ids, reading order), bookId
`5c589095-f812-48a2-8ab2-03ba2791f2b2`, scope `chapter`,
chapterIndex 1, occurrenceId null, lane `standard`, phase
`forever-pucked` (the gate-2 recorded binding's admitted phase —
server-derived at submission, not caller-asserted):

| Formula | keepGoing | Intent key (first 24 hex) | Plan id |
|---|---|---|---|
| pre-B2 (5 fields) — reproduction check | *(not a field)* | `603ab416bd67ab1b25de97be` | `plan:603ab416bd67ab1b25de97be` = **the retired plan** ✓ |
| live B2 (8 fields) | `false` | `b2dc2a3d1cd367a0245b9102` | **`plan:b2dc2a3d1cd367a0245b9102`** ← chosen |
| live B2 (8 fields) | `true` | `5c54a3926540c320be0bbed3` | `plan:5c54a3926540c320be0bbed3` |

Both live-formula candidate ids were probed read-only at
proposal time: `GET /v2/d6-plans/<id>` returns **404
`plan_not_found`** for each — neither plan exists. The full keys
and the eligible-id list are in the evidence JSON
(`intentIdentity`), so every figure in this section is
recomputable from the pinned package alone.

### 1.2 Scope analysis — why chapter scope, keepGoing `false`

The chosen intent must scope **exactly** Chapter 2's 18 eligible
segments. The four candidate semantics, against the deployed
source:

- **Book scope, keepGoing `true` — REJECTED (sweeps the book).**
  A book plan's entries are the whole book's plane. The live
  book-scope quote (same builder, same plane digest) counts
  **332 eligible occurrences / 439,141 chars / ~$6.19 modeled
  expected** — not Chapter 2's 18. Worse, the driver's
  advancement branch (`driveOnce`: `plan.scope === "book" &&
  plan.keep_going`) creates the *next* chapter's job when a job
  settles, chapter after chapter — including work Julie has not
  approved, in chapters she has not named. (Chapter 3's own
  occurrences are builder-excluded as parked — 24 `parked`
  exclusions in the quote — but the remaining ~314 eligible
  occurrences in other chapters are not.)
- **Book scope, keepGoing `false` — REJECTED (wrong plan, wrong
  scope).** No advancement, but the plan still *owns* the whole
  book's scoped set: 407 scoped entries (51 `bound_already` +
  332 eligible + 24 parked-excluded), an eligible set of 332,
  and a `finishPlan` that
  can only ever report `partial / incomplete` for a Chapter-2-
  only run. The plan's identity, accounting, and overlap fence
  would all describe a book Julie did not ask to generate.
- **Segment scope × 18 — REJECTED (fragmentation).** Eighteen
  one-segment plans would each scope exactly, but they fragment
  the run's accounting, monitoring, and finish semantics into 18
  artifacts, and discard the chapter as the unit of work — the
  shape both the retired plan and Julie's "generate Chapter 2"
  decision actually take. Nothing in the design requires it: the
  chapter intent already scopes exactly.
- **Chapter scope, keepGoing `true` — mints, but REJECTED
  (untruthful semantics).** It would mint `plan:5c54a392…` and,
  at chapter scope, keepGoing is behaviorally inert *today*:
  the only drive-time read of `keep_going` is the advancement
  branch, which additionally requires `scope === "book"`
  (`nextChapterEntries` has exactly one call site, inside that
  branch). But keepGoing's sole defined meaning in this system
  is cross-chapter continuation, and Julie's decision is
  "Chapter 2, then stop." Recording `keepGoing: true` would
  store an execution semantic she did not choose, on the chance
  a future build widens its meaning at chapter scope — at which
  point the stored artifact would already say yes. The minting
  rationale that once argued for it (§0) is gone; what remains
  argues against.
- **Chapter scope, keepGoing `false` — CHOSEN.** Identical
  requested semantics to the retired run: scope filter admits
  exactly chapterIndex 1's entries (38 scoped: 20
  `bound_already` + 18 eligible, §2); the first — and only —
  job is the chapter's eligible entries
  (`plan:…:ch1`); on settle the plan goes to `finishPlan` over
  its own 18 (complete iff all 18 done — a truthful finish).
  It mints a new plan solely because the identity formula grew
  (§0), which is a fact about the builds, not a change in what
  Julie is being asked to approve.

### 1.3 The exact submission (execution-time, §4 step E2)

One command, via the client-reachable command route (the same
surface the smoke and the retired run used):

```json
POST /v2/commands
{
  "command_id": "fresh-ch2-20261031-fp-chapter2-v1",
  "type": "SubmitJob",
  "payload": {
    "bookId": "5c589095-f812-48a2-8ab2-03ba2791f2b2",
    "lane": "standard",
    "data": {
      "d6Intent": {
        "scope": "chapter",
        "chapterIndex": 1,
        "phase": "forever-pucked",
        "keepGoing": false
      }
    }
  }
}
```

Forwarding (deployed entry, `worker-entry-prod-d6.js`): a
`SubmitJob` whose `payload.data.d6Intent` is present is an
intent, not a job — the entry builds `{commandId, bookId:
payload.bookId, lane: payload.lane, ...d6Intent}` and forwards
to the coordinator's `/internal/d6/intent`, which calls
`submitIntent`. Admission re-derives everything server-side:
the eligible plane is rebuilt fresh, the phase is admitted
against the recorded gate-2 binding (`forever-pucked` ↔ this
bookId; capabilities confirms the binding live), and the intent
key is computed from the server-derived values — the caller's
fields request semantics, they do not assert identity.

`command_id` convention: `fresh-ch2-<yyyymmdd>-fp-chapter2-v1`
— descriptive, dated, **single-use**. The exact id used is
written into the execution record before submission; it is
never reused for any later command, and no second submission
under a variant id is permitted by §4 (a retry under a new
command id would still hit the same intent key and return the
same plan with `created: false` — which §1.5 treats as a STOP,
not a success path).

### 1.4 Pre-submission identity checks (reads only; ALL must pass)

- **C1 — the plane has not moved.** Re-run the chapter quote
  (`GET /v2/d6-eligibility?bookId=…&scope=chapter&chapterIndex=1`):
  eligibleCount 18, totalChars 25,091, expectedCostMicroCents
  353,726, exclusions `{bound_already: 20, voice_prompt: 0,
  parked: 0, other: 0}`, digest
  `6d7efbb74667cea93a99c0d1965cb8d5931ffa4589d2d20b3b3283cae3b7f3e8`.
  If counts differ → **STOP**. If only the digest differs,
  recompute the predicted id from the fresh eligible set and
  re-run C2 before proceeding — never submit against a stale
  prediction.
- **C2 — the predicted plan does not exist.**
  `GET /v2/d6-plans/plan:b2dc2a3d1cd367a0245b9102` → 404
  `plan_not_found` (verified at proposal time; re-verify at
  execution).
- **C3 — no competing owner.** `GET /v2/d6-plans` lists exactly
  the two known plans — the retired Chapter 2 plan and the
  complete smoke plan; no `active` plan exists. (The R2-2
  overlap fence would refuse a conflicting submission anyway;
  this check makes the refusal unnecessary rather than
  discovered.)
- **C4 — system state as reviewed.** `/health` build
  `6a73d962…`, generation `enabled`; queue unpaused; settings
  revision 1 (lane `standard`, cap $50); phase figures equal
  §5's opening table; the stale job/grant and the Chapter 3 job
  byte-identical in state and revision to the evidence capture
  (recorded, never touched).

### 1.5 Post-submission confirmation — and the STOP around it

The submission's response must be exactly:

```json
{ "planId": "plan:b2dc2a3d1cd367a0245b9102", "created": true, "state": "active" }
```

with the plan's first job `plan:b2dc2a3d1cd367a0245b9102:ch1`
visible on the plan/job reads. **Any other shape is a STOP:**
`created: false` (convergence — impossible per §0, so its
appearance would mean the plane or the build is not what was
reviewed), a different plan id, a `rejected` outcome (including
`plan_overlap_conflict` or `lane_not_allowed`), or a transport
error with an unknown outcome. On a STOP: no second submission,
no manual job or grant action — read back the plan list, record
what exists, report verbatim. A submission whose outcome is
genuinely unknown is treated as *possibly created*: the plan
list read-back, not a retry, is how its existence is settled.

---

## 2. Eligible / bound re-derivation (fresh, three-way)

The scope table was derived **three independent ways**, all
against live state at 2026-10-31T02:43:02Z, and all three agree
exactly:

1. **The server's own builder, quoted live.**
   `GET /v2/d6-eligibility` runs the *same* builder
   `submitIntent` executes, scoped exactly as it scopes
   (`service.mjs` `eligibilityQuote`): chapter 1 →
   eligibleCount **18**, totalChars **25,091**,
   expectedCostMicroCents **353,726**, exclusions
   `{bound_already: 20, voice_prompt: 0, parked: 0, other: 0}`,
   plane digest `6d7efbb74667cea93a99c0d1965cb8d5931ffa4589d2d20b3b3283cae3b7f3e8`.
2. **The retired plan's stored entries** (the prior derivation,
   frozen at its creation and never rewritten — the store
   updates only `job_id` on entry rows): 38 chapter-1 entries,
   one chapterId (`8281536e-b678-48cb-9ed4-de4383d538e9`),
   20 `bound_already` (9,997 chars) + 18 `eligible`
   (25,091 chars).
3. **The live bindings snapshot** (sync family `bindings`,
   watermark 1800, 1,800 entities): Forever Pucked carries 51
   binding entities. Each of the 20 `bound_already` occurrences
   **has** a live binding; each of the 18 eligible occurrences
   has **none** — zero exceptions in either direction. (The
   remaining 31 FP bindings belong to other chapters and are
   consistent with the migration census: Chapter 1's 27,
   Chapter 3's 3, the smoke segment's 1.)

Classification rule (the builder's precedence, `eligible-set.mjs`):
an occurrence with a live audio binding derives `bound_already`
and is never in an eligible set; an unbound occurrence with a
resolved voice derives `eligible`; an unbound occurrence whose
POV has no usable voice derives `voice_prompt` — Chapter 1 has
**none**, so the chapter's plane is exactly 20 + 18 with no
third class in play.

**The 18 eligible segments** (reading order; full 38-row table
with per-segment figures in the evidence JSON):

| Pos | Occurrence | Chars | Expected (micro) | Attempt upper (micro) | Pre-split |
|---|---|---|---|---|---|
| 45 | `4b2b3699-db42-4af1-9f27-3caad67f58e6` | 1,448 | 20,414 | 32,580 | yes |
| 46 | `117ef377-8df1-4189-bc85-4670bb034940` | 1,294 | 18,242 | 29,115 | yes |
| 48 | `6b7ea94c-6631-4e66-8330-e3d3152b0c74` | 1,352 | 19,060 | 30,420 | yes |
| 49 | `c4475eda-a6b1-4c92-9f71-f2f69643608f` | 1,498 | 21,118 | 33,705 | yes |
| 50 | `59acff00-d6a4-4e2b-9734-34d50f4f59f0` | 1,349 | 19,018 | 30,353 | yes |
| 51 | `26a37980-ddbb-4f41-8f14-b99e541c582e` | 1,352 | 19,060 | 30,420 | yes |
| 52 | `be263419-cd45-4d29-b31b-e5352f4c8b59` | 1,493 | 21,048 | 33,593 | yes |
| 53 | `de0436f4-89f5-4a99-b38a-d32823ce72cd` | 1,456 | 20,526 | 32,760 | yes |
| 54 | `4f35bc00-7120-45e5-b251-2068ccb4452a` | 1,475 | 20,794 | 33,188 | yes |
| 55 | `3929c8a1-e5a3-4ba3-be1f-e1bb72dccb6b` | 1,367 | 19,272 | 30,757 | yes |
| 56 | `0343a3a1-9957-4431-8663-dce0b329171f` | 1,389 | 19,582 | 31,253 | yes |
| 57 | `bfabaa59-e720-4ec6-9346-d196f0f80582` | 1,399 | 19,723 | 31,478 | yes |
| 58 | `b42a64ab-8bac-4706-85f3-adf7cc96bcdd` | 1,341 | 18,905 | 30,173 | yes |
| 59 | `84ff25f0-dc56-4c9e-980d-0af74e9fef7f` | 1,184 | 16,692 | 26,640 | no |
| 60 | `2997a9b4-0ff6-4254-8022-4c6c9b986159` | 1,477 | 20,822 | 33,233 | yes |
| 61 | `67d4b319-d696-4c08-90d7-100d5c9e240c` | 1,367 | 19,272 | 30,757 | yes |
| 62 | `abae8a3e-127d-4979-a883-df072be33784` | 1,437 | 20,258 | 32,332 | yes |
| 63 | `3095422d-17c5-4f48-8660-ce94930fb605` | 1,413 | 19,920 | 31,793 | yes |

Totals: **18 segments, 25,091 chars**; Σ expected **353,726** micro-cents (matches the live quote to the unit); Σ per-attempt uppers 564,550; Σ per-occurrence uppers (12-attempt ceiling) 6,774,600 (§5). Seventeen of the eighteen exceed the 1,200-char pre-split threshold (§3). Position 50 (1,349 chars) is the segment whose split attempt was the retired run's disposed unknown — it is an ordinary eligible row here; nothing about it is special-cased, and nothing about its history is inherited by the new plan beyond its eligibility.

---

## 3. Safety and duplicate-billing protections

**Born armed — no quarantine hold.** A plan is birth-marked
into quarantine only when it is born while generation is halted
(`submitIntent`: the mark is written iff the quarantine mode is
enforced **and** `generationHalted()` reads true at insert).
Since the gate-7 re-arm, `GENERATION_HALT` is `"0"`, so the new
plan is born **unmarked**: admitted normally, `approvalRequired`
false on its plan views (a monitoring checkpoint in §4 — if it
ever read true, that is an unexpected state and a STOP). No
release step exists in this run because no hold can exist.

**Fence admission of the new plan.** The R2-2 overlap fence
passes: the only plans in the store are terminal (`retired`,
`complete`), and terminal plans are skipped by the fence — the
retirement is precisely what cleared ownership (gate-7 §3).
At execution, the executor's pre-claim fence resolves this
plan's identity from persisted records exactly as it refused
the retired plan's: state `active` is not in
`PLAN_STATES_REFUSED`, so its grants are dispatchable — the
fence discriminates on plan state, and this plan's state is a
live one by Julie's prospective go, not by any residue.

**Phase budget guard (every grant, not just the first).**
`d6PhaseBudgetCheck` gates each grant on: settled +
reservedUnverified + inFlightUpper + *this job's still-pending
occurrence uppers* ≤ 13,500,000 (`grant-guards.mjs`). At the
first grant the pending sum is all 18 occurrence uppers:
199,665 + 5,648 + 0 + 6,774,600 = **6,979,913 ≤ 13,500,000**,
headroom **6,520,087**. As segments commit, pending shrinks by
each finished occurrence's upper while settled grows only by
its recorded known cost, so a guard that passes at the first
grant is not placed under greater pressure later. The guard
gates on the reservation basis, never the estimate — the
unverified reservation from gate 5 (5,648) is carried inside
the sum, per the Q4 remainder definition.

**$50 monthly cap.** Settings revision 1 (verified live) —
the outer backstop in the same grant machinery
(`spending_cap` → `parked_cap`). The quota view's
spentMicroCents (371,485) is the coordinator ledger's
grant-time estimate debits, **not** provider-confirmed spend;
this plan's own expected settle (~$0.35 modeled) is two orders
of magnitude under the cap on any basis.

**Daily quota (100/day).** attemptsToday is 0. Expected
provider calls ≈ **35** if first-try success dominates
(17 pre-split segments × 2 parts + 1 single segment). The
per-segment attempt budget (below) caps the pathological case
at 216 attempts for the chapter; if the rolling daily quota
binds first, the grant guard parks the plan (`parked_quota`)
fail-closed — a designed stop, reported under §4, never an
improvisation trigger. The plan can also simply span the
quota-day boundary under the watchdog's own cadence; no action
is needed for that case.

**Pre-split at 1,200 chars.** Segments over
`PRE_SPLIT_MAX_CHARS` are synthesized via the pre-split path
(`synthesizeLongSegment` / `preSplitText`): **17 of the 18**
eligible segments (1,294–1,498 chars) take it, each splitting
into two parts at this size range. As the fix package states
honestly, the threshold is *incidence reduction* for the
120-second provider timeout — a mitigation, not a guarantee;
the timeout remains a fail-closed backstop whose outcome, if
it ever fires post-dispatch, is the unknown-billing path in
§4, not a silent retry.

**POLICY_BLOCK handling.** A provider policy refusal drives
the deployed recursive splitting (depth ≤ 4, ≤ 16 leaf parts,
minimum part 50 chars) **without voice substitution** (feature
law F3), inside the same per-segment attempt budget.
Occurrences that exhaust the budget on policy grounds finish
as `blocked_policy` in the plan totals — counted, visible,
terminal for this run; the plan finishes `partial` and §4's
report names them. They are not silently re-attempted, and
any later attempt at them is a new Julie decision.

**Server-owned repair chains.** Known-failure retries run
inside the server's repair machinery (`REPAIR_MAX_RETRIES` 3
per chain), every retry counting toward the segment's
12-attempt budget (`SEGMENT_ATTEMPT_BUDGET`, spanning split
tree + repair chain, `gen-constants.mjs`). No client- or
operator-submitted repair is part of this run (F6).

**Storage guard.** Each grant also passes
`d6StorageProjection`: modeled new audio ≈ 25,091 chars ×
3,012.6 B/char ≈ 75.6 MB (≈ 83 MB with the ×1.10
retries/orphans allowance) against the seeded base
(5,736,481,302 B / 5,942 objects) — far inside the 10 GB
free-tier boundary. A `storage_boundary` refusal is
fail-closed if ever reached.

**Why the old plan's work cannot double-execute or
double-bill.** (i) Eligibility is re-derived from live
bindings (§2): the 20 already-bound occurrences are never in
the new plan's eligible set, never granted, never billed
again. (ii) The retired plan can never grant at all
(gate-7 §2 — driver exclusion + executor fence; its state was
re-verified unchanged in this capture). (iii) The new plan's
job is a new job id (`plan:b2dc2a3d…:ch1`); the stale job's 18
`granted` rows are keyed to the old job id and are never read
by the new plan's driver or executor. (iv) Spend intents are
keyed per grant + job + occurrence and are reachable only
after a successful claim under the new plan's own grants.
(v) While this plan is non-terminal, the overlap fence
refuses any second plan from owning any of the 18.

---

## 4. Execution sequence and stop behavior (for the later go)

This plan executes nothing. On Julie's distinct go (after
Rowan's review of this plan), the sequence is:

- **E0 — Preflight.** §1.4 checks C1–C4, plus: phase figures
  equal §5's opening table; Chapter 3 job re-read for
  invariance only (state `parked_policy`, fingerprint
  `b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`);
  stale job/grant unchanged. Any drift = **STOP**, report,
  no submission.
- **E1 — Approval check.** Julie's go for *this* plan,
  recorded on the board, cited in the execution record. No
  earlier approval (program, gate 5, gate 6, gate 7) covers
  this submission.
- **E2 — ONE submission.** The §1.3 command, exactly once,
  then the §1.5 confirmation. No variant, no retry.
- **E3 — Monitoring.** Plan and job reads on the watchdog's
  own cadence (`WATCHDOG_PERIOD_MS` = 10 min) and at
  observation points: plan state and totals; job occurrence
  states; grants; attemptsToday and ledger movement; phase
  settled growth (recorded/known basis only); the plan
  summary's `bindingsPublished` / `bindingsPending`.
  **Publication is server-side:** a D6 commit writes the SQL
  binding atomically, then the binding projection
  (`binding-projection.mjs` — commit first, then project;
  per-occurrence marker pending → published; the
  reconcile sweep rides each `driveOnce` pass, limit 50)
  publishes the sync `bindings` entity with the server-stamped
  payload (`cacheKey`, `revisionKey`, `format`, `size`,
  `sha256`, provenance `"d6"`). The client learns the audio
  through the ordinary sync bindings family — **no manual
  SyncPush is part of this sequence.** (The one-off push used
  at the G10 smoke predates gen-pkg-1's projection; that gap
  is closed. The legacy Chapter-2 monitor cron is keyed to
  the *retired* plan id and cannot act on this plan.) A
  committed segment whose binding stays pending across
  several passes, or any projection `conflict`, is a
  reportable problem — reported, never hand-pushed.
- **E4 — Completion report.** Plan `complete` (all 18 done)
  or `partial` (failures / blocked named per segment):
  per-segment outcomes, the plan's settled figure
  (recorded/known, via the plan's own attempt rows),
  attempts used, bindings published, closing phase figures.
  Client playback confirmation is Julie's device check, as
  before — this plan does not claim it.
- **E5 — Record.** The execution record is pinned and filed
  for Rowan's review, in the established pattern.

**STOP behavior (general).** Any ambiguity, unexpected state,
or unlisted outcome at any step: stop, preserve, report
verbatim — no retry of a mutating step, no manual grant,
repair, or publication action, no scope improvisation.
Re-halt / re-pause remain available as Julie-directed
containment; they are not taken unilaterally beyond the stop
itself.

**Unknown-billing runbook (the designed fail-closed path).**
If any attempt's provider outcome cannot be classified, it
lands `unknown_billing`; the phase halts (`d6PhaseHalt` reads
the open unknown); the next grant refuses with
`phase_halted_unknown_billing`; the plan parks
`halted_unknown` at the grant step and the driver excludes it
from selection thereafter. In-flight granting stops;
already-committed segments stay committed and published. The
response is: **stop, report** to Julie and the board with the
attempt/execution ids and the closing figures. Resolution is
possible only through the deployed operator paths — the
reconcile route for a *proven* known cost or no-charge (with
independent provider evidence, per Rowan's standing
requirement), or the §8 adjudicate-estimated path — each
under its own Rowan-reviewed proposal and Julie approval,
exactly as gates 5–6 were run. Under this go, the plan is
never resubmitted, retired, or otherwise touched after such a
halt; a `halted_unknown` outcome is a program stop, not a
mid-run repair ticket.

---

## 5. Budget — with the mandatory billing-truth disclosures

**Disclosures (Rowan 6537006494 + 6537164115 + 6537327586,
carried verbatim in substance; they describe the retired
run's disposed attempt and have not changed):**

- The estimate **19,018 micro-cents** (~$0.0190) is an
  **occurrence-length model proxy** — the full occurrence's
  1,349 characters run through the code cost model. It is
  **not** an observed Google charge and **not** the split
  request's own measured length.
- The reservation **5,648 micro-cents** (~$0.0056) is the
  split attempt's **persisted modeled allowance** — an
  internal modeled figure, **not** a verified upper bound
  and **not** a provider bill ceiling.
- The two figures are computed on **unlike bases** and
  differ by **13,370 micro-cents**; neither invalidates the
  other, and the mismatch is carried, not reconciled away.
- **The actual Google charge for the disposed attempt
  remains UNKNOWN.** The attempt's `cost_micro_cents` is
  NULL; its outcome is `estimated_unverified`; the phase
  carries `provider_unverified` permanently, including after
  the gate-6 retirement and into this run.

**Phase position now** (`forever-pucked`, micro-cents;
live-verified 2026-10-31T02:43:02Z via the capabilities
surface):

| Term | Value | Nature |
|---|---|---|
| Phase budget | 13,500,000 | Julie's $13.50 decision, server-enforced |
| Settled | 199,665 | recorded/known under the existing ledger |
| Estimated unverified | 19,018 | modeled proxy (above) |
| Reserved unverified | 5,648 | modeled allowance (above) — the gating term |
| In-flight uppers | 0 | — |
| Unknown open | 0 | — |
| Remaining authorization | 13,294,687 | = budget − settled − reserved |

**Fresh Chapter 2 projection** (all figures **modeled, not
provider figures**, from the deployed cost model —
expected = round(chars / 15.96 × 225); per-attempt upper =
round(chars / 10 × 225); per-occurrence upper = 12 ×
per-attempt upper — over the §2 re-derived set):

| Projection | Micro-cents | ≈ $ |
|---|---|---|
| Expected settled-equivalent (all 18 succeed) | 353,726 | $0.3537 |
| Single-attempt uppers, summed | 564,550 | $0.5646 |
| Grant-guard reservation basis (Σ per-occurrence uppers) | 6,774,600 | $6.7746 |

- **Guard check at the first grant:** settled 199,665 +
  reservedUnverified 5,648 + inFlight 0 + pending uppers
  6,774,600 = **6,979,913 ≤ 13,500,000** — passes with
  **6,520,087** of headroom on the worst-case reservation
  basis (§3).
- **Remaining authorization after the expected settle:**
  13,294,687 − 353,726 = **12,940,961**.
- **Google prepay — dated, not fresh.** Julie's AI Studio
  prepay balance was **$17.83, verified by her screenshot on
  Oct 29, 2026**, auto-reload OFF. Per Rowan's caveat
  (6537764537), that figure **must not be treated as freshly
  verified**: no Wren surface can read the AI Studio balance,
  and **only Julie can refresh it**. The expected fresh-run
  cost (~$0.35 modeled) is **~2% of $17.83**; even the
  single-attempt-upper sum (~$0.56) is ~3%. The phase budget
  and the prepay balance are independent ceilings — the
  server enforces the first, physics enforces the second —
  and both sit far above this run's modeled exposure. No
  top-up is proposed or needed for this scope; if Julie
  refreshes the balance before her go, the refreshed figure
  is recorded in the execution record as her evidence, and
  nothing in this plan's math depends on it.

---

## 6. Explicit non-authorizations

This proposal authorizes **nothing**. Specifically:

- **Execution** — the §4 sequence, including the single
  intent submission — requires **Julie's distinct go**,
  given after Rowan's review of *this* plan. Her Chapter 2
  program direction (Oct 30, 2026) and the gate 5/6/7
  approvals do not cover it.
- **Batch stays unarmed.** The capabilities surface confirms
  `batch: {admitted: false, reason: "batch_not_armed"}`;
  the lane is `standard`, and nothing here changes lane
  admission.
- **Chapter 3 stays parked.** Its job is read at E0 for
  invariance only. No resume, no inclusion — the chosen
  chapter scope cannot reach it (§1.2), and the book-scope
  semantics that could have are rejected.
- **No rest-of-book scope.** The other chapters' 314 eligible
  occurrences are outside this plan; any work on them is a
  future, separate Julie decision.
- No settings change, no deploy, no quarantine release, no
  reconcile or adjudication call, and no stale job/grant
  mutation is proposed or authorized.
- Rollback floor unchanged: build `6a73d962…` remains the
  minimum build that may ever run against this data.

**Turn:** Rowan's — review of this fresh-generation plan
(including the §0 correction). Then Julie's distinct go.

— Wren
