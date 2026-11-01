# GATE 3 RETRY — EXECUTION RECORD: ALL PASS, grant finalized, ends HELD

Opal Roundtable (Julie + Rowan + Wren) — Case #10 / issue #15,
board repo `jedavid33-design/opal-roundtable`.
Review pins live in repo `jedavid33-design/opal-reader`, branch `ui1-review`.

**Verdict: EXECUTED — ALL PASS.** The Gate 3 retry ran exactly
once, under the operative proposal (pin
`0ead570fd9713ec72ec84fe59080a54919e3c8af`, SHA-256
`ec21844bbe391df7c4a9e44aa90e2c1d51035ddf2b4de3162e1042233dd6189b`),
Rowan's REVIEW PASS (board 6561426431), and Julie's GO
recorded on the board **before** any step (board **6561443308**,
Handoff ID RT-H-20261101-4328b9 — the GO comment id is E3's
`authorizationRef`, used verbatim).

- **Exactly 1 mutation** — the E3 finalizer action. No halt
  flip, no queue pause (both protections verified already in
  place), no second preview, no second finalizer call.
- **E1 preview: HTTP 200, classification `finalizable`** —
  the derivation completed on the fixed build against live
  production data. Precondition digest
  `08fabed1b7c2ee8738841cb0bd8a91183a55a5d124b5e7e2c4ce9df72e2f5645`.
- **E3 finalizer: HTTP 200, outcome `applied`.** Grant
  `reported`, claim `completed`, exactly the 8 reservations
  closed `grant_settled`, audit row written bound to Julie's
  GO and the E1 digest.
- **Ends HELD, certified** from E4 read-backs:
  `GENERATION_HALT "1"` **and** queue `delivery_paused: true`.
- **Spend: $0.** No provider call, no generation, no phase
  money movement (verified unchanged at E4).
- **STOP law:** never triggered — zero deviations at every
  step. No §5.0 containment re-hold was used or needed.

What this proves, at its true strength (§9 of the proposal):
the finalizer derivation completes on the fixed build against
live data; the stalled grant is closable on the fixed build
and is now closed; the Gate 4 precondition (no grant reading
`issued` for the Chapter 3 job) is met. It does **not** prove
the mechanism of attempt 1's HTTP 500 — H1 remains SUPPORTED,
NOT proven — and it authorizes nothing further: Gate 4,
re-arm, Phase B, and Batch each remain separately gated.

Evidence: raw captures preserved under
`gate3/retry-execution/evidence/` in the Wren workspace (71
files, SHA-256 listing pinned alongside this record as
`GATE3-RETRY-EVIDENCE-SHA256.txt`). All timestamps UTC.

---

## Step 0 — GO recorded before E0

Board comment **6561443308** (2026-11-01), read back
byte-identical after posting (backticks 24 = 24; all key
spans verified: Handoff ID RT-H-20261101-4328b9, Rowan PASS
6561426431, proposal pin `0ead570f…`, proposal SHA-256, live
build, exact grant identity, `authorizationRef` statement).
No production contact preceded it.

## E0 — Fresh census (2026-11-01T17:35:29Z → 17:35:45Z): ALL PASS, 21/21

21 read surfaces, all HTTP 200. Verified item-by-item against
proposal §4 (the attempt-1 verifier, adapted: new build, held
expectations, 31 parts):

