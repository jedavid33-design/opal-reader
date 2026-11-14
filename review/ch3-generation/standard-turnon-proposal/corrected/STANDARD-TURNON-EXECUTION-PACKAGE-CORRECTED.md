# STANDARD TURN-ON — CORRECTED EXECUTION PACKAGE

**Case:** Opal Roundtable, issue #15 · **Handoff:** `RT-H-20261114-cc407c`
**Prepared under:** Julie's Standard turn-on preparation GO (board 6882034835); incorporates Rowan's proposal ruling ST-G1–ST-G8 (verbatim board 6882886761) in full. This package returns for Rowan's documentary execution-gate review; **Julie's execution GO is sought only after that review.** Preparation made **no production contact**. Production remains HELD.

**Review pin (repo `jedavid33-design/opal-reader`, branch `ui1-review`):** `<PIN>`

## 1. ST-G1 — Gate census: establish, do not infer

Two passes: the **opening census** at window start, and a **release-boundary repeat** of items marked ‡ immediately before mutation act 1. Any unexplained mismatch STOPs pre-lift under the executor law.

1. ‡ /health: build `8a16def4…`, halted. 2. ‡ Script settings + etag capture: halt `"1"`, 10 bindings, observability intact. 3. ‡ **Queue, independently:** cf-api queue object read — `delivery_paused` true, sole consumer `f260f218…`, **and the backlog/in-flight fields exactly as the surface returns them, recorded verbatim**; an empty queue is claimed only to the extent those fields establish it, never inferred from the pause state or from zero dispatches. 4. Containment NORMAL/verified, `updatedAt` unchanged. 5. ‡ Capabilities: halted; FP phase accounting vs baseline (settled 1,406,466 / est 19,018 / reserved 5,648 / remaining 12,087,886) — movement requires named explanation or STOP. 6. **Grant inventory (the deliverable-work census):** the smoke job read (`GET /v2/jobs/plan:8f14c8885548b9c5ddd6b8df:ch3`) enumerating **every grant with its state** — `:ch3:1–5:full` expected `reported`; every post-revival successor except the live one expected in a terminal state (`voided` / `lease_expired_undelivered` family); **the live grant identified exactly**: id, job, occurrence `f4b451a5-b496-4392-90f8-079c3b142e5c` (position 107), state `issued`, lease unexpired at read time, reservation ownership = the standard 12-slot cohort, claim state from the same read, and **no grant in `handoff_uncertain` or any unresolved state anywhere on the job**. 7. ‡ `drive=1` diagnostics: recent pass outcomes corroborating the grant sequence; recorder per §3. 8. **All six plans** re-read; smoke plan `active`, totals {20, 19, 0, 0, 0}; **the parked-policy job `1832c21f…` re-read unchanged** (`parked_policy`, rev 1, grants []); other plans at standing states. 9. **Quarantine** on the smoke plan: held false. 10. Conflicts: exactly the four preserved rows. 11. Settings revision 1. 12. Watermarks content 18 / bindings 1861 (1862 only after Stage 1's publication). 13. Repair-status: intent 1 discharged by derivation; no new intents. 14. ‡ Quota surface + **reconcile (full body archived)**: all four ST-G2 categories read; reconcile `ok` with drift [] modulo the known adjudicated straddler and the day's explained cycling bookkeeping — **unexplained drift is a STOP; an explanation does not convert it into authority**. 15. ‡ **Re-quotes:** Chapter 4 remainder (chapterIndex **3**) expected 1 eligible (position 107); Chapter 5 (chapterIndex **4**) per §4. 16. ‡ **Gemini prepay balance confirmed by Julie in-window** (AI Studio) — the historical figure does not satisfy this item.

**Permitted successor movement:** between census and lift, and during Stage 1, the live grant may be succeeded only by the next sequential grant (`:ch3:N+1:full`) for the same job and occurrence, via the expiry/safe-void path, each movement evidenced in pass outcomes or the job read. Any other identity change = STOP.

**Surface limit, named per ST-G1's blocker rule:** no read surface exposes an outbox row directly. Outbox/delivery-attempt status is therefore established indirectly and completely as follows: the live grant's state is `issued` (not invoked, not uncertain) on the job read; `GENERATION_HALT` has been continuously `"1"` since before the grant's issuance (settings record + every gate read), and the delivery handler is wired only when it is not `"1"` (source, coordinator :4036–4037) — so no send has been attempted for any grant issued under the halt, and an attempted-but-unacknowledged send (the `handoff_uncertain` path) is affirmatively excluded by the absence of that state in item 6. If direct outbox evidence is required beyond this chain, that is the specific blocker, returned here in advance for Rowan's disposition; no mutation will be added to obtain it.

## 2. ST-G2 — Quota and spending envelope

Four categories are kept distinct in every gate read and in the record: **server attempt-ledger count** (`attemptsToday`), **provider-attempt reservations** (`providerReservedToday`), **actual provider dispatches** (`providerDispatchesToday`), and **expenditure** (settled / estimatedUnverified / reservedUnverified, phase surface). **Source-enforced rule** (`quota-budget.mjs`): consumed = dispatched + reserved; the day's consumed may not exceed `PROVIDER_ATTEMPT_DAILY_LIMIT` = 100, and a fresh cohort admission requires **consumed + 12 ≤ 100** (the 12-slot worst-case cohort). The November observations (1 attempt, 12 reserved, 0 dispatches) are historical, **not** assumed invariants: the census reads the gate day's actual values, and Stage 2 proceeds only if the source rule admits the Chapter 5 cohort at submission time. **Envelope:** Stage 1 = 1 occurrence (1,461 chars; model estimate ≈ 20,600 units); Stage 2 = 21 occurrences, expected **410,880 units** — an **estimate, not a guaranteed maximum**; the binding ceilings are the FP phase budget (remaining 12,087,886 units; settlement refuses beyond it), the settings $50 monthly cap, and the 100/day attempt limit. Expected combined spend ≈ $0.43 against ≈ $12.09 of phase headroom. **Park behavior:** if either chapter parks on quota or budget, that stage ends immediately; a Stage 1 park ends the gate (no Stage 2); a Stage 2 park ends generation work; in both cases the gate proceeds to the closing acts and reports — a park is an outcome, never a retry trigger. **No** automatic top-up, cap increase, retry allowance, or budget expansion is part of this gate; a needed Gemini top-up is Julie's separate act under her standing rule, outside the gate.

## 3. ST-G3 — Recorder and fault readiness

The basis is Rowan's separately accepted **due-aligned autonomous-continuation finding** — not an L-1 or P-12 PASS, and it is not renamed one. Census requirement (item 7): the two most recent complete passes each delivered **≤ 5 minutes after** their preceding reported due times (handler-entry `at` vs the predecessor's `armedAfter`); the latest reported registration is **not overdue by more than 20 minutes** at census; `recordingFailures` 0; no error rows at the head of the pass list. No ten-minute spacing is required (lifecycle deadlines legitimately govern the schedule), and **no hash-chain verification is claimed**. A renewed chain silence or a 1101 signature at any point invokes the standing STOP/WAIT law; **no automatic A-1 invocation** follows from it — any future evaluation is a separate gate.

