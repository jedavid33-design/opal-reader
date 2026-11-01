# GATE 4 — FINAL PRESENTATION: corrected consolidated execution instructions — resume and complete Forever Pucked Chapter 3 (the plan's 15 remaining segments), Approach 2 (detection-only threshold) adopted, ends HELD

**Status of this document.** This is the single consolidated execution
instruction set for Gate 4 — the document an executor runs from. It
consolidates the operative instructions of four source documents into
one coherent sequence (§§4–10), applies Rowan's four final corrections
(§§1–3 and §5), and carries the detection-only spending disclosure
exactly as it will be put to Julie (§11). **It authorizes nothing.**
Execution requires Julie's separate GO for exactly this gate — one
GO, one execution attempt — recorded before the census (§4 of this
presentation), and nothing in any review in this chain is a substitute
for it. No step in this document has been executed.

**Sources consolidated** (repo `jedavid33-design/opal-reader`, branch
`ui1-review`, path `review/ch3-generation/recovery/gate3/`):

| Source | Pin | SHA-256 |
|---|---|---|
| Gate 4 proposal (`GATE4-PROPOSAL.md`) | `806cc53a` | `b524bb187d72c4c7881bf1d4470e6524b14a72678168ae23292245efc5abfabc` |
| Amendment 1 (`GATE4-AMENDMENT-1.md`) | `451f71ad5526879f6849f4f1607bb80024e439d0` | `af3ec5d397fb427b4f53e05f69ee6cfc82328bba9d95913dbc4002723baa7ef1` |
| Amendment 2 (`GATE4-AMENDMENT-2.md`) | `34fceb04332c73dc85e71c39b1df53ccd933c331` | `4f92ced7eaa67ba074f05f5992d4b7a18de66dde0d9e1c03785db9083f3b0c09` |
| R1 Resolution (`GATE4-R1-RESOLUTION.md`) | `6c1e503d538bcaf86b77f1ea29d4640f4ba06725` | `5149bbbeb9b3a02a40acf4da1fd263c153bf4669c00cf3bd2806897d027c8839` |

**Reading rule.** Where the sources' wording conflicts, the latest
document governs: R1 Resolution > Amendment 2 > Amendment 1 >
proposal, and this presentation says so at each point of conflict.
No operative term is silently altered: every change of substance is
one of Rowan's four corrections or a supersession a source document
itself declares, and §12 itemizes them.

**The review this presentation answers.** Rowan's R1 Resolution
review (relayed verbatim by Julie, Nov 1, 2026, direct mode):
**PASS WITH CONDITIONS — APPROACH 2 ADOPTED.** Her R1 ruling, in
substance: the 600,000 figure *"is a detection threshold, NOT a hard
cap"*; $0.29 is the expected modeled cost; $0.47 is the modeled
upper scenario at m = 1, not an unconditional maximum;
higher-duration scenarios must remain visible in Julie's approval
presentation (§11 carries them); Approach 1 remains available for
future, larger generation scopes and is **not** adopted here. Her
four final corrections are applied at §§1–3 and §5.3 of this
presentation. **Preserved, per her review:** the 15-segment scope;
the R1/R2 sub-gates; the four executor mutations; the
foreign-generation STOP; the sliding stall detection; the rollover
accounting; the end state HELD; one GO, one execution attempt.

---

## 1. Correction 1 — every 600,000 reference is a detection-threshold reference

**The relabeling rule (governing all Gate 4 paperwork).** Every
reference in the four source documents to the figure **600,000
units (≈ $0.60)** — under whatever wording a source used — is to be
read, cited, and executed as a **detection threshold**, in the R1
Resolution §8.1's words (quoted): *"detection threshold (600,000
units): an executor stop-trigger on observation; not a cap, not a
guarantee that settled spend stays at or under it."* No document in
this chain asserts, and no executor may represent, that settled
spend is guaranteed to stay at or under 600,000. Amendment 2 §5.1's
sentence claiming the figure *"binds by arithmetic"* is superseded
by R1 Resolution §§4 and 8: **469,519 units stands as the m = 1
forecast** — the modeled upper scenario at the cost model's slowest
admitted rate — labeled as a forecast wherever it appears, never as
a bound. The Amendment 1 §5.2 cover check is retained as a
**detection computation** (R1 Resolution §8.1): a poll whose
projected settled crosses the detection threshold stops the gate
the same way an observed crossing does; it is never described as
enforcement.

**Grep inventory (verifiable).** Method: `grep -n -E '\$0\.60|600,000|600000|ceiling|Ceiling'`
over the four source files as pinned above. **71 lines match**:
proposal 10, Amendment 1 13, Amendment 2 18, R1 Resolution 30.
Locations (document — section — lines; source wording quoted
minimally):

- **Proposal** — §1.1 (line 44: *"cost ceiling"* in the sequence
  summary); §3.5 (lines 172, 180: the *"Cost ceiling (proposed,
  §5.5)"* bullet — 600,000 units (≈ $0.60), 2.04× the quote, 4.7%
  of remaining headroom); §5.5 (line 270: the operative *"Cost
  ceiling"* bullet); §5.6 (line 276: completion *"within the §5.5
  ceiling"*); §6 (line 298: read-back item 7, *"≤ 600,000 per
  §5.5"*); §7 (line 320: the *"Cost ceiling"* STOP); §8 (line 328:
  *"the cost ceiling"* among the forward fences); §9 (line 334: *"at
  or under the ceiling"*); §10 (line 350: open question Q5,
  *"600,000 units"*).
