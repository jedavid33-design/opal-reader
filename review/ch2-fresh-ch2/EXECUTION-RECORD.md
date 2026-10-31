# GATE-8 FRESH CHAPTER 2 GENERATION — EXECUTION RECORD

**Result: COMPLETE — plan `plan:b2dc2a3d1cd367a0245b9102`
reached terminal state `complete`, 18 / 18 segments committed
and published. No halt, no unknown-billing outcome at any
point, no STOP invoked after submission.** Executed
2026-10-31, 03:52–04:16Z (submission 03:53:31Z; `complete`
first observed 04:15:55Z).

**Authorization.** Julie's Gate-8 generation GO, recorded on
roundtable issue #15 as comment **6538633362** before any
execution step (read firsthand by the executor at E1; scope =
exactly the one intent below). Governing documents: the
Gate-8 plan as passed — `GENERATION-PLAN.md` @ `8a242375…` +
Addendum 1 @ `71f0a376…` + Addendum 2 @ `571b40c6…`; Rowan's
consolidated Gate-8 PLAN PASS 6538448893. Live build
throughout: `6a73d9622e1b4eac00c58e289de1c674ed6b3d6b`.
Raw captures (local, unpinned): `~/workspace/ch2-program/
fresh-ch2/execution/` (`e0/`, `e2/`, `e3/poll-01…12`, `e4/`).

---

## E0 — Preflight: ALL PASS (31/31 checks, capture 03:52:55Z)

Every §1.4 check and §4 E0 invariance item matched the
reviewed values exactly; no drift, no submission risk:

- **C1 (plane):** chapter quote eligibleCount 18, totalChars
  25,091, expectedCostMicroCents 353,726, exclusions
  `{bound_already: 20, voice_prompt: 0, parked: 0, other: 0}`,
  digest `6d7efbb74667cea93a99c0d1965cb8d5931ffa4589d2d20b3b3283cae3b7f3e8`
  — exact (amended C1: any mismatch would have been STOP).
- **C2 (identity):** `GET /v2/d6-plans/plan:b2dc2a3d1cd367a0245b9102`
  → 404 `plan_not_found`.
- **C3 (no competing owner):** plan list exactly the two
  known plans (retired Ch 2 + complete smoke), no `active`
  plan, cursor exhausted.
- **C4 (system as reviewed):** `/health` build `6a73d962…`,
  generation `enabled`, coordinator `armed`; settings
  revision 1 (lane `standard`, cap $50); capabilities phase
  figures equal §5's opening table (settled 199,665 /
  estimated 19,018 / reserved 5,648 / inFlight 0 / remaining
  13,294,687; batch `batch_not_armed`); quota attemptsToday 0,
  spentMicroCents 371,485, ledgerSeq 19; queue
  `delivery_paused == false`; retired plan still `retired`;
  stale job `generating` rev 2 with 18 `granted` rows;
  conflicts exactly the two known `schedule_dead` rows;
  Chapter 3 job `parked_policy` rev 1, 27 rows, G8-recipe
  fingerprint recomputed =
  `b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`
  (exact); bindings watermark 1800 with none of the 18
  eligible occurrences bound and FP at 51 bindings.

## E1 — Approval check: PASS

Comment 6538633362 read firsthand: Julie's GO for exactly
this one intent, recorded before execution, with the
Addendum 1 §B3 disclosures presented and accepted. No
earlier approval was relied on.

## E2 — ONE submission: PASS, exact §1.5 shape

Command id `fresh-ch2-20261031-fp-chapter2-v1` (single-use,
recorded before the POST per §1.3), via `POST /v2/commands`
(client connector; scope + instance headers), body exactly
§1.3's: SubmitJob, bookId `5c589095-f812-48a2-8ab2-03ba2791f2b2`,
lane `standard`, d6Intent `{scope: "chapter", chapterIndex: 1,
phase: "forever-pucked", keepGoing: false}`.

Response (03:53:31Z, HTTP 200), verbatim the §1.5 expected
shape:

```json
{"planId": "plan:b2dc2a3d1cd367a0245b9102", "created": true, "state": "active"}
```

Read-back confirmation: plan `active`, stopReason null,
totals eligible 18 / done 0 / failed 0 / blocked 0 /
prompts 0; **quarantine held false, approvalRequired false**
(born armed, unmarked, as §3 predicted); 38 plan entries =
20 `bound_already` + 18 `eligible`, the 18 eligible
occurrence ids identical to the reviewed evidence list,
Σ eligible chars 25,091; first job
`plan:b2dc2a3d1cd367a0245b9102:ch1` present, `queued` rev 1,
18 rows all `pending`. No second submission was made or
needed.

## E3 — Monitoring: grants, a transient commit-path failure wave, server-owned repair, completion

Polls every ~2 min against the watchdog's cadence
(`e3/poll-01…12`):

- **03:59:46Z (poll-04):** job `generating` rev 2, all 18
  rows `granted`; quota ledgerSeq 19 → 37 and spentMicroCents
  371,485 → 725,221 (the 18 grant-time estimate debits);
  phase settled already moving (204,525).
