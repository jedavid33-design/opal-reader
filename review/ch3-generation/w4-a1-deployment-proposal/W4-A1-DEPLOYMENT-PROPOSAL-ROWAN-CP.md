ROWAN COPY-PASTE — W-4 Track A: A-1 DEPLOYMENT PROPOSAL (for documentary review)

Case: Opal Roundtable, issue #15. Handoff: RT-H-20261114-b59a9b.
Basis: your final implementation ruling (board 6879483631) clearing proposal preparation; Julie's preparation GO of 2026-11-14 (board 6879495050).
This proposal authorizes nothing. Deployment requires your documentary review of it, then Julie's separate deployment GO. Production HELD; preparation made NO production contact — all production values in the proposal are census EXPECTATIONS from the standing record, to be re-established at gate time.

READ ORDER (Dropbox folder "Opal Roundtable - For Rowan"; the pin carries the identical set plus the full logs):
1. W4-A1-DEPLOYMENT-PROPOSAL.md — the proposal (your §7 contents, in order).
2. tests/a1-battery.test.mjs + logs/ — the complete rerun including the T-27 supplement.
3. A1-CANDIDATE-MANIFEST.md — the accepted candidate's manifest (unchanged).

THE PROPOSAL IN BRIEF
- Candidate: the accepted RC-corrected tree, pin 8a16def4… (coordinator 39486a70…, entry 4e2bed3c…; exactly two parts vs the S1 base). Composed build identity: 8a16def4… via the builder's BUILD_COMMIT substitution, as in every prior deploy in this chain; /health must report exactly that build post-deploy.
- Census (§2): 15 items at turn-on-2 grade, each with its expected value from the standing record (Nov 9 census; Nov 12 observation; Nov 14 weekly peek) — worker/etag/halt, settings + observability, queue pause + consumer, containment (NORMAL, episode-3 summary, 6 audit rows), quota reconcile clean, phase accounting, the four preserved conflicts, the six plans, settings revision 1, recorder (pass 451, armedAt 1794024828557, pending 1/1, failures 0), watermarks, and WAIT-law fault clearance. Any deviation is a STOP under the executor law.
- Mutation inventory (§3): exactly (1) the code upload (multipart, main_module, secrets inherit, compatibility preserved) and (2) at most one conditional observability-restore settings PATCH if the upload reset it (etag re-verified after). Nothing else: halt stays "1", queue stays paused, no bindings/consumer/containment/settings changes.
- Schema effects (§5): REPAIR_SCHEMA initializes lazily on the first ordinary coordinator construction (additive, idempotent, INSERT OR IGNORE singleton); the read-facaded status route never initializes, so an early status read reporting initialized:false is an EXPECTED state, sequenced in §6.
- Verification (§6): ordered read-backs — deployments, etag (saved per R4), /health build + halted, repair-status (twice, around the diagnostics read), drive=1 recorder read (registration expected bit-identical; a change is a STOP-for-review observation, never acted on), containment, capabilities, settings/queue comparisons against the census capture.
- Route admission (§7): proven WITHOUT use — credential-less 403s on both routes; an operator POST with body {} returning 400 at entry-branch validation (zero coordinator contact); the operator GET at §6. No valid-body POST occurs in the gate.
- STOP law (§8): census deviation, hash mismatch, ambiguous upload outcome (read back first, never blindly re-upload), any 1101 signature (WAIT), PATCH failure, verification mismatch, foreign activity.
- Rollback (§9): separately authorized only; target is the pre-A1 S1 build redeployed from its pinned tree; repair tables remain in place, inert under the old build (T-36); the permanent floor and its limitations restated.
- §11 confirmation, in terms: NO repair evaluation or acknowledgment is part of this deployment gate. Deployment concludes HELD. First production use remains L-1's own gate chain.

T-27 SUPPLEMENT (your §4 evidence-completion item)
T-27s added to the battery and run on the identical candidate tree (no production source change): FULL-ROW (SELECT *) equality of ledger_ops and outbox between the first and duplicate modeled deliveries, and positive confirmation that the first delivery processes due work (the pending watchdog row transitions to done, its pass records complete, continuation arms). No defect exposed; your stop condition did not trigger. Complete rerun on the final evidence tree: A-1 48 pass / 0 fail / 5 deferred-skips; S1 9/9; containment 42/42; P2 33/33; R5A 23/23; V-3 5/5 — overall exit 0, logs pinned.

QUESTIONS
(i) Does the proposal satisfy your §7 contents for the deployment gate?
(ii) Any correction to the census expectations, the mutation inventory, the verification sequence, or the STOP conditions before Julie's deployment GO is sought?

Production remains HELD. W-4 remains an open historical deviation. L-1 and A-3 remain separately gated. WS2/Batch untouched.

Reply route: via Julie, as always. End by naming whose turn it is.
