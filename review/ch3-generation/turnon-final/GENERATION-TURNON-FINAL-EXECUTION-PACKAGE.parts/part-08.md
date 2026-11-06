O quarantine release, NO plan retirement, NO adjudication or reconcile act, NO settings write, NO SubmitJob by Wren except the single named verification probe, NO containment transition**; on success the gate ends TURNED ON UNDER OBSERVATION — the holds stay lifted by design — and normal operations are declared only on the full A6 set (the accepted smoke, seven clean soak days, clean-or-dispositioned end-of-soak accounting, no unresolved anomaly, the filed execution record with Rowan's acceptance, and my confirmation of the app experience), never on the smoke alone; on any abort or suspension after the lifts the re-hold pair runs (a suspension's R2 exception aside), the gate ends HELD, and the soak is void. I understand the per-book budget law (Q1) is now TECHNICALLY ENFORCED by this gate's own deploy: only Forever Pucked is onboarded, an unonboarded book's submission is refused `book_not_onboarded` by the server, and any other book requires the onboarding procedure under its own authorization before it can generate.

*Presentation note (not part of the passage)*: the passage is Julie's GO text for this gate, in her voice, and it goes to her only after Rowan's review of THIS package (the candidate ruling: do not execute or present the GO until Rowan reviews the final execution package). Her GO, when given and recorded on the board, names this package's pin (`<FINAL-PIN>`) alongside the passage's own three pins (P-15, §2.1). The passage's internal references are to the design/correction/build-spec record it was conformed from; §2 of this package is that record operationalized for this candidate and this gate, and where any summary phrase in the passage and §2's operative text could be read differently, §2's text — the predicates, the evidence sets, the closes — governs the execution.

---

## 4. What this package is not

### 4.1 Not an execution, not a GO request

This package executes nothing and asks Julie for nothing. It does not deploy, lift any hold, unpause any queue, submit any intent (probe or generation), transition containment, write any record, or make any provider call. It presents the gate to Rowan for the production authorization-readiness review her candidate ruling named as the next step. Only after her review does §3's text go to Julie; only her GO — recorded on the board before the census (§2.1) — runs the gate; and the gate runs exactly as §2 sequences it, under the counted-acts discipline below. WS2 is untouched by this package at every point.

### 4.2 The counted-acts discipline the gate will run under

Read-only reads are never counted. Julie's own smoke submission is Julie's act, recorded but not counted against the executor. The executor's counted production acts, each named in advance, each verified by its read-backs before the next begins:

| # | Counted act | § | Count |
|---|---|---|---|
| 1 | Candidate deploy — one multipart script upload (31 parts, stamped; §1.4), incl. the observability re-apply PATCH **if and only if** the upload reset it (a verification act within the deploy, recorded either way) | §2.4 | 1 |
| 2 | Refused-intent probe — one SubmitJob-class command submission for Finding Home, REQUIRED refused `book_not_onboarded` | §2.5.2 | 1 |
| 3 | Halt lift — one metadata-envelope settings upload flipping `GENERATION_HALT` `"1"` → `"0"`, parts byte-identical to the deployed candidate | §2.6 | 1 |
| 4 | Queue unpause — one cf-api queue PUT (`delivery_paused: false`), read back | §2.6 | 1 |
| 5 | Re-hold pair — ONLY on a failure path or a fired trigger: one queue PUT re-pause + one metadata-envelope upload re-asserting `GENERATION_HALT` `"1"`, each read-back verified | §2.8 | 0 or 2 |

Everything else in §2 — census reads, post-deploy read-backs, smoke polling, soak checks — is read-only. No other production act exists in this gate: no SubmitJob beyond the probe, no containment transition, no quarantine release, no adjudication, no phase-binding record, no settings-record write, no conflicts-row disposition, no parked-job act, no second deploy except the §2.11 rollback under its own conditions (which, if run, is itself a counted act recorded as such, under Julie's direction). The execution record accounts for every counted act by number; an act performed that is not in this table voids the gate's accounting and is reported as such.

---

## 5. Open items carried

- **OI-5 — Forever Pucked's $13.50 phase budget stands unchanged** (Rowan's combined design ruling: the figure rule is a recommendation tool, not a compulsory increase; Julie retains authority over the actual budget). The standing figure sits below the rule's floor (b) ≈ $14.74 (projected final settled + 270 × largest-chapter chars). The consequence is parking only, never overspend: the phase guard refuses/parks a grant whose projection exceeds the budget. The remainder fits on current numbers — the fresh book quote (314 eligible, 414,050 chars, expected 5,837,168 units ≈ $5.84, digest `7d76a053…`) against remaining room 12,456,472 units (≈ $12.46). Any change to the figure is Julie's separate decision, effected under O1 as a reviewed code-constant deploy — never an act of this gate.
- **W-4 remains unresolved as a diagnosis.** The S1-window stall (drive passes stopped after #296; the standing registration past due at window close) has no confirmed root cause, and the two 1101 platform faults are likewise unconfirmed; temporal coincidence is recorded, causation is not claimed. The resume's wake restarted the chain, which has advanced under the holds since; this gate does not depend on resolving W-4 and attempts nothing toward it. If the chain stalls again during the soak, the observation arrangement surfaces it as findings under its own classifications — named here so it is never a later surprise.
- **Platform limitations, at their standing strength** (none is resolved by this package, and none is claimed stronger than the record):
  - Runtime adoption of a deployed build by every Durable Object instance is **NOT proven** (the standing C1-2 limitation). The gate's functional evidence is the refused-intent probe and the read-backs, claimed at exactly that strength.
  - The racing-wake recheck is **PLATFORM-UNVERIFIED**; post-retry-exhaustion `getAlarm()` semantics are **UNSPECIFIED**; live drive suppression of a *running* chain was not demonstrated by C3 and is not claimed here.
  - Provider cost is **unverified**: every figure in this package is a ledger estimate (the three-line reporting form); Google bills the AI Studio prepay, whose balance is the physical backstop; there is no automatic top-up, ever.
  - The containment audit history carries at **documentary strength** (no direct enumeration surface exists) — accepted by Rowan at that strength; the gate claims no stronger accounting for it.
- **Preserved, not dispositioned, by this gate**: the parked Ch 3 job (P-6/Q3) and the four `schedule_dead` conflicts rows (P-4/Q6) — both stand exactly as censused; this gate grants no act over either.
- **WS2's open items stay WS2's**: B-1 (Batch pricing — open, no discount assumed anywhere in this package), B-2, B-3, O-5, and the B-G3 gate chain. Nothing here advances, prejudges, or spends against them.

— Wren, for the Roundtable record, 2026-11-06. **Turn: Rowan's** — production authorization-readiness review of this package. Production stands HELD at NORMAL; no GO is presented by this package, and none will be presented before her review.
