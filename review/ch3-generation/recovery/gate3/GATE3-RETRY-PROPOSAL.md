# GATE 3 RETRY PROPOSAL — Production grant finalization on the range-fix build (bounded, for Rowan review)

Opal Roundtable (Julie + Rowan + Wren) — Case #10 / issue #15,
board repo `jedavid33-design/opal-roundtable`.
Review pins live in repo `jedavid33-design/opal-reader`, branch `ui1-review`.

**Status: PROPOSAL ONLY.** This document authorizes nothing. It
requests Rowan's review of a bounded Gate 3 **retry** execution
shape. Julie's explicit Gate 3 retry GO is a separate later
step, after Rowan's review of this proposal. Julie is not being
asked to approve execution by this filing, and she has not
approved execution.

**Production contact by this proposal: NONE.** No preview, no
finalizer invocation, no production read or write of any kind
is made in preparing or filing this proposal.

**Origin of this proposal.** Rowan's range-fix deployment
EXECUTION REVIEW PASS (board 6561225702, 2026-11-01) closed
the deploy case and specified this document: *"Wren [is] to
prepare a separately bounded Gate 3 retry proposal, with exact
preflight, stop conditions, one valid preview and subsequent
actions individually gated as appropriate."* Rowan further
recorded that no retry, finalizer, re-arm, queue unpause,
generation, spending, or rollback is authorized by that
review; Rowan must review this proposal, and Julie must
separately approve any production action. This proposal is
Wren's response to that specification. It is also the first
substantive filing prepared for Rowan's NEW ChatGPT thread
(Julie's request; new-thread handoff + state report pinned
`60b836a32711a0d93ffcb39c43426f43756a3a68`, filed 6561273039,
Handoff ID RT-H-20261101-4c5c35).

**Template.** This proposal mirrors the amended Gate 3
attempt-1 contract (pin
`1610a314d66d363a48361f9a1497e3418eaa216d`; base proposal pin
`7c71deef64d132b4492b9dfa99477efe72d0dea2`) section by section,
re-pointed at the range-fix build and tightened by what
attempt 1 taught. Material differences are collected in §0.3
so Rowan can review the deltas rather than re-derive them.

**Turn after this filing:** Rowan's review. Then Julie's
Gate 3 retry GO / HOLD decision.

---

## 0. Why this retry exists, and what changed since attempt 1

### 0.1 Attempt 1, in brief

