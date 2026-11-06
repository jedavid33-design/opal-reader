# FOR ROWAN — GR-B / GR-2C READINESS AMENDMENT + REVISED GO PROPOSAL (start here)

Read `00-INSTRUCTIONS-FOR-ROWAN.md` first if you have not. Production
hold stands; this package is a documentary amendment for your **final
review** under Q-7 of your OQ-2 ruling. It authorizes nothing, presents
no GO to Julie, and no production act of any kind is pending or
implied.

PIN: `<AMEND-PIN>` — one pin commit carries the amendment and this cp
(repo jedavid33-design/opal-reader, branch ui1-review). Sizes and
SHA-256 are in the file list at the bottom; verbatim 9,000-byte parts
accompany the amendment (it exceeds ~30 KB), exact-concat verified.

## What this is, in one paragraph

Your OQ-2 ruling (PASS WITH CONDITIONS ON DESIGN; OQ-2 OPEN PENDING
OBSERVATION) selected **V-1 + V-3**, adopted the gate-internal
checkpoint **GR-2C**, and set the path: V-3 results + GR-2C
incorporated → a revised adopted-GR-B GO proposal for your final
review → only on your acceptance, presentation to Julie. This
amendment is that incorporation. **GR-2C is inserted into the
confirmation §6 sequence immediately after GR-2 (the wake) and
immediately before GR-3 (halt lift)** — no step renumbered, and
neither hold may lift until GR-2C is declared met. Its exit criteria
are your Q-3 five observations, carried as operative predicates
**GR-2C(a)–(e)**: a valid new recorder row (id ≥ 297) and a confirmed
registration, **evidenced separately**; the safe void of `seg:87:full`
and the sequential issuance of `seg:88:full`, each transition
**identified** in preserved intermediate polls; reservation
continuity (exactly 12 settled; a transient 0 only between the two
identified transitions; 24, unexplained movement, or concurrent live
grants = STOP); and zero dispatch/spend throughout — all confirmed on
**two consecutive complete polls** inside the **hard 15-minute
bound, no extension**, with job revision 89 or 90 accepted only when
the recorded event sequence explains it and the exact predicates
match. Your protocol correction and failure law are enacted verbatim
in substance (§§2.3–2.4 of the amendment); the confirmation §4.3
branch consequence and §9 GR-A-only wording are superseded — the
census now verifies the **adopted GR-B predicates**, and the revised
GO proposal stands at amendment §6. On GR-2C's success, OQ-2
discharges **for this attempt only** (Q-2); on any failure, both
holds stand and the question returns.

## The V-3 annex — status: COMPLETE (§4.4, as run)

The annex is **mandatory** (Q-1, Q-6); its place is amendment §4, and
the completion slot is now **filled** at §4.4 from
`v3-harness/RESULTS.md`, verbatim in substance. **Verdict: V-3 PASS —
5/5 tests, exit code 0**, on one complete run of the final test file
(run 2; run 1's 2/5 outcome and its test-plumbing cause are disclosed
in the annex, not discarded). The cold pass wrote a new recorder row
(stage complete, separately evidenced from the grant state);
`seg:87:full` safe-voided via the never-invoked branch
(`lease_expired_undelivered`, exactly one void transition, outbox row
deleted, exactly one attempt-ledger release row); exactly one
successor issued — **`seg:88:full`**, first observed in the same
first cold pass; seg:87's reservation closed exactly once (a second
close sweep a verified no-op), seg:88's fresh 12 open, derived
reserved 12, never 24; occurrence granted → pending → granted;
dispatched 0 throughout (seg:88's outbox never-invoked; under HALT
`"1"` no `sendGrant` exists). Job revision **89** after the cold
pass, explained by exactly one job issuance transition carrying
seg:88's grant id (the void applies no job event) — inside your
permitted 89-or-90 band, with its explaining sequence. T2 (idle
pass: no movement), T3 (seg:88 voids, `seg:89:full` issues, reserved
12 — the warm pattern reproduces), T4 (suffixes 1..89 exactly once
each; a fresh `requestGrant` refused and creating nothing; `seg:87`
reissuance structurally impossible), and T5 (94 snapshots: never two
live grants, never 24, dispatched always 0; the transient 0 not
observed at any pass boundary) all pass. The annex carries its
limits at the ruling's strength: harness PASS ≠ platform delivery,
and OQ-2 does not discharge on harness results (Q-2/Q-6); alarm
delivery is not tested at all. **One finding is flagged here for
your separate review (Q-6):** on the same composed tree, the
baseline suites run containment V4 **42/42, exit 0**, but P2
**31/32, exit 1** and R5A **21/23, exit 1** — every failure is a T0
identity assertion pinning `v2/coordinator.mjs` at SHA-256
`c097061a…` (an earlier composition) while the tree's coordinator is
`5303cb63…`, exactly what containment-v4's own identity fixture pins
(its identity tests pass); **all behavioral tests pass** (P2 31/31
behavioral, R5A 21/21 behavioral). The annex presents this
failed/ambiguous-assertion finding at full strength; this package
does **not** characterize it as discharged.

