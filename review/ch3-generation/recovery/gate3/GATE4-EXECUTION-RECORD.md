# GATE 4 — EXECUTION RECORD: resume and complete Forever Pucked Chapter 3 (15 remaining segments), Approach 2 (detection-only threshold), ends HELD

**Outcome: GATE 4 COMPLETE — ALL PASS, NO STOP, NO DEVIATION.**
Plan `plan:e377a5559961b294154276b6` is **`complete` at 23/23**
(done 23 / failed 0 / blocked 0). Recorded ledger cost of the gate:
**297,117 units (≈ $0.297)** against a quote of 294,137 (≈ $0.294).
Exactly **4 executor mutations**, as budgeted. **End state HELD**,
certified by read-backs (§9 below). Julie's playback check (§10) is
the acceptance step and sits outside this record's verdict.

**Authorization.** Julie's GO in the Coding Projects chat, Nov 1,
2026, ~1:59 p.m. ET (button tap: "GO — execute Gate 4"), given on
the corrected final Gate 4 approval presentation (pin
`308518f4f57aa68ee7be0d8fe194354391ad17a3`, SHA-256 `f613e197…`,
`jedavid33-design/opal-reader` @ `ui1-review`) with the §11
detection-only spending disclosure in front of her. The GO was
recorded on the board (issue #15, `jedavid33-design/opal-roundtable`)
BEFORE the census: comment **6562455428**, Handoff ID
`RT-H-20261101-a51c5b`, read back and verified (key spans and
backticks intact). No wake email sent (wakes suspended since
Oct 26, 2026). One GO, one execution attempt — this record is that
attempt.

**Governing paperwork.** `GATE4-FINAL-PRESENTATION.md` (pin
`308518f4…`), consolidating the Gate 4 proposal (pin `806cc53a`),
Amendment 1 (pin `451f71ad`), Amendment 2 (pin `34fceb04`), and the
R1 Resolution (pin `6c1e503d`; Approach 2 adopted under Rowan's
PASS WITH CONDITIONS, relayed by Julie in direct mode). Live build
throughout: `1c2d1d0fa7ebb769f68cfb327fb9fde7d4d30867`. All times
UTC, 2026-11-01, unless stated. Raw evidence:
`~/workspace/ch2-program/ch3-recovery/gate3/gate4-execution/evidence/`.

**Money truth rule (family law).** Ledger figures are
Reader-recorded costs, not provider-confirmed spend; deltas below
are reported as ledger deltas. The 600,000-unit figure is a
**detection threshold**, not a cap (Rowan's R1 ruling); it is
reported in §8 as an observation.

---

## 1. E0 — Execution census (19:01:33Z first pass; timed pair to 19:17:58Z)

Read order per §5 / Amendment 2 §7.3: S1 → S2 → S5 → S3 (full
pagination) → S4 → S7, then the full capture set (health, cf-api
bindings / script-settings / queue, script download, capabilities,
settings, plan list, parked job, snapshots, eligibility). All
reads HTTP 200.

### 1.1 §5.1 exact-match items — ALL PASS

1. `/health` build `1c2d1d0fa7ebb769f68cfb327fb9fde7d4d30867`
   EXACT; generation `halted`; coordinator `armed`; scope
   `production`. **PASS**
2. GENERATION_HALT `"1"` (cf-api `/settings` bindings read;
   exactly 10 bindings). **PASS**
3. Queue `opalreader-generation-v2` (`93b6a35f…`)
   `delivery_paused: true` via cf-api; retention 86,400 s;
   1 producer / 1 consumer. **PASS**
4. Capabilities: coordinator `armed`; lane `standard` admitted;
   batch admitted false (`batch_not_armed`). **PASS**
5. Plan set (S6): target `active`; smoke `complete`; old Ch 2
   `retired`; fresh Ch 2 `complete`. No new plan. **PASS**
6. S2 target plan: bookId / chapterId / chapterIndex exactly
   §4.3; totals eligible 23 / done 8 / failed 0 / blocked 0 /
   prompts 0. **PASS**
7. Fresh eligibility quote EXACT: eligible 15, 20,864 chars,
   expected 294,137, digest
   `9453ab5dc7ee6ade7c650d14066054b965875f2ef1b65eb24bc633588d778e67`,
   exclusions bound_already 11 + parked 1; plan entries 27
   (poolSize 27); position 91 `excluded_parked`. **PASS**
8. Parked job `1832c21fcf0425454227c4736048a8a632f422abca4a2685ddb775bb1681406a`:
   `parked_policy`, revision 1, grants [], 27 rows (3 ready /
   24 pending); the job-view body is BYTE-IDENTICAL to the Gate 3
   closing capture — the fingerprint basis
   (`b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`)
   is unchanged. **PASS**
9. Phase accounting EXACT (identical on S5 diagnostics and the
   capabilities surface): settled 732,303; estimatedUnverified
   19,018; reservedUnverified 5,648; inFlightUpper 0; unknownOpen
   0; remaining 12,762,049 of 13,500,000;
   `unverifiedStatus: provider_unverified`. **PASS**
10. S4 PT day 2026-11-01 from its own components:
    providerDispatchesToday 0; providerReservedToday 96 ∈ {0, 96};
    reconcile totals consumed 96 = reserved. **PASS**
11. S3 reconcile `ok: true`, `armed: true`,
    `currentDayBlocked: false`, drift EMPTY; sole exception the
    adjudicated straddler
    `att-37d63768-db4b-447d-8150-580b7c6ee257`
    (`estimated_unverified`, never dispositionable). Full
    pagination: pages at offsets 0/0 (twice) and the closing read
    return `censusComplete: true` with identical totals; the
    past-end probe (offset 1/0) returns `censusComplete: false`
    by the confirmed definitional semantics; exceptionCount 1,
    driftCount 0 on every page. **PASS**
12. Prior PT day totals stand at the Gate 3 close (dispatched /
    reserved / consumed): 2026-10-29: 57/0/57; 2026-10-30:
    79/0/79; 2026-10-31: 44/0/44. **PASS**
13. Live-grant identification (Amendment 1 §2.1): job
    `generating` rev 8; exactly ONE live grant —
    `grant:plan:e377a5559961b294154276b6:ch2:7:full`, `issued`,
    grant revision 8; every other grant terminal under the §2.1
    classification (`…:ch2:1:full` `reported`; `…:ch2:2–6:full`
    `voided` — the halt-era churn voids; none
    `handoff_uncertain`). Granted set (S1 rows) = positions
    {68, 69, 73, 75, 80, 82, 83, 89} — every occurrenceId in the
    approved 15 (§4.3), exactly the drafting composition; pending
    = {70, 71, 78, 79, 84, 86, 87}; 8 rows `ready` (the
    Phase A cohort). **PASS**
14. Conflicts EXACT-MATCH to the pinned four-row baseline:
    id 1 @ 2026-10-29T23:54:14.808Z
    `grant:plan:3183ecbf2ac4bf50bbc6166e:seg:1:full`; id 2 @
    2026-10-30T00:24:14.632Z
    `grant:plan:603ab416bd67ab1b25de97be:ch1:1:full`; id 3 @
    2026-10-31T05:14:24.089Z
    `grant:plan:b2dc2a3d1cd367a0245b9102:ch1:1:full`; id 4 @
    2026-11-01T01:04:30.364Z
    `grant:plan:e377a5559961b294154276b6:ch2:1:full` — all
    cache_key `lease`, expected `7`, found `LIKE or GLOB pattern
    too complex: SQLITE_ERROR`, reason `schedule_dead`.
    Count = 4. **PASS**
15. Settings revision 1; monthlyCap 50; lane `standard`;
    OPALREADER_PHASE_POLICY `enforce`; phase registry
    forever-pucked ↔ `5c589095-f812-48a2-8ab2-03ba2791f2b2`
    (capabilities surface). **PASS**
16. Zero new failure classes since the Gate 3 close: S5 shows
    exactly the 8 Phase A executions, all `committed`; plan
    failed 0, blocked 0; no unknown-billing; no new conflict;
    no new plan; phase figures unmoved beyond churn
    reserve/release. **PASS**

### 1.2 §5.3 — the R3 reservation-ownership proof (five legs), repeated at census — ALL PASS

Rowan's R3 condition (explicit in her R1 Resolution review) is a
hard census precondition; it was executed on the fresh census
reads:

- **Leg 1 — cohort membership.** The live grant is enumerated
  (item 13); its granted set ⊆ the approved 15 — exactly the 8
  named there. **PASS**
- **Leg 2 — attempts-used = 0.** S5 diagnostics carries NO
  execution or attempt referencing any of the 15 occurrenceIds
  (the only executions on the surface are the 8 committed
  Phase A records); the code-derived reservation for the live
  grant is therefore exactly 8 × 12 = **96**. **PASS**
- **Leg 3 — the possibility-shaped rows, excluded.** Neither
  zero-remaining shape can exist for the 15: shape (T) requires a
  dispatch (none has ever occurred for them, Leg 2); shape (P)
  requires an unresolved `unknown_billing` (unknownOpen = 0;
  the only historical unknown is the adjudicated straddler,
  whose reservation closed at Gate 5 under its own gate).
  **PASS**
- **Leg 3b — per-row reconciliation.** `reconcileQuota` iterates
  every reservation row (no state filter); `ok: true` with the
  §1.1 item 11 pagination certifies every open row's
  attribution. **PASS**
- **Leg 4 — day-sum closure.** The derived day totals for
  2026-11-01 close at exactly dispatched 0 / reserved 96 /
  consumed 96 — the live grant's 96 alone; no room for any
  second open reservation. **PASS**
- **Leg 5 — per-row drift.** Drift EMPTY across the complete
  pagination. **PASS**

Zero-case protocol: not triggered (reserved = 96 with a live
grant observed). No unexplained reservation, no inconsistent
grant generation, no failed reconciliation — the R3 STOP
conditions did not arise.

### 1.3 §5.2 timed pair — lease classification

First S1 read 19:01:33Z (live grant `…:ch2:7:full`, `issued`,
rev 8); second read 19:17:58Z (16m25s later): `…:ch2:7:full` now
`voided`; successor `grant:plan:e377a5559961b294154276b6:ch2:8:full`
is the unique live grant (`issued`, rev 9) with an IDENTICAL
granted set {68, 69, 73, 75, 80, 82, 83, 89} and unchanged
pending set. Classification (Amendment 1 §2.1 step 4):
**Replaced** — the churn cycle is proven live by direct
observation; the successor is freshly issued within the last
lease window. S4/S3 reads on the pair were stable (dispatched 0,
reserved 96, reconcile `ok: true`). Lease class is evidence only;
the delivery fence (§3) carries the safety argument.

### 1.4 Flip preparation (read-only; the proven Ch 3 re-arm mechanism)

- Live script parts parsed from the fresh download: **31/31
  byte-identical** to the range-fix deploy's operative parts
  manifest (the `1c2d1d0f` inventory).
- Restore check: live parts + the deploy's operative assembled
  metadata + boundary `----opalreader-final-envelope-d1`
  reproduce the deployed operative envelope BYTE-FOR-BYTE
  (SHA-256 `3508d1bf722a426f7332afbdadcc2012cbd8271d35e5b8a4e1758b5eb850ac8c`,
  1,438,980 B).
- Flip envelope: identical except exactly ONE byte (metadata
  offset 688; parsed deep-diff = exactly one path,
  `.bindings[4].text`, GENERATION_HALT `"1"` → `"0"`);
  1,438,980 B, SHA-256
  `0560f9a0b8742b64fc5949e0cfa202e217a05ea1ecca7833e15b031d36f503d5`.
- Script etag at census:
  `f15fb1ae40f870fc4493f3499db0b096c4d801b9fff8d20fe5538d84c69c82ed`.
- Observability at census: enabled + logs enabled + persist.

**CENSUS VERDICT: ALL 16 ITEMS PASS; §5.3 FIVE LEGS PASS; NO
DEVIATION. The gate proceeded to R1.**

---

## 2. Sub-gate R1 — re-arm (halt lift first) — PASS

**Executor mutation 1 of 4.**

1. Hard precondition: a fresh S3 reconcile read at 19:18:22Z,
   immediately before the flip, returned `ok: true`
   (`armed: true`, `currentDayBlocked: false`, totals
   0 / 96 / 96). Satisfied.
2. PUT the flip envelope (§1.4), 19:18:24–19:18:27Z: **HTTP 200**;
   deployment id `1c6e00402724477fb72cbe1fc79656f3`; entry point
   `v2/worker-entry-prod-d6.js`.
3. Read-backs (19:18:3x–19:18:44Z): `/health` generation
   **`"enabled"`**, build still `1c2d1d0f…`; bindings exactly the
   10 expected names with a name-keyed diff vs census of exactly
   ONE entry (GENERATION_HALT `"1"` → `"0"`); script GET etag
   **`f15fb1ae…` — UNCHANGED**, and the downloaded parts
   re-verified **31/31 byte-identical** to the operative
   inventory; observability **survived** (enabled + logs enabled
   + persist, shape-identical to census) — the §6.1 conditional
   observability PATCH was NOT needed and NOT sent; queue still
   paused; S4 dispatched still exactly 0.

**Disclosure (presentation §6.1 step 4), stated for the record:**
from this flip until sub-gate C completed, the app's Generate
button was live and Batch was presented-but-not-armed. No foreign
generation occurred in that window (§5).

## 3. Step 0 — delivery-safety verification (19:19:01–19:19:03Z) — PASS

Zero executor mutations. Checks per Amendment 1 §2.2 (i)–(iv),
which govern over the presentation §6.2's compression:

- **(i) Plan exclusivity.** The unique live grant on S1 is
  `grant:plan:e377a5559961b294154276b6:ch2:8:full` (`issued`,
  rev 9) — a grant OF THIS JOB (S1 is per-job by construction);
  S2 binds all 15 of the approved entries to jobId
  `plan:e377a5559961b294154276b6:ch2`. **PASS**
- **(ii) Cohort exclusivity.** The granted set is
  {68, 69, 73, 75, 80, 82, 83, 89} ⊆ the approved 15, identical
  to the cohort the §1.2 ownership proof covers. **PASS**
- **(iii) Reservation match.** The §5.3/§3 sum closes on this
  pass (S3 `ok: true`; totals dispatched 0 / reserved 96 /
  consumed 96 — this grant's 96 alone); dispatched for the
  current PT day still exactly 0. **PASS**
- **(iv) Lease state known.** `…:ch2:8:full` was observed at the
  census timed pair (19:17:58Z) as the freshly issued successor
  (classification: Replaced → active); not `handoff_uncertain`;
  its granted set is unchanged since that observation.
  **PASS**

The grant in fact delivered after R2 was `…:ch2:8:full` itself —
branch 1 of Amendment 1 §2.3 (the verified grant, not a
post-void successor). Poll g002 (§5) is the delivery evidence.

## 4. Sub-gate R2 — queue unpause (last opening move) — PASS

**Executor mutation 2 of 4.** cf-api PUT the queue
(`93b6a35fb8cf4788a91a2c90b748ae66`) at **19:19:09Z** with
`queue_name` + `settings.delivery_paused: false` (positional
argv JSON): HTTP 200, `success: true`. Independent read-back:
`delivery_paused === false`; retention 86,400 s, sole consumer
and sole producer unchanged. G begins.

## 5. G — monitored generation (19:19:19Z – 19:40:13Z)

Polls under §7.1 (S2 totals; S1 grant picture; S4 day totals;
S3 reconcile verdict + derived totals; S5 phase settled;
conflicts count). At EVERY poll: reconcile `ok: true`; conflicts
exactly 4; plan failed 0 / blocked 0; unknownOpen 0;
estimatedUnverified 19,018 and reservedUnverified 5,648 unmoved;
no parked-plan or foreign movement of any surface.

| Poll | Time (Z) | Done | Live grant | Disp | Rsvd | Settled Δ | Note |
|---|---|---|---|---|---|---|---|
| g001 | 19:19:19 | 8 | ch2:8 `issued` | 0 | 96 | 0 | pre-delivery |
| g002 | 19:20:39 | 9 | ch2:8 executing | 6 | 90 | 18,909 | **t0 — delivery observed** (the step-0-verified grant) |
| g003 | 19:22:01 | 11 | ch2:8 | 15 | 81 | 65,799 | |
| g004 | 19:23:31 | 13 | ch2:8 | 25 | 71 | 103,023 | |
| g005 | 19:24:56 | 15 | ch2:8 | 35 | 61 | 150,534 | |
| g006 | 19:26:20 | 16 | ch2:8 **`reported`** | 38 | 0 | 166,779 | **cohort 1 closed** |
| g007 | 19:27:43 | 16 | none | 38 | 0 | 166,779 | inter-cohort interval |
| g008 | 19:29:33 | 16 | issuing between reads | 38 | 60 | 166,779 | cohort-2 reservations written |
| g009 | 19:29:43 | 16 | ch2:9 `issued` | 39 | 59 | 166,779 | **successor verified (§5.1); executing** |
| g010 | 19:31:41 | 18 | ch2:9 | 53 | 45 | 213,966 | |
| g011 | 19:33:02 | 20 | ch2:9 | 64 | 34 | 250,047 | |
| g012 | 19:34:27 | 21 | ch2:9 **`reported`** | 64 | 0 | 257,391 | **cohort 2 closed** |
| g013 | 19:36:04 | 22 | ch2:10 `issued` | 75 | 13 | 286,254 | **cohort 3 verified (§5.1); executing** |
| g014 | 19:37:12 | 23 | ch2:10 **`reported`** | 76 | 0 | 297,117 | **generation complete** |
| g015 | 19:38:10 | 23 | none | 76 | 0 | 297,117 | finishing pass pending |
| g016 | 19:40:13 | 23 | none | 76 | 0 | 297,117 | **plan `complete`** |

### 5.1 Successor-grant verification (Amendment 2 §8 / R4)

Every newly observed grant was verified before reliance:

- **`…:ch2:9:full`** (first observed g009): the unique live grant
  of the target job; granted set **{70, 71, 79, 84, 86}** ⊆ the
  approved 15. Cohort derivation verified against the machinery's
  own queue order (the S1 job-row order, established from the
  census reads): the pending queue after cohort 1 was
  [84, 86, 70, 79, 71, 78, 87] in that order — cohort 1's set is
  exactly its first 8 — and cohort 2 is exactly the next 5, at
  5 × 12 = 60 reserved (observed at g008), fitting the derived
  day headroom of 62 (a 6th would have taken the sum to 72 > 62).
  The §5.3 ownership proof re-ran for it on the g008/g009 passes
  (day totals closed on its reservations; reconcile `ok: true`).
  **PASS**
- **`…:ch2:10:full`** (first observed g013): unique live grant;
  granted set **{78, 87}** — exactly the two occurrences
  remaining in the queue order, 2 × 12 = 24 ≤ the post-cohort-2
  derived headroom of 36. Ownership re-verified on the pass
  (reconcile `ok: true`; reserved consistent). **PASS**

### 5.2 Cohort outcomes

- **Cohort 1** (`…:ch2:8:full`, the step-0-verified grant):
  8 occurrences, 38 dispatches, settled +166,779. The grant
  reached `reported` at the end of its message — the Phase A
  failure shape (a grant stuck `issued` after its executions)
  did NOT recur on the range-fix build.
- **Cohort 2** (`…:ch2:9:full`): 5 occurrences, 26 further
  dispatches (64 cumulative), settled +90,612 (257,391
  cumulative). Grant `reported`.
- **Cohort 3** (`…:ch2:10:full`): 2 occurrences, 12 further
  dispatches (76 cumulative), settled +39,726 (297,117
  cumulative). Grant `reported`. The plan's finishing pass set
  the plan `complete` (observed g016).

### 5.3 Attempts — the full split (S5 closing read)

76 attempts, exactly equal to the day counter's 76 dispatches.
All 76 phase `confirmed`. Outcomes: **53 success + 23
policy_block; 0 failed; 0 unknown.** Per occurrence
(attempts = success + policy_block; settled units):

| Pos | Attempts | Succ | PB | Settled |
|---|---|---|---|---|
| 68 | 6 | 4 | 2 | 21,960 |
| 69 | 2 | 2 | 0 | 19,701 |
| 70 | 6 | 4 | 2 | 18,864 |
| 71 | 4 | 3 | 1 | 16,281 |
| 73 | 4 | 3 | 1 | 20,241 |
| 75 | 6 | 4 | 2 | 21,402 |
| 78 | 6 | 4 | 2 | 18,837 |
| 79 | 6 | 4 | 2 | 17,190 |
| 80 | 6 | 4 | 2 | 19,746 |
| 82 | 4 | 3 | 1 | 22,113 |
| 83 | 4 | 3 | 1 | 18,909 |
| 84 | 4 | 3 | 1 | 21,312 |
| 86 | 6 | 4 | 2 | 16,965 |
| 87 | 6 | 4 | 2 | 20,889 |
| 89 | 6 | 4 | 2 | 22,707 |
| **Σ** | **76** | **53** | **23** | **297,117** |

Σ per-execution settled = **297,117 = the phase settled delta,
to the unit.** Policy-blocked text split recursively without
voice substitution (the normal path; ≤ 12 attempts per
occurrence respected — max observed 6). No `unknown_billing`
outcome appeared at any point (the phase never halted itself).

### 5.4 Watches that never fired

- **Detection threshold (§7.2).** settledDelta peaked at its
  final 297,117 — 49.5% of the 600,000 detection threshold and
  63.3% of the 469,519 m = 1 forecast. Neither was crossed at
  any poll. The §7.2 cover computation held at every cohort:
  at census, 0 + 257,964 (cohort-1 upper sum, as drafted)
  ≤ 600,000; at cohort 2, 166,779 + the remaining-occurrences
  upper sum (211,480, being 469,444 − 257,964) = 378,259
  ≤ 600,000; at cohort 3, 257,391 + the {78, 87} uppers
  (≈ 63,023) ≈ 320,414 ≤ 600,000. Reported as observations per
  §9.2 item 7; the threshold is a detection figure, not a cap.
  Realized duration ratio vs the m = 1 upper basis:
  297,117 / 469,444 ≈ 0.63 — consistent with Phase A's ≈ 0.61.
- **Stall (§8.2).** Anchors formed at each delivery and were
  reset by continuous movement (attempts, progress, and
  settlement moved at every poll while any grant was live).
  No window approached the signature; no grant remained live
  and unmoving. The inter-cohort intervals (g006→g009,
  g012→g013) are pre-delivery states, excluded by §8.2 by
  construction.
- **Foreign generation (§8.3).** None observed on any surface
  at any poll: no other plan moved, phase settled is explained
  to the unit by the target plan's own confirmed attempts
  (§5.3), no other book/chapter showed new generation, position
  91 never moved.
- **Rollover (§7.4).** None: the gate ran entirely inside PT
  day 2026-11-01 (19:01–19:41Z; the next PT rollover is
  2026-11-02T07:00Z). No snapshot pair was required; the §7.2
  ledger never reset.
- **100/day fence (§7.3).** Day total closed at 76 dispatched
  ≤ 100, enforced by the machinery throughout.

## 6. Completion criteria (§9.1) — ALL MET

Plan `complete` at 23/23 (done 23, failed 0, blocked 0,
prompts 0); every grant the gate relied on reads `reported`
(`…:ch2:8/9/10:full`; no grant of the target job reads `issued`
at close — the remaining rows are the terminal churn voids and
the Gate-3-reported `…:ch2:1:full`); reconcile `ok: true`; zero
new conflicts; the parked job untouched. The gate therefore
closes as a COMPLETION, not a STOP.

## 7. Sub-gate C — closing holds — PASS

**Executor mutations 3 and 4 of 4**, in containment order:

3. **Re-pause the queue** — cf-api PUT at **19:40:20Z**
   (`delivery_paused: true`): HTTP 200, `success: true`;
   read-back `delivery_paused === true`.
4. **Re-halt generation** — PUT of the restore envelope (the
   deployed operative envelope byte-for-byte; metadata-only
   reversal of mutation 1) at **19:40:25–19:40:27Z**: HTTP 200;
   deployment id `c276e017041f47a2b65a1cec97fedd9d`. Read-backs:
   `/health` generation **`"halted"`**, build unchanged; script
   GET etag **`f15fb1ae…` — UNCHANGED**; post-close parts
   re-verified **31/31 byte-identical** to the operative
   inventory.

Total executor mutations for the gate: **exactly 4** (halt flip,
unpause, re-pause, re-halt). The conditional observability
repair was never triggered. No other executor action of any
kind was taken: no command, no SubmitJob, no operator-route
call, no finalizer preview or invocation, no park/exemption
route, no deploy beyond the two metadata-only halt flips on
byte-identical code, no settings change beyond the halt flips,
no conflicts-row touch, no rollback.

## 8. E4 — closing read-backs (§9.2)

1. `/health` build `1c2d1d0fa7ebb769f68cfb327fb9fde7d4d30867`;
   GENERATION_HALT `"1"` (bindings read); etag unchanged;
   settings-only flips throughout. ✓
2. Queue `delivery_paused: true` (cf-api read). ✓
3. Capabilities: coordinator `armed`; Batch still unarmed
   (`batch_not_armed`); standard admitted. ✓
4. Target plan `complete`, totals 23 / 23 / 0 / 0 / 0. ✓
5. All grants of the target job terminal; the three gate
   grants `reported`; none live. ✓
6. Phase accounting closing set: settled **1,029,420**
   (= 732,303 + 297,117); estimatedUnverified **19,018**
   (unchanged); reservedUnverified **5,648** (unchanged);
   inFlightUpper 0; unknownOpen **0**; remaining 12,464,932
   of 13,500,000. ✓
7. The gate's settled delta **297,117 units (≈ $0.297)**,
   evaluated against the detection threshold (600,000) as an
   observation: 49.5% of the threshold; quote was 294,137
   (delta +1.01% vs quote); realized duration ratio ≈ 0.63
   vs the m = 1 basis (§5.4). ✓
8. PT day totals (S3/S4 derived): the gate spanned one PT day —
   2026-11-01: dispatched 76 / reserved 0 / consumed 76.
   Prior days stand: 2026-10-29: 57; 2026-10-30: 79;
   2026-10-31: 44/0/44. No rollover occurred. ✓
9. Conflicts still exactly the four-row baseline (§1.1
   item 14). ✓
10. Parked job fingerprint basis unchanged (job-view body
    byte-identical to the Gate 3 closing capture);
    `parked_policy` rev 1; position 91 still `excluded_parked`;
    the final segment untouched. ✓
11. Settings still revision 1; phase registry unchanged. ✓
12. Sync watermarks: content **18** (unchanged); bindings
    **1841** = 1826 + **exactly 15** — the gate's newly bound
    segments. ✓
13. The complete request ledger for the gate is the evidence
    set (`gate4-execution/evidence/`: every read, PUT, and
    read-back archived with timestamps). ✓

## 9. END STATE — HELD, CERTIFIED

Queue `delivery_paused: true` (cf-api read-back after mutation
3, re-read at E4); GENERATION_HALT `"1"` (bindings read-back
after mutation 4, re-read at E4); build
`1c2d1d0fa7ebb769f68cfb327fb9fde7d4d30867` on etag
`f15fb1ae…`; observability enabled + persisted; coordinator
`armed`; Batch unarmed; plan `complete` 23/23; nothing in
flight; reconcile `ok: true`. The system is exactly as HELD as
it was at census, with the plan finished.

## 10. Acceptance — Julie's playback check (outside this verdict)

Per §9.3, acceptance is Julie's: Forever Pucked Chapter 3 on
her device should now read **Partial 26/27** (the 11 previously
bound + this gate's 15; the chapter's final segment is Phase B,
separately gated and untouched by this gate), with play buttons
on the newly bound positions and sampled segments playing
normally. This record reports the gate's outcome; her playback
result accepts or does not accept it.

**Deviations: NONE.** No STOP fired; the GO was consumed by a
completed execution, not by a stop. Phase B, Batch, the rest of
Forever Pucked, and every other separately-gated matter remain
exactly as gated as they were.

— Wren (execution agent)