| § | Item | Result |
|---|---|---|
| 4.1.1 | /health | build `1c2d1d0fa7ebb769f68cfb327fb9fde7d4d30867` EXACT; generation `halted`; coordinator `armed`; scope `production`; ok `true` |
| 4.1.2 | Live script parts | **31/31 byte-identical** to the range-fix operative manifest, zero extras; etag `f15fb1ae40f870fc4493f3499db0b096c4d801b9fff8d20fe5538d84c69c82ed` (matches §2.6) |
| 4.1.3 | Bindings | exactly 10; `GENERATION_HALT "1"`; `OPALREADER_PHASE_POLICY "enforce"` |
| 4.1.4 | Observability | enabled + persisted on both `/settings` and `/script-settings` |
| 4.1.5 | Settings / capabilities | revision **1** (cap 50, lane `standard`); standard admitted; Batch `batch_not_armed` |
| 4.1.6 | Queue (cf-api) | `delivery_paused: true` ALREADY; sole consumer `f260f2188d80426bb0588685e9d084eb`; retention 86,400 s |
| 4.2.7 | Plan list | exhaustive (`nextCursor: null`); exactly the 4 known plans: Ch 3 `active`, fresh Ch 2 `complete`, old Ch 2 `retired`, smoke `complete` |
| 4.2.8 | Ch 3 plan | `active`; totals 23 / 8 / 0 / 0 / 0 |
| 4.2.9 | Ch 3 job | `generating` rev 2; occurrences 8 `ready` / 15 `pending`; exactly one grant |
| 4.2.10 | Grant | `grant:plan:e377a5559961b294154276b6:ch2:1:full`, `issued` rev 2 |
| 4.2.11 | Parked job | `parked_policy` rev 1; fingerprint recomputed `b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282` EXACT (park-release/exemption state verified by the E1 derivation, §6-item-13 note) |
| 4.2.12 | Eligibility | 15 eligible / 11 bound_already / 1 parked; 20,864 chars; expected 294,137; digest `9453ab5dc7ee6ade7c650d14066054b965875f2ef1b65eb24bc633588d778e67` EXACT |
| 4.2.13 | Phase accounting | exact on BOTH surfaces (diagnostics + capabilities): settled 732,303 / estimatedUnverified 19,018 / reservedUnverified 5,648 / unknownOpen 0 / remaining 12,762,049; inFlightUpper 0 |
| 4.2.14 | Sync watermarks | bindings **1826** / content **18** |
| 4.3.15 | Quota reconcile | `ok: true`, drift empty, `censusComplete: true`, guard armed, `currentDayBlocked: false` (pages 000/001/003 consistent; page 002 the empty second exception page) |
| 4.3.16 | Sole exception | `att-37d63768-db4b-447d-8150-580b7c6ee257`, `estimated_unverified` — no second exception |
| 4.3.17 | Historical PT days | 2026-10-29 = 57/0/57; 2026-10-30 = 79/0/79; **2026-10-31 = 44/52/96** |
| 4.3.18 | Census-day PT totals (observed) | 2026-11-01 = dispatched 0 / reserved 0 / consumed 0 |
| 4.4 | Conflicts | **EXACT MATCH** to the §4.4.1 four-row baseline (ids 1–4, every field incl. timestamps and occurrence ids) |
| 4.5 | Bindings proof | all 8 committed occurrences present in the bindings snapshot; **revision_key == cache_key on 8/8** |

**Retry census evidence digest:**
`61b3426eb7833c401530b3ab98343271d4732cfeed3d46adff5917a42f84872a`
(SHA-256 over the 23 raw `*-e0.json` capture envelopes in
sorted filename order, filenames included — computed by the
executor for this record; distinct from, and never conflated
with, the E1 preview precondition digest below.)

## E0.5 — Verify-held: PASS, zero mutations

From the E0 read-backs themselves: `GENERATION_HALT "1"`
(§4.1 item 3), /health generation `halted` (item 1), queue
`delivery_paused: true` (item 6) — both protections already
in place, exactly as the proposal expected. The system never
left HELD. No hold mutation was performed or budgeted.

## E1 — The single valid preview (17:36:48Z → 17:36:49Z): HTTP 200, `finalizable`

One operator call, exactly as parameterized in attempt 1:
`GET /v2/d6-grant-finalization-preview?grantId=grant:plan:e377a5559961b294154276b6:ch2:1:full&planId=plan:e377a5559961b294154276b6&jobId=plan:e377a5559961b294154276b6:ch2`

Response (verbatim head; full body in evidence
`preview-e1.json`):

```json
{"outcome": "preview", "classification": "finalizable",
 "grantId": "grant:plan:e377a5559961b294154276b6:ch2:1:full",
 "preconditionDigest": "08fabed1b7c2ee8738841cb0bd8a91183a55a5d124b5e7e2c4ce9df72e2f5645",
 "state": { … }}
```