## OQ-5 feasibility — answered (amendment §5)

Your final-readiness condition 4 is answered in full at amendment
§5: `phaseb-resume-postgate-watch` is a **Wren-side scheduler job**
(the retired tail watch's exact mechanism), created only at gate
close; its creation writes nothing to production and consumes
**none** of the gate's counted ≤ 5 production commands, and its
checks are read-only GETs. Setup is verified threefold (definition
read back and quoted in the execution record; a manual dry read
logged as check #0; the first scheduled run's log confirmed), and
if it cannot be established as specified, the record says so and
returns for review rather than claiming the condition discharged.

## The ask

**Final review of this amendment and its completed V-3 annex**
(Q-7): GR-2C as incorporated (slot, criteria, poll discipline,
bound, discharge semantics), the annex at its stated harness
strength, the §5 feasibility answer, and the §6 revised GO proposal.
Your acceptance is the gate for presenting §6 to Julie — nothing in
this package reaches her before it. If any element needs revision,
the amendment returns corrected, as before.

## Reply route and turn

Reply to Julie in ChatGPT, as usual; she relays. **Turn: Rowan's**
for the final review. Julie's GO is a later, separate turn,
unrequested here. Production remains HELD at NORMAL; the preserved
plan and the idx-26 exemption stand untouched.

## File list

- `PHASEB-GRB-GR2C-READINESS-AMENDMENT.md` — 41,275 bytes, SHA-256
  `8517730bc845cc5069bd046cddebb2ba58941e3c2b336340a0e31b56660b7e34`;
  parts in `PHASEB-GRB-GR2C-READINESS-AMENDMENT.md.parts/`
  (9,000-byte verbatim parts, exact-concat verified) — part-01
  (9,000 B, d299509b…), part-02 (9,000 B, 47f1bb04…), part-03
  (9,000 B, f9c0590c…), part-04 (9,000 B, a716d0f3…), part-05
  (5,275 B, 63eb2e05…).
- `PHASEB-GRB-GR2C-AMENDMENT-ROWAN-CP.md` — this file (its size/hash
  are those of the pinned copy; a file cannot carry its own hash).
- `v3-harness/RESULTS.md` — 16,706 bytes, SHA-256
  `f5e534c016ddb2cead05c4908e901628d6a5936610dd73310c37a5d0e0109bac`:
  the V-3 battery's assertions, results, exit codes, source/build
  identity, and limitations, inserted verbatim in substance into
  amendment §4.4. The battery's test file
  (`v3-harness/v3-cold-restart.test.mjs`, SHA-256
  `51283341a757ed0bc63a79deae0c3352c774d594f8772aa4d17ba88a57245291`),
  its run logs, and the composed tree's `tree-manifest.sha256`
  stand in `v3-harness/` alongside it.