- **Amendment 1** — title (line 1: *"cumulative ceiling"*); §0
  summary (line 8: the two-readings flag — the 12× form's cohort-1
  worst case 3,095,568 against *"the entire 600,000 ceiling"*); §5
  heading and preamble (lines 120, 122: A4, quoting Rowan's *"The
  600,000-unit ceiling must apply cumulatively"*; Q5 PASS on the
  figure); §5.1 (line 126: *"The ceiling binds settledDelta … ≤
  600,000"*); §5.2 (lines 133, 136, 140, 142: the cover formula ≤
  600,000, the worked figures 257,964 and 469,444, the 12× reading
  at 3,095,568); §6 (line 155: rollover is not *"a ceiling event"*);
  §8 (line 181: the two-readings residual); §9 (line 190: *"the
  ceiling figure: 600,000 units stands"*); §10 (line 202: mechanics).
- **Amendment 2** — §0 summary and verdict table (lines 33, 51:
  *"the standing 600,000 ceiling"*, *"Proven scope bound 469,519 ≤
  600,000"*); §2 preamble (line 98); §4.3 (line 297: the premise-P
  ruling request); §5.1 (lines 303–334: the *"binds by arithmetic"*
  construction — **superseded**, see above); §5.3 (lines 370–376:
  the declined-premise fork, including option (a), *"restate
  600,000 as a detection-and-stop bound"* — the fork Rowan's review
  in fact closed by adopting Approach 2); §9 (lines 560, 563).
- **R1 Resolution** — title and framing (lines 1, 28, 32: the
  document is the rejection of the guaranteed-cap reading); §0
  tables (lines 43, 59, 64–66); §4 (line 226: *"Solving the bound =
  600,000"* — the m ≈ 1.28 crossing); §7 (lines 368, 376, 392, 413,
  414, 421, 422: the Approach 1 design's internal references —
  Approach 1 is not adopted; these lines are design record only);
  §8 (lines 467, 470, 473, 485, 499–524: the relabeling rule, the
  detection procedure, and the verbatim exposure paragraph carried
  at §11 of this presentation); §9 (lines 532, 538); §10 (line
  576). The resolution's own post-ruling language already conforms
  to the relabeling rule; it is inventoried for completeness.

**This presentation's own usage.** The figure is named only as the
**detection threshold (600,000 units)**. The superseded word appears
in this document only inside quoted source or ruling text, in this
inventory, and in sentences that negate it.

---

## 2. Correction 2 — the cash estimate, with its full qualification

The ledger figures Gate 4 watches (§§7, 10) are the Reader's own
accounting (225 units per audio second). **Google's actual billing
for TTS is per input character** (R1 Resolution §5). The two views
are never mixed. Restated with its qualification, from R1
Resolution §5 — every figure below is reproduced from it:

- **Rate basis.** The introductory rate $0.81 per audio hour at the
  pinned realized rate of 15.96 chars/sec converts to 225 / 15.96 ≈
  **14.10 micro-cents per submitted character ≈ $14.10 per 1M
  characters**. At the doubled post-introductory rate (Jan 1,
  2027), ≈ **$28.20 per 1M characters**.
- **Character bound.** Submitted characters are bounded
  **assumption-free at 216,000** (total attempts ≤ 180, and every
  attempt's text ≤ the 1,200-char pre-split cap,
  `PRE_SPLIT_MAX_CHARS`, `policy-split.mjs:222` ⇒ 180 × 1,200), and
  at **158,320** under the structural tightening (≤ 5 partition
  levels per pre-split chunk plus ≤ 3 repair retries per chain:
  5 × 20,864 + 15 × 3,600; the tightening's assumptions are stated
  in R1 Resolution §5 — the assumption-free bound stands without
  them).
- **The ≈ $3.04 figure, qualified.** "≈ $3.04" is 216,000 chars at
  the **introductory** rate under the **assumption-free** bound.
  The same bounds at the post-introductory rate convert to
  **≈ $6.09** (216,000) and **≈ $4.46** (158,320); at the
  introductory rate the tightened bound converts to **≈ $2.23**.
  Expected cash: a clean pass submits 20,864 chars ≈ **$0.29**; at
  Phase A's realized attempt profile scaled to this scope,
  ≈ 30,000 chars ≈ **$0.43** (an estimate, labeled as such in the
  source).
- Google's own billing detail is day × product only (Gate 5
  record), so all cash figures here are **rate conversions, not
  invoice reads**. The $50 monthly settings cap plays no role in
  the cash view (R1 Resolution §3.3: it gates legacy-ledger
  estimates at issuance — not settled, not cash — and is not cited
  as a safeguard anywhere in this presentation).

---

## 3. Correction 3 — the prepay balance is a historical figure

Everywhere the AI Studio prepay balance appears in this
presentation, it reads as follows, and the executor uses it in no
other form: **$17.83 as of Julie's Oct 29, 2026 screenshot —
historical, not freshly verified; the physical-backstop argument
holds for whatever balance ≥ the stated exposures actually stands
at execution; the executor does not read Google billing and the
census does not depend on this figure.** (Auto-reload is off, per
the same Oct 29 record.) The backstop's role in this gate is
exactly that sentence and nothing more: context for Julie's
decision (§11), never a census item, never a bound the executor
relies on.

---

## 4. Scope, identity, and authorization boundary

### 4.1 In scope — exactly this (proposal §1.1, unchanged)

Under the one GO, the executor performs, in order: **E0** census
(§5) → **R1** re-arm sub-gate (§6.1) → **step-0** delivery-safety
verification (§6.2) → **R2** queue-unpause sub-gate (§6.3) → **G**
monitored generation (§7) → **C** closing sub-gate, ends HELD
(§9) → **E4** read-backs (§9.2) → **Julie's playback check** (§9.3,
the acceptance step). The sub-gates R1 and R2 are separately named
decision points inside the single GO: a deviation at R1's
read-backs stops the gate *between* the sub-gates, and R2 is never
executed to "see if it helps" (proposal §5.2, preserved).

### 4.2 Explicitly out of scope (proposal §1.2, unchanged)

- **Phase B** — the chapter's final segment, occurrence
  `2a85f74f-353d-4c25-a86a-4a4db392868b` (position 91, 569 chars),
  `excluded_parked` on the plan; the parked job
  `1832c21fcf0425454227c4736048a8a632f422abca4a2685ddb775bb1681406a`
  and every park-release/exemption route are never touched.
- **Batch** in any form — standard lane only, as stamped
  (`d6StandardOnly`).
- **Any other book, chapter, or plan**, including the rest of
  Forever Pucked. Foreign generation is a STOP (§8).
- **Any code change, deploy, or client publication** — build
  `1c2d1d0fa7ebb769f68cfb327fb9fde7d4d30867` throughout.
- **Any finalizer invocation** — a grant that fails to close is a
  STOP (§10), never a repair under this gate.
- **Any SubmitJob, command, or intent** — the resume needs none
  (§4.4); submitting one is outside the GO.
- **Clearing or editing any conflicts row; any rollback; any
  second attempt.** One GO covers one attempt (§10).

### 4.3 Identity binding (proposal §2, unchanged)

| Field | Value |
|---|---|
| Book | Forever Pucked |
| bookId | `5c589095-f812-48a2-8ab2-03ba2791f2b2` |
| chapterId | `2060f9df-f017-4793-a5e1-9d131789d973` |
| chapterIndex | 2 (Chapter 3) |
| Phase | `forever-pucked` (registry-bound to this bookId) |
| Lane | `standard` (Batch not armed) |
| planId | `plan:e377a5559961b294154276b6` |
| jobId | `plan:e377a5559961b294154276b6:ch2` |
| Plan state at drafting | `active`, totals eligible 23 / done 8 / failed 0 / blocked 0 / prompts 0 |
| Fresh quote (2026-11-01 ~17:47Z) | eligible 15 / 20,864 chars / expected 294,137 units (≈ $0.294) / digest `9453ab5dc7ee6ade7c650d14066054b965875f2ef1b65eb24bc633588d778e67` |
| Phase accounting at drafting | settled 732,303 / estimatedUnverified 19,018 / reservedUnverified 5,648 / inFlightUpper 0 / unknownOpen 0 / remaining 12,762,049 of 13,500,000 |