§4.6 field check against the census: **ALL PASS, 22/22** —
identity (grant/plan/job/book/chapter 2/lane/phase); grant
`issued` rev 2; job `generating` rev 2; plan `active` totals
23/8/0/0/0; claim `claimed`; outbox present + acked with
exactly the 8 target ids; each target `ready` with execution
`committed`, attempts in the 4/6/6/6/6/6/4/6 pattern (30
`success` + 14 `policy_block` = 44, 0 failed/unknown), its
reservation `open` on dayKey 2026-10-31 with `slots_total`
12 and `slots_consumed` = attempts, binding cache key ==
target cache key; attemptsTotal 44; dispatchTotal 44;
reservations summary count 8 / residual 52; dayTotals
44/52/96 @ 2026-10-31; phase money exactly §2.4; watermarks
1826/18; parkRelease releaseId 1 `live`, occurrenceCount 23,
coversEligible `true`; exemptionForFinalOccurrence `false`;
partition 8 `ready` / 15 `pending`.

**Precondition digest (E1):**
`08fabed1b7c2ee8738841cb0bd8a91183a55a5d124b5e7e2c4ce9df72e2f5645`
— recorded verbatim, bound into E3, verified at E4. (The
Fixture S digest `00db68a8…` is test evidence only and is not
this value; no live digest was predicted in advance.)

## E2 — Pre-action conflict re-check: EXACT MATCH

Immediately before E3, the complete conflict set was
re-fetched (`GET /v2/conflicts`, HTTP 200) and compared
row-by-row against the §4.4.1 baseline: **exact match, all
four rows, every field.** No STOP. (Evidence
`conflicts-e2.json`.)

## E3 — The single finalizer action (mutation 1 of 1): HTTP 200, `applied`

One operator call: `POST /v2/d6-finalize-grant` (local
window 17:37:36Z → 17:37:37Z; the audit row's server-side
`finalizedAt` is 1793554658153 = 2026-11-01T17:37:38.153Z).

Request body (verbatim, evidence `e3-request.json`):

```json
{"grantId": "grant:plan:e377a5559961b294154276b6:ch2:1:full",
 "planId": "plan:e377a5559961b294154276b6",
 "jobId": "plan:e377a5559961b294154276b6:ch2",
 "authorizationRef": "6561443308",
 "expectedPreconditionDigest": "08fabed1b7c2ee8738841cb0bd8a91183a55a5d124b5e7e2c4ce9df72e2f5645"}
```

Response (verbatim head; full body in evidence
`finalize-e3.json`): HTTP 200,
`{"outcome": "applied", "alreadyFinalized": false, …}` with:

- **audit**: grantId / planId / jobId / bookId / chapterIndex
  exact; **`authorizationRef`: "6561443308"** (Julie's GO
  comment id); **`preconditionDigest`:
  `08fabed1b7c2ee8738841cb0bd8a91183a55a5d124b5e7e2c4ce9df72e2f5645`**
  (= the E1 digest); beforeTotals 44/52/96 @ 2026-10-31,
  attemptsTotal 44, dispatchTotal 44, phaseSettledMicro
  732,303; outcome `applied`; finalizedAt 1793554658153.
- **before**: digest == E1 digest; dayTotals 44/52/96;
  reservations 8 open, residual 52; phase accounting §2.4.
- **after** (the finalizer's post-transaction re-derivation,
  classification shape `already_finalized`): grant
  **`reported`** rev 2; claim **`completed`**; job
  `generating` rev 2; plan `active` totals 23/8/0/0/0; the
  audit view identical to the audit object above; the 8
  reservations each `closed` / `grant_settled` (itemized at
  E4 item 3).

No second call of any kind was made. The response was
unambiguous — the §7 readback-first replay rule was not
needed.

## E4 — Full readbacks (proposal §6): ALL PASS

Fresh capture set (suffix `e4`), all reads HTTP 200.

1. **Grant `reported`** — on TWO surfaces: the E3 action's
   after-view, and independently the job read
   (`GET /v2/jobs/…:ch2` grants entry: state `reported`,
   revision 2). Precision note: no read surface projects the
   grant's `report_json` text itself; the values item 1
   exists to bind — this GO's `authorizationRef` and the E1
   precondition digest — are verified verbatim on the audit
   row (item 14), and the grant's reported state is verified
   on both surfaces above. Nothing about the state is
   inferred from the action response alone.
2. **Claim `completed`** — E3 after-view (the finalizer's
   post-transaction re-derivation readback).
