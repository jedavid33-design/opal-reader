s not amend the first-attempt record, the corrective proposal, or any ruling. It does not touch WS2: Batch remains unarmed, its B-G3 package remains separately gated, and **no approval in this package's chain says anything about Batch**. It authorizes no deploy, no probe, no wake act, no onboarding, no composition of the WS1 and WS2 candidates, and no act on any preserved row, plan, or job.

**Counted acts — the complete table.** Read-only reads are never counted. Julie's submission is her act, recorded, not counted. The FC-1 evidence assembly (§4.2) is file work on Wren's side, not a production act.

| # | Act | When |
|---|---|---|
| 1 | Halt lift — envelope flip `GENERATION_HALT` `"1"` → `"0"` (§4.6 Act 1) | After full census + confirmation pass |
| 2 | Queue unpause (§4.6 Act 2) | Immediately after Act 1's read-backs |
| 3 | Queue re-pause (re-hold pair, first) | Only on a §4.13 close branch (ii)–(v) |
| 4 | Halt flip back — `"0"` → `"1"` (re-hold pair, second) | Only on a §4.13 close branch (ii)–(v), after act 3 |

Totals: **2** (success), **4** (any close), **0** (pre-lift stand-down). An act performed that is not in this table voids the gate's accounting and is reported as such.

**The partial-lift ledger (§4.13A) — separate, never merged (R3).** If Act 1 verifies and Act 2 fails or is unverified, the gate's acts are recorded in this branch ledger **instead** — it is not a fifth row of the table above, and its figures are never added to the 2/4/0 totals:

| Line | Act | When |
|---|---|---|
| M-1 | Halt lift (Act 1) — 1 verified mutation | §4.6 Act 1, verified |
| A-2 | Queue unpause (Act 2) — an **attempt**, outcome class recorded (failed / unverified / applied-despite-the-failed-response); a verified mutation **in this ledger only** if the determination reads establish it applied | §4.6 Act 2 |
| RH-0 | Queue re-pause | Only if the determination reads show Act 2 applied (§4.13A (b)) |
| RH-1 | Halt re-hold — `"0"` → `"1"`, with the full read-back set | §4.13A's authorized response |

## §7 Open items carried forward (at their recorded strength; none is resolved by this package)

- **OI-5 (budget figure tension, standing):** the program's ≈$14.74-per-book figure rule vs Julie's $13.50 Forever Pucked decision — $13.50 stands as the operative cap because it is Julie's explicit decision for this phase; the tension is parked, never an overspend argument.
- **W-4 (unresolved diagnosis):** the S1 window's late drive-pass cessation remains UNDIAGNOSED; causation with the second 1101 fault is **not** claimed. Its practical consequence for this gate is fully absorbed by P-12 (recorder judged fresh at census) and §4.8's bounded window (a silent chain is a named branch, never an indefinite pause) — the diagnosis itself remains open.
- **Platform limitations at standing strength:** runtime adoption of any build by every Durable Object instance is NOT proven (the standing C1-2 limitation); the racing-wake recheck is PLATFORM-UNVERIFIED; post-retry-exhaustion `getAlarm()` semantics are UNSPECIFIED; live drive suppression of a running chain was not demonstrated by C3; provider-confirmed cost is unverifiable from production surfaces (ledger estimates only; the prepay balance is the physical backstop); the containment audit history stands at documentary strength (no enumeration surface). The 1101 faults' root cause remains UNCONFIRMED after three occurrences.
- **Preserved, not dispositioned:** the four `schedule_dead` rows (Q6 — no clearing without separate authorization); the parked Ch 3 job; the old Ch 2 plan's 38 entries; the idx-26 chapter exemption (live, append-only journal, no read surface — never claimed as read); the WS1↔WS2 composition question (the B-G2 candidate carries no S1 branch; composition is a future, separately reviewed step); WS2's own open items (B-1 pricing, O-5, staging end-of-life) — untouched, in WS2's packages, under WS2's gates.
- **The fault itself:** as of this package's drafting evidence, the third 1101 fault was still being logged (monitor runs through 09:06 ET Nov 7). Whether it has since cleared is a fact only the §4.2/§4.3 evidence can establish, at gate time.

## Appendix A — Execution-record accounting separation (A6): the inherited ledger and the smoke ledger

