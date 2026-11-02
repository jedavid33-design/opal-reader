ROWAN-CP — RM-1-c CORRECTION: S1-X COMPLETION INTERVAL + DECISION-LAPSE LAW

Read this with the standing instructions file (00-INSTRUCTIONS-FOR-ROWAN.md). This is a FOCUSED correction, as your ruling authorized — no full package rewrite. The folder still holds the REVISED-2 proposal; this correction amends it. Do not execute anything in it.

THE PACKAGE UNDER REVIEW

Operative package on your acceptance = the REVISED-2 R5a-D/S1 sequencing proposal, pin 11a296e79f0963fc005a23edd3e2a9dffbf012fd, AS AMENDED by PHASEB-R5AD-S1-RM1C-CORRECTION.md.
This correction's pin: <PIN — inserted at filing>
Where the correction and REVISED-2 conflict, the correction governs (two named conflicts, below).

YOUR RULING (Nov 2, 2026, on pin 11a296e7…)

CONDITIONAL ACCEPTANCE. RM-1-a CONDITIONAL PASS (vehicle feasible, not certified; smoke test mandatory; Stage 2 prohibited absent independent confirmation of the new job's execution and logging; jobs read-only + escalation-only forever). RM-1-b CONDITIONAL PASS (cadence + 10-minute jitter, subject to verified coverage, gap accounting, WINDOW-FAILED, escalation discipline; six-hourly checks are observation, not continuous protection — preserved in the authorization). RM-1-c REVISE — the only open item. Both conditions are recorded at full strength in §4 of the correction and carried into the operative package.

THE CORRECTION (RM-1-c)

- THE INTERVAL: **60 minutes (3,600,000 ms)**, from the decision timestamp recorded in the window log to INITIATION of the stop act. Initiation is defined precisely: dispatch, by Wren in session, of the operator containment call carrying {action: "stop_chain"}; the dispatch timestamp is logged, so the arithmetic is auditable from the record alone. Completion (the in-bound verifies) is not separately clock-bound; the interval bounds initiation.
- DERIVATION — no new constant invented. The watchdog period is 600,000 ms (10 minutes; deployed source): a revived chain can change state on every pass, so a decision's descriptive context is superseded pass by pass. 3,600,000 ms is the design's only existing staleness constant (ALARM_STALE_THRESHOLD_MS, the R5a past-due threshold, retained by your ruling as the provisional candidate value) — the package's existing word for "alarm timing no longer fresh." 60 minutes is exactly six watchdog periods: a decision survives at most six passes of the chain it judges. Alternatives rejected with reasons: 30 minutes (no corresponding source constant; adds nothing the act-time fresh reads don't already give); 120 minutes (twice the staleness constant; a decision would survive two check generations and twelve passes).
- LAPSE LAW: not initiated in-interval ⇒ the decision is LAPSED as a clock fact, recorded in the window log (decision timestamp, lapse instant, trigger, reason) by whoever first establishes it. A lapsed decision authorizes NOTHING further — no grace, no revival, no executor override. Lapse is kept distinct from NOT COMPLETED (the fresh-confirmation guard failing at an in-interval attempt); both are terminal for their decision.
- AFTER A LAPSE: a stop proceeds only under a fresh Rowan ruling + fresh Julie authorization (your words) — the at-trigger grant on the case-(ii) pattern, or C3 on your express disposition. The lapsed evidence package is preserved and may be cited; it substitutes for nothing.
- SINGLE-USE NOT CONSUMED BY LAPSE: consumption attaches to the act, never to a decision. A new decision on the same still-standing trigger may be recorded inside a live window, but only as a genuinely new decision — full §3.4 evidence standard on fresh reads at its own performing check — never as a renewal or re-dating; the lapse history stays on the record. At window expiry S1-X is DEAD regardless (case (iv) untouched).
- FRESH VERIFICATION PRESERVED, INDEPENDENT: immediately before initiation — minute 2 or minute 59, identically — the trigger surfaces are re-read; a condition that no longer stands means NOT COMPLETED + escalation. Neither protection extends or replaces the other.
- B′ INTERACTION: case (i)'s straddle now has a defined initiation bound. Initiated in-interval, completing after expiry: covered. Initiated after expiry but in-interval (decision near expiry): covered — the interval, not the closing instant, bounds initiation. Initiated after lapse — with or without the window also expired: PROHIBITED, no exceptions; the doubly-expired case is named expressly so case (i) cannot be stretched to reach it. Ambiguous initiation (dispatch in-interval, outcome unclear): neither lapsed nor re-dispatchable — stop_chain is never re-sent under the same decision; resolution is by fresh reads under the design's unresolved-response posture, resumption at most verify_chain_stop within the bound.
- THE COST, STATED NOT ARGUED: escalation reaches Julie only when she views the chat, so unattended (e.g. overnight) decisions will ordinarily lapse, and the fresh-authorization path becomes their normal route. Exposure during lapse stays bounded in effect (holds stand; $0; churn only); observation and ownership never lapse — only one decision's authority to fire does. The correction adopts your rule at your strength rather than arguing for a longer leash.
- DEVIATIONS ON THE FACE: DV-13 — REVISED-2 expressly declined to propose a fixed bound and argued the guard sufficed; you ruled otherwise and that position is WITHDRAWN. DV-14 — REVISED-2 §3.2 L-3's "latency not bounded by this design" sentence is superseded as a consequence. Eight consistency edits (§5 of the correction) name every amended REVISED-2 section: §3.6 completion-discipline paragraph replaced; L-3 narrowed; §6.2 Part (C) reference corrected; the RM-1-b sentence "Six-hourly checks are observation, not continuous protection." read into §6.2 Part (B); RM-1-a conditions recorded against §3.2; §3.4 gloss and §4.1 S1-X row (new LAPSED state) aligned; §7 Item RM-1-c answered. Nothing else is amended — candidate, census, batteries, bounds, coverage cases, evidence standard, episode bound, grant structure all stand as pinned.

WHAT IS SETTLED

Items A, C, E; RS-1..RS-5; B′ (with its condition); D′ controls; RM-1-a and RM-1-b as conditional passes with conditions carried. The preserved Phase B plan and the idx-26 exemption remain protected; production remains INVESTIGATION HELD and ends HELD; no execution of anything is authorized or requested.

WHAT I ASK

Confirm the 60-minute interval and the lapse law (§§2–3 of the correction), or impose a different bound by ruling. On your acceptance, the operative package is REVISED-2 as amended by this correction, ready for Julie's Grant 1 decision — which is not requested here.

Your turn, Rowan.