3. **Reservations, each of the 8 rows individually** (E3
   after-view reservations array, cross-checked against the
   §2.3 table): all `closed`, `close_reason`
   `grant_settled`, `day_key` 2026-10-31, `slots_total` 12,
   stored `slots_consumed` unchanged (4/6/6/6/6/6/4/6 by
   occurrence), reservation ids exactly
   `qres:<grantId>:<occurrenceId>:2026-10-31`. **8/8 PASS.**
4. **Derived PT totals**: 2026-10-31 = dispatched **44** /
   reserved **0** / consumed **44** (reconcile e4) — the 52
   slots released, the 44 dispatches permanently counted.
   Historical days unchanged (57/0/57; 79/0/79). Census-day
   totals observed: 2026-11-01 = 0/0/0.
5. **Quota reconcile**: `ok: true`, drift empty, guard
   armed, `currentDayBlocked: false`, `censusComplete:
   true`, sole straddler exception only.
6. **Attempts / dispatches**: exactly 44 confirmed attempts
   across the 8 executions (operator diagnostics e4) and 44
   dispatch rows (reconcile day totals); no new attempt or
   dispatch; no provider contact.
7. **Plan**: `active`, totals 23 / done 8 / failed 0 /
   blocked 0 / prompts 0 — finalization advanced nothing.
8. **Job**: `generating` rev 2; occurrences 8 `ready` / 15
   `pending`.
9. **Eligibility**: unchanged 15 / 11 / 1; digest
   `9453ab5dc7ee…` exact; 20,864 chars; expected 294,137.
10. **Phase accounting**: unchanged on both surfaces —
    settled 732,303; estimatedUnverified 19,018;
    **reservedUnverified 5,648 → 5,648**; unknownOpen 0;
    remaining 12,762,049. Finalization moved no phase money,
    exactly as designed (§2.4: the 5,648 is the straddler's
    accounting, not this grant's slots).
11. **Sync watermarks**: bindings 1826 / content 18,
    unchanged.
12. **Conflicts**: exactly the §4.4.1 baseline set,
    post-action — no mismatch, no containment event.
13. **Park release / exemption / parked job**: parked job
    `parked_policy` rev 1, fingerprint recomputed exact at
    E4; park release live and exemption absent as proven by
    the E1 derivation and the action's in-transaction
    re-derivation (both refuse on any change); eligibility
    parked count still 1.
14. **Finalizer audit row** — verified field-by-field from
    the E3 response's audit object (the row as written by
    the single `applied` action): (a) exact grant identity
    `grant:plan:e377a5559961b294154276b6:ch2:1:full`; (b)
    **authorizationRef `6561443308`** — Julie's retry GO
    comment id, exact; (c) **preconditionDigest
    `08fabed1b7c2ee8738841cb0bd8a91183a55a5d124b5e7e2c4ce9df72e2f5645`**
    — the E1 preview digest, distinguished by name from the
    retry census evidence digest
    `61b3426e…f5917a42f84872a` (E0 section above); the two
    are different values from different steps and are never
    conflated here. Exactly one audit row exists for this
    grant: exactly one action call was made, its outcome was
    `applied` (not a replay), and the post-transaction
    re-derivation classified the state `already_finalized`,
    which requires precisely this row.
15. **Hold state**: `GENERATION_HALT "1"`; queue
    `delivery_paused: true`; build still
    `1c2d1d0fa7ebb769f68cfb327fb9fde7d4d30867`; script parts
    still **31/31 byte-identical** (etag unchanged
    `f15fb1ae…`); observability enabled + persisted;
    settings revision still 1; Batch still `batch_not_armed`.
    **ENDS HELD certified** — both protections established by
    read-back, per the amended rule.

## Totals and boundaries

- **Mutations: exactly 1** (E3). Census, verify-held, E1,
  E2, and all E4 reads are reads. §5.0 containment: unused.
- **Spend: $0.** No provider call was made by any step.
- **GO consumed.** This record is the single attempt the GO
  authorized.
- **Not done, by design:** no re-arm, no unpause, no halt
  lift, no generation, no Gate 4 resumption, no Phase B, no
  Batch, no conflicts-row change, no rollback.
- **Next:** Rowan's execution review of this record. Gate 4
  (the remaining 15 segments) requires its own proposal /
  review / Julie GO, plus a separate re-arm decision.

— Wren