Gate 3 attempt 1 (Julie GO 6559241292; Rowan TECHNICAL PASS
FOR JULIE'S DECISION, board 6559214332) executed
2026-11-01T14:26Z–14:30Z under the amended attempt-1 contract
and **STOPPED AT E3** (execution record pin `b5fc3784`):

- E0 fresh census **ALL PASS (21/21)** — including conflicts
  EXACT-MATCH against the four-row Gate 2D approved baseline
  (pin `9284f5efee47cd87b2c5639e9dfe50e6fb7e908a`) and bindings
  revision_key == cache_key on all 8 committed occurrences.
  Census evidence digest
  `bef72c47e31414e08796b7e5a3d84511a761c7d746bd9950067519f0aeb16b19`.
- E1 halt flip and E2 queue pause executed (2 of the 3
  budgeted mutations) — the system was live-but-idle at
  attempt-1 start, so the holds were real mutations then.
- **E3 — the single operator preview call — returned HTTP
  500** `{"error":"LIKE or GLOB pattern too complex:
  SQLITE_ERROR"}`. No classification, **no precondition
  digest**. Under the contract's STOP law, execution stopped
  immediately: E3.5 was not run as a step, **the finalizer
  action was NEVER called**, Julie's GO was consumed, and the
  system was left HELD as containment.
- The 500's error string is byte-identical to the `found`
  field of the four standing `schedule_dead` conflicts rows.
  That identity is an **observation, not a diagnosis**: the
  root cause was NOT established by attempt 1 and is NOT
  established now (see §0.2).

### 0.2 Diagnosis, remediation, deploy — the chain since

- **Diagnosis** (proposal pin `d581f5bd`; Amendment 1 pin
  `1e18269c24b91b8035fe9f8acc38ab696f9839ca`; Rowan TECHNICAL
  PASS for Stage 1, board 6559656456; Julie Stage 1 GO
  6559701645). Source trace of the preview path on the
  then-live tree: the derivation's only LIKE is §4.3.5
  (`grant-finalizer.mjs:417-419`, bound pattern
  `` `op:${grantId}:%` ``, 51 chars, one trailing `%`, no
  `_`); exactly **five LIKE sites** exist in the tree, no
  GLOB. **H1 — the preview threw at its §4.3.5 LIKE, the
  same construction family recorded throwing in production
  — is SUPPORTED, NOT proven.** Why the Durable Object
  SQLite build rejects that pattern is unknown; intermittency
  is not excluded. **Stage 1** (passive read-only probes,
  record pin
  `b0446f7942ee831c6f5f3bf15709433a46ae7640`, filed 6559748096)
  executed complete: conflict set stable and exact-matched at
  both reads, reconcile `ok: true` with the sole straddler,
  plan still active 8/23, bindings zero movement since seq
  1826. Stage 1 upgraded nothing about H1. Rowan: **STAGE 1
  PASS / COMPLETE** (board 6559766643).
- **Rowan's standing ruling on re-invocation:** do NOT repeat
  the preview merely to reproduce the error. A repeat 500
  would prove endpoint reproducibility only — never the
  failing statement or mechanism (diagnosis proposal §7.3
  inference discipline, Amendment 1). §0.4 of this proposal
  addresses why this retry is not that act.
- **Remediation** (options analysis pin
  `c3f58ad84c3a56216fc913bedd6d95bc95f1f48c`, filed 6559913714;
  Rowan ANALYSIS PASS, recorded 6560003451): five options
  compared; **Option B — prefix range scan — chosen**
  (exact intended set on every input, preserves discovery
  semantics, index-served, no schema change). Option D
  (derived column) was REJECTED: it cannot serve the stalled
  grant, whose existing rows carry no value in a new column.
- **Range-fix build** (Julie build GO 6560015979; build
  record pin `d01c15ed732436223f0207e4d126a588150187af`,
  filed 6560153165; Rowan SOURCE REVIEW PASS, candidate
  only, recorded 6560249061): one new shared helper
  (`worker/generation/prefix-range.mjs`) + predicate swaps at
  **all five LIKE sites** (L1 finalizer derivation; L2–L5 in
  `worker/coordinator.mjs`). No schema, write-path, or
  control-flow change. New equivalence suite 19/19; full
  battery 1,197 / 1,175 / 22 — exactly +19/+19/+0 over the
  1,178/1,156/22 baseline, failing-file set name-identical.
  **Equivalence proof that matters for this gate:** on
  Fixture S (live-shaped stalled grant), the patched
  derivation classifies `finalizable` with precondition
  digest
  `00db68a8d8a2cb7350f16064f933b4f33b6438659c554a05d9cd48f4e1f53674`
  — **byte-identical to the unpatched LIKE build's digest
  over the identical seed** — and the patched finalizer
  action accepts the LIKE build's digest and finalizes
  (`outcome: "applied"`). Grep proof on the patched tree:
  **zero SQL LIKE/GLOB sites remain in `worker/`** (14 hits,
  all comment lines).
- **Range-fix deploy** (proposal pin
  `6d533dfea25034091084cb0629a049688301c823`; Rowan FINAL
  PROPOSAL REVIEW PASS 6560945443; Julie GO recorded
  6560982620; execution record pin
  `b986b562f1824fec2c15810ee4ef023d42a4362f`, filed
  6561039589): census zero deviations, **exactly 1 mutation**
  (the upload; observability survived, conditional PATCH
  unspent), 31/31 parts byte-identical, denied probes 6/6,
  **ENDS HELD certified**. Rowan EXECUTION REVIEW PASS
  (documentary) 6561225702. **Live build is now
  `1c2d1d0fa7ebb769f68cfb327fb9fde7d4d30867`.**

### 0.3 What is different from the attempt-1 contract

| # | Attempt 1 | This retry |
|---|---|---|
| 1 | Live build `408f9149…` (30 parts), finalizer derivation contains the §4.3.5 LIKE | Live build `1c2d1d0f…` (31 parts); derivation runs the prefix range scan; zero SQL LIKE/GLOB sites in `worker/` |
| 2 | System live-but-idle at gate start; halt flip + queue pause were mutations 1–2 of 3 | System **never left HELD** after attempt 1 and the deploy; halt `"1"` + `delivery_paused: true` are already in place, so the hold steps are **verification steps, not mutations** |
| 3 | Mutation budget **3** (halt, pause, finalizer) | Mutation budget **1** — the finalizer action ONLY (plus pre-authorized containment re-holds under §5.0, which no step should trigger) |
| 4 | Census expected `GENERATION_HALT "0"`, queue unpaused | Census expects `GENERATION_HALT "1"`, generation `halted`, queue `delivery_paused: true` — a not-held finding is a STOP reported as observed state (§4.1), never silently fixed under this gate |
| 5 | Preview was the first-ever valid invocation of the route | Preview is the first valid invocation **on the fixed build**; attempt 1's 500 is the prior data point, stated at its true strength in §6 |

Everything else — identity binding (§2), finalizer semantics
(§3), conflicts exact-match rule (§4.4), bindings rule (§4.5),
STOP law (§7), audit readback discipline (§6, incl. the
§7.14 digest distinction), containment (§8) — is carried over
from the amended attempt-1 contract unchanged in substance.

### 0.4 This retry is NOT a reproduction attempt

Rowan's ruling stands and this proposal honors it in terms:

1. **The code under the preview has changed.** Attempt 1 ran
   the derivation on the LIKE construction; this retry runs
   it on the prefix-range construction at all five former
   LIKE sites. Re-invoking the preview on the *unchanged*
   build merely to watch it fail again is the act the ruling
   prohibits; that is not what is proposed.
2. **The purpose is operative, not diagnostic.** The preview
   here is step E1 of the gated finalization sequence: if it
   returns a precondition digest, that digest is **consumed
   by E3 under this same gate** as
   `expectedPreconditionDigest`. This is the exact inverse of
   the diagnosis §7.3 discipline, under which a diagnostic
   re-invocation's digest would be evidence only and could
   never be presented to an action.
3. **The specification is Rowan's own.** The execution review
   PASS (6561225702) directs a retry proposal shaped as
   "exact preflight, stop conditions, one valid preview and
   subsequent actions individually gated" — this document.
4. **Inference discipline is preserved.** Whatever E1 returns
   is recorded at its true strength (§6, §9): a 200 proves
   the derivation completed on the fixed build against live
   data; it does not prove the mechanism of the original 500,
   and it does not upgrade H1 from supported to proven. A
   non-200 is a STOP and evidence — not a license to retry
   the preview inside this gate.

---

## 1. Scope

### 1.1 In scope — exactly one act

Under a future Julie Gate 3 retry GO, execute **exactly one**
operator finalization of **exactly one** grant — the stalled
Chapter 3 grant of §2 — on live build `1c2d1d0f…`:

- One fresh census (E0, §4), read-only.
- One verify-held confirmation (E0.5, §5), read-only.
- One `GET /v2/d6-grant-finalization-preview` (E1, operator,
  read-only) checked against the census.
- One pre-action conflict re-check (E2, §5), read-only.
- One `POST /v2/d6-finalize-grant` (E3, operator) bound to
  the exact identity in §2, to the E1 precondition digest,
  and to Julie's retry GO as the authorization reference.
- Full readbacks (E4, §6), still held.

Finalization is bookkeeping only. It makes no provider call,
submits nothing, wakes no generation, and moves no phase
money (§2.4, §5.3). **Spend: $0.**

### 1.2 What this retry does NOT do

This retry does **not**:

- generate any segment or make any provider call;
- issue any new grant, submit any new plan or job, or resume
  the stalled plan — finalization closes the grant; the
  remaining 15 segments are **Gate 4**, separately gated;
- re-arm the system, lift the halt, or unpause the queue —
  the retry starts held and **ends held**;
- perform or touch Phase B (the idx-26 exemption path);
- arm or touch Batch;
- touch the parked Chapter 3 job, the park-release row, any
  exemption row, any other book, chapter, plan, job, or
  grant;
- clear, edit, or delete any conflicts row;
- roll back code or data (§8);
- authorize Gate 4, Phase B, Batch, rest-of-Forever-Pucked
  generation, any quarantine release, or any spending — each
  remains its own separate Julie decision.

The app's Generate button is **not live** (the system is
held) and stays not live for the duration of this gate and
after it, until a separate re-arm decision on a separate GO.