- **04:01:48Z–~04:10Z (polls 05–09):** plan totals showed a
  growing `failed` count (4 → 8 → 11 → 14 → 17) with `done`
  still 0. Diagnostics showed the failures were
  **commit-path**, not synthesis or billing: of the 18
  first-pass executions, 8 ended at stage `flush` with
  detail `{"code": "winner_digest_mismatch"}` and 10 at
  stage `commit` with detail `{"reason": "object_missing"}`.
  Every attempt on those executions was `confirmed` with a
  recorded cost or a zero-cost `policy_block` outcome;
  **`unknownOpen` read 0 at every observation and the plan
  never halted.** Per the plan, no operator action was taken:
  no retry, no manual grant/repair/publication, no re-halt.
  (The factual pattern — a winner-selection/commit race
  resolved downstream — is stated as observation; root-cause
  interpretation is left to Rowan's review.)
- **04:12:07Z (poll-10):** the server-owned repair chains
  (F6) had re-run every failed occurrence: totals flipped to
  **done 18 / failed 0**, job rows all `ready`, inFlight 0.
- **04:15:55Z (poll-12):** plan state **`complete`**,
  stopReason null — terminal.

**Attempt accounting (diagnostics, paginated in full):**
36 executions = 18 first-pass `failed` + 18 `committed`,
the same 18 occurrence ids on both sides (exactly one
committed execution — and exactly one binding — per
occurrence). **79 attempts**: 22 `policy_block` (recorded
cost 0 each; the recursive POLICY_BLOCK split trees, no
voice substitution) + 57 `success`. **Σ recorded attempt
cost = 379,674 micro-cents**, which equals the phase settled
delta to the unit (below). No attempt carried an unknown
outcome; no `blocked_policy` finish occurred.

## E4 — Binding publication: PASS, server-side only

Bindings snapshot after completion: watermark **1800 →
1818** (exactly +18), entities 1,818; all 18 Chapter 2
occurrences present as bindings with payload provenance
`"d6"` (server-stamped `cacheKey` / `revisionKey` / `format`
wav / `size` / `sha256`; e.g. position 50: 4,185,644 B);
Forever Pucked bindings 51 → **69**. New audio total
80,275,992 B (~80.3 MB; modeled ~75.6 MB, inside the ×1.10
allowance). **No manual SyncPush was sent or needed** — the
gen-pkg-1 binding projection published all 18, with no
projection conflict observed. Client playback confirmation
remains Julie's device check, per the plan; this record does
not claim it.

## Closing accounting (micro-cents, recorded/known basis)

| Term | Opening (E0) | Closing | Δ |
|---|---|---|---|
| Phase settled | 199,665 | **579,339** | **+379,674** |
| Estimated unverified (§8 disposition) | 19,018 | 19,018 | 0 |
| Reserved unverified (gating term) | 5,648 | 5,648 | 0 |
| In-flight uppers | 0 | 0 | 0 |
| Unknown open | 0 | **0** | 0 |
| Remaining authorization (of 13,500,000) | 13,294,687 | **12,915,013** | −379,674 |
| Quota view (attemptsToday / spent / ledgerSeq) | 0 / 371,485 / 19 | 18 / 725,221 / 37 | — |
| Bindings watermark | 1800 | **1818** | +18 |

The run's recorded settled figure **379,674 (~$0.3797)**
against the plan's modeled expected 353,726: the +25,948
difference is the confirmed recorded cost of the superseded
first-pass attempts (successful part-syntheses on executions
whose commit then lost the winner race), all on the
recorded/known basis — no figure in this record is a
provider invoice, and the phase still carries
`provider_unverified` for the gate-5 disposition, unchanged.
All guards held throughout: phase budget (worst observed
guard basis far under 13,500,000), $50 cap, daily quota
(18 grants / 79 attempts, both under 100).

**Invariance at close (final sweep, `e4/final-inventory/`):**
Chapter 3 fingerprint exact, job still `parked_policy`
rev 1; stale Chapter 2 job read byte-identical to E0
(`generating` rev 2, untouched); retired plan still
`retired`; conflicts still exactly the two `schedule_dead`
rows; settings still revision 1; Batch still
`batch_not_armed`; queue still unpaused; `/health` still
build `6a73d962…` / `enabled`. Plan list at close: exactly
three plans — smoke `complete`, retired Ch 2 `retired`,
fresh Ch 2 **`complete`**.

**Non-actions:** exactly one mutating call was made in the
entire run (the E2 submission). No second submission, no
variant command id, no manual grant, repair, reconcile,
adjudication, retirement, quarantine release, settings
change, deploy, queue action, or Chapter 3 / Batch action.

**Turn:** Rowan's — execution-record review. Client playback
confirmation is Julie's device check. Chapter 3 remains
parked and the rest of Forever Pucked remains ungenerated;
both are separate future Julie decisions.

— Wren