The **15 remaining occurrences** (proposal §2.3; positions,
occurrenceIds, chars — the set is invariant; which are `granted`
vs `pending` rotates with the machinery's cycle):

| Pos | occurrenceId | Chars |
|---|---|---|
| 68 | `81881ab7-fe99-4feb-98f6-bcbf7fc7e2a4` | 1,430 |
| 69 | `72672ef5-8481-403b-ba97-f5c1dc0e4a77` | 1,321 |
| 70 | `c731c8e7-4d18-4f59-bd73-f3c42a093063` | 1,343 |
| 71 | `e651189e-9085-4590-ba4a-f0af18d24287` | 1,256 |
| 73 | `94f6f847-7ded-470e-9a1d-577951c3a496` | 1,456 |
| 75 | `962bc05c-666e-4967-aee2-d2bdd4283084` | 1,397 |
| 78 | `e98450a5-2ee3-4ac7-bdcf-9226749b8000` | 1,371 |
| 79 | `e51a7f03-eb79-4500-965f-f3f77efad254` | 1,215 |
| 80 | `7fa865b8-ed32-4b8c-ae37-fd2d71cba0f6` | 1,471 |
| 82 | `9150d43c-a37a-4bbf-af88-ec88d1669614` | 1,489 |
| 83 | `635505ae-e0ff-4d38-8015-eb66357d3908` | 1,448 |
| 84 | `b522918a-5973-4061-adaa-462460670e6a` | 1,493 |
| 86 | `b8e75022-23a0-41f2-9297-47e71f255394` | 1,291 |
| 87 | `f1aba4cc-ca84-42db-9b38-1104e01fd4e0` | 1,430 |
| 89 | `712f42d8-5460-475a-a41a-fd3e6b57d00e` | 1,453 |

Total: **15 occurrences, 20,864 chars**, matching the quote.
Ledger units behave as micro-dollars despite the `MicroCents`
name ($1 ≈ 1,000,000 units). **Money truth rule (family law):**
ledger figures are Reader-recorded costs, not provider-confirmed
spend; the gate reports ledger deltas as ledger deltas.

### 4.4 Why no submission is needed (proposal §§0.2, 3, unchanged)

The plan is already self-driving: the coordinator's watchdog calls
`driveOnce` (`service.mjs:888`), which selects this `active` plan
every cycle and issues the next cohort grant whenever pending
occurrences exist and no grant reads `issued` (`service.mjs:977-1010`
→ `coordinator.mjs:1805`), sized by `boundGrantTargets` as the
longest pending prefix fitting the day's derived headroom at
12 − attempts-used slots per occurrence against the 100/day cap
(`quota-budget.mjs:622-645`). Since Gate 3 finalized the stuck
grant, this cycle has been issuing grants that are never delivered
while halted (the sender is wired only when GENERATION_HALT is
`"0"`), voided at the 15-minute lease expiry
(`lease_expired_undelivered`), and re-granted — zero dispatches,
zero spend. After R1 + R2 (§6), the drain delivers the live grant
under its delivery fence (`coordinator.mjs:1861-1876`), the
executor executes, `handleReport` settles the grant at the end of
its message (`d6-executor.mjs:859`), and `driveOnce` issues the
next cohort, until `finishPlan` sets the plan `complete` at 23/23
(`service.mjs:870-887`). Policy-blocked text splits recursively
without voice substitution, ≤ 12 attempts per segment across the
split tree (`policy-split.mjs`) — the normal path, as Phase A's
cohort (44 attempts, 30 success / 14 policy_block, settled delta
+152,964) demonstrated. A PT-day rollover mid-plan is a normal
continuation, not a failure (§7.4).

**Read surfaces (Amendment 1 §1, as used throughout):** S1 job
view `GET /v2/jobs/<jobId>`; S2 plan read `GET /v2/d6-plans/<planId>`;
S3 quota reconcile `GET /v2/d6-quota-reconcile` (operator, full
pagination); S4 quota view `GET /v2/quota`; S5 operator diagnostics
(per-plan execution/attempt attribution and the phase view); S6
plan list `GET /v2/d6-plans`; S7 conflicts `GET /v2/conflicts`;
plus the capabilities read, `/health`, the Cloudflare script
`/settings` and queue reads. Every `/v2/*` call carries the
production scope headers. No finalizer preview call is made at any
point in this gate.

---

## 5. E0 — execution census (proposal §4, as amended; runs first)

**Read order and stability (Amendment 2 §7.3, mandatory):** one
pass reads, in this order — **S1 → S2 → S5 → S3 (full pagination)
→ S4 → S7** — as close together as the reads permit; each result
records its timestamp; the timed pair (item 13 / §5.3) is part of
the protocol. Conclusions that must agree across reads: **grant id
+ granted set** (S1 vs §5.3's computation) and **day totals +
phase settled** (S3 vs S4 vs S5). Any contradiction aborts the
census and restarts it fresh; a census that cannot stabilize is
itself a STOP. A pass's figures carry their timestamps; legs from
different passes never mix.

### 5.1 Exact-match items (proposal §§4.1–4.3)

1. `/health` build = `1c2d1d0fa7ebb769f68cfb327fb9fde7d4d30867`.
2. GENERATION_HALT reads `"1"`.
3. Queue `opalreader-generation-v2` delivery paused, read via
   cf-api; the Worker cannot read queue state.
4. Capabilities: coordinator `armed`; lane `standard` live, Batch
   unarmed (`d6StandardOnly` stamped).
5. Plan id set on S6 exactly: smoke `complete`; old Ch 2 plan
   `retired`; **target plan `active` at 8 done / 0 failed**.
6. S2 target plan: `bookId` / `chapterId` / `chapterIndex` exactly
   as §4.3; totals eligible 23 / done 8 / failed 0.
7. Fresh S-quote exactly: eligible 15, expected 294,137, digest
   `9453ab5dc7ee6ade7c650d14066054b965875f2ef1b65eb24bc633588d778e67`,
   exclusions bound_already 11 + parked 1 (position 91); also
   `boundaryBlocked: false`, `poolSize: 27`.
8. Parked job record unchanged: state `parked_policy`, revision 1,
   fingerprint
   `b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`.
9. Phase accounting exactly as §4.3 (settled 732,303;
   estimatedUnverified 19,018; reservedUnverified 5,648;
   inFlightUpper 0; unknownOpen 0; remaining 12,762,049 of
   13,500,000; `unverifiedStatus: provider_unverified`).
10. S4 current PT day, from its own components: dispatched = 0;
    reserved ∈ {0, 96}; consumed = reserved. (The {0, 96} figure is
    the conclusion of the §5.3 proof, not a bare expectation —
    any other value fails item 10 *and* §5.3 together.)
11. S3 reconcile `ok: true` — drift empty, current-day block
    empty; the one historical exception is the adjudicated
    straddler `att-37d63768-db4b-447d-8150-580b7c6ee257`
    (`estimated_unverified`, never dispositionable), the sole
    exempted entry.
12. The derived day totals for the prior PT days stand at the Gate
    3 close: 2026-10-29: 57; 2026-10-30: 79; 2026-10-31:
    dispatched 44 / reserved 0 / consumed 44.
13. **Live-grant identification (Amendment 1 §2.1, replacing the
    proposal's item 13):** from S1, exactly one grant of the
    target job reads `issued`, or none does at the instant read;
    its `grant_id` and its `granted` set are enumerated; every
    other grant reads `reported`; the granted set ⊆ the approved
    15 of §4.3 (at drafting: positions 68, 69, 73, 75, 80, 82,
    83, 89 — composition may legitimately rotate).
14. Conflicts = **exactly the four-row Gate 2D baseline,
    exact-matched:** id 1 @ 2026-10-29T23:54:14.808Z,
    `grant:plan:3183ecbf2ac4bf50bbc6166e:seg:1:full`; id 2 @
    2026-10-30T00:24:14.632Z,
    `grant:plan:603ab416bd67ab1b25de97be:ch1:1:full`; id 3 @
    2026-10-31T05:14:24.089Z,
    `grant:plan:b2dc2a3d1cd367a0245b9102:ch1:1:full`; id 4 @
    2026-11-01T01:04:30.364Z,
    `grant:plan:e377a5559961b294154276b6:ch2:1:full` — all
    cache_key `lease`, expected `7`, found the recorded
    `LIKE or GLOB pattern too complex: SQLITE_ERROR`, reason
    `schedule_dead`. Count ≠ 4, or any field differing = STOP
    (executor STOP law, §10.2).
15. Settings revision **1**: phase policy `enforce`; lane
    `standard`; settings monthly cap $50 (a read value; per §2 it
    is not a safeguard for settled or cash); phase registry =
    `forever-pucked` ↔ §4.3 bookId, complete (unbound books fail
    closed).
16. **Zero new occurrences of every failure class since the Gate 3
    close:** no unknown-billing execution, no `blocked` segment,
    no new conflict, no new plan, no movement of phase accounting
    beyond the grant churn reserved-then-released (item 9 figures
    hold exactly).

### 5.2 Grant-identity classification (Amendment 1 §2.1)

For any live grant relied on anywhere in this gate, the executor
additionally records its **lease class** by timed pair: two reads
of S1 at least 16 minutes apart (lease 15 min, `LEASE_MS`,
`coordinator.mjs:134`): **active** (same id, both reads),
**replaced** (different live id / none, second read), or
**stale-live** (same id across ≥ 16 min with no second live grant —
reachable only through churn, never relied on as deliverable). No
operator or wire surface projects `lease_expires_at`; lease class
is **evidence, never a relied-upon fact** — the delivery fence
(§6.2) is what makes delivery safe. Whether the delivery-safety
guarantee would survive a *proven* stale-live grant is a
pre-existing, separately-gated code question (Amendment 1 §8
item 2), **not** part of this gate.

### 5.3 Correction 4 — the R3 condition: the reservation-ownership proof, repeated at census

Rowan's R3 condition, stated explicitly in her R1 Resolution
review and carried here as a census requirement (Amendment 2 §7
already specifies the protocol; this section makes its repetition
at execution census a hard precondition): **at execution census,
the executor repeats the complete reservation-ownership proof
using fresh, consistent reads, including the zero-remaining-
reservation case; any unexplained reservation, inconsistent grant
generation, or failed reconciliation is a STOP before any
mutation.**

The proof (Amendment 1 §3 as corrected and extended by Amendment 2
§7.2 — five legs):

- **Leg 1 — cohort membership.** S1 enumerates the live grant
  and its `granted` set; all members are in the approved 15
  (§4.3) and §5.1 item 13 holds.
- **Leg 2 — attempts-used = 0.** S5 shows no execution referencing
  any of the 15 (they have never been attempted); consequently the
  code-derived reservation for the live grant is exactly 8 × 12 =
  **96** whenever a grant is live, and the next cohort's
  size-after-settlement is independently derivable the same way.
- **Leg 3 — the possibility-shaped rows, excluded.** Zero-remaining
  open reservation rows **are possible** in the machinery, in
  exactly two shapes, both by consumption and never by creation
  (Amendment 2 §7.1): **(T) transient** — a row reaches
  consumed = total on the last permitted dispatch
  (`quota-budget.mjs:803`/`:814`) and stays open until the
  settlement sweep (`closeReservationsForGrant`, :714);
  `derivedDayTotals` counts it 0 either way. **(P) persistent** —
  the close fence (`:662-672`) blocks closes behind an unresolved
  `unknown_billing` execution. Zero-*total* creation is impossible
  (`boundGrantTargets` breaks the prefix at slots ≤ 0, :624-645;
  re-reservation refuses slots ≤ 0, :782-785). Both shapes are
  excluded here by Leg 2 (no occurrence of the 15 has ever been
  dispatched, so no row for them can have been consumed into
  either shape) plus Leg 3b.
- **Leg 3b — per-row reconciliation.** `reconcileQuota` iterates
  **every** reservation row (SELECT *, no state filter,
  `quota-budget.mjs:478` ff.) and re-derives day totals
  row-by-row; `ok: true` therefore certifies every open row's
  attribution, not just the totals. Item 11's `ok: true` is this
  leg's evidence.
- **Leg 4 — day-sum closure.** The unfiltered day sum
  (`derivedDayTotals`) for the live day closes at exactly the
  live grant's derived 96 (item 10), leaving no room for any
  second open reservation: any other open row with positive
  remaining would raise the sum above it.
- **Leg 5 — per-row drift.** `reconcileQuota`'s per-row drift /
  classification comparisons pass for every row in the complete
  pagination (item 11); a row owned by anything else would
  classify or drift.

**Zero-case protocol.** A `{reserved: 0}` read in isolation proves
nothing (inter-void instant, between cycles, or a churn failure
are indistinguishable on one read). It is acceptable at census
**only** when the §5.3 timed pair brackets it (different live
grant, or live grant → none, with no contradiction) **and** the
second pass's proof yields the live grant's 96 (or the pair shows
two live-grant passes ≥ 16 min apart). **Two consecutive zero-case
passes ≥ 16 min apart with no live grant observed = STOP** — the
machinery's normal state always has either a live grant or a
fresh void behind it.

### 5.4 What the census never does

No mutation of any kind. Julie's GO is recorded before E0; the
census itself writes nothing. There is no census-repair move: any
deviation is reported, and the gate does not proceed (§10.2).

---

## 6. The opening sub-gates (proposal §5, as amended)

### 6.1 Sub-gate R1 — re-arm (halt lift first)

Executor mutations so far after this step: **1 of 4.**

1. **Hard precondition:** a fresh S3 reconcile read returns
   `ok: true` immediately before the flip. If it does not, STOP —
   no flip (Gate 7 / gate-(c) lesson, preserved).
2. Lift **GENERATION_HALT "1" → "0"** — settings-class write only;
   no code upload; the script etag must be unchanged afterward.
3. Read back: halt now `"0"`; script etag unchanged (§10.2);
   observability still enabled + persisted (the family's
   conditional rule: only if a settings flip unexpectedly nulled
   observability may the executor reapply the observability-only
   multipart PATCH to `/settings` — that conditional repair is
   inside the GO and does not consume the mutation budget; code
   bytes provably unchanged by etag comparison afterward).
4. **Disclosure, stated to Julie in the execution report at this
   point:** from this flip until sub-gate C completes, **the app's
   Generate button is live** and Batch is presented-but-not-armed.
   Any generation outside this gate during that window is foreign
   (§8) — including Julie's own tap. Hands off the button until
   the gate closes.
5. **Step 0 runs next (§6.2). R2 is not executed on R1's
   momentum.**

### 6.2 Step 0 — delivery-safety verification (Amendment 1 §2.2; runs after R1, before R2)

Zero executor mutations. The delivery **fence**, not the executor,
decides delivery: a message naming a grant that is not `issued`
at its delivery instant, or whose revision has moved, dead-letters
and the grant voids and re-grants (`coordinator.mjs:1861-1876`) —
a designed branch of this step, **not** a STOP. Checks, re-read in
order (S1 → S4 → S3):

1. The plan is the only `active` plan; no job other than the
   target job has a grant reading `issued`.
2. The live grant's granted set ⊆ the approved 15 (§4.3), equal
   to the guard-selected cohort for the current derived headroom
   (Leg 2 arithmetic, §5.3).
3. Reservation ownership re-verified: the §5.3 proof re-run for
   the currently live grant; day totals close on it alone;
   `reconcileQuota.ok: true` on this pass.
4. The live grant's lease class (§5.2) is recorded; no class is
   treated as proof of deliverability.

Any leg failing → **STOP between the sub-gates**, containment
re-halt (settings-only, etag-identical) applied, report. No
drain-and-see.

### 6.3 Sub-gate R2 — queue unpause (last opening move)

Executor mutations after this step: **2 of 4.**

1. `PUT` the queue with `queue_name` + `settings.delivery_paused:
   false` (cf-api; the body is the positional argv JSON — a
   `--data` flag is silently ignored by this connector).
2. Read back `delivery_paused === false`.
3. **G begins (§7).** The executor then polls; it issues nothing,
   submits nothing, and calls no operator route.

---

## 7. G — monitored generation (proposal §5.4–5.5, as amended)

### 7.1 Poll contents (Amendment 1 §4.1)

Every poll records, with its timestamp: **(1)** the poll timestamp;
**(2)** the plan's totals from S2 (eligible / done / failed /
blocked); **(3)** the live-grant picture from S1 — every grant's
id, state, revision, and granted set; **(4)** the day totals from
S4 (dispatched / reserved / consumed, from the view's own
components); **(5)** `reconcileQuota`'s verdict and derived day
totals from S3; **(6)** the phase settled figure from S5. Bounds
are always evaluated on the cumulative gate figures of §7.2 —
never per-day, never per-grant (Amendment 1 §4.4).

### 7.2 The detection threshold — mechanics (R1 Resolution §§8.1–8.2, governing)

- **The ledger.** `settledDelta = (phase settled, live) − 732,303`
  (the §5 census opening figure). Evaluated at census and at every
  G poll, plus the §7.3 cover computation. The ledger never resets
  — not at a PT rollover, not at a cohort boundary (§7.4).
- **Observation STOPs.** On any observation of **settledDelta >
  600,000** (the detection threshold crossed), the executor STOPs
  and applies the closing holds in containment order (§9.1) with
  read-backs, and reports the figures. On any observation of
  **settledDelta > 469,519** — the m = 1 forecast crossed — the
  executor likewise STOPs: crossing the forecast refutes the
  operating picture and is treated as foreign work under §8 (R1
  Resolution §8.2; Amendment 2 §5.1). Neither figure is a bound on
  what the machinery can settle between polls; §11 says so to
  Julie in plain words, and §2 states the cash view separately.
- **The cover computation (detection form).**
  `settledDelta + Σ upperBoundAttemptMicro(next cohort) ≤ 600,000`,
  evaluated at census and at each new live grant's first
  observation, in Amendment 1 §5.2's derived one-upper form (the
  code-derived upper-sum of the cohort's not-yet-settled
  occurrences). At drafting: cohort 1 = 257,964 ✓; all 15 =
  469,444 ✓. A cohort the threshold cannot cover in this
  computation is a STOP **before** its dispatch — this is the
  gate's only pre-dispatch check on the threshold, and it is a
  detection computation, never enforcement (R1 Resolution §8.1).
  Tier distinction (Amendment 1 §5.2): the model's one-upper form
  governs this gate's threshold; the code's 12× worst-attempt form
  (all-15: 5,633,328) governs only the phase fence (§7.5) and the
  reservation/cohort arithmetic. The two tiers are never mixed.
- **In-flight.** Between polls, settling cannot exceed one
  cohort's worth (structural form: ≤ m × 258,004 for the cohort-8
  shape, R1 Resolution §6); operationally at most one gate attempt
  is dispatched-but-unconfirmed at any instant (sequential
  executor + grant exclusivity). No poll cadence changes the
  exposure table (§11).