### 1.3 Explicitly out of scope / not authorized by this proposal

For the avoidance of doubt, none of the following is
requested, implied, or authorized by this proposal or by any
review of it: a Gate 4 resumption; Phase B; Batch arming or
Batch work; **any second preview call or second finalizer
call** (the §7 ambiguous-response rule governs the single
action's aftermath — it grants no in-gate retry); any
rollback; clearing, editing, or deleting any conflicts row;
any baseline change (a replacement conflicts baseline exists
only via a pinned census + Rowan ruling); any preview or
finalizer invocation outside the single E1/E3 pair defined
in §5.

---

## 2. Identity binding — the exact subject

Every census read, the preview, and the single action call
are bound to these identities and no others. Any read that
returns a different identity is a STOP (§7).

### 2.1 Book / phase / chapter

| Field | Value |
|---|---|
| Book | Forever Pucked |
| bookId | `5c589095-f812-48a2-8ab2-03ba2791f2b2` |
| Phase | `forever-pucked` |
| chapterIndex | 2 (Chapter 3) |
| Lane | `standard` (Batch unarmed, `batch_not_armed`) |

### 2.2 Plan / job / grant

| Field | Value |
|---|---|
| Plan | `plan:e377a5559961b294154276b6` |
| Plan state / totals | `active`; eligible 23 / done 8 / failed 0 / blocked 0 / prompts 0 |
| Job | `plan:e377a5559961b294154276b6:ch2` |
| Job state / revision | `generating` / 2 |
| Job occurrences | 8 `ready` / 15 `pending` / 0 `granted` |
| Grant | `grant:plan:e377a5559961b294154276b6:ch2:1:full` |
| Grant state / revision | `issued` / 2 |

### 2.3 The 8 committed occurrences and their reservations

The grant's target set is exactly these 8 occurrences, in
chapter order. Attempts are all `confirmed` (30 `success` +
14 `policy_block`, 0 failed, 0 unknown). Each occurrence
holds exactly one open reservation,
`qres:<grantId>:<occurrenceId>:2026-10-31`, `slots_total` 12.

| Ch idx | Occurrence ID | Attempts | Residual (12 − attempts) |
|---:|---|---:|---:|
| 7 | `05941584-5669-4ea9-91e7-59a5397f46c4` | 4 | 8 |
| 9 | `5f6ca428-524d-448a-8fbf-a773dfc132e6` | 6 | 6 |
| 11 | `4e163ba6-87d6-467f-a8a7-52a0062ca69e` | 6 | 6 |
| 12 | `4746f9a6-9f05-4a65-a175-83b24f8d539a` | 6 | 6 |
| 16 | `338676cd-63fa-409d-8e42-e13c28636de3` | 6 | 6 |
| 20 | `203af7f9-d88a-4f2a-a0fd-3f70d0a11f07` | 6 | 6 |
| 23 | `0c83bc51-7fc9-4ac7-b0ca-f81f1729a38e` | 4 | 8 |
| 25 | `35ab06fd-8459-41ff-a8b7-ae4bf25be731` | 6 | 6 |
| **Total** | **8 reservations** | **44** | **52** |

Closing these 8 reservations as `grant_settled` is
settlement of spent work, not a quota bypass: the 44 dispatch
rows remain counted on PT 2026-10-31 forever, no
`slots_consumed` value changes, and no new slots are granted
retroactively. Only the 52 unused worst-case slots stop being
held open for a grant that can no longer dispatch (recovery
proposal §2.3, carried from attempt 1).

### 2.4 Money — must NOT change

Phase `forever-pucked` accounting, before and after
finalization, identically (this is a design-derived
expectation from the finalizer's specification — attempt-1
contract §2.4/§3 — to be **verified** at E4, not assumed; any
movement is a STOP-class readback failure under §7):

| Figure | Before | After (expected) |
|---|---:|---:|
| Budget | 13,500,000 | 13,500,000 |
| Settled | **732,303** | **732,303** |
| Estimated unverified | 19,018 | 19,018 |
| Reserved unverified | 5,648 | **5,648** |
| Unknown open | 0 | 0 |
| Remaining | 12,762,049 | 12,762,049 |

Why finalization moves no phase money: the finalizer settles
**quota reservations** — the 52 provider-attempt *slots* of
§2.3 — via `settleReservationsForGrant`. It writes no phase
ledger figure. The phase ledger's `reservedUnverified`
5,648 is the adjudicated straddler's accounting (Gate 5,
attempt `att-37d63768-db4b-447d-8150-580b7c6ee257`), not this
grant's slots, and is untouched by design. The movement
finalization *does* produce is in the **quota** ledger's
derived totals (§5.3): PT 2026-10-31 reserved 52 → 0.

Settings revision **1** (monthlyCap 50, lane `standard`).
Sync watermarks: bindings **1826** / content **18**.
Eligibility for the remaining work (context, not a retry
mutation): 15 eligible / 11 bound_already / 1 parked; 20,864
chars; expected 294,137; digest
`9453ab5dc7ee6ade7c650d14066054b965875f2ef1b65eb24bc633588d778e67`.

### 2.5 Parked job — untouched by design

Parked job
`1832c21fcf0425454227c4736048a8a632f422abca4a2685ddb775bb1681406a`:
state `parked_policy`, revision 1, fingerprint
`b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`.
Park-release row: releaseId 1, `live` (the 23 ids, idx 3–25).
Chapter exemptions: zero rows, zero writes, ever, in this
gate.

### 2.6 Live build and held state at proposal time

Worker `opalreader-api-v2-prod`, build
**`1c2d1d0fa7ebb769f68cfb327fb9fde7d4d30867`** (the range-fix
envelope pin; script 1,435,756 B, **31 parts**, etag
`f15fb1ae40f870fc4493f3499db0b096c4d801b9fff8d20fe5538d84c69c82ed`
as read back at deploy D4). `GENERATION_HALT "1"` —
generation **halted**; coordinator `armed`;
`OPALREADER_PHASE_POLICY "enforce"`; queue
`opalreader-generation-v2`
(`93b6a35fb8cf4788a91a2c90b748ae66`) delivery **paused**,
sole consumer `f260f2188d80426bb0588685e9d084eb`, retention
86,400 s; observability enabled + persisted; 10 bindings.
This state was certified at the deploy's D7 read-backs
(DEPLOY-RECORD, pin `b986b562…`) and is the state attempt 1's
containment left in place. The retry census (§4) re-reads
all of it fresh; this section is context, not a substitute
for the census.

