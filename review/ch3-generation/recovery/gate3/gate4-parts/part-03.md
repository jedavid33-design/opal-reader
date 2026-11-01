6. All 15 §2.3 occurrences `ready` with executions `committed`; bindings watermark advanced from 1826 by exactly the new bindings (expected 1841 for 15; the record states the actual), content watermark still 18.
7. Phase accounting: settled = 732,303 + (recorded generation delta, ≤ 600,000 per §5.5); estimatedUnverified 19,018 and reservedUnverified 5,648 unchanged; unknownOpen 0.
8. Reconcile: `ok: true`, drift empty, sole straddler exception; per-day derived totals recorded verbatim for every PT day the gate touched; no open reservations remain for the job's grants.
9. Conflicts: exactly the baseline four, field-for-field.
10. Parked job: fingerprint unchanged; position 91 still `excluded_parked`; zero exemption writes.
11. Capabilities: batch still not armed; generationState `halted`.
12. Mutation count for the whole gate: exactly the §5.1 budget (4 + generation's own recorded acts, enumerated), each listed.
13. **Julie's playback check (acceptance, outside the executor's verdict):** the app shows the chapter complete (header 27/27 for the chapter's bound set as the client presents it — 26 plan/bound + the Phase B segment still outstanding, so the honest expectation is the 15 newly-committed segments playable in place); Julie taps and plays a sample including a segment she knows was in the 15. Her verdict closes the gate; the executor's read-backs do not substitute for it.

---

## 7. Stop conditions — executor STOP law

**The STOP law, in effect verbatim:** if any census item, read-back, or monitored figure differs from this proposal's expectation — even by one item, even if it looks like harmless known bookkeeping — the executor STOPs before any further mutation (or, mid-gate, executes §5.7 containment and STOPs), preserves the state, reports the exact deviation and any proposed explanation *as separate things* to Julie and Rowan, and proceeds only on a fresh explicit GO or Rowan ruling for that deviation. An executor's own explanation never clears its own stop.

Named STOPs (non-exhaustive — the law above governs anything unnamed):

- **Census mismatch** of any §4 item, exact or invariant.
- **Reconcile not `ok: true`** at census, at R1, at R2, or at any G poll (drift non-empty beyond the known straddler exception).
- **THE PHASE A STALL SIGNATURE:** a delivered grant that has neither settled nor produced a new attempt across two consecutive polls spanning ≥ 35 minutes after its first dispatch. (Phase A's signature: 41 value-identical polls over ~31 minutes *after flow had stopped*, spanning the lease fuse and three watchdog cycles; the window here is set just beyond it — **Q4** asks Rowan to confirm.) On this STOP: containment, report — **never** a finalizer call, never a resubmission, never a repair under this gate.
- **Failed disposition outside the normal split path:** any of the 15 ending `failed`, any `policy_block_terminal`, any execution reaching `unknown_billing`, any grant entering `handoff_uncertain`. (Ordinary `policy_block` attempts that split and confirm are the normal path, §3.5 — not a STOP.)
- **Foreign generation:** any dispatch, attempt, or settled delta not attributable to this plan's job — including any other book/chapter/plan activity in the window (see the Generate-button disclosure, §5.1).
- **Conflicts change:** any fifth row or any changed field, at census or at any read-back.
- **Cost ceiling:** the plan's cumulative recorded settled delta reaching 600,000 units (§5.5) — STOP + containment at the poll that observes it.
- **Identity drift:** build, etag, bindings count, settings revision, or queue consumer changing at any read-back; the plan, job, or parked-job identity differing from §2 anywhere.
- **A stopped gate is never restarted on anyone's interpretation.** The GO is consumed by the attempt, stopped or completed (§8).

---

## 8. Containment, one-way nature, and rollback position

Generation is one-way in the only sense that matters: audio generated and spend settled during G cannot be un-generated or un-spent. The gate's protections are therefore all *forward* fences — census before opening, sub-gates in proven order, the quota guard's own arithmetic, the cost ceiling, the stall clock, containment on any deviation. There is **no rollback question in this gate**: no code changes, so nothing to roll back *to*; the closing sub-gate returns settings and queue to their census values, which is a posture restoration, not a rollback, and is not subject to the rollback-floor law (the floor, build `6a73d962…`, is untouched and uninvoked — build `1c2d1d0f` runs throughout). If the gate STOPs with the plan partially advanced (some cohorts committed, some segments pending), that partial state is **preserved and reported**, not compensated: committed segments stay committed (they are good audio Julie can already hear), pending segments stay pending, and any continuation is a fresh proposal on the new facts — never a resumption of this GO.

---

## 9. Honest evidence — what success proves, and what it does not

A successful Gate 4 proves: the shipped machinery — watchdog driving, cohort bounding, delivery, execution, report-close, settlement — completed a real 15-segment plan end-to-end on the range-fix build, inside the quota and phase fences, at a recorded ledger cost at or under the ceiling. That is the first full normal-path generation cycle since the finalizer was built, and it retires the Phase A stall *empirically* for this plan's shape.

It does **not** prove: why Phase A's `handleReport` failed to close its grant (the micro-cause was never established — `stale_revision`-swallow remains a candidate, not a finding; Option B hardening was never built, and a recurrence is handled by §7's STOP, not by any fix claimed here); that the LIKE-family defect's mechanism is understood (H1 remains SUPPORTED, NOT proven — the range-fix removed the constructions, and Gate 3's 200 proves the derivation completes on the fixed build, nothing more); that generation is safe for arbitrary books, sizes, or the batch lane (untested here, separately gated); or anything about Phase B's segment, whose voice/exemption path has never run. Ledger costs are Reader-recorded figures, not provider-confirmed spend (§3.5).

