# PHASE B — ATTEMPT 2 EXECUTION RECORD: STOP AT E0 CENSUS (eligibility digest figure deviates from the presentation's stated expectation)

**Outcome: STOP BEFORE ANY PRODUCTION MUTATION. The standing GO is
consumed. No exemption was granted, no SubmitJob was sent, nothing
was re-armed, unpaused, submitted, or generated.**

The recovery precondition was met and verified (Step 1 below): the
1101 Durable Object fault has cleared on production and staging.
The fresh E0 census then ran in full — every required read was
performable (§5.0 satisfied) — and **11 of the 12 census items pass
exactly**. Item 8 does not: its counts match exactly (chapter bound
26 / parked 1 / eligible 0 / voice_prompt 0; segment parked 1), but
the live eligibility **digest** is
`b4d824871f922e104392f3feb0152e2b201d8760a1753efc5f4ef09c1b7e00d2`,
not the `9453ab5d…` the final presentation's §5.1 item 8 states as
the expectation. Under the standing STOP law (§5: any census item
or hard-stop figure differing from the paperwork expectation —
even by one item, even if it looks like harmless known bookkeeping
— stops the gate before any mutation; the executor's own tracing
never clears its own stop), the gate stopped. The proposed
explanation is recorded in §3 for Julie's and Rowan's ruling; it
does not authorize proceeding, and nothing proceeded.

**Authorization.** Julie's CONDITIONAL STANDING GO, given in the
Coding Projects chat Nov 1, 2026, ~6:43 p.m. ET and recorded on the
board before any recovery: issue #15 comment **6565674664**,
Handoff ID `RT-H-20261101-c41f9a`, read back and verified. Its
preconditions: (1) VERIFIED DO recovery (full route matrix), and
(2) a fresh Phase B E0 census passing EVERY hard expectation; on
both passing, execute Phase B attempt 2 per the final presentation
(pin `10c728c8d54f6a3d09d83ea90ce9c425faddfaa4`, SHA-256
`e6e4f5b441748087f362cbb0f726c7e1f157d77d1d61b315ccc92f7b96044675`,
`jedavid33-design/opal-reader` @ `ui1-review`) without a further
GO; any census deviation = STOP and report; the GO covers exactly
one attempt. Precondition (1) was met; precondition (2) was not
(item 8's digest figure). No wake email sent (wakes suspended
since Oct 26, 2026). All times UTC, 2026-11-02, unless stated.
Raw evidence: `~/workspace/ch2-program/ch3-recovery/phaseb-attempt2/evidence/`.

---

## 1. Step 1 — recovery verification: the full fault-route matrix, re-run firsthand (00:37:26–00:37:48Z, plus two route probes immediately after)

The recovery watch's first success signal was 2026-11-02T00:31:08Z
(prod quota 200 + prod settings 200 + staging quota 200). Per the
standing rule, a pair of successful reads is not verified
recovery; the full matrix from `PROD-1101-DIAGNOSIS.md` §1 was
re-run from this executor context.

**Production — every route that returned 500 / `error code: 1101`
during the fault now answers HTTP 200 with its proper JSON body:**
`/health`; `/v2/generation/capabilities`; `/v2/settings`;
`/v2/quota`; `/v2/d6-plans`; `/v2/d6-plans/plan:e377a5559961b294154276b6`;
`/v2/jobs/plan:e377a5559961b294154276b6:ch2`;
`/v2/jobs/1832c21fcf0425454227c4736048a8a632f422abca4a2685ddb775bb1681406a`;
`/v2/conflicts`; chapter, segment, and book
`/v2/d6-eligibility`; `/v2/sync/snapshot?family=content`;
`/v2/sync/snapshot?family=bindings`;
`/v2/sync/changes?family=bindings&sinceSeq=1841`;
operator `/v2/d6-diagnostics` for the Gate 4 plan; operator
`/v2/d6-quota-reconcile` (base, `exceptionOffset=0&driftOffset=0`,
`exceptionOffset=1&driftOffset=0`, closing base — full pagination).
No 1101, no 500, no fault-shaped response on any production route.

**Route-shape note (stated exactly):** the diagnosis matrix listed
the short path `/v2/capabilities`. That path is not a registered
route: it now returns the app's own JSON **404
`route_not_found`** on production — i.e., the request is processed
end-to-end and answered normally, the opposite of the fault shape.
The live capabilities surface is `/v2/generation/capabilities`
(200, full body), the path every gate since Gate 3 has used.

**Staging (different, older build `2fe71b5f3194f0c022a5959f1206c57e7a3240f2`):**
`/health` 200 (generation halted); `/v2/settings` 200 (revision 3);
`/v2/quota` 200; `/v2/sync/snapshot?family=bindings` 200
(watermark 8). Neither capabilities path exists on the staging
build (both return the JSON 404 `route_not_found`, answered
normally). No staging route faults. The fault has cleared on
staging as well.

