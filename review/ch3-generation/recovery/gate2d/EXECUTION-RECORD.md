# EXECUTION RECORD — Gate 2D: halted deploy + re-arm of the grant-finalizer build

Executed 2026-11-01 (census captured 2026-11-01T02:09:32Z) under
Julie's Gate 2D GO (board comment 6552140714, Oct 31, 2026),
following Rowan's Gate 2 PASS FOR GATE 2D DECISION (6552121744)
on the finalizer build pinned `c24bd4716d2ae386fcefd31a97b4a202968671a0`
(+ Amendment 1 `4b1d2bd8b06bc7030166ff1eb7d025ff8a9fba61`).

## OUTCOME: STOP AT D0 (census) — NO MUTATION MADE

The fresh complete census found **one deviation** from the gate's
expected pre-state: the conflicts surface holds **FOUR**
`schedule_dead` rows (ids **1, 2, 3, 4**), where the expectation —
from the Phase A close — was exactly **three** (ids 1/2/3).

Per the gate's STOP law (and the standing Gate-(a) executor rule:
a census deviation of even one item stops the gate before any
further mutation; the executor's own tracing never clears its own
stop), execution **halted before D1**. **Zero mutations were
made**: no halt flip, no queue pause, no upload, no probe, no
settings change. Production remains exactly as found:
live-but-idle on build `63d7260e…`, `GENERATION_HALT "0"`, queue
delivery enabled, the stalled Ch 3 grant still `issued` rev 2.
**Total spend: $0.** No envelope was pinned or uploaded under
this gate (assembly was never reached; the STOP fired at census).

## The deviation (verbatim from evidence/conflicts-pre.json)

Row 4, in full:

```json
{
  "id": 4,
  "at": 1793495070364,
  "occurrence_id": "grant:plan:e377a5559961b294154276b6:ch2:1:full",
  "cache_key": "lease",
  "expected": "7",
  "found": "LIKE or GLOB pattern too complex: SQLITE_ERROR",
  "reason": "schedule_dead"
}
```

- `at` = **2026-11-01T01:04:30.364Z** — *after* the Phase A close
  (~00:29Z, where conflicts were verified exactly 3) and after
  Rowan's stall confirmation. It is new since the gate's
  expectation was fixed.
- It names the **stalled Chapter 3 grant itself** — the first
  `schedule_dead` row for this grant (rows 1–3 name the smoke,
  old-Ch 2, and fresh-Ch 2 grants respectively).
- The signature is byte-identical in kind to rows 1–3: same
  `cache_key "lease"`, same `expected "7"`, same
  `LIKE or GLOB pattern too complex: SQLITE_ERROR` found text,
  same `schedule_dead` reason — the known, still-unfixed lease
  SQL quirk documented across this chain.

## Proposed explanation (for Rowan/Julie to rule on — NOT an executor clearance)

The stalled grant remains `issued`; sometime at 01:04:30Z a lease
pass over it (watchdog / alarm / lease-expiry machinery of the
kind the recovery diagnosis enumerated) attempted to schedule
against it and hit the same lease SQL error that produced rows
1–3, appending row 4 as a conflict record. Nothing else in the
census moved: attempts, reservations, phase money, bindings,
watermarks, plan totals, and the reconcile all match the Phase A
close **exactly** (table below), so the row appears to be
bookkeeping fallout of the known quirk touching the stalled
grant — the same class of event Rowan accepted as explained
provenance for row 3 at Gate (a). That acceptance, however, was
Rowan's ruling on a prior gate; under this gate's STOP law the
deviation stands until Rowan rules and/or Julie dispositions it
for Gate 2D specifically. **Gate 2D remains unexecuted; a fresh
GO (or a Rowan ruling incorporated into a revised gate) is
required before any retry.**

## D0 census — expected vs observed (capture `pre`, 2026-11-01T02:09:32Z)