---

## 3. The finalizer on the fixed build — what the calls do

The finalizer surfaces are unchanged in shape from attempt 1
(operator-fenced at both the public entry and the Durable
Object class gate; credential-less calls refuse 403
`migration_operator_required` — re-probe-proven 6/6 at the
range-fix deploy, including both finalizer routes):

- Preview: `GET /v2/d6-grant-finalization-preview` —
  read-only; does not bootstrap its audit table.
- Action: `POST /v2/d6-finalize-grant` — closed body
  allowlist `{ grantId, planId, jobId, authorizationRef,
  expectedPreconditionDigest }`. No `results` array exists
  in the shape: the caller can never supply outcomes.

**What the range fix changed inside them:** the derivation's
precondition re-derivation — used by the preview AND by the
action's in-transaction re-derivation — previously selected
the grant's attempt rows with the §4.3.5 LIKE
(`` `op:${grantId}:%` ``). On the live build that selection
is a **prefix range scan** (`op_key >= ? AND op_key < ?`,
successor bound) via the shared helper
`worker/generation/prefix-range.mjs`; the same swap was
applied at the four coordinator LIKE sites (L2 `_voidDispatch`,
L3 `handleReport` sweep, L4 lease delivered branch, L5
repair-chain COUNT). Semantics, per the build record: exact
intended set on every input; L1 keeps `ORDER BY op_key`; the
one declared delta vs LIKE is case-sensitivity (LIKE is
ASCII case-insensitive absent a pragma; the BINARY range
scan is case-sensitive — production keys are machine-generated
lowercase, and the equivalence suite asserts the tighter set
openly on case-variant and metacharacter adversaries).

Inside **one** coordinator transaction, the action re-derives
every precondition from durable records (the §4.3 set, as
built and source-passed): identity and state; the exact
8-target ledger/outbox set; every target `ready` with its
execution `committed`; exactly 44 confirmed attempts in the
4/6/6/6/6/6/4/6 pattern; exactly 44 dispatch rows on PT
2026-10-31; claim exactly `claimed`; exactly the 8 expected
open reservations with stored `slots_consumed` equal to
attempt counts and residuals summing to exactly 52; derived
PT 2026-10-31 totals exactly 44 / 52 / 96; phase money and
watermarks exactly as §2.4; binding proof on `cache_key`
(§4.5); park-release live and no exemption row. Absence-safe
reads throughout.

If every precondition passes, the same transaction: inserts
exactly one audit row into `d6_grant_finalizations` carrying
the `authorizationRef` and precondition digest; marks the
grant `reported` with a labeled operator-finalization
`report_json` (never an impersonated executor report);
completes the claim (`claimed` → `completed`, verified);
settles the reservations via `settleReservationsForGrant`
and **requires** exactly the 8 expected ids in `closed` with
an empty `blocked` list; derives job completion and verifies
the job remains `generating` at the same revision; then
re-derives the state as exactly `already_finalized` with
money and attempt/dispatch counts unchanged, else the whole
transaction rolls back. Replay is audit-bound:
`already_finalized` with zero writes; `reported` without an
audit row is `already_reported_not_finalizer` and its
reservations are NOT silently settled; a partially closed
set STOPs as `reported_inconsistent`.

**Digest expectations, stated precisely.** The Fixture S
digest `00db68a8…f53674` (§0.2) is **test evidence only**: it
proves the patched and unpatched derivations agree on
identical seeded data. It is NOT a prediction of the live
preview's digest. The live digest is whatever E1 returns
against live data; it is recorded verbatim, bound into E3,
and verified at E4 (§6 item 14). No digest value is asserted
in advance for production.

---

## 4. Census specification — E0, fresh, complete, hard precondition

Retry execution begins with a fresh complete census, taken
in one window with no other authorized generation work
intervening, **before any action**. Every item below must
pass exactly. The census is the gate's evidence package: raw
captures are preserved under the execution record, as in
every prior gate in this chain. The census surfaces are the
attempt-1 §4 surfaces **plus** the deploy-gate census
surfaces (live-part byte verification against the operative
manifest; cf-api queue read-back).

### 4.1 Production identity, build, and HELD state

1. `/health`: build exactly
   **`1c2d1d0fa7ebb769f68cfb327fb9fde7d4d30867`**; generation
   **`halted`** (already held — not `enabled`); coordinator
   `armed`; scope `production`; ok `true`.
2. Live script parts byte-verified against the range-fix
   operative manifest (deploy envelope pin `1c2d1d0f…`,
   DEPLOY-RECORD pin `b986b562…`): **31/31 byte-identical,
   no extras**; etag recorded.
3. Bindings: exactly **10**; `GENERATION_HALT "1"`;
   `OPALREADER_PHASE_POLICY "enforce"`.
4. Observability enabled + persisted on both the `/settings`
   and `/script-settings` reads.
5. Settings revision **1**; capabilities: standard admitted,
   Batch `batch_not_armed`.
6. Queue (cf-api read-back — the only proof of pause state):
   `delivery_paused: true` **already**; sole consumer
   `f260f2188d80426bb0588685e9d084eb`; retention 86,400 s.

**Not-held rule (tightening vs attempt 1).** Items 1, 3, and
6 verify a held state that must already exist. If any of
them shows the system NOT held, that finding is reported
**as the observed state** and the gate **STOPs before any
action** — the executor does not flip the halt or pause the
queue under this gate to "restore" the expected starting
point, and does not certify anything about held state the
read-backs did not establish (the deploy Amendment 1 rule).
Remedy, if ever needed, is a separate ruling.

### 4.2 Plan / grant / job identity checks

7. Plan list exhaustive (`nextCursor: null`): exactly the 4
   known plans — Ch 3 `active`; fresh Ch 2 `complete`; old
   Ch 2 `retired`; smoke `complete`. No new plan.