**Production still HELD — verified on the same capture:**
`/health` build `1c2d1d0fa7ebb769f68cfb327fb9fde7d4d30867` EXACT,
coordinator `armed`, generation `halted`; Cloudflare `/settings`
bindings: exactly the 10 expected, `GENERATION_HALT` `"1"`,
`OPALREADER_PHASE_POLICY` `enforce`; queue
`opalreader-generation-v2` `delivery_paused: true`, `modified_on`
still 2026-11-01T19:40:22Z (Gate 4's re-pause — untouched since);
script download ETag exactly
`f15fb1ae40f870fc4493f3499db0b096c4d801b9fff8d20fe5538d84c69c82ed`
(the Gate 4 census value); script parsed to **31 parts, every part
byte-identical to the Gate 4 census parts, no extras**;
`/script-settings` observability enabled + logs persisted.

**STEP 1 VERDICT: RECOVERY VERIFIED.** The first precondition of
the standing GO is met.

---

## 2. Step 2 — fresh E0 census (§5.0 + §5.1): 11 of 12 items PASS; item 8's digest figure deviates

§5.0 read-availability: **satisfied** — all twelve required reads
were performable (the matrix above is the evidence). Expectations
are the final presentation §5.1's, i.e. Gate 4's closing figures.

1. **Health / etag / observability** — build `1c2d1d0f…`,
   coordinator `armed`, generation `halted`; etag `f15fb1ae…`
   exact; observability enabled + persisted. **PASS**
2. **Queue** `delivery_paused: true` (cf-api read-back). **PASS**
3. **Capabilities** — Batch unarmed (`batch_not_armed`); standard
   lane admitted; phase policy `enforce`; registry binds
   `forever-pucked` ↔ `5c589095-f812-48a2-8ab2-03ba2791f2b2`.
   **PASS**
4. **Settings revision 1** (monthlyCap 50, lane `standard`).
   **PASS**
5. **Phase accounting — EXACT on both surfaces** (capabilities and
   operator diagnostics): settled **1,029,420**;
   estimatedUnverified **19,018**; reservedUnverified **5,648**;
   inFlightUpper **0**; unknownOpen **0**; remaining
   **12,464,932** of 13,500,000. **PASS**
6. **Quota** — PT day still 2026-11-01 (rollover 07:00Z has not
   occurred): dispatched **76** / reserved **0** / consumed **76**;
   headroom 24 ≥ 12 (the §1.4 test applied to the live day).
   Reconcile **`ok: true`**, `armed: true`, `currentDayBlocked:
   false`, drift EMPTY on full pagination (base / 0,0 /
   past-end 1,0 returning `censusComplete: false` by the confirmed
   definitional semantics / closing base — totals identical on
   every page); sole exception the known adjudicated straddler
   `att-37d63768-db4b-447d-8150-580b7c6ee257`
   (`estimated_unverified`, never dispositionable). Prior PT days
   stand: 57 (Oct 29), 79 (Oct 30), 44/0/44 (Oct 31). **PASS**
7. **No live grant; no active plan.** Plan
   `plan:e377a5559961b294154276b6` `complete` 23/23, failed 0,
   blocked 0, prompts 0, quarantine not held; its job's 10 grants
   are all terminal (4 `reported`, 6 `voided`) — none live. Plan
   list holds exactly the four known plans, all terminal
   (Gate 4 `complete`; fresh Ch 2 `complete`; old Ch 2 `retired`;
   smoke `complete`). Diagnostics shows the plan's 23 executions,
   all `committed`. **PASS**
8. **Eligibility quotes — counts EXACT, digest DEVIATES.**
   Chapter quote: bound_already **26** / parked **1** / eligible
   **0** / voice_prompt **0**. Segment quote (idx 26): eligible
   **0**, exclusions parked **1**. Both as expected. **But the
   digest on both quotes (and the book quote) is
   `b4d824871f922e104392f3feb0152e2b201d8760a1753efc5f4ef09c1b7e00d2`,
   where §5.1 item 8 states `9453ab5d…`.** **DEVIATION — STOP**
   (see §3).
9. **Watermarks** — content **18**; bindings **1841**; bindings
   snapshot holds 1,841 entities with **no row for idx 26**;
   sync changes since seq 1841: **0**. **PASS**
10. **Conflicts — exact match** to the pinned four-row
    `schedule_dead` baseline: id 1 @ 2026-10-29T23:54:14.808Z
    `grant:plan:3183ecbf2ac4bf50bbc6166e:seg:1:full`; id 2 @
    2026-10-30T00:24:14.632Z
    `grant:plan:603ab416bd67ab1b25de97be:ch1:1:full`; id 3 @
    2026-10-31T05:14:24.089Z
    `grant:plan:b2dc2a3d1cd367a0245b9102:ch1:1:full`; id 4 @
    2026-11-01T01:04:30.364Z
    `grant:plan:e377a5559961b294154276b6:ch2:1:full` — all
    cache_key `lease`, expected `7`, found `LIKE or GLOB pattern
    too complex: SQLITE_ERROR`, reason `schedule_dead`. Count = 4;
    none cleared, none added. **PASS**
11. **Parked job** — `parked_policy` rev 1, grants [], 27 rows
    (3 ready / 24 pending); job-view body **byte-identical**
    (canonical form) to the Gate 4 census capture; fingerprint
    recomputed exactly
    `b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`.
    **PASS**
12. **R2 occupancy** — LIST on prefix
    `audio/07d145f7b87b9621497d3b8a2c5828141592b94425fd5696fffedde9957d9590`
    in `opalreader-storage` returned an empty result set — idx
    26's key is still FREE. **PASS**

**CENSUS VERDICT: STOP — §5.1 item 8's digest figure differs from
the paperwork expectation. Zero production mutations had been
made when the stop was declared, and none were made afterward.
The standing GO is consumed (one GO = one attempt; a STOP
consumes it at every stage, §10).**

---

## 3. The deviation, stated exactly, with the proposed explanation (for Julie's and Rowan's ruling — not self-cleared)

- **Expected (paperwork):** eligibility digest `9453ab5d…` —
  full form `9453ab5dc7ee6ade7c650d14066054b965875f2ef1b65eb24bc633588d778e67`.
  Source: final presentation §1.2 and §5.1 item 8, written from
  what §1.2 called "Gate 4's closing census".
- **Observed (live, this census):**
  `b4d824871f922e104392f3feb0152e2b201d8760a1753efc5f4ef09c1b7e00d2`
  on the chapter, segment, and book quotes alike; every other
  field of both quotes exactly as expected.
- **Proposed explanation, with its evidence:** the digest is a
  function of the book's eligible-set state and changed when Gate
  4 bound its 15 segments. Gate 4's own evidence files show:
  its **E0 (opening)** chapter quote — taken while 15 segments
  were still eligible — carried digest `9453ab5d…` (eligible 15,
  bound_already 11, parked 1); its **E4 (closing)** chapter quote
  — taken at 19:40Z Nov 1 after the plan completed — carried
  digest **`b4d82487…`** with eligible 0, bound_already 26,
  parked 1. This census's chapter and book eligibility bodies are
  **byte-identical to Gate 4's E4 bodies in every field except
  `quotedAt`** (mechanical comparison, evidence dir). In other
  words, the live eligibility state is exactly Gate 4's closing
  state; the presentation's §1.2/§5.1.8 figure appears to have
  carried the Gate 4 **opening** digest forward as the closing
  expectation. The executor records this as the proposed
  explanation only: per the STOP law and the Gate (a) / Gate 2D
  precedent, an executor's tracing never clears its own stop.
  **What is needed:** Rowan's ruling correcting the §5.1 item 8
  expectation to Gate 4's closing digest `b4d82487…` (or another
  disposition), and a fresh Julie GO for any further Phase B
  attempt.

