# W-4 TRACK B — L-1 EXECUTION RECORD

**Case:** Opal Roundtable, issue #15 · **Handoff:** `RT-H-20261114-0b3c9f`
**Gate window:** Saturday 2026-11-14, attended. Julie's execution GO recorded 16:49Z (board 6880966098); census from 16:50:15Z; the invocation at 16:50:53Z; witness window to 17:30:54Z; terminal census completed ~18:05Z.
**Operative specification:** the corrected L-1 execution package (pin `98ec992a…`) jointly with Rowan's execution-package ruling (board 6880952638).
**Outcome: INCONCLUSIVE** — checkpoint 3 satisfied at full strength; checkpoint 4's conjunctive cadence tolerance not established on the named rows. Full evidence below for Rowan's disposition. **Counted acts: exactly 1** (the single authorized evaluation). The gate concludes HELD (generation); the chain is observed live at the closing boundary.

Review pin (repo `jedavid33-design/opal-reader`, branch `ui1-review`): `<PIN>`

## 1. Gate-entry census and checkpoint 0

The census's first read was checkpoint 0's first instance (L-G2 sequencing): latest pass **451** at 1794024228557, complete; reported registration **1794024828557**; pending 1/1; `recordingFailures` 0; repair-status initialized, zero strikes, no intents, no events — **the frozen baseline matched exactly.** All remaining census items at their expected values: build `8a16def4…` (etag `611a23c8…` captured), halt `"1"`, phase policy `"enforce"`, observability intact, latest deployment the deployment gate's PATCH record; queue paused, sole consumer `f260f218…`; containment NORMAL/verified, `updatedAt` 1793933356719, episode-3 summary; capabilities halted / `batch_not_armed`; reconcile `ok` with the known adjudicated exception; phase accounting settled 1,406,466 / estimatedUnverified 19,018 / reservedUnverified 5,648 / remaining 12,087,886; exactly four conflicts; six plans at standing states (smoke `parked_quota`) + parked job `parked_policy` rev 1; settings revision 1; watermarks 18/1861. **Checkpoint 0 repeated immediately before invocation: baseline matched again.** Final checks: queue-pause read-back ~1 minute before invocation (paused, consumer unchanged); no 1101 signature on any gate read (WAIT cleared); GO validity and exclusive control confirmed in-window; strike eligibility 0 outstanding. Witness independence: no scheduler exists (A-3 unbuilt); the deployed repair route is operator-invoked only; pre-existing instrumentation (weekly peek — Saturdays 09:47 ET, outside this window; the retired-plan monitor) is read-only and cannot produce a pass; no competing wake, command, or mutation occurred during the window.

## 2. The single invocation (counted act 1 of 1)

The body was constructed and verified offline against the corrected package before sending (exact keys; action `evaluate_repair`; both text fields within limits; serialized form archived with the gate evidence):

```json
{"action": "evaluate_repair", "authorizationRef": "L-1 execution — Julie GO, board comment 6880966098", "reason": "L-1 first-use liveness witness: single authorized A-1 evaluation as the gate's sole stimulus, execution package RT-H-20261114-338a9f as accepted by Rowan."}
```

- **T0 (request-send): 2026-11-14T16:50:53.422Z** (epoch 1794675053423). Response received 16:50:54.060Z. HTTP 200.
- **Outcome: `registered`.** evaluationId 1; predicate P-STALE; `actInitiated: true`; `commitmentSyncEstablished: true`; due 1794024828557 (the earliest pending due, as the package predicted); **read-back registration 1794675054811**.
- The four evidence stages, kept distinct (L-G4): (1) the setAlarm call completed inside the evaluation (actInitiated, sync-established); (2) the reported registration read back as 1794675054811 — a *new* value near the invocation instant, not the registered due (the read-back raced the delivery; the value is recorded, its precise platform mechanics not interpreted); (3) observed handler delivery — pass 452 (§3); (4) independently observed continuation — the pass sequence (§4).

## 3. Checkpoint 3 — SATISFIED

**Pass 452: `at` 1794675054894 — 1,471 ms after T0** — stage complete, error null, `armedAfter` **1794675654894** (advanced beyond the pre-stimulus registration), `recordingFailures` 0. Well within the 15-minute bound (deadline 1794675953423). The stimulus outcome is established (§2), and the pass is demonstrably subsequent to it.

## 4. Checkpoint 4 — NOT ESTABLISHED AT THE SPECIFIED TOLERANCE

The named continuation rows are consecutive, complete, error-free, with `armedAfter` advancing at every row — and the chain continued autonomously for the entire window and beyond (16 consecutive complete passes observed by the terminal census, zero failures, no intervention of any kind). The inter-row gaps, however, are **not** all within the required [5, 20] minutes:

| Row | `at` | Gap from previous | `armedAfter` |
|---|---|---|---|
| 452 | 1794675054894 | — (T0 +1,471 ms) | 1794675654894 |
| 453 | 1794675654944 | 600,050 ms (10.00 min) ✓ | 1794675954894 |
| 454 | 1794675954895 | **299,951 ms (4.999 min) ✗** | 1794675984895 |
| 455 | 1794675984896 | **30,001 ms (0.50 min) ✗** | 1794676254944 |
| 456 | 1794676254995 | 270,099 ms (4.50 min) | 1794676854895 |
| 457 | 1794676854964 | 599,969 ms (10.00 min) | 1794676854995 |
| 458 | 1794676855091 | 127 ms | 1794676884964 |
| 459 | 1794676884965 | 29,874 ms | 1794677455091 |
| 460 | 1794677455146 | 570,181 ms (9.50 min) | 1794677754964 |
| 461–467 | … | 299,866 / 30,001 / 270,199 / 599,846 / 154 / 29,846 / 570,219 ms | advancing throughout |

Rows 453→454 misses the 5-minute floor by **49 ms**; 454→455 by ~270 s. The specification is explicit that gaps far below cadence do not satisfy the predicate and that rows may not be skipped to construct a sequence. **Checkpoint 4 is therefore not established at its specified tolerance**, and the outcome is classified **INCONCLUSIVE** under B-R4 (checkpoint 3 satisfied; continuation not established at the specified criteria). This classification is the executor's application of the agreed criteria, offered for Rowan's disposition with the complete evidence.

**What the passes were doing (observed, mechanism labeled as interpretation):** every pass from 452 onward worked the smoke plan's grant lifecycle — pass outcomes name grants `…:ch3:6:full` (452), `…:ch3:7:full` (454), `…:ch3:8:full` (457) — the revived chain resumed processing the parked plan's schedule rows, whose dues and lease mechanics set the irregular spacing (bursts of near-term rows alternating with ~5–10-minute dues). The spacing pattern is consistent with backlog cascade rather than with retry bursts or duplicate deliveries (each row is a distinct complete pass doing distinct grant work; no error rows exist) — recorded as interpretation, not as a criterion.

## 5. Strike accounting (L-G5, five parts)

(1) **Intent existence:** yes — intent event id 1 at 1794675054777 (P-STALE; armedObserved 1794024828557; latestPassIdBefore 451). (2) **Completion record:** yes — completion event id 2 at 1794675054811, outcome `registered`, actInitiated, due and read-back as §2. (3) **Effective outstanding strikes: 0** (authoritative derivation). (4) **Recorder-derived discharge eligibility: established** — the derivation lists intent 1 in `dischargedIntentIds` (two consecutive complete passes with handler-entry timestamps strictly later than the completion timestamp: 452, 453). (5) **Durable discharge-event existence: no** — the audit surface holds exactly the intent and completion events; no discharge event row exists (the cached projection consequently still displays `strikes: 1`; the derivation governs). No evaluation or acknowledgment was used to persist or clear anything during this gate, per the package.

## 6. Terminal census (checkpoint 5)

Compared against the gate-entry census: /health build `8a16def4…`, halted ✓; queue paused, same consumer ✓; containment NORMAL/verified, unchanged ✓; capabilities halted ✓; reconcile `ok: true`, censusComplete, drift [] ✓; **phase accounting bit-identical** (settled 1,406,466 / 19,018 / 5,648 / 12,087,886) — **zero provider expenditure** ✓; **providerDispatchesToday 0 — zero provider dispatches** ✓; conflicts exactly 4 ✓; settings revision 1 ✓; watermarks content 18 / bindings 1861 with zero binding changes ✓. Two gate-consequence movements, both recorded and both attributable to the witnessed chain operation (the gate's authorized stimulus), not to any operator act: **(a)** the smoke plan's stored state moved `parked_quota` → `active` (totals unchanged {20, 19, 0, 0, 0}; stopReason cleared) — the revived chain resumed its lifecycle; with the halt asserted, `sendGrant` is never wired, so its successor grants cycle undelivered and **nothing can dispatch**; the quota surface shows the bookkeeping (ledgerSeq 350 → 359; `providerReservedToday` 12 = one cohort reservation; `attemptsToday` 1 on the server attempt ledger against `providerDispatchesToday` 0 — reported as observed; no provider request occurred); **(b)** the recorder/alarm state at close: latest pass **467**, all complete; reported registration **1794679555058**; pending 2/1; `recordingFailures` 0. The chain is **observed live at the closing boundary**; no indefinite-liveness claim is made (ruling §9), and future recurrence remains possible.

## 7. Deviations and limitations

No STOP fired; no deviation from the operative specification occurred; the single counted act was the authorized invocation. The classification limitation is §4's: the witness criteria's cadence tolerance was written for a clean-cadence chain, and the revived chain's backlog cascade does not meet it on the named rows — the substantive question (whether 16+ consecutive autonomous complete passes satisfy L-1's proposition) is Rowan's to disposition on this evidence. As established in prior rounds: these observations do not prove platform alarm-delivery mechanics, and W-4's causation remains unestablished. **W-4 remains an OPEN HISTORICAL DEVIATION.** A-3 remains separately gated; generation turn-on remains separately gated; no acknowledgment was made or is implied.

**Turn: Rowan's** (documentary review and disposition of the L-1 outcome). Then Julie's.