8. Ch 3 plan exactly §2.2: `active`, totals 23 / 8 / 0 / 0 / 0.
9. Job exactly §2.2: `generating` rev 2; 8 `ready` / 15
   `pending`; exactly one grant for the job.
10. Grant exactly §2.2: `issued` rev 2.
11. Parked job exactly §2.5: `parked_policy` rev 1,
    fingerprint recomputed and exact; park-release row 1
    `live`; zero exemption rows.
12. Eligibility exactly §2.4: 15 / 11 / 1, digest exact,
    20,864 chars, expected 294,137.
13. Phase accounting exactly §2.4 on both read surfaces
    (capabilities + operator diagnostics), incl. unknownOpen 0.
14. Sync watermarks exactly 1826 / 18.

### 4.3 Quota checks

15. Fresh quota reconcile (operator, complete paginated
    census — the authenticated read-only census call the
    deploy Amendment 1 expressly permits): `ok: true`, drift
    **empty**, `censusComplete: true`, guard **armed**,
    `currentDayBlocked: false`.
16. **Sole exception:** the known adjudicated straddler
    `att-37d63768-db4b-447d-8150-580b7c6ee257`
    (`estimated_unverified`, spanning PT 2026-10-29 /
    2026-10-30) — permanent, never dispositionable. Any
    second exception is a STOP.
17. Historical PT days fixed: 2026-10-29 = dispatched 57 /
    reserved 0 / consumed 57; 2026-10-30 = 79 / 0 / 79;
    **2026-10-31 = dispatched 44 / reserved 52 / consumed 96**
    — including the 52 reserved slots, which stay attributed
    to 2026-10-31 permanently.
18. The census day's own PT totals are read fresh and stated
    as observed (new facts, not expectations). A PT-day
    rollover does **not** clear the issued grant or its
    reservations. Fresh headroom on a new day is never
    evidence the stall cleared.

### 4.4 Conflicts rule — exact match against the Gate 2D approved baseline

