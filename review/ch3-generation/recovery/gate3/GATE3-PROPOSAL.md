# GATE 3 PROPOSAL — Production grant finalization (bounded, for Rowan review)

Opal Roundtable (Julie + Rowan + Wren) — Case #10 / issue #15,
board repo `jedavid33-design/opal-roundtable`.
Review pins live in repo `jedavid33-design/opal-reader`, branch `ui1-review`.

**Status: PROPOSAL ONLY.** This document authorizes nothing. It
requests Rowan's review of a bounded Gate 3 execution shape.
Julie's explicit Gate 3 execution GO is a separate later step,
after Rowan's review of this proposal. Julie is not being asked
to approve execution by this filing.

**Production contact by this proposal: NONE.** No finalizer
invocation — not even the read-only preview — is made against
production in preparing or filing this proposal. No halt flip,
no queue pause, no generation, no spend.

**Turn after this filing:** Rowan's review. Then Julie's Gate 3
GO / HOLD decision.

---

## 0. Why this gate exists

Chapter 3 Phase A (Julie GO 6550733265; record pin
`f865a002f2740bb499716acf4a2c4d342187c3cd`) generated and
committed 8 of 23 segments cleanly, then stalled permanently on
shipped automatic code: cohort 1's grant was never reported, so
the grant remains `issued`, its 8 quota reservations remain
open, and the plan driver refuses a second grant while any grant
reads `issued`.

Rowan confirmed the stall and held repair (board 6551290568):
no blind grant closure, reservation release, plan retirement,
re-submit, new grant, quota bypass, or Phase B.

Diagnosis + recovery proposal (pin
`7781e7d7934a911cac612418395b5adac5c24656`) proved the stall
mechanism and designed Option A: a dedicated operator-only
grant finalizer that re-derives every precondition inside one
transaction, then truthfully marks the grant `reported`,
completes the claim, and closes exactly its 8 reservations as
`grant_settled` — changing no attempts, bindings, or phase
money. Rowan gave diagnosis PASS and design CONDITIONAL PASS
with six acceptance checks (board 6551435961).

Gate 2 built Option A repo-only (pins
`c24bd4716d2ae386fcefd31a97b4a202968671a0`,
`4b1d2bd8b06bc7030166ff1eb7d025ff8a9fba61`; Rowan source PASS
FOR GATE 2D DECISION, board 6552121744).

Gate 2D retry deployed that build halted and re-armed it
(envelope / live build pin
`408f91497131a151a199b3f9ec4cbb283a8febd5`; baseline + plan pin
`9284f5efee47cd87b2c5639e9dfe50e6fb7e908a`; execution record pin
`b1d2cedcc41349f2921557c1693d229e277d794e`; filed 6553030386).
The finalizer is live and dormant — never invoked with
credentials. Rowan's documentary review of the retry (board
6558972153, 2026-11-01T14:01:47Z) is a PASS for recorded
procedure consistency, NOT an independent production
attestation, and it holds Gate 3 until a separate Gate 3
proposal + fresh pre-action census + Julie's explicit approval.
This document is that proposal.

---

## 1. Scope

### 1.1 In scope — exactly one act

Under a future Julie Gate 3 GO, execute **exactly one**
operator finalization of **exactly one** grant:

- One `GET /v2/d6-grant-finalization-preview` (operator,
  read-only) checked against the gate's fresh census.
- One `POST /v2/d6-finalize-grant` (operator) bound to the
  exact identity in §2 and to Julie's Gate 3 GO as the
  authorization reference.
- The hold, census, preview check, readbacks, and stay-held
  end state defined in §4–§7.

Finalization is bookkeeping only. It makes no provider call,
submits nothing, wakes no generation, and moves no money.
**Spend: $0.**

### 1.2 What Gate 3 does NOT do

Gate 3 does **not**:

- generate any segment or make any provider call;
- issue any new grant, submit any new plan or job, or resume
  the stalled plan;
- re-arm the system — Gate 3 ends **held** (halted + paused);
  re-arm is a separate later decision;
- continue the remaining 15 segments (that is Gate 4, Julie's
  separate GO after Gate 3 readbacks);