The execution record for this gate keeps **two ledger sections**, and no figure moves between them:

**Ledger I — inherited (plan:8f14c8885548b9c5ddd6b8df, Chapter 4 completion).** Opening values = the census reads (P-5, P-9, P-10, P-11). Lines: the PT-day dispatches consumed by the completion (observed count; the planning reserve was R = 12); the attempt records attributable to the completion, by outcome class; the settled delta (phase settled at the A6 snapshot minus phase settled at census), cross-checked against the plan's own settled figure; the +1 binding (watermark at census → at snapshot; the new binding's entityKey). Closing statement: the A6 snapshot itself, verbatim values. If P-1 ends non-clean, Ledger I closes with the plan's exact observed state and the PRE-SMOKE STOP disposition instead.

**Ledger S — the smoke (Julie's chapter, plan created at T0).** Opening values = **the A6 snapshot** (bindings watermark, phase settled, day counters at T0 — including the inherited completion's dispatches already inside the T0 PT day, stated as a line so the day arithmetic is auditable). Lines: the smoke plan's dispatches, attempts by outcome class, settled figure (plan surface), phase settled delta snapshot → completion, bindings delta snapshot → completion, the report-only exposure signals (§4.7) computed on this ledger only. Closing statement: the classification's evidence set (§4.11) with every value traced to this ledger or the snapshot.

**Gate totals** (the §4.11 three-line report) are presented as the two ledgers' sum **only** in the remaining-room line (the phase is shared); verified charges and unverified estimates are stated per ledger and summed only with their labels intact. The first attempt's figures (89 dispatches; ≈368,586 units) belong to the first attempt's record and appear in this gate's record only as cited history, never as an opening balance.

## Appendix B — Change list for this corrected filing (answering Rowan's review, handoff `RT-H-20261107-cc21c8`)

This corrected filing differs from the uncorrected package (pin `22c7aea70be544b409375d12d8aceca182351125`) **only** as listed here. The review's instruction — "Do not reopen A2–A6 or the previously settled OQ questions without new evidence" — was followed: no census predicate, STOP-law term, trigger, soak term, declaration term, §7 item, or Appendix A line changed.

**Filing front matter (the corrections a corrected filing requires).** (1) Title: "— CORRECTED" added. (2) Status paragraph rewritten: corrected-filing status, the review verdict and handoff named, the only-corrections statement. (3) Operative sources: Rowan's review of the uncorrected package inserted as source 3; the first-attempt record renumbered to source 4. (4) Contents at a glance: §4's bullet gains the partial-lift contingency (§4.13A); an Appendix B bullet added. (5) §0: a corrected-filing note added (supersession as the review text; the uncorrected text preserved; any beyond-list difference is a filing defect). (6) §5's header and presentation note conformed to "Rowan's final readiness pass on this corrected package." (7) The closing filing note and Turn line conformed (final readiness check).

**R1 — progress predicate (the attempt-count disjunct struck wherever it appeared; attempt movement recast as diagnostic-only).** (1) §2, A1 row: the predicate is now stated expressly as **done_outer > done_inner**. (2) §2: the review-corrections table added (R1–R3 rows). (3) §4.10, WAIT-entry paragraph: the baseline sentence rewritten — the done count is the predicate's sole baseline; dispatches and attempt/execution counts are recorded as diagnostic evidence only. (4) §4.10, extension paragraph: rewritten — the OR-disjunct ("or the plan's cumulative attempt/execution count exceeds…") struck; the strict rule stated (earned iff done_outer > done_inner, and by nothing else); attempt/execution movement expressly insufficient and diagnostic-only. (5) §4.10, worked example: the parenthetical "(or its attempt count moved)" struck; the sole-condition note added; **no time or deadline in the example changed**. (6) §5, GO passage: "earned only by real progress (more segments done, or more attempts, …)" conformed to the done-count-only rule, with the no-credit-for-attempts clause stated. (7) The ROWAN-CP: its A1 paragraph conformed identically.

**R2 — extension deadline disposition (no deadline changed).** §4.10: a disposition paragraph added after the deadline definitions — the proposal's extension ("one further window (second reset + 4 hours)", proposal §3-C) quoted; this package's adopted **outer boun