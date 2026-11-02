# Rowan ruling — R5a-D/S1 Revised-2: CONDITIONAL ACCEPTANCE, one correction (RM-1-c) (record of relay)

> **Record note (Wren):** Relayed verbatim by Julie in the Coding Projects chat on Nov 2, 2026 (~5:37 p.m. ET). Pin reviewed: `11a296e79f0963fc005a23edd3e2a9dffbf012fd`. No board copy exists; this chat relay is the record. Verdict: **CONDITIONAL ACCEPTANCE — ONE CORRECTION REQUIRED.** RM-1-a CONDITIONAL PASS (scheduler architecture accepted incl. two window jobs, supervised exceptional checks, log/history reconciliation, tail; operating history supports feasibility but does not certify the new jobs; Stage-1 smoke test MANDATORY — Stage 2 prohibited unless the new job's execution and logging are independently confirmed; jobs remain read-only + escalation-only, never containment transitions/S1-X/commands/stimuli). RM-1-b CONDITIONAL PASS (cadence + 10-minute jitter accepted subject to verified coverage, gap accounting, WINDOW-FAILED, escalation discipline; six-hourly checks are observation, not continuous protection — preserve the limitation in the authorization). **RM-1-c REVISE**: the first-in-session completion rule with fresh-confirmation reads is insufficient without a MAXIMUM interval between the recorded firing decision and the stop act — propose a source-grounded maximum and define expiry (after it, the prior decision does not authorize execution; fresh Rowan ruling + Julie authorization required). Preserve fresh verification immediately before any stop act and the single-use S1-X budget. Return a FOCUSED RM-1-c correction + updated CP; no full rewrite unless consistency requires. PRODUCTION HOLD CONTINUES.

---

ROWAN RULING — R5a-D/S1 REVISED-2

Date: 2026-11-02
Pin: 11a296e79f0963fc005a23edd3e2a9dffbf012fd
Verdict: CONDITIONAL ACCEPTANCE — ONE CORRECTION REQUIRED

RM-1-a: CONDITIONAL PASS.

Accept the proposed scheduler-based monitoring architecture, including the two window jobs, supervised exceptional checks, scheduler-history/window-log reconciliation, and post-window tail.

The existing scheduler’s reported operating history supports feasibility but does not certify the new jobs.

The Stage-1 smoke test is mandatory. Stage 2 is prohibited unless the new job’s execution and logging are independently confirmed.

Scheduled jobs remain read-only and escalation-only. They must never execute containment transitions, S1-X, commands, or stimuli.

RM-1-b: CONDITIONAL PASS.

Accept the proposed cadence and +10-minute jitter tolerance, subject to verified coverage, explicit gap accounting, WINDOW-FAILED rules, and the established escalation discipline.

Six-hourly checks are observation, not continuous protection. Preserve that limitation in the authorization.

RM-1-c: REVISE.

The proposed first-in-session completion rule with fresh-confirmation reads is insufficient without a maximum interval between the recorded firing decision and the emergency stop act.

Propose a source-grounded maximum completion interval and define what happens when it expires.

After that interval, the prior decision must not authorize execution. A fresh Rowan ruling and Julie authorization are required.

Preserve fresh verification immediately before any stop act and the existing single-use S1-X budget.

Do not broaden the monitoring jobs’ permissions or change the accepted authorization boundaries.

Return a focused RM-1-c correction and updated Rowan CP. No full package rewrite is needed unless consistency requires it.

PRODUCTION HOLD CONTINUES.

No deploy, stimulus, containment transition, generation, or restoration is authorized.

The preserved Phase B plan and Chapter 3 idx 26 remain protected.

Turn: Wren.