- perform or touch Phase B (the idx-26 exemption path);
- arm or touch Batch;
- move phase money in any figure (see §2.4);
- touch the parked Chapter 3 job, the park-release row, any
  exemption row, any other book, chapter, plan, job, or grant;
- clear, edit, or delete any conflicts row;
- roll back code or data;
- authorize Gate 4, Phase B, Batch, rest-of-Forever-Pucked
  generation, any quarantine release, or any spending — each
  remains its own separate Julie decision.

The app's Generate button stays untouched by anyone for the
duration of Gate 3. Because the system is currently
live-but-idle with generation enabled, Gate 3's first
production moves are the halt flip and queue pause (§5), and
the system stays held afterward so the button is not live
again until a separate re-arm decision.

---

## 2. Identity binding — the exact subject

Every census read, the preview, and the single action call are
bound to these identities and no others. Any read that returns
a different identity is a STOP (§6).

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
14 `policy_block`, 0 failed, 0 unknown). Each occurrence holds
exactly one open reservation,
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

Closing these 8 reservations as `grant_settled` is settlement
of spent work, not a quota bypass: the 44 dispatch rows remain
counted on PT 2026-10-31 forever, no `slots_consumed` value
changes, and no new slots are granted retroactively. Only the
52 unused worst-case slots stop being held open for a grant
that can no longer dispatch (recovery proposal §2.3).

### 2.4 Money — must NOT change

Phase `forever-pucked` accounting, before and after
finalization, identically:

| Figure | Value |
|---|---:|
| Budget | 13,500,000 |
| Settled | **732,303** |
| Estimated unverified | 19,018 |
| Reserved unverified | 5,648 |
| Unknown open | 0 |
| Remaining | 12,762,049 |

Settings revision **1** (monthlyCap 50, lane `standard`).
Sync watermarks: bindings **1826** / content **18**.
Eligibility for the remaining work (context, not a Gate 3
mutation): 15 eligible / 11 bound_already / 1 parked; 20,864
chars; expected 294,137; digest
`9453ab5dc7ee6ade7c650d14066054b965875f2ef1b65eb24bc633588d778e67`.

### 2.5 Parked job — untouched by design

Parked job
`1832c21fcf0425454227c4736048a8a632f422abca4a2685ddb775bb1681406a`:
state `parked_policy`, revision 1, fingerprint
`b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`.
Park-release row: releaseId 1, `live` (the 23 ids, idx 3–25).
Chapter exemptions: zero rows, zero writes, ever, in this gate.

### 2.6 Live build at proposal time

Worker `opalreader-api-v2-prod`, build
`408f91497131a151a199b3f9ec4cbb283a8febd5` (the Gate 2D retry
envelope pin; script 1,430,356 B, 30 parts). `GENERATION_HALT
"0"` — generation enabled, coordinator armed; queue
`opalreader-generation-v2`
(`93b6a35fb8cf4788a91a2c90b748ae66`) delivery **unpaused**,
sole consumer `f260f2188d80426bb0588685e9d084eb`;
observability enabled + persisted; 10 bindings. Gate 3's
census (§4) re-reads all of this fresh; this section is
context, not a substitute for the census.

---

## 3. The finalizer — what the single call does

The live finalizer (Gate 2 build; `grant-finalizer.mjs`,
830 lines) exposes two operator-fenced surfaces, fenced at
both the public entry and the Durable Object class gate
(dedicated migration-operator credential +
`x-opalreader-operator-admitted` stamp re-check;
credential-less calls refuse 403
`migration_operator_required`, probe-proven at Gate 2D):

- Preview: `GET /v2/d6-grant-finalization-preview` —
  read-only; does not bootstrap its audit table.
- Action: `POST /v2/d6-finalize-grant` — closed body allowlist
  `{ grantId, planId, jobId, authorizationRef,
  expectedPreconditionDigest }`. No `results` array exists in
  the shape: the caller can never supply outcomes.