### 7.3 The 100/day attempts fence (code-enforced; proposal §5.5, unchanged)

Attempts per PT day ≤ 100 is enforced by the machinery, not by
monitoring: derived counters only, cohort bounding at issuance,
dispatch refused past the derived total. Census opening for the
execution day is read fresh (§5.1 items 10–12); the first cohort
is derived (12 slots per occurrence ⇒ 8), and later cohorts are
cut by attempts-used (Phase A's profile implies [8, then ~4…] —
arithmetic, not a promise). A **mid-plan rollover** resumes after
07:00Z with fresh headroom — the designed path, **not** a STOP
(§7.4). Phase-A-era counters, if encountered, are informational
only.

### 7.4 Rollover protocol (Amendment 1 §6 / A5 — PASS outright)

If G spans a PT midnight (07:00Z): **(1)** the executor takes a
snapshot pair — full §7.1 poll contents as the last poll before
the boundary and the first poll after it — recorded as the
rollover evidence; **(2)** the §7.2 ledger does **not** reset:
the threshold and the forecast are evaluated on cumulative gate
figures across the boundary; **(3)** the day-scoped figures (S3/S4
day totals, the 100/day fence) legitimately roll to the new day
and are read as the new day's figures, with the snapshot pair
establishing continuity; **(4)** a rollover is not a stall event
(§8.2 exclusion), not foreign work (§8), and not a restart of
anything. Julie's GO covers the rollover; no fresh decision is
needed at the boundary.

