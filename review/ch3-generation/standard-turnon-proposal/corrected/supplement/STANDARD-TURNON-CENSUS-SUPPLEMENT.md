# STANDARD TURN-ON — CENSUS-SURFACE SUPPLEMENT

**Case:** Opal Roundtable, issue #15 · **Handoff:** `RT-H-20261114-9dfbfe`
**Supplement to:** the corrected Standard execution package (pin `a6616a0d…`), per Rowan's corrected-package ruling §2–§5 (verbatim board 6882938432). Prepared under Julie's preparation GO (board 6882034835). **Offline only — no production contact.** All surface claims are from the deployed A-1 candidate source (pin `8a16def4…`) or from saved gate artifacts, cited. Where this supplement amends the corrected package, the supplement governs.

**Review pin (repo `jedavid33-design/opal-reader`, branch `ui1-review`):** `<PIN>`

## 1. The surface inventory (ruling §2)

`jobView` is confirmed as Rowan states (coordinator :4260–4273): grants carry **grant_id, state, revision only**; the package's attribution of further fields to that read is corrected here. The full inventory for every census fact:

| Required fact | Surface (route → builder) | Fields | Strength |
|---|---|---|---|
| Grant identity + state, all grants on the job | `GET /v2/jobs/<jobId>` → `jobView` | grants[].{grant_id, state, revision}; job.{state, revision, chapterIndex, lane} | **Direct** |
| Occurrence posture (claim-adjacent) | `GET /v2/d6-plans/<planId>` entries; jobView occurrences | entries[].{occurrenceState, executionState, disposition}; occurrences[].{state, revision_key} | **Direct** at the granularity the system exposes; no separate claim object exists on any read surface (claims are internal lease rows) |
| Per-attempt history for an occurrence | `GET /v2/d6-diagnostics?jobId=` → `attemptDiagnostics` (service.mjs:1569) | per-occurrence {state, stage} + attempts[].{attemptId, seq, outcome, costMicroCents, providerRequestId} | **Direct** |
| Reservation aggregate + day accounting | `GET /v2/quota` → `quotaView`; `GET /v2/d6-quota-reconcile` | providerReservedToday, attemptsToday (net, §3), providerDispatchesToday; reconcile {ok, censusComplete, drift} derived from unique reservation/dispatch rows (quota-budget §1.4) | **Direct (aggregate)** |
| Reservation identity/detail for a *terminal* grant | `GET /v2/d6-grant-finalization-preview` → grant-finalizer | per-occurrence reservation {reservationId, dayKey, slotsTotal, slotsConsumed, state, closeReason} + attempts totals | **Direct, within its domain** (finalizable grants); not a live-grant census surface |
| Live grant's reservation ownership + amount | Chain: jobView (the job's sole non-terminal grant) + plan detail (sole granted occurrence) + source cohort constant (12 slots) + quota aggregate corroboration (providerReservedToday == 12 ⇔ exactly one cohort outstanding) | — | **Indirect, convergent** |
| Live grant's lease expiration | **No surface returns it.** Chain: LEASE_MS = 15 min (coordinator :732); issuance bounded by the first pass outcome naming the grant (handler-entry timestamp); an expired grant is voided by the live chain's expiry processing | — | **Indirect.** No gate decision needs the exact expiry: the boundary repeat (§4) re-establishes identity + state at the moment of lift, and successor movement is governed by the package's permitted-movement rule |
| Outbox payload / delivery-attempt timestamps | **No surface returns them.** Chain in §2 | — | **Indirect (accepted in principle, ruling §1)** |
| Queue backlog / in-flight | cf-api queue GET (saved artifact, deploy evidence `queue-s1.json`): fields are queue_id, name, settings, producers, consumers — **no backlog or in-flight count exists in the object** | — | **Not directly observable.** Chain in §2 |
| Command outcome (Stage 2 reconciliation) | `GET /v2/commands/<command_id>` → `receipt()` (api.mjs:221; coordinator read model) | {command_id, type, outcome, outcome_json fields, received_at} | **Direct** (§5) |

## 2. The two indirect chains, stated narrowly

**Deliverability (outbox).** Rowan's qualification is honored: `issued` alone, and the absence of `handoff_uncertain` alone, prove nothing about sends — `drainOutbox` (:2479–2521) records attempts before invocation and a grant may remain `issued` after an acknowledged send. The load-bearing fact is therefore **provenance within the held interval**, and it is established, not assumed: `GENERATION_HALT` was flipped to `"1"` on 2026-11-07 (suspension close, deployment record) and **every** settings/health read at every gate since — the deployment census, the L-1 census twice, the L-1 terminal census — has returned it `"1"` with no intervening lift authorized or recorded. Every post-revival grant (ch3:6 onward) was **issued inside that continuously held interval** (issuance bounded by pass outcomes from 2026-11-14T16:50Z). While the halt is `"1"`, the entry does not wire `sendGrant`, and the coordinator drains the outbox **only** through that handler (:4036–4037) — so for these grants **no send attempt was possible**, irrespective of drain bookkeeping order. Grants ch3:1–5 predate the interval and stand `reported` — delivered and reported in November, history rather than risk. This is not described as direct outbox inspection.