---

## 10. Authorization boundaries and open questions

**Boundaries.** This filing authorizes nothing. Execution requires, in order: (1) Rowan's review of this proposal; (2) **Julie's fresh GO** for exactly this gate — one GO, one attempt, covering E0 → R1 → R2 → G → C → E4 as specified and nothing else. The GO is recorded on the board before E0. Rowan's review PASS, like every review in this family, is documentary and authorizes no production act by itself. No wake email accompanies this filing (suspended by Julie, Oct 26, 2026).

**Open questions for Rowan** (flagged, not guessed):

- **Q1 — census surface for the live grant.** The plan read exposes occurrence states but no grant object; Gate 3 verified its named grant through the finalizer preview surface. For Gate 4's census item §4.3.13 (no `handoff_uncertain` grant; live-grant identity/state), is a read-only finalizer-preview call against the *current* live grant (identified by its revision-embedded id at census instant) an acceptable census read under this gate — or should the census rest on the occurrence-state + reservation-derivation inference used in §0.2, with the grant's state named as inferred? Wren's drafting used inference only and called no preview.
- **Q2 — churn-tolerant census.** §4 writes the quota/grant items as invariants ({0, 96} reserved; dispatched exactly 0) rather than exact values, because the halt-era cycle (§0.2) makes the instantaneous value phase-dependent. Confirm this is the right strength — or specify the tighter form Rowan wants (e.g., two census reads a full lease cycle apart, both required to satisfy the invariant with *different* granted sets, proving the cycle rather than a frozen accident).
- **Q3 — end state.** §5.6 recommends ending HELD (re-pause + re-halt as closing steps), against the live-idle endings of the two pure re-arm gates, for the reasons given. Rowan's ruling requested.
- **Q4 — stall window.** §7 arms the stall STOP at two value-identical polls spanning ≥ 35 minutes post-first-dispatch, set just beyond Phase A's observed ~31-minute signature. Confirm or reset.
- **Q5 — cost ceiling.** §5.5 proposes 600,000 units (≈ 2.04× the quote; 4.7% of remaining headroom). Confirm or reset.
- **Q6 — cohort-boundary bookkeeping.** If completion crosses a PT-day rollover mid-plan, the record will show two days' derived totals; nothing in §6 requires the days to be equal in shape. Confirm no additional read-back is wanted for the rollover case.

**Turn: Rowan's** — review of this Gate 4 proposal. Nothing is pending from Julie until Rowan posts; no production act of any kind is authorized in the interim.

---

### Evidence index (repo `jedavid33-design/opal-reader`, branch `ui1-review`, unless noted)

- Gate 3 retry execution record — pin `ea72cf9852d49c62336a492d070cfd128d5eccec`, `review/ch3-generation/recovery/gate3/GATE3-RETRY-RECORD.md`; filed on issue #15 as comment 6561547524 (Handoff RT-H-20261101-b55896).
- Rowan Gate 3 retry execution review PASS — board comment 6561581179 (issue #15, `jedavid33-design/opal-roundtable`).
- Gate 3 retry proposal — pin `0ead570fd9713ec72ec84fe59080a54919e3c8af`, `review/ch3-generation/recovery/gate3/GATE3-RETRY-PROPOSAL.md`.
- Range-fix deploy record (operative 31-part manifest) — pin `b986b562f1824fec2c15810ee4ef023d42a4362f`, `review/ch3-generation/recovery/gate3/diagnosis/range-fix/DEPLOY-RECORD.md`.
- Phase A execution record (cohort-1 rates, stall signature) — pin `f865a002…`, filed 6551215366.
- Live reads for this proposal (2026-11-01 ~17:36–17:51Z, Wren, read-only): `/v2/d6-eligibility` (chapter quote, §2.5), `/v2/d6-plans/plan:e377a5559961b294154276b6` ×2 (§2.2, §2.3, §0.2 rotation), `/v2/quota`, `/v2/d6-quota-reconcile`, `/v2/conflicts`, `/v2/generation/capabilities`, `/v2/d6-diagnostics?planId=…`, `/health`, cf-api queue + script `/settings` reads (§4 values).
- Source citations: range-fix build tree, `worker/generation/service.mjs`, `worker/generation/quota-budget.mjs`, `worker/generation/gen-constants.mjs`, `worker/generation/grant-guards.mjs`, `worker/generation/policy-split.mjs`, `worker/generation/d6-executor.mjs`, `worker/coordinator.mjs`, `worker/worker-entry-prod-d6.js` — file:line as cited inline.