### 7.5 The phase fence (context, code-enforced; unchanged)

The phase guard refuses any new grant whose projection (settled +
reservedUnverified + in-flight uppers + this grant's pending
12× uppers) would exceed the phase budget 13,500,000; plans park
(`parked_budget`) rather than overspend. Tier-1 check on census
figures: 732,303 + 5,648 + 0 + 5,633,328 = 6,371,279 ≤ 13,500,000
— the fence is not approached by this gate under any tier. A plan
found `parked_budget` / `parked_quota` / `parked_cap` /
`parked_storage` at any poll is a STOP (§10), never an executor
action.

### 7.6 Successor-grant verification (Amendment 2 §8 / R4 — PASS)

Every newly observed grant id — at census, at §6.2, and at every G
poll — passes the full verification **before any reliance**: it is
the unique live grant of the target job; its granted set ⊆ the
approved 15 and equal to the guard-selected cohort for the current
derived headroom; the §5.3 ownership proof re-runs for it on the
same pass; S3 returns `ok: true` on that pass. Any leg failing =
STOP + containment (§9.1), no reliance. Lease class is recorded
per §5.2 and **never inferred from appearance**: a same-looking
grant id across polls earns nothing by itself; the timed
classification and the delivery fence carry the safety argument.

---

## 8. Stall detection and foreign generation