| Item | Expected | Observed | Verdict |
|---|---|---|---|
| /health build | `63d7260ef0c87c45cdcb88c7007643bb90e1631c` | exact | PASS |
| /health generation / coordinator | enabled / armed | enabled / armed | PASS |
| Worker etag | `82053d4d75533056753c5ee6225e0de56e29ecb1de980aa543cdba613a59d6be` | exact (1,383,556 B) | PASS |
| Live parts vs Ch 3 operative manifest | 29/29 identical | 29/29, no extras (`parts-compare-pre.json`, `all_identical: true`) | PASS |
| Observability | enabled + persisted | enabled; logs enabled + persist + invocation_logs | PASS |
| Bindings | 10; `GENERATION_HALT "0"`; phase policy enforce | exactly 10; halt `"0"`; enforce | PASS |
| Settings | rev 1, lane standard, cap $50 | rev 1, standard, 50 | PASS |
| Phase accounting (forever-pucked) | settled 732,303; estUnv 19,018; resUnv 5,648; remaining 12,762,049 / 13,500,000 | exact (inFlightUpper 0) | PASS |
| Quota reconcile | `ok: true`, drift empty, sole exception straddler `att-37d63768…` | `ok: true`, drift [], exactly 1 exception = the straddler, `censusComplete: true`, guard armed | PASS |
| PT day totals | 2026-10-31: dispatched 44 / reserved 52 / consumed 96 | exact; current day still 2026-10-31 (pre-07:00Z rollover); historical 10-29 = 57, 10-30 = 79 | PASS |
| Plans | smoke complete; old Ch 2 retired; fresh Ch 2 complete; Ch 3 active 8/23 | exact (plan list exhaustive, nextCursor null; Ch 3 totals eligible 23 / done 8 / failed 0 / blocked 0) | PASS |
| Ch 3 grant | `grant:plan:e377a5559961b294154276b6:ch2:1:full` issued rev 2 | exact (job `…:ch2` generating rev 2; rows 23 = 8 ready / 15 pending) | PASS |
| Parked Ch 3 job | `parked_policy` rev 1, fingerprint `b991f18a…` | exact state/rev; fingerprint recomputed `b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`; 27 rows (3 ready / 24 pending), grants [] | PASS |
| Eligibility (Ch 3) | eligible 15 / bound_already 11 / parked 1; digest `9453ab5d…` | exact: 15 / 11 / 1, digest `9453ab5dc7ee6ade7c650d14066054b965875f2ef1b65eb24bc633588d778e67`, totalChars 20,864, expectedCost 294,137 | PASS |
| **Conflicts** | **exactly 3 `schedule_dead` rows (ids 1/2/3)** | **4 rows (ids 1/2/3/4)** — row 4 new at 2026-11-01T01:04:30.364Z, naming the Ch 3 grant, same lease signature | **DEVIATION → STOP** |
| Sync watermarks | bindings 1826 / content 18 | exact | PASS |
| Queue | unpaused; sole consumer `f260f2188d80426bb0588685e9d084eb` | `delivery_paused: false`; sole consumer exact; sole producer the prod script | PASS |
| Batch | unarmed (Standard-only) | capabilities: batch `admitted: false` (`batch_not_armed`), standard admitted | PASS |
| Park release / exemptions | releaseId 1 live; zero exemption writes | No row-level read exists on the live build; covered by the eligibility digest + parked/bound composition matching the Phase A close exactly (the chain's own closing standard at Phase A) | PASS (indirect, as at Phase A close) |

## What was NOT done

- No halt flip (D1), no queue pause (D2), no code upload (D3),
  no denied probe (D4), no re-arm step (R0–R3).
- No envelope assembly, no envelope pin, no build stamp created
  under this gate. (The finalizer tree diff was verified
  beforehand and matches the Gate 2 pin exactly: new
  `worker/generation/grant-finalizer.mjs`, modified
  `worker/worker-entry-prod-d6.js` +122/−2, plus test files
  only — recorded here for the retry's convenience.)
- The finalizer was not invoked in any form. Gate 3 has not run.
- Nothing generated, submitted, or spent. **Spend: $0.**

## State preserved

Production is byte- and state-identical to the census capture:
build `63d7260e…`, etag `82053d4d…`, halt `"0"`, queue unpaused,
grant `issued` rev 2, plan active 8/23, watermarks 1826/18,
phase settled 732,303. The only new fact in the system is the
one production itself wrote at 01:04:30Z (conflict row 4), which
predates this gate's first read and was not caused by it (this
gate made reads only).

## Evidence

`execution/evidence/` — full `pre` capture set (health, queue,
bindings, script-settings, script downloads + metas, capabilities,
settings, quota, plan list + 4 plan reads, jobs, conflicts, sync
snapshots, eligibility ×2, diagnostics ×4), the 4-page quota
census (`census-page-000..003-pre.json`), `assess-pre.json`,
`parts-parse-pre.json`, `parts-compare-pre.json`,
`job-ch3plan-pre.json`, timestamps. Tools in `execution/tools/`
(capture.sh, census.sh, assess.py, parts_tool.py, cf_get_script.py,
cf_put_envelope.py — the last unused).

## For Rowan's review — look hardest at

1. **Conflict row 4 itself** (id 4, 2026-11-01T01:04:30.364Z,
   Ch 3 grant, lease signature): is this the known quirk's
   expected fallout on a permanently-issued grant — i.e., will
   rows keep accreting while the grant stays `issued`, and does
   that change Gate 3's census expectations (conflicts count can
   no longer be pinned to a fixed number)?
2. Whether Gate 2D's census expectation should be restated as
   "conflicts = rows 1–3 + any further `schedule_dead`/lease rows
   naming the stalled grant with the identical signature, each
   individually recorded" — or whether some other bound is the
   right hard precondition for the retry.
3. The timing: row 4 appeared ~35 minutes after Rowan's stall
   confirmation and ~5 hours before this gate ran — the census
   expectation inherited from the Phase A close was already
   stale when the gate opened. Not an executor complaint; a
   fact about how fast this surface drifts while the grant
   remains issued.

Turn: **parent (Wren)** — to file this STOP record for Rowan and
surface the deviation to Julie. Gate 2D retry requires a fresh
disposition.