**Queue posture.** The queue object exposes no backlog figure (§1). The bounded chain: the queue's **sole producer is the worker itself** (producers list, saved artifact); production happens only via the same unwired-while-halted drain path, so **no message has been produced since 2026-11-07T04:49Z** (the re-pause), and the pre-pause window's traffic is accounted in the turn-on 1 record (all grants terminal or reported; a stale message for a terminal grant is refused at apply by grant state). The residual — a pre-existing message surfacing at unpause — is governed by ruling §5's own posture (the halt prevents provider execution) plus the operative control in §4: the boundary census repeat runs **after** unpause and **before** the halt lift, so any consumer-visible movement is observed and must be explained before act 2, else STOP. **Conclusion: no unresolvable material delivery risk remains; the census-surface blocker is resolved at the strengths tabled above, with no code change.**

## 3. ST-G2 clarifications (for the record, and for Julie's GO presentation)

- **`attemptsToday` is a NET count** (coordinator :2535–2538): attempt operations minus `attempt_release` operations for the day. The L-1 terminal value 1 is net of the void-releases across the revival cycles — **not** a count of historical issuances (≥5 occurred). The corrected package's phrasing is amended accordingly wherever it appears.
- **Expected smoke-test expenditure:** ≈ **$0.43** (Stage 1 ≈ $0.02 + Stage 2 expected 410,880 units ≈ $0.41) — an estimate from the cost model, **not a cap**.
- **Operator STOP threshold and its limitation:** during generation the executor polls the accounting surfaces and STOPs the gate on unexplained movement, foreign generation, a >35-minute stall, or settlement beyond the stages' expected figures. This is **reactive, poll-based** supervision — it bounds response, it is not a hard spending ceiling, and it is not represented as one.
- **Source-enforced ceilings (the actual hard bounds):** the FP phase budget of $13.50 (settlement refuses beyond it; headroom at census ≈ $12.09); the settings monthly cap of $50; the provider-attempt rule (consumed = dispatched + reserved ≤ 100/day; a fresh cohort admission requires consumed + 12 ≤ 100); and the Gemini prepay balance as a physical limit (confirmed by Julie in-window). No gate act can raise any of them.
- **Pre-submission recheck (new named step):** immediately before mutation act 3 (the Chapter 5 SubmitJob) — i.e., after Stage 1 acceptance — the quota surface, reconcile, and phase accounting are re-read; Stage 2 proceeds only if all remain eligible and explained. This is in addition to the opening census, per ruling §3.

## 4. ST-G7 clarifications, incorporated

(a) The deliverable-grant census (package §1 items 5–7) **repeats at the halt-lift boundary: after act 1 (queue unpause) and before act 2 (halt lift)**, including a brief post-unpause observation for consumer activity under the halt; any unexplained movement STOPs before the lift. (b) Queue unpause may let pre-existing messages reach the consumer while halted; the halt prevents provider execution; zero queue activity is **not** claimed from the pause state. (c) **Work-stop buffer:** no Stage 2 submission after lift + 3 hours; closing acts begin by lift + 3 h 30 m at the latest, inside the 4-hour absolute deadline. (d) **In-flight at re-hold:** acts 4–5 do not cancel an already initiated provider request; if a grant is in flight at re-hold, the terminal census waits for its terminal state (reported/voided) and accounts it in full; if it cannot resolve within the deadline, it is reported as the named open item under the truthful-reporting law — holds are reported at their last-verified values, unknowns named unknown, WAIT preserved throughout.

## 5. Submission-ambiguity rule, tightened (ruling §4)

Absence of a visible plan after 15 minutes is **not** proof of non-landing. The fixed command_id makes the receipt the arbiter: `GET /v2/commands/10889ce0-fc8f-4843-bd0c-2bf3eb2a5304` — a receipt with an outcome establishes **landing** and its result; **no receipt** after the reconciliation window establishes **non-landing** at that surface's strength (the command never reached the coordinator); a receipt whose outcome cannot be classified establishes **neither** — the outcome is reported **unresolved**, the gate closes under the hold law, and there is **no resubmission** under any branch.

## 6. What is asked

Rowan: disposition of the census-surface blocker on this inventory. If accepted, the corrected package (pin `a6616a0d…`) **as supplemented here** is the execution package, and Julie's execution GO may be presented. Production remains HELD; WS2 untouched; W-4 open.

**Turn: Rowan's** (supplement disposition). Then Julie's, for the execution GO.