### 8.1 The Phase A signature (Amendment 1 §4.2, unchanged)

The failure this gate watches for, generalized from Phase A: a
grant was **delivered**, its executions ran (or partly ran), and
thereafter **nothing changes** — no new attempts on any surface,
no plan-progress movement, no phase-settlement movement — while
the same grant remains the live grant, and the window spans at
least one full lease cycle, so "the grant is merely slow" is
excluded by construction.

### 8.2 The sliding window (Amendment 2 §6, governing; Amendment 1 §§4.3–4.4 definitions preserved)

- **Anchor.** t0 = the timestamp of the first G poll at which a
  grant of the target job is observed **delivered** (any
  dispatched attempt attributable to the plan, or any grant
  transition into execution). Before any delivery, no window runs
  — a pre-delivery gate is governed by §6.2 and ordinary
  monitoring.
- **Evaluation.** At every poll P with **P − t0 ≥ 35 minutes**,
  the signature is evaluated over the **whole window [t0, P]**,
  not the last two polls: the executor checks every intervening
  poll record in the window (each was taken under §7.1 and
  checked when taken) plus the cumulative figures at P.
- **Signature (all five required at P):** (i) a grant was
  delivered (t0 exists); (ii) the **same grant id** is the live
  grant at every poll in the window, including P; (iii) P − t0 ≥
  35 min; (iv) **zero** new attempts attributable to the plan
  (S5) after the window's first movement; (v) **zero** plan-progress
  movement (S2 totals) and **zero** phase-settlement movement (S5)
  across the window.
- **Resets and negations.** Any new attempt, any progress or
  settlement movement, any grant-id change, or any grant leaving
  `issued` **resets the anchor** (a new anchor forms at the next
  delivered observation) and negates the signature. A signature
  that completes = **STOP** (§10).