## 4. ST-G4 — The two authorized stages, and nothing else

**Stage 1:** the lift (§5) delivers the live grant; position 107 (displayed **Chapter 4** = persisted **chapterIndex 3**, zero-based — the correspondence verified at census by the plan identity and the item-15 re-quote) completes; the chapter reaches **20/20**. The live grant's delivery and its ordinary lifecycle consequences are authorized internal consequences of the lift, **not** operator mutation attempts (ruling ST-G4).
**Stage 2 — only after Stage 1 is complete, accounted for, and accepted by Julie:** the Chapter 5 submission (§6). Chapter 5 displayed = persisted **chapterIndex 4**. Re-quote verification at census: bookId `5c589095-f812-48a2-8ab2-03ba2791f2b2`; **21 eligible; 29,145 chars; expected 410,880 units; digest `831e456db0d82373d2f408fd9e37d6d9a3dd46e9f2419153be7d2d9755b60f94`**; quota/phase eligibility current. A digest or figure mismatch = STOP.
**No other generation is authorized** — no other book, chapter, or occurrence, under any reading of this gate.

## 5. ST-G7 — Mutation inventory, ordering, and closing law (five acts, no more)

1. **Queue unpause** — cf-api PUT `delivery_paused: false`; read-back: paused false, consumer unchanged. (Nothing can flow yet: halt still asserted, no delivery handler wired.)
2. **Halt lift** — settings-envelope flip `GENERATION_HALT` `"1"` → `"0"`, all other parts byte-identical; read-backs: binding `"0"`, /health live, etag unchanged, observability intact. → Stage 1 runs on this act's consequences.
3. **Chapter 5 SubmitJob** — §6, exactly once, after Stage 1 acceptance. → Stage 2 runs.
4. **Halt restoration** — flip `"0"` → `"1"`; read-backs mirror act 2. **A mandatory closing act, not an optional retry.**
5. **Queue pause restoration** — PUT `delivery_paused: true`; read-back paused true. **Mandatory closing act.**

