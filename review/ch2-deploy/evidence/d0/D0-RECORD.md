# Step D0 — quiescence + closed inventory: PASS (read-only)
Two complete samples >=10 min apart under containment:
s1 2026-10-30T20:41:52Z, s2 2026-10-30T20:52:19Z (10m27s apart).
Canonical assessments (assess-s1.json / assess-s2.json) are IDENTICAL
across every compared value, and match DEPLOY-PROPOSAL.md section 2:
- /health build f3b6e6e9fd7a44532ceef86e484a79e466b36d4d, generation
  "halted", coordinator "armed"; script etag
  82b3be1db8a75758128cab38b363985795ac223bdf1812d9698c5c8a07730545.
- Queue delivery_paused true, sole consumer f260f2188d80426bb0588685e9d084eb;
  v1 queue paused, sole consumer opalreader-api.
- Bindings exactly the 10 expected names; GENERATION_HALT "1";
  OPALREADER_PHASE_POLICY "enforce". Observability enabled + logs
  enabled + persist.
- Settings revision 1 (lane standard, monthlyCap 50); quota
  attemptsToday 0 / spentMicroCents 371485 / ledgerSeq 19 (grant-time
  estimates, not provider spend).
- Watermarks content 18 / bindings 1800 (7 content entities, 1800
  binding entities).
- Plan list exhaustive (nextCursor null): exactly smoke complete +
  Ch 2 plan:603ab416bd67ab1b25de97be halted_unknown /
  phase_halted_unknown_billing; totals eligible 18 / done 0 /
  failed 8; entries 20 bound_already + 18 eligible; entry execution
  states 8 failed + 1 unknown_billing + 29 none.
- Diagnostics (execution-plane only; NOT proof of no queued
  message): Ch 2 exactly 9 records (8 failed at commit + 1
  unknown_billing), 51 attempts ALL phase "confirmed" (1 outcome
  "unknown"); smoke 2 records (1 failed split parent + 1 committed),
  7 attempts all "confirmed" — 58 attempts total, ZERO in
  "reserved"/"dispatching".
- Grants: smoke job and Ch 2 job each carry exactly one grant,
  state "issued", revision 2 (grant IDs as recorded at Gate 1);
  Ch 3 grants [].
- Ch 3 job parked_policy; fingerprint recomputed by the G8 recipe =
  b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282 (exact).
- /v2/conflicts: exactly the two recorded schedule_dead rows.
- Neighbors: v1 etag ea6f819665cb92ad91b5c42166704860e8a85c573cc86223b96ec3b722224891;
  staging etag 61553a072a162db80c606f9f3c03aea1c1344d57b0fefe11675acd470d200e81.
No drift between samples or from the proposal pre-state. No STOP.