- **Exclusions (never a stall):** a grant merely `issued` and
  never delivered (pre-delivery churn; §6.2's province); lease
  churn with no delivery; a PT rollover inside the window
  (day-scoped figures roll by design, §7.4 — the signature is
  evaluated on grant identity, attempts, progress, and settlement,
  none of which a rollover resets); ordinary slow progress (any
  movement negates).

### 8.3 Foreign generation (Amendment 1 §7 / A6 — PASS outright; proposal §7 STOP preserved)

Any of the following, observed on its named surface, is foreign
work: **(a)** attempts or a plan-progress change attributable to
any plan other than the target plan (S5 / S2 / S6); **(b)** a phase
`settled` increase not explained by the target plan's own
confirmed attempts (S5 cross-check) — including a §7.2 forecast
crossing attributed to no gate attempt; **(c)** movement of
`estimatedUnverified`, `reservedUnverified` (beyond the target
plan's own live reservations), or `unknownOpen` (S5); **(d)** the
target plan moving in a way inconsistent with its own grants —
progress with no live or reported grant covering it (S1 vs S2);
**(e)** any segment of the parked set (position 91) or any other
book/chapter showing new generation (S2 / S6 / quote surfaces).
On any trigger: **STOP immediately**, apply the closing holds in
containment order (§9.1) with read-backs, report the trigger and
the figures, and take **no repair action of any kind**. Foreign
generation never enlarges this gate, and no executor judgment
converts it into gate work.

---

## 9. Closing, read-backs, and acceptance

### 9.1 Sub-gate C — closing holds (proposal §5.6; containment order per R1 Resolution §8.2)

Executor mutations 3 and 4 of 4 — in this order, whether the gate
ends in completion or in a STOP after R2:

1. **Re-pause the queue** (cf-api PUT, `delivery_paused: true`;
   read back paused).
2. **Re-halt generation** (GENERATION_HALT → `"1"`, settings-only;
   read back `"1"`; script etag unchanged).

**Completion criteria (all required for a completion verdict):**
plan `complete` at **23/23** (done 23, failed 0); every grant the
gate relied on reads `reported` (no grant of the target job reads
`issued` at close); reconcile `ok: true`; zero new conflicts; the
parked job untouched. **Any criterion failing = the gate closes
as a STOP**, reported as such — closing holds are applied either
way.

### 9.2 E4 — closing read-backs (proposal §6, items extended by Amendments 1–2)

1. `/health` build still `1c2d1d0f…`; GENERATION_HALT `"1"`
   (settings-only flips; etag unchanged).
2. Queue delivery_paused `true` (cf-api read).
3. Capabilities: coordinator `armed`; Batch still unarmed.
4. Target plan `complete`, totals 23 / 23 / 0 / 0 / 0 — or, on a
   STOP close, its exact state at close, reported as-is.
5. All grants of the target job `reported`; none live. (On a STOP
   close: the live-grant picture exactly as left, reported.)
6. Phase accounting closing set: settled (opening 732,303 +
   settledDelta), estimatedUnverified 19,018 (unchanged),
   unknownOpen 0, remaining vs 13,500,000.
7. The gate's settled delta, evaluated against the **detection
   threshold (600,000)** per §7.2 and reported as an observation,
   with the realized multiplier context where computable.
8. PT day totals for every PT day the gate spanned, from S3/S4
   derived figures, with the §7.4 snapshot pair attached if a
   rollover occurred.
9. Conflicts still exactly the four-row baseline (§5.1 item 14).
10. Parked job fingerprint unchanged; position 91 still
    `excluded_parked`; the final segment untouched.
11. Settings still revision 1; phase registry unchanged.
12. Sync watermarks: bindings advanced by exactly the gate's
    newly bound segments (expected +15 on a completion close);
    content 18.
13. The complete request ledger (§12) attached to the execution
    record.

### 9.3 Julie's playback check — the acceptance step

After E4, Julie opens Forever Pucked Chapter 3 on her device: the
header should read **Partial 26/27** (26 of the chapter's 27
segments bound — the 11 already bound plus this gate's 15; the
chapter's final segment is Phase B, separately gated and not part
of this gate), play buttons present on the newly bound positions,
and sampled segments play normally. **This check is the acceptance step and sits
outside the executor's verdict**: the executor reports the gate's
outcome; Julie's playback result accepts or does not accept it.
(Phase A's precedent: her "Partial 11/27" check and tap-to-play
confirmation closed acceptance for the cohort that had run.)

---

## 10. The STOP law and the executor instruction block

### 10.1 Executor instruction block (complete)

- **Authorization:** Julie's GO for exactly this gate, recorded
  before E0. One GO, one execution attempt.
- **Mutation budget — exactly 4 executor mutations:** (1) the R1
  halt flip (§6.1); (2) the R2 queue unpause (§6.3); (3) the
  closing re-pause (§9.1); (4) the closing re-halt (§9.1).
  Containment after a post-R2 STOP uses mutations 3–4 in that
  order (re-pause, then re-halt); a STOP before R1 uses none; a
  STOP between R1 and R2 uses the re-halt only (settings-only,
  etag-identical). The one conditional exception is the
  observability-only repair (§6.1 step 3), inside the GO, not
  budget-counted, code bytes provably unchanged. Machinery writes
  (grants, reservations, settlements, bindings) are the plan's
  own operation, not executor mutations.
- **No other executor action exists in this gate:** no commands,
  no SubmitJob, no operator-route calls, no finalizer preview or
  invocation, no park/exemption route, no deploy, no settings
  change beyond the two halt flips, no conflicts-row touch, no
  rollback.
- **One-way doors:** none beyond the family's standing law — no
  rollback is authorized by this gate; the closing holds are
  state flips on the same build, not a rollback.

### 10.2 STOP law (proposal §7 preamble, verbatim in substance; standing executor law)

**Any census item not matching exactly, any sub-gate read-back
differing, any §7–§8 trigger firing, or any surface contradicting
this presentation = STOP.** Under the standing executor STOP law
(Gate (a), Oct 31, 2026): if any pre-flight census count, binding,
plan state, or other hard-stop item differs from the paperwork
expectation — even by one item, even if it looks like harmless
known bookkeeping — the executor stops **before any further
mutation**, preserves the state, reports the exact deviation and
the proposed explanation, and proceeds only on a fresh explicit
GO or a Rowan ruling for that deviation. An executor's own tracing
never clears its own stop; a post-hoc technical acceptance does
not retroactively authorize having proceeded; and no unlimited
exemption exists for future matching conflicts — the remedy for a
changed conflict set is a new baseline plus Rowan review, never
an executor judgment call.

**Named STOPs** (proposal §7, as amended by §§1, 5.3, 7, 8 of this
presentation): census mismatch of any item, including the §5.3
proof failing in any leg, an unexplained reservation, an
inconsistent grant generation, or a failed reconciliation; R1
precondition reconcile not `ok: true`; halt-flip read-back
differing; observability unexpectedly null and not restorable by
the §6.1 conditional repair; script etag changed at any settings
step; step-0 any leg failing; detection threshold crossed
(§7.2) or forecast crossed (§7.2); a cohort the §7.2 cover
computation cannot cover; the sliding-window stall signature
completing (§8.2); foreign generation, any trigger (§8.3); the
plan parking (`parked_quota` / `parked_cap` / `parked_budget` /
`parked_storage`) or any new `blocked` segment or `failed` count
above 0; any `unknown_billing` outcome appearing (it also halts
the phase by code — the executor mirrors with the closing
holds); any grant of the target job failing to reach `reported`
after its executions complete (the Phase A failure shape —
detection is §8.2; the response is a STOP, never a finalizer call
under this gate); any reconcile verdict other than `ok: true`
outside the §5.1 item 11 exception; Julie instructing a stop at
any point.

### 10.3 What a STOP does with an in-flight gate

A STOP is terminal for the attempt. The executor: **(1)** makes no
further opening move; **(2)** applies the containment holds the
stage requires — before R1: none (state untouched); between R1
and R2: re-halt; after R2: re-pause, then re-halt (§9.1 order) —
each with read-backs; **(3)** leaves all machinery state exactly
as it stands (grants, reservations, and the plan are the
machinery's to void, settle, or hold — the executor repairs
nothing); **(4)** records the full evidence set (§12) and reports
the deviation, the figures, and the end state. **The GO is
consumed.** Any resumption, repair, finalizer use, or retry is a
new decision for Julie, on new paperwork — never an executor
continuation, and a stopped run is never restarted on the
executor's own interpretation.

---

## 11. The detection-only disclosure — as it will be put to Julie at GO

Rowan's R1 ruling requires the explicit detection-only spending
disclosure in Julie's approval presentation, with the
higher-duration scenarios visible. The text below is the R1
Resolution §8.3's verbatim exposure paragraph, updated **only**
for correction 2 (the $3.04 rate qualification) and correction 3
(the prepay figure marked historical), as her review directs. The
two edited spans are marked **[Correction 2]** / **[Correction 3]**
immediately after the paragraph, with the resolution's original
wording quoted for comparison. Nothing else in the paragraph is
changed — wording, figures, order, and emphasis are the
resolution's.

> Before you decide: the $0.60 figure in this gate is a **detection
> threshold, not a guaranteed cap**. Software watches the running
> total and stops the gate if it passes $0.60 — but batches run on
> their own cycle between checks, so spending can pass $0.60 before
> the stop lands. Here is the honest range. The job is expected to
> cost about **$0.29**. On the cost model's own slowest-rate
> assumption, the worst case is **$0.47** — already under the
> threshold. The threshold can only be crossed at all if the audio
> comes back at least ~28% slower than that slowest assumed rate
> across the whole chapter; in Chapter 3's first batch the audio
> actually ran about 39% *faster* than that bound (realized factor
> 0.61). If durations ran 1.5× the bound, the total would be about
> **$0.70**; 2×, about **$0.94**; 3×, about **$1.41**; even 5× —
> speech at 2 characters per second, far outside anything observed
> — about **$2.35**. Two independent backstops sit behind all of
> this: the system's own **$13.50 phase budget** for Forever
> Pucked, which the code refuses new batches against, and your
> Google **prepay balance** ($17.83 as of your Oct 29, 2026
> screenshot — historical, not freshly verified — auto-reload off),
> which physically caps all Google spending while the standing
> balance covers the exposures above. Separately, Google charges
> per character sent rather than per second of audio; the absolute
> worst case for characters sent (every possible split and retry)
> converts to about **$3.04** at today's introductory rate — about
> $14.10 per million characters, converted from the verified $0.81
> per audio hour; the figure rests on the assumption-free bound of
> 216,000 characters sent (180 possible attempts × the
> 1,200-character pre-split cap), and at the doubled
> post-introductory rate from Jan 1, 2027 the same bound converts
> to about **$6.09**. Approving this gate means accepting that
> $0.60 is monitored-and-stopped — with the realistic worst case
> under $0.50 and the extreme tail bounded as above — **not** a
> hard guarantee of $0.60.

**Marked changes from the resolution's §8.3 text:**

- **[Correction 3]** The prepay parenthetical. Resolution's
  original: *"…your Google **prepay balance** ($17.83 on Oct 29,
  auto-reload off), which physically caps all Google spending."*
  Changed to mark the figure historical per correction 3 (§3 of
  this presentation) and to state the backstop's condition
  explicitly ("while the standing balance covers the exposures
  above"). No figure changed.
- **[Correction 2]** The cash sentence. Resolution's original:
  *"…the absolute worst case for characters sent (every possible
  split and retry) converts to about **$3.04** at today's
  introductory rate."* Extended — same sentence, same $3.04 — with
  the rate's basis (≈ $14.10/1M chars, converted from the verified
  $0.81/audio-hour), the character bound it rests on (216,000 =
  180 × 1,200), and the post-introductory conversion (≈ $6.09),
  per correction 2 (§2 of this presentation).