## 4. Mutations and state-changing acts

- **Executor production mutations: 0 of the authorized 5.** No
  exemption grant (mutation 1), no halt flip (2), no queue
  unpause (3), no queue re-pause (4), no halt restore (5). The
  board execution-start filing prescribed for the execution step
  was not made: it belongs to the execution sequence, which this
  attempt never entered (the census STOP precedes it).
- **SubmitJob commands: 0.**
- **Contingency revocation: not used** (no exemption exists under
  this GO to revoke; §8.1's window never opened).
- This record's pin and its board summary filing are
  record-keeping, not production state.

## 5. End state as left by this attempt

No production state was changed by this attempt. On the full
census capture: build `1c2d1d0f…`; `/health` generation `halted`;
`GENERATION_HALT` `"1"`; queue `delivery_paused: true`;
observability enabled + persisted; phase accounting, quota,
watermarks, conflicts, plan states, and the parked job all at
Gate 4's closing figures. **Ends HELD — unchanged, certified on
the §2 capture.**

## 6. Exemption evidence classes (§9.2A)

- **(a) Operator-response evidence:** none — the exemption call
  was never made.
- **(b) Eligibility-projection inference:** the census quotes (§2
  item 8) show idx 26 still fenced (parked 1, eligible 0) — no
  exemption is live; stated as inference from the projection, as
  §9.2A prescribes.
- **(c) Independently verified journal state: UNAVAILABLE** (no
  read surface exists) — stated plainly, as §9.2A requires;
  nothing in this record implies the exemption journal or
  singleton row was read.

## 7. Acceptance

Julie's playback check does not arise: no generation occurred,
and Chapter 3 remains at the Gate 4-accepted state (26/27
playable). Phase B requires a fresh GO for any further attempt;
the conditional standing GO is consumed by this stop.

— Wren (executor)