**Partial-lift handling:** if act 1 lands and act 2 fails or refuses, restore the queue pause at once (act 5, exercised early as the closing response) and stand down. If act 2's outcome is ambiguous, resolve it by reads only (settings + /health); a flip is never re-sent to "make sure." If reads establish the halt lifted, Stage 1 accounting applies and the gate proceeds directly to closing acts once Stage 1's state is established.
**Absolute deadline:** lift + **4 hours** is the hard end for all five acts and the terminal census; the 35-minute sliding stall windows operate only inside it. At the deadline the gate moves to closing acts (or to WAIT-law reporting, below) regardless of stage.
**Closing under fault (WAIT preserved):** if a 1101 signature prohibits acts 4–5, do not force them. Report the **actual last-verified** halt and queue states; any state that cannot be established is named **unknown**, explicitly. No claim is made that every interruption ends with verified holds.

## 6. ST-G5 — The Chapter 5 submission, in full

Exactly one attempt, via `POST /v2/commands` (client connector, production scope headers), body in full:

```json
{"command_id": "10889ce0-fc8f-4843-bd0c-2bf3eb2a5304", "type": "SubmitJob", "payload": {"bookId": "5c589095-f812-48a2-8ab2-03ba2791f2b2", "lane": "standard", "data": {"d6Intent": {"scope": "chapter", "chapterIndex": 4, "phase": "forever-pucked", "keepGoing": false}}}}
```

The command_id is fixed here, in advance, so the outcome is reconcilable read-only: the plans list (a new FP plan for chapterIndex 4), its job read, and the eligibility surface. **An ambiguous response does not authorize resubmission:** reconcile by reads for up to 15 minutes; if the plan is found, the submission landed and Stage 2 proceeds; if no plan exists after the window, the submission is treated as not landed, the gate stands down to the closing acts, and any resubmission requires a fresh gate. Julie's role in both stages is playback acceptance. (Per ST-G5, this proves the controlled Standard path; the in-app submission workflow remains a separate release-readiness item.)

## 7. ST-G8 + ST-G6 — Acceptance, terminal census, end state

**Per chapter, all required:** only the authorized occurrences processed; provider-attempt and expenditure accounting verified against §2's four categories; grants, claims, and reservations reconciled on the job reads; the binding published (watermark 1861 → 1862 for Stage 1; Stage 2's publications enumerated) and chapter completion verified on the plan reads; no new unresolved billing or delivery uncertainty; **Julie's playback acceptance**. Playback rejection, quota park, budget park, policy block, stall, foreign generation, or unexplained accounting movement **prevents proceeding** to the next stage; no automatic retry or alternate submission exists.
**Terminal census:** the §1 surfaces re-read; resulting accounting, remaining work, recorder state, and restored holds established and recorded; the four preserved conflicts untouched throughout.
**End state (ST-G6): the gate concludes HELD — including on success.** Successful generation and playback of both chapters is the functional milestone; it does not authorize subsequent chapters. A later operational-release proposal may rely on this smoke evidence and be substantially narrower.

## 8. Authorization boundary

Nothing in this package is authorized yet. After Rowan's documentary execution-gate review, Julie's execution GO in an attended window authorizes exactly §5's five acts and §4's two stages. WS2/Batch untouched; A-3 separately gated; W-4 remains an open historical deviation; production remains HELD.

**Turn: Rowan's** (documentary execution-gate review). Then Julie's, for the execution GO.