**The scenario table behind the paragraph** (R1 Resolution §4,
reproduced; m = realized duration multiplier against the cost
model's slowest admitted rate; Phase A's realized m ≈ 0.61):

| m | Meaning (speech rate) | Bound (units) | Bound ($) |
|---|---|---|---|
| 1.0 | 10 chars/s — the model's slowest admitted rate | 469,519 | $0.47 |
| 1.5 | 6.7 chars/s | 704,245 | $0.70 |
| 2.0 | 5 chars/s | 938,971 | $0.94 |
| 3.0 | 3.3 chars/s | 1,408,422 | $1.41 |
| 5.0 | 2 chars/s — pathological, far outside observation | 2,347,325 | $2.35 |

The detection threshold (600,000) can be crossed at all only if
the scope-average multiplier reaches m ≈ 1.28 (R1 Resolution §4).

---

## 12. Consolidation mechanics, evidence, and boundaries

**What this presentation changes, and what stands.** Changes —
each traceable to Rowan's review: the §1 relabeling of every
600,000 reference across the four sources (correction 1; R1
Resolution §8.1's rule, now executed mechanically against the §1
inventory); the §2 cash qualification (correction 2); the §3
prepay wording (correction 3); the §5.3 R3 census condition
(correction 4 — Amendment 2 §7's protocol, restated as a hard
census precondition, per Rowan's explicit condition); the §8.2
sliding window governing over Amendment 1 §4.3's poll-pair form
(Amendment 2 §6, already the governing source); the §7.2 detection
mechanics governing over Amendment 2 §5.1's superseded
enforcement framing (R1 Resolution §§4, 8). **Stands unchanged:**
the proposal's scope, identity binding, census items, sub-gate
sequence, completion criteria, read-backs, and STOP law;
Amendment 1 in full (A1 grant-identity protocol, A2 as repaired,
A3 definitions, A5 rollover, A6 foreign generation); Amendment
2's R2/R3/R4 constructions; the four-mutation budget; the end
state HELD. Approach 1 (R1 Resolution §7) is **not** incorporated:
it is shelved for this gate by Rowan's ruling and remains a design
record for future, larger scopes; adopting it later would require
its own build, review, and deploy gates and would change this
gate's mutation budget to 6 — none of which is requested here.

**Satisfiability.** Every condition in Rowan's PASS WITH
CONDITIONS is discharged by this document or was already
discharged by a source it consolidates: R1 by Approach 2 as
specified in R1 Resolution §8 and relabeled per §1; R2 by
Amendment 2 §6 (PASS); R3 by Amendment 2 §7 plus the §5.3 census
repetition her review made explicit (CONDITIONAL PASS, condition
now on record and carried); R4 by Amendment 2 §8 (PASS); A5/A6
PASS outright in the Amendment 1 review and preserved. The one
point no document satisfies — because no mechanism in this
architecture can — is a literally unconditional hard cap on
settled spend; §11 states that to Julie in plain words rather
than papering over it.

**Evidence the executor will produce.** The GO record; the E0
census read set with timestamps and the §5.3 proof's five legs;
the §5.2 lease classifications relied on; the R1/R2 read-backs
(etag comparisons, queue reads); the complete timestamped G poll
log (§7.1 contents per poll), including the §7.4 snapshot pair if
a rollover occurs; the step-0 verification record; the closing
read-backs (§9.2); the request ledger for the whole gate
(method/path/status per call); and the execution record filed on
the board after execution, win or lose. This presentation itself
is pinned in the code repo (`jedavid33-design/opal-reader`,
branch `ui1-review`, path
`review/ch3-generation/recovery/gate3/GATE4-FINAL-PRESENTATION.md`)
as the child of the R1 Resolution pin; no board filing is made
for it in direct mode.

**Boundaries restated.** This presentation is preparation only.
It executes nothing, mutates nothing, and authorizes nothing.
Julie's GO — given on this document, with §11's disclosure in
front of her — is the sole authorization for the single execution
attempt it describes. Phase B, Batch, the rest of Forever Pucked,
the finalizer, and every other separately-gated matter remain
exactly as gated as they were.