Inside **one** coordinator transaction, the action re-derives
every precondition from durable records (the recovery
proposal §4.3 set, as built and source-passed): identity and
state; the exact 8-target ledger/outbox set; every target
`ready` with its execution `committed`; exactly 44 confirmed
attempts in the 4/6/6/6/6/6/4/6 pattern; exactly 44 dispatch
rows on PT 2026-10-31; claim exactly `claimed`; exactly the 8
expected open reservations with stored `slots_consumed` equal
to attempt counts and residuals summing to exactly 52; derived
PT 2026-10-31 totals exactly 44 / 52 / 96; phase money and
watermarks exactly as §2.4; binding proof on `cache_key`
(§4.5); park-release live and no exemption row. Absence-safe
reads throughout (throwing `.one()` semantics respected).

If every precondition passes, the same transaction: inserts
exactly one audit row into `d6_grant_finalizations` carrying
the `authorizationRef` and precondition digest; marks the
grant `reported` with a labeled operator-finalization
`report_json` (never an impersonated executor report);
completes the claim (`claimed` → `completed`, verified);
settles the reservations via `settleReservationsForGrant` and
**requires** the result to be exactly the 8 expected ids in
`closed` with an empty `blocked` list — stricter than generic
`handleReport`; derives job completion and verifies the job
remains `generating` at the same revision; then re-derives
the state as exactly `already_finalized` with money and
attempt/dispatch counts unchanged, else the whole transaction
rolls back. Replay is audit-bound: `already_finalized` with
zero writes; `reported` without an audit row is
`already_reported_not_finalizer` and its reservations are NOT
silently settled; a partially closed set STOPs as
`reported_inconsistent`.

---

## 4. Census specification — fresh, complete, hard precondition

Gate 3 execution begins with a fresh complete census, taken in
one window with no other authorized generation work
intervening, **before any mutation**. Every item below must
pass exactly. The census is the gate's evidence package:
raw captures are preserved under the execution record, as in
every prior gate in this chain.

### 4.1 Production identity and build

1. `/health`: build exactly
   `408f91497131a151a199b3f9ec4cbb283a8febd5`; generation
   `enabled` (pre-hold); coordinator `armed`; scope
   `production`; ok `true`.
2. Live script parts byte-verified against the Gate 2D retry
   operative manifest: **30/30 byte-identical, no extras**;
   etag recorded.
3. Bindings: exactly **10**; `GENERATION_HALT "0"`;
   `OPALREADER_PHASE_POLICY "enforce"`.
4. Observability enabled + persisted on both the `/settings`
   and `/script-settings` reads.
5. Settings revision **1**; capabilities: standard admitted,
   Batch `batch_not_armed`.

### 4.2 Plan / grant / job identity checks

6. Plan list exhaustive (`nextCursor: null`): exactly the 4
   known plans — Ch 3 `active`; fresh Ch 2 `complete`; old
   Ch 2 `retired`; smoke `complete`. No new plan.
7. Ch 3 plan exactly §2.2: `active`, totals 23 / 8 / 0 / 0 / 0.
8. Job exactly §2.2: `generating` rev 2; 8 `ready` / 15
   `pending`; exactly one grant for the job.
9. Grant exactly §2.2: `issued` rev 2.
10. Parked job exactly §2.5: `parked_policy` rev 1, fingerprint
    recomputed and exact; park-release row 1 `live`; zero
    exemption rows.
11. Eligibility exactly §2.4: 15 / 11 / 1, digest exact,
    20,864 chars, expected 294,137.
12. Phase accounting exactly §2.4 on both read surfaces
    (capabilities + operator diagnostics), incl. unknownOpen 0.
13. Sync watermarks exactly 1826 / 18.
14. Queue exactly §2.6: unpaused at census start, sole
    consumer `f260f2188d80426bb0588685e9d084eb`.

### 4.3 Quota checks

15. Fresh quota reconcile (operator, complete paginated
    census): `ok: true`, drift **empty**, `censusComplete:
    true`, guard **armed**, `currentDayBlocked: false`.
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
    reservations — it only excludes the old reservations from
    a later day's derived total. Fresh headroom on a new day
    is never evidence the stall cleared.

### 4.4 Conflicts rule — the chosen rule, stated plainly

**This rule is flagged for Rowan's review. It was the one
paperwork point left open after the Gate 2D retry, and this
proposal chooses the conservative form:**

