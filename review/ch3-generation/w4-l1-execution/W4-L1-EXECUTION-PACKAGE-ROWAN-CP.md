ROWAN COPY-PASTE — W-4 Track B: L-1 EXECUTION PACKAGE (for documentary review)

Case: Opal Roundtable, issue #15. Handoff: RT-H-20261114-338a9f.
Prepared under Julie's preparation GO (board 6880904065). Basis: the accepted L-1 specification (amended design §7) as refined by your deployment execution ruling §5 (board 6880501262). Production remains HELD; this package authorizes nothing; execution requires your acceptance and then Julie's separate GO naming the window.

READ ORDER (Dropbox folder "Opal Roundtable - For Rowan"; the pin carries the identical package):
1. W4-L1-EXECUTION-PACKAGE.md — the complete package: stimulus, sequence, outcomes, one-shot law.

PACKAGE IN BRIEF
- Stimulus (sole permitted, per your first-use recommendation): exactly ONE A-1 evaluation — POST /v2/d6-repair-evaluate with the body written in full in the package (action "evaluate"; authorizationRef naming Julie's execution GO record, filled at gate time; a reason naming this gate). Counted-act ceiling for the gate: one. No acknowledgment, no retry, no second evaluation, no alternative stimulus after ANY outcome — decline, error, or ambiguous response (ambiguous = read-only reconciliation, then the gate ends).
- Frozen baseline: pass 451 at 1794024228557, complete, chain intact, failures 0; reported registration 1794024828557; pending 1/1 (re-established at the deployment gate's terminal reads, 2026-11-14 ~16:00Z).
- Sequence: fresh complete census (the deployment gate's 15 items at updated expectations — build 8a16def4…, etag 611a23c8…, PLUS repair-status initialized/empty/zero-strikes) → checkpoint 0 (any pass beyond 451 or any registration advance = stimulus withheld, gate ends, GO unconsumed) → witness independence (no scheduler exists; pre-existing instrumentation is read-only and cannot produce a pass; window chosen outside the weekly peek's minute) → final checks (queue-pause read-back within 15 minutes of invocation; WAIT clearance; GO validity + exclusive control; halt; containment NORMAL; strike eligibility 0 outstanding) → the single invocation (T0 = response receipt) → observation by ~2-minute read-only diagnostics polls → terminal census.
- Expected behavior, stated honestly in the package: the registration targets the earliest pending due — the pending watchdog row's past-due 1794024828557 — so the evaluation's read-back may EQUAL the pre-stimulus reported value; delivery, not that number, is the witness. A past-due registration is expected to deliver promptly (hence the 15-minute bound).
- Criteria (unchanged, conjunctive): row 452 complete within 15 minutes of T0, chain intact, failures 0, its armedAfter advanced; rows 453–455 consecutive and complete within 40 minutes of row 452; every gap in [5, 20] minutes; each armedAfter advancing; no external intervention. setAlarm completion / reported registration / observed delivery / observed continuation recorded as distinct steps. Outcomes SUCCESS / FAILURE / INCONCLUSIVE / TIMEOUT-STOP at the accepted definitions; a clean terminal census is required for verified closure (else HELD BY LAST VERIFIED STATE; TERMINAL VERIFICATION UNAVAILABLE).
- Strike consequence named in advance: one intent is recorded; discharge follows the accepted two-consecutive-pass rule if the chain revives (labeled routine observed continuation); otherwise the intent stands unresolved at 1 of 3 strikes, for separate disposition.
- On SUCCESS the chain is live again at cadence while generation remains HELD (halt + pause unchanged; a live chain dispatches nothing while halted) — stated in advance, including that the weekly peek will then report the revival under its own rules. SUCCESS establishes bounded observed liveness only: no generation authority, no W-4 closure, no causation claim.

QUESTIONS
(i) Does the package pass documentary review as the operative L-1 gate specification?
(ii) Any correction to the stimulus body, the observation cadence, or the checkpoint mechanics?

Production remains HELD. A-3 remains separately gated. No generation release. WS2/Batch untouched.

Reply route: via Julie, as always. End by naming whose turn it is.