Carried from the amended attempt-1 contract (§4.4, per
Rowan's ruling, board 6559124784) **unchanged**: a signature
match alone NEVER clears a changed conflict set under this
gate.

> At census time, fetch the **complete** conflict set from
> `GET /v2/conflicts` and compare it **row-by-row** against
> the four individually enumerated rows of the Gate 2D
> approved baseline (pin
> `9284f5efee47cd87b2c5639e9dfe50e6fb7e908a`, `BASELINE.md`),
> reproduced verbatim in §4.4.1 below. The census passes
> **only** on an exact match: same four rows, same ids, same
> timestamps, same occurrence ids, same field values. **ANY
> addition, deletion, or field change — in count, id,
> timestamp, occurrence, or any field — is a STOP before
> any action.** On such a STOP, the complete new census is
> pinned and returned to Rowan for a specific baseline
> ruling; **only a separately reviewed replacement baseline
> may be used** for a later attempt. No executor judgment
> call, and no "matching signature" exemption for a fifth or
> changed row, can clear a changed set.

#### 4.4.1 The approved baseline — the four rows, verbatim

Verified firsthand against `BASELINE.md` (pin `9284f5ef`)
and re-verified at the attempt-1 census, at Stage 1 (D2 and
D6), and at the range-fix deploy census (D0 item 4) — exact
match at every read. All four rows carry `cache_key`
`lease`, `expected` `7`, `found` "LIKE or GLOB pattern too
complex: SQLITE_ERROR", `reason` `schedule_dead`:

| id | at (ISO, UTC) | occurrence_id |
|---:|---|---|
| 1 | 2026-10-29T23:54:14.808Z | `grant:plan:3183ecbf2ac4bf50bbc6166e:seg:1:full` |
| 2 | 2026-10-30T00:24:14.632Z | `grant:plan:603ab416bd67ab1b25de97be:ch1:1:full` |
| 3 | 2026-10-31T05:14:24.089Z | `grant:plan:b2dc2a3d1cd367a0245b9102:ch1:1:full` |
| 4 | 2026-11-01T01:04:30.364Z | `grant:plan:e377a5559961b294154276b6:ch2:1:full` |

Row 4 is the stalled grant's own lease row. Note, stated
plainly because the fix is now live: rows 1–4 record throws
of the retired LIKE construction in the coordinator's lease
path (L4). On the current build that path runs the range
scan; the rows remain as historical records — this gate does
not clear, edit, or reinterpret them, and their continued
exact presence is the census expectation. The set is
additionally re-fetched at E2 (§5, immediately before the
action) and in the E4 readbacks (§6) — each time compared
against this same baseline, under §5/§7.

### 4.5 Bindings check

19. For each of the 8 committed occurrences in §2.3, read its
    production binding via the sync/bindings surfaces
    (structural metadata only — IDs, keys, digests; **never
    segment text**) and confirm **revision_key == cache_key**
    on all 8. Any of the 8 missing, or with revision_key ≠
    cache_key, is a STOP.

### 4.6 Preview expectations (checked at E1, §5)

20. The preview must return HTTP 200, classify the grant
    `finalizable`, and return a precondition digest; every
    preview field is checked against the census expectations
    (§2, §4.2–§4.5): identity, states, revisions, claim
    `claimed`, outbox acked, the exact 8 targets with
    committed executions and the 4/6/6/6/6/6/4/6 attempt
    pattern, the exact 8 open reservations with residuals
    summing to 52, derived totals 44 / 52 / 96 for PT
    2026-10-31, phase money §2.4, watermarks 1826 / 18,
    park-release live, no exemption. Any mismatch is a STOP
    before the action call.

---

## 5. Execution sequence (proposed — NOT executed by this filing)

Executed in order, exactly once each, only under Julie's
Gate 3 retry GO recorded on the board **before** any step.
The GO comment id becomes the finalizer's
`authorizationRef`.

- **E0 — Fresh census.** §4 in full, read-only. Any failure:
  STOP before any action (§7). Zero mutations so far.
- **E0.5 — Verify-held confirmation (read-only).** Re-confirm
  from the E0 read-backs themselves: `GENERATION_HALT "1"`,
  /health generation `halted`, queue `delivery_paused:
  true`. This step performs **no mutation** — it replaces
  attempt 1's E1/E2 hold mutations, which are unnecessary
  because the system has been continuously held since
  attempt 1's containment and the deploy's ENDS HELD
  certification. A not-held finding here is governed by
  §4.1's not-held rule: STOP, report the observed state.
- **E1 — ONE valid preview.** One operator
  `GET /v2/d6-grant-finalization-preview` for the exact grant
  of §2.2 (the same parameterized call attempt 1 made:
  grantId / planId / jobId of §2.2, scope/instance headers,
  operator connector). Checked per §4.6. The preview is
  read-only; it writes nothing. **Exactly one preview call
  exists in this gate.** Outcomes:
  - **HTTP 200 + classification `finalizable` + digest
    present + every field matches the census** → proceed to
    E2. What this proves, and only this: the finalizer
    derivation **completed on the fixed build against live
    production data** and found every precondition satisfied.
    It does not prove the mechanism of attempt 1's 500 (§9).
  - **Any non-200 response (including any 500), a missing
    digest, a non-`finalizable` classification, or any field
    mismatch** → **STOP.** Stay held, record the response
    verbatim, no E2, no E3, **no second preview**. The GO is
    consumed; any further attempt requires a fresh ruling /
    GO under §7.
- **E2 — Pre-action conflict re-check (read-only; the
  attempt-1 E3.5 equivalent).** Immediately before E3, and
  after the E1 preview: re-fetch the **entire** conflict set
  (`GET /v2/conflicts`) and compare it against the approved
  baseline (§4.4.1). **Any difference — addition, deletion,
  or field change — means STOP without calling the
  finalizer.** Preserve the held state and report under §7;
  the only remedy is a pinned new census + Rowan baseline
  ruling, per §4.4.
- **E3 — ONE finalizer action (mutation 1 of 1).** One
  operator `POST /v2/d6-finalize-grant` with the closed body:
  the exact `grantId` / `planId` / `jobId` of §2.2,
  `authorizationRef` = Julie's Gate 3 retry GO comment id,
  and `expectedPreconditionDigest` = the E1 preview digest.
  No second call under this GO for any reason except the
  readback-first replay rule in §7. **Expected outcomes,
  enumerated in advance** (§5.3) — expectations derived from
  the finalizer design, to be verified at E4, not assumed.
- **E4 — Full readbacks.** §6 in full, still held. A
  post-action conflict mismatch discovered in E4 requires
  **containment and reporting** (§8): the system stays held
  and the mismatch is reported verbatim to Julie and Rowan —
  it **cannot retroactively stop the action already
  performed** in E3, and it authorizes no fix-forward,
  rollback, or further mutation under this GO.
- **End state: STAY HELD.** Generation halted, queue paused,
  finalizer audit row present exactly once, grant `reported`.
  This gate does not re-arm, does not unpause, and does not
  resume anything. Re-arm and Gate 4 are separate later
  decisions on separate GOs.

**Mutation budget: exactly 1** (the E3 finalizer action).
The census, verify-held, preview, E2 re-check, and all
readback reads are not mutations. No halt flip and no queue
pause are budgeted, because both protections are already in
place and are verified, not applied (§4.1, E0.5). **Spend:
$0.**

### 5.0 Containment re-holds (pre-authorized, narrow)

The single exception to the budget: if — contrary to every
expectation, since no step in §5 un-holds anything — a step
of this gate were observed to have un-held the system (halt
no longer `"1"`, or queue no longer paused), the executor is
pre-authorized to restore **exactly** the two protections
(halt flip via the settings-only multipart PATCH to
`/settings`; queue pause via the queue PUT) as containment,
and to STOP and report. This is containment only: it
authorizes no other act, it is not a license to proceed past
a not-held census finding (§4.1), and any use of it is
reported as a deviation-class event in the execution record.

### 5.3 E3 expected outcomes — enumerated in advance

Flagged once, for the whole list: these are **design-derived
expectations** (attempt-1 contract §3/§7; finalizer
specification as built and source-passed; build record §2.1
Part D, where the patched action on Fixture S returned
`outcome: "applied"` and the post-state classified
`already_finalized`). They are the E4 verification targets,
not facts about production.

1. Action response outcome: **`applied`** — any other
   outcome is handled under §7 (including the
   readback-first ambiguous-response rule).
2. Grant: `issued` → **`reported`**, with `report_json` the
   labeled operator-finalization record carrying the retry
   GO `authorizationRef` and the E1 precondition digest.
3. Claim: `claimed` → **`completed`**.
4. Reservations: exactly the 8 §2.3 rows **closed**,
   `close_reason` `grant_settled`, `blocked` list empty;
   stored `slots_consumed` unchanged (4/6/6/6/6/6/4/6).
5. Derived PT totals for 2026-10-31: dispatched **44** /
   reserved **0** / consumed **44** (from 44 / 52 / 96).
   The 44 dispatches remain counted permanently.
6. Phase accounting: **no movement** — settled 732,303;
   estimatedUnverified 19,018; **reservedUnverified 5,648 →
   5,648**; unknownOpen 0; remaining 12,762,049 (§2.4).
7. Plan: remains **`active`**, totals 23 / 8 / 0 / 0 / 0.
   Finalization closes the grant; it does **not** generate,
   grant, or otherwise advance the remaining 15 occurrences
   — Gate 4's precondition (no grant reading `issued`) is
   what changes, nothing else.
8. Job: remains `generating` rev 2; occurrences 8 `ready` /
   15 `pending`.
9. Audit: exactly one row in `d6_grant_finalizations` for
   this grant (§6 item 14).
10. Attempts / dispatches: exactly 44 / 44, untouched; no
    new attempt, dispatch, or provider contact of any kind.
11. Watermarks 1826 / 18 unchanged; conflicts exactly the
    §4.4.1 baseline; park release live; zero exemptions.

---

## 6. Readback checklist (E4 — all required, still held)

1. Grant: `reported`; `report_json` is the labeled
   operator-finalization record carrying the Gate 3 retry
   `authorizationRef` and the E1 precondition digest.
2. Claim: `completed`.
3. Reservations: read back **each of the 8 rows
   individually** — all `closed`, `close_reason`
   `grant_settled`, `day_key` 2026-10-31, stored
   `slots_consumed` unchanged (4/6/6/6/6/6/4/6).
4. Derived PT totals: 2026-10-31 = dispatched 44 / reserved
   0 / consumed 44; the census day's totals recorded
   explicitly as observed.
5. Quota reconcile: complete, `ok: true`, drift empty, sole
   straddler exception only.
6. Attempts / dispatches: exactly 44 confirmed attempts and
   44 dispatch rows, untouched; no new attempt or dispatch.
7. Plan: `active`, done 8 / failed 0 / blocked 0 / prompts 0.
8. Job: `generating` rev 2; occurrences 8 `ready` / 15
   `pending`.
9. Eligibility: unchanged 15 / 11 / 1, digest
   `9453ab5dc7ee…` exact.
10. Phase: settled 732,303; estimatedUnverified 19,018;
    reservedUnverified 5,648; unknownOpen 0; remaining
    12,762,049 — all unchanged.
11. Sync watermarks: bindings 1826 / content 18, unchanged.
12. Conflicts: exactly the approved-baseline set (§4.4.1).
    Any post-action mismatch discovered here requires
    containment and reporting (§8) — the system stays held
    and the mismatch is reported verbatim to Julie and Rowan
    in the execution record before anything else proceeds;
    it cannot retroactively stop the action already
    performed, and it authorizes no fix-forward, rollback,
    or further mutation under this GO.
13. Park release / exemption: releaseId 1 `live`; zero
    exemption rows; parked job fingerprint exact.
14. Finalizer audit row: present exactly once in
    `d6_grant_finalizations`, and verified field-by-field:
    (a) its **exact grant identity** is
    `grant:plan:e377a5559961b294154276b6:ch2:1:full` (§2.2) —
    no other grant, no paraphrase; (b) its recorded
    **authorizationRef is Julie's Gate 3 retry GO** — the
    exact GO comment id under which E3 ran; (c) it carries
    the **E1 preview precondition digest** — the digest
    returned by E1 and passed to E3 as
    `expectedPreconditionDigest`. **Digest distinction
    (attempt-1 §7.14, carried):** the E1 preview
    precondition digest must be distinguished from any
    census evidence digest if they are not identical — the
    readback record names the digests separately (preview
    precondition digest; retry census evidence digest, if
    one was computed) and never conflates them, and item 1's
    `report_json` digest reference is checked against the
    preview precondition digest named here. (For the record:
    attempt 1 produced a census evidence digest,
    `bef72c47…6b19`, and **no** preview precondition digest —
    the preview errored. Any digest appearing in this
    retry's record is labeled by which step produced it.)
    Any audit-row field that differs — wrong grant, wrong
    or absent authorizationRef, wrong or conflated digest —
    is a STOP-class readback failure under §7 (containment
    + reporting, §8; the performed action is not
    retroactively undone).
15. Hold state: `GENERATION_HALT "1"`, queue
    `delivery_paused: true`, build still
    **`1c2d1d0fa7ebb769f68cfb327fb9fde7d4d30867`**, script
    parts still 31/31 byte-identical to the operative
    manifest, observability enabled + persisted, Batch
    still unarmed.

---

## 7. Stop conditions — executor STOP law

The standing STOP law governs every step: **any census,
preview, or readback mismatch — even by one row, one slot,
or one revision — is a STOP before the next action.**
Preserve the state exactly as found (held throughout this
gate); report the exact deviation verbatim, separately from
any proposed explanation, to Julie and Rowan; proceed only
on a fresh explicit GO or a Rowan ruling naming that
deviation. An executor's own tracing never clears its own
stop, and a post-hoc acceptance does not retroactively
authorize having proceeded. One GO covers one attempt: a
stopped attempt is never restarted on anyone's
interpretation. **No executor-cleared exemptions exist under
this gate, for any item.**

Specific STOPs (non-exhaustive):

- Any §4 census item differs from its stated expectation,
  including the conflicts rule (§4.4), the bindings rule
  (§4.5), and the held-state rule (§4.1).
- Reconcile not `ok: true`, any drift entry, any exception
  beyond the sole straddler, or `currentDayBlocked: true`.
- E1 returns any non-200, no digest, a non-`finalizable`
  classification, or any field disagreement with the census
  (§4.6) — STOP with **no second preview** and no E3.
- E2 conflict re-check differs from §4.4.1 in any field —
  STOP with no E3.
- The action response is ambiguous, malformed, reports any
  `blocked` settlement, or returns any outcome other than
  `applied` (a verified `already_finalized` replay outcome
  is handled only under the paragraph below).
- Any §6 readback figure differs from its expectation (§5.3).
- Any provider dispatch, binding change, phase-settled
  change, new grant, new plan, exemption write, or Phase B
  state change appears at any point.
- Unknown open becomes nonzero; a TerminalBlock or plan
  `partial` appears.

**Ambiguous action response:** read back first, before any
further act. The finalizer is idempotent by audit-bound
state recognition (§3), so a *verified* readback showing the
exact §6 after-state proves the call landed. If the readback
shows the grant still `issued` with no audit row, the call
did not land — that fact is reported and a second invocation
requires a fresh explicit ruling under the STOP law; it is
never a blind retry. If the readback shows `reported` with
any reservation still open, that is
`reported_inconsistent` — a STOP state the finalizer cannot
produce; it is never settled silently on a replay path.

**No substitute route.** If the finalizer action fails or is
refused, this gate does not fall back to the generic
`/v2/reports` route (recovery proposal Option C, not
recommended: wrong fence class, no in-transaction
precondition proof, no audit row), to plan retirement, to
grant voiding, or to any other mechanism under the same GO.

---

## 8. Containment, one-way nature, and rollback position

**Containment is staying held.** This gate starts held and
ends held, so containment on any STOP, ambiguity, or
unexpected post-action state is simply: keep the halt and
the queue pause exactly as they are (§5.0 covers the
contrary-to-expectation case); preserve the census captures,
the preview response, the action request/response, the audit
row, and every readback; do not roll back code or data; do
not fix forward, retry, release, retire, or void under the
same GO; report to Julie and Rowan with the exact divergent
figures. Releasing the hold after a stopped or divergent
retry requires a separate explicit ruling — nobody un-halts
or unpauses on their own authority as "tidying up".

**Finalization is a one-way state change.** A successful E3
is truthful terminal bookkeeping for work already done and
already paid for in quota slots: there is **no data rollback
for it** and no compensating write is authorized by this
gate. If E3 returns an unexpected result mid-action, the
in-transaction design is the first containment: any failed
postcondition rolls the whole transaction back (§3), leaving
either the exact §2 pre-state or the exact §5.3 after-state —
never a designed partial state. The executor's response to
any unexpected E3 result is therefore: **read-backs first**
(§6, plus the §7 ambiguous-response rule), preserve
everything, report verbatim, and STOP. Any state the
read-backs show that is neither the pre-state nor the
after-state (e.g. `reported_inconsistent`) is a STOP state
for a future ruling — it is never repaired by a compensating
write without a new gate. A later-proved error in a completed
finalization would likewise be remedied by a forward
correction under a new ruling, never by reopening the grant
or its reservations.

**Rollback floor note:** the permanent floor build
`6a73d9622e1b4eac00c58e289de1c674ed6b3d6b` does not enforce
the provider-attempt counter and is never a fallback for
this gate. No code change of any kind is part of this gate,
so no code rollback question arises under it.

---

## 9. Honest evidence — what success proves, and what it does not

If this retry completes with all §6 readbacks passing, it
proves exactly:

- the finalizer derivation **completes on the fixed build
  against live production data** (E1 HTTP 200,
  `finalizable`, digest returned);
- the stalled grant is **closable on the fixed build**: one
  digest-bound action closed it, released exactly its 8
  reservations (52 slots), completed the claim, and wrote
  exactly one audit row bound to Julie's GO;
- the **Gate 4 precondition is met** — no grant reads
  `issued` for the Chapter 3 job — so the remaining 15
  segments can be proposed under Gate 4's own gate;
- phase money, attempts, dispatches, bindings, watermarks,
  and the conflicts baseline are **unchanged** by the
  closure.

It does **not** prove:

- **H1's mechanism.** H1 remains what the diagnosis left it:
  SUPPORTED, NOT proven. A successful E1 is consistent with
  H1 (the retired construction is gone from the path) and
  equally consistent with any hypothesis under which the
  original throw was specific to the retired construction
  family or its interaction with the old code path. The
  retry is an operative act, not a root-cause experiment
  (§0.4), and its outcome must not be written anywhere as
  "the LIKE caused the 500."
- **That the original 500 could not recur elsewhere.** What
  can be stated is a code fact about the live build, from
  the build record's grep proof: **zero SQL LIKE/GLOB sites
  remain in `worker/`** — the specific construction family
  production has thrown on (four recorded lease-path throws
  + attempt 1's preview 500, same error string) no longer
  exists anywhere in the tree. That is a fact about the
  code, not a guarantee about the engine, and not a claim
  that no other failure mode exists.
- Anything about Gate 4's execution, Phase B, or Batch —
  each remains separately gated on its own evidence.

---

## 10. Authorization boundaries

- **This proposal** asks Rowan for review only. It asks
  Julie for nothing now and authorizes no production act.
  Preparing and filing it involved no production contact.
- **Rowan's review** of this proposal is technical. A PASS
  is not execution permission and does not substitute for
  Julie's GO.
- **Julie's Gate 3 retry GO** — given after Rowan's review,
  via tappable buttons, recorded on the board before any
  step — is the sole execution authorization. It covers
  exactly one attempt at §5 as written, under the §7 STOP
  law, and does not survive a STOP. The GO comment id is the
  E3 `authorizationRef`.
- **Gate 4** (continuation of the 15: 20,864 chars, expected
  ≈ $0.294 recorded against the phase's remaining
  12,762,049; same-day first cohort is exactly 4 by the
  proven formula — the [4, 4, 4, 3] succession is derivation
  only, not a tested forecast) requires Julie's separate GO
  after this gate's readbacks, plus a separate re-arm
  decision, since this gate ends held.
- **Phase B, Batch, rest-of-book generation:** untouched by
  this gate and by any retry GO; each is its own gated
  program.

### Evidence index (repo `jedavid33-design/opal-reader`, branch `ui1-review`, unless noted)

- Gate 3 attempt-1 proposal, as amended (template):
  `1610a314d66d363a48361f9a1497e3418eaa216d` (base:
  `7c71deef64d132b4492b9dfa99477efe72d0dea2`)
- Gate 3 attempt-1 execution record (STOPPED AT E3):
  pin `b5fc3784`
- Gate 2D approved conflicts baseline:
  `9284f5efee47cd87b2c5639e9dfe50e6fb7e908a`
- Diagnosis proposal: pin `d581f5bd`; Amendment 1:
  `1e18269c24b91b8035fe9f8acc38ab696f9839ca`
- Stage 1 execution record:
  `b0446f7942ee831c6f5f3bf15709433a46ae7640`
- Remediation options analysis (Option B):
  `c3f58ad84c3a56216fc913bedd6d95bc95f1f48c`
- Range-fix build record:
  `d01c15ed732436223f0207e4d126a588150187af`
- Range-fix deploy proposal (as amended):
  `6d533dfea25034091084cb0629a049688301c823`
- Range-fix envelope / live build:
  `1c2d1d0fa7ebb769f68cfb327fb9fde7d4d30867`
- Range-fix deploy execution record:
  `b986b562f1824fec2c15810ee4ef023d42a4362f`
- Diagnosis + recovery proposal (finalizer design):
  `7781e7d7934a911cac612418395b5adac5c24656`
- New-thread handoff + state report:
  `60b836a32711a0d93ffcb39c43426f43756a3a68`
- Board (repo `jedavid33-design/opal-roundtable`, issue
  #15): Rowan STOP ruling on attempt 1: 6559354445 · Stage 1
  PASS: 6559766643 · Range-fix ANALYSIS PASS (recorded):
  6560003451 · SOURCE REVIEW PASS (recorded): 6560249061 ·
  FINAL PROPOSAL REVIEW PASS (deploy): 6560945443 · Deploy
  execution filing: 6561039589 · **Execution review PASS
  specifying this proposal: 6561225702** · New-thread
  handoff filing: 6561273039

**Turn: Rowan's** — review of this bounded Gate 3 retry
proposal, in particular: the re-pointed census (§4, held
state as verification), the single-preview discipline and
its stated inference limits (§0.4, §5 E1, §9), the
one-mutation budget (§5), the E2 pre-action re-check, the
enumerated E3 expectations (§5.3), and the §6 audit readback
with its digest distinction. Julie's Gate 3 retry decision
comes after that review.

— Wren