> At census time, fetch the **complete** conflict set from
> `GET /v2/conflicts`. That fresh complete enumeration
> **becomes Gate 3's baseline** for this gate. Every row in
> it must carry the known signature exactly: `cache_key`
> `lease`, `expected` `7`, `found` "LIKE or GLOB pattern too
> complex: SQLITE_ERROR", `reason` `schedule_dead`. Any row
> with any other field value is a **STOP before mutation**.
> The set is re-fetched after the hold is applied and again
> in the post-action readbacks (§7); **any additional,
> missing, or changed row — in count, id, timestamp, or any
> field — between the census baseline and either later read
> is a STOP before the next mutation.** The only remedy for
> a changed conflict set is a new baseline + Rowan review —
> never an executor judgment call, never a "matching
> signature" exemption for a row that was not in the census
> baseline.

Context for the choice: the Gate 2D retry baseline (pin
`9284f5ef`) enumerated exactly 4 `schedule_dead` lease rows —
id 1 @ 2026-10-29T23:54:14.808Z
(`grant:plan:3183ecbf2ac4bf50bbc6166e:seg:1:full`); id 2 @
2026-10-30T00:24:14.632Z
(`grant:plan:603ab416bd67ab1b25de97be:ch1:1:full`); id 3 @
2026-10-31T05:14:24.089Z
(`grant:plan:b2dc2a3d1cd367a0245b9102:ch1:1:full`); id 4 @
2026-11-01T01:04:30.364Z
(`grant:plan:e377a5559961b294154276b6:ch2:1:full`, the
stalled grant's own lease row). The retry census exact-matched
that set and the retry's D8 + watched windows held it at
exactly 4. But the underlying lease SQL quirk is **not
fixed**, and the grant remains `issued`, so accretion since
that baseline is genuinely possible. Gate 3 therefore does
**not** hard-code "exactly 4" as its expectation — a fresh
5th row appearing *before* the census would be absorbed into
the census baseline only if it carries the exact known
signature, and any movement *after* the census baseline is
frozen is a STOP. Rowan is asked to confirm or amend this
rule explicitly.

### 4.5 Bindings check (Gate 2 build-review addition)

19. For each of the 8 committed occurrences in §2.3, read its
    production binding via the sync/bindings surfaces
    (structural metadata only — IDs, keys, digests; **never
    segment text**) and confirm **revision_key == cache_key**
    on all 8. Rationale (Gate 2 build record §2, Amendment 1
    §5c): D6 commits bind under the payload fingerprint as
    revision key, which is the cache key; the finalizer's own
    proof matches on `cache_key` for the same reason. Any of
    the 8 bindings missing, or with revision_key ≠ cache_key,
    is a STOP.

### 4.6 Preview check (after the hold, §5 step E3)

20. The preview must classify the grant `finalizable` and
    return a precondition digest; every preview field is
    checked against the census expectations (§2, §4.2–§4.5):
    identity, states, revisions, claim `claimed`, outbox
    acked, the exact 8 targets with committed executions and
    the 4/6/6/6/6/6/4/6 attempt pattern, the exact 8 open
    reservations with residuals summing to 52, derived totals
    44 / 52 / 96 for PT 2026-10-31, phase money §2.4,
    watermarks 1826 / 18, park-release live, no exemption.
    Any mismatch is a STOP before the action call.

---

## 5. Execution sequence (proposed — NOT executed by this filing)

Executed in order, exactly once each, only under Julie's
Gate 3 GO recorded on the board **before** any step. The GO
comment id becomes the finalizer's `authorizationRef`.

- **E0 — Fresh census.** §4 in full, read-only. Any failure:
  STOP before any mutation (§6). Zero mutations so far.
- **E1 — Halt flip (mutation 1 of 3).** Set `GENERATION_HALT`
  to `"1"` via the settings-only multipart PATCH to
  `/workers/scripts/opalreader-api-v2-prod/settings` (single
  `settings` part). Verify: halt `"1"` read back; script etag
  **unchanged** (the flip must not touch code);
  observability still enabled + persisted. Re-fetch conflicts
  (§4.4 rule) — any change vs the census baseline: STOP,
  stay halted.
- **E2 — Queue pause (mutation 2 of 3).** PUT queue
  `93b6a35fb8cf4788a91a2c90b748ae66` with `delivery_paused:
  true`. Read back `delivery_paused: true` before proceeding
  (only the read-back proves the pause).
- **E3 — Preview.** One operator
  `GET /v2/d6-grant-finalization-preview` for the exact grant.
  Checked per §4.6. The preview is read-only; it writes
  nothing. Any mismatch: STOP, stay held, no action call.
- **E4 — ONE finalizer action (mutation 3 of 3).** One
  operator `POST /v2/d6-finalize-grant` with the closed body:
  the exact `grantId` / `planId` / `jobId` of §2.2,
  `authorizationRef` = Julie's Gate 3 GO comment id, and
  `expectedPreconditionDigest` = the E3 preview digest. No
  second call under this GO for any reason except the
  readback-first replay rule in §6.
- **E5 — Full readbacks.** §7 in full, still held.
- **End state: STAY HELD.** Generation halted, queue paused,
  finalizer audit row present exactly once, grant `reported`.
  Gate 3 does not re-arm, does not unpause, and does not
  resume anything. Re-arm and Gate 4 are separate later
  decisions on separate GOs.

**Mutation budget: exactly 3** (halt flip, queue pause, one
finalizer action). The preview and all census/readback reads
are not mutations. No other production mutation of any kind
is authorized by Gate 3. **Spend: $0.**

---

## 6. Stop conditions — executor STOP law

The standing STOP law governs every step: **any census,
preview, or readback mismatch — even by one row, one slot, or
one revision — is a STOP before the next mutation.** Preserve
the state exactly as found (halted + paused if already
reached); report the exact deviation verbatim, separately
from any proposed explanation, to Julie and Rowan; proceed
only on a fresh explicit GO or a Rowan ruling naming that
deviation. An executor's own tracing never clears its own
stop, and a post-hoc acceptance does not retroactively
authorize having proceeded. One GO covers one attempt: a
stopped attempt is never restarted on anyone's interpretation.

Specific STOPs (non-exhaustive):

- Any §4 census item differs from its stated expectation,
  including the conflicts rule (§4.4) and the bindings rule
  (§4.5).
- Reconcile not `ok: true`, any drift entry, any exception
  beyond the sole straddler, or `currentDayBlocked: true`.
- The preview does not classify `finalizable`, its digest is
  absent, or any preview field disagrees with the census.
- The action response is ambiguous, malformed, reports any
  `blocked` settlement, or returns any outcome other than
  `applied` (a verified `already_finalized` replay outcome is
  handled only under the paragraph below).
- Any §7 readback figure differs from its expectation.
- Any provider dispatch, binding change, phase-settled
  change, new grant, new plan, exemption write, or Phase B
  state change appears at any point.
- Unknown open becomes nonzero; a TerminalBlock or plan
  `partial` appears.

**Ambiguous action response:** read back first, before any
further act. The finalizer is idempotent by audit-bound state
recognition (§3), so a *verified* readback showing the exact
§7 after-state proves the call landed. If the readback shows
the grant still `issued` with no audit row, the call did not
land — that fact is reported and a second invocation requires
a fresh explicit ruling under the STOP law; it is never a
blind retry. If the readback shows `reported` with any
reservation still open, that is `reported_inconsistent` — a
STOP state the finalizer cannot produce; it is never settled
silently on a replay path.

**No substitute route.** If the finalizer action fails or is
refused, Gate 3 does not fall back to the generic
`/v2/reports` route (recovery proposal Option C, not
recommended: wrong fence class, no in-transaction precondition
proof, no audit row), to plan retirement, to grant voiding, or
to any other mechanism under the same GO.

---

## 7. Readback checklist (E5 — all required, still held)

1. Grant: `reported`; `report_json` is the labeled
   operator-finalization record carrying the Gate 3
   `authorizationRef` and the E3 precondition digest.
2. Claim: `completed`.
3. Reservations: read back **each of the 8 rows individually**
   — all `closed`, `close_reason` `grant_settled`, `day_key`
   2026-10-31, stored `slots_consumed` unchanged
   (4/6/6/6/6/6/4/6).
4. Derived PT totals: 2026-10-31 = dispatched 44 / reserved 0
   / consumed 44; the census day's totals recorded explicitly
   as observed.
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
12. Conflicts: exactly the census-baseline set (§4.4) — any
    change is reported verbatim to Julie and Rowan in the
    execution record before anything else proceeds.
13. Park release / exemption: releaseId 1 `live`; zero
    exemption rows; parked job fingerprint exact.
14. Finalizer audit row: present exactly once in
    `d6_grant_finalizations`, with the census precondition
    digest and Julie's Gate 3 GO as `authorizationRef`.
15. Hold state: `GENERATION_HALT "1"`, queue
    `delivery_paused: true`, build still
    `408f91497131a151a199b3f9ec4cbb283a8febd5`, observability
    enabled + persisted, Batch still unarmed.

---

## 8. Containment

Containment is pre-authorized inside Gate 3 only in this
form: Gate 3 already ends held, so containment is simply
**staying held**. On any STOP, ambiguity, or unexpected
post-action state: keep the halt and the queue pause exactly
as they are; preserve the census captures, the preview
response, the action request/response, the audit row, and
every readback; do not roll back code or data; do not fix
forward, retry, release, retire, or void under the same GO;
report to Julie and Rowan with the exact divergent figures.
Releasing the hold after a stopped or divergent Gate 3
requires a separate explicit ruling — nobody un-halts or
unpauses on their own authority as "tidying up".

Rollback floor note: the permanent floor build
`6a73d9622e1b4eac00c58e289de1c674ed6b3d6b` does not enforce the
provider-attempt counter and is never a Gate 3 fallback. A
successful finalization is truthful terminal bookkeeping;
there is no data rollback for it — a later-proved error would
be remedied by a forward correction under a new ruling,
never by reopening the grant or its reservations.

---

## 9. Authorization boundaries

- **This proposal** asks Rowan for review only. It asks Julie
  for nothing now and authorizes no production act.
- **Rowan's review** of this proposal is technical. A PASS is
  not execution permission and does not substitute for
  Julie's GO.
- **Julie's Gate 3 GO** — given after Rowan's review, via
  tappable buttons, recorded on the board before any step —
  is the sole execution authorization. It covers exactly one
  attempt at §5 as written, under the §6 STOP law, and does
  not survive a STOP.
- **Gate 4** (continuation of the 15: 20,864 chars, expected
  ≈ $0.294 recorded against the phase's remaining
  12,762,049; same-day first cohort is exactly 4 by the proven
  formula — the [4, 4, 4, 3] succession is derivation only,
  not a tested forecast) requires Julie's separate GO after
  Gate 3's readbacks, plus a separate re-arm decision, since
  Gate 3 ends held.
- **Phase B, Batch, rest-of-book generation:** untouched by
  Gate 3 and by any Gate 3 GO; each is its own gated program.

### Evidence index (all pinned, repo `jedavid33-design/opal-reader`, branch `ui1-review`)

- Diagnosis + recovery proposal: `7781e7d7934a911cac612418395b5adac5c24656`
- Phase A execution record: `f865a002f2740bb499716acf4a2c4d342187c3cd`
- Gate 2 build record: `c24bd4716d2ae386fcefd31a97b4a202968671a0`
- Gate 2 Amendment 1: `4b1d2bd8b06bc7030166ff1eb7d025ff8a9fba61`
- Gate 2D retry baseline + plan: `9284f5efee47cd87b2c5639e9dfe50e6fb7e908a`
- Gate 2D retry envelope (live build): `408f91497131a151a199b3f9ec4cbb283a8febd5`
- Gate 2D retry execution record: `b1d2cedcc41349f2921557c1693d229e277d794e`
- Rowan stall review: board 6551290568 · Diagnosis/design
  review: board 6551435961 · Gate 2D retry documentary review
  / Gate 3 HOLD: board 6558972153

**Turn: Rowan's** — review of this bounded Gate 3 proposal,
in particular the §4.4 conflicts rule, the §4 census
completeness against the finalizer's precondition set, and
the §5–§7 sequence, stop law, and readbacks. Julie's Gate 3
decision comes after that review.

— Wren
