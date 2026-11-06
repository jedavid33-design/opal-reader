# FOR ROWAN — OQ-2 COLD-RESTART ASSESSMENT (start here)

Read `00-INSTRUCTIONS-FOR-ROWAN.md` first if you have not. Production hold
stands; this package is a documentary assessment for your ruling. It
authorizes nothing, requests no GO, and no production act of any kind is
pending or implied.

PIN: `<OQ2-PIN>` — one pin commit carries the assessment and this cp
(repo jedavid33-design/opal-reader, branch ui1-review). Sizes and SHA-256
are in the file list at the bottom; verbatim 9,000-byte parts accompany
the assessment (it exceeds ~30 KB), exact-concat verified.

## What this is, in one paragraph

The focused OQ-2 assessment your final readiness ruling commissioned
(item 6), against the **adopted GR-B state** your item 1 determined:
86 voided grants, one issued `grant:plan:19cad189fab54b9c804a74a6:seg:87:full`,
job `generating` revision 88, occurrence `granted`, reserved **12**, no
dispatch and no settled movement, containment NORMAL, **no alarm
registration standing** (`armedAt` null at every read since C3's stop
deleted the former registration; restoration re-armed nothing). The
assessment separates what the window's 296 drive passes and 87 grants
establish from what they do not, decomposes the cold-restart gap into
four sub-questions (CR-1…CR-4), grounds every mechanics claim in the
deployed composed source (file/line), specifies three candidate
verification vehicles, and recommends the smallest. **GR-B remains
blocked throughout; the GR-A-only GO wording stands not approved, and
this package contains no GO wording.**

## What the warm chain establishes — and what it cannot (§§1–3)

**Established (ESTABLISHED, window/C3/restoration records):**
sequential lease-expired reissuance on a delivering chain (296 passes,
87 grants, 21h30m44s, ids **incremented — never re-used**, answering
package §9's id question for the warm chain); never two live grants;
derived reserved at **exactly 12** across all 86 void/reissue cycles
(no double-count, no leak); dispatched 0, attempts 0, $0 throughout;
all 296 recorder rows stage `complete`, `recordingFailures` 0; and the
Grant 2 precedent — the same probe produced a pass ~1.9 s after
dispatch on this build after a two-day dormancy.

**Not established — the cold gap (§3).** Every warm observation was
made on a chain that was *delivering*, on a registration that had
never been deleted, in a DO that had not been through a verified
stop + episode close. Decomposed:

- **CR-1 — creation vs delivery.** Creation of a fresh registration
  is source-derived with high confidence: at the probe, `wake()` →
  `_armAlarmIfEarlier` reads `getAlarm()` = null and takes the
  **null branch** — an unconditional `setAlarm` at the earliest
  pending due time (both pending rows are past due). **Delivery is
  UNRESOLVED**, with the W-4 as a live counterexample class: a
  registration on this DO stood 26h14m37s past due undelivered, root
  cause UNCONFIRMED; and post-retry-exhaustion `getAlarm()`
  semantics are UNSPECIFIED. Confirming observation: a new recorder
  row within the ruled bound. Refuting: the bound expires rowless.
- **CR-2 — the first cold pass vs `seg:87`.** Source-derived
  expectation, stated branch-by-branch from
  `_processScheduleRow`'s `lease` case: `seg:87` was born under the
  halt, its outbox was never invoked (`sendGrant` is wired only when
  GENERATION_HALT is `"0"` — so under the holds dispatch is
  *structurally unavailable*, not merely unobserved), and the pass
  therefore takes the **safe void**: `seg:87` voided
  (`lease_expired_undelivered`), occurrence `granted` —defer→
  `pending` —grant→ `granted` under the successor, and the
  successor's id is forced by construction — grant ids are the job
  revision at issuance (`grant:${jobId}:${job.revision}:full`), so
  the next issuable grant is **`seg:88:full`** and `seg:87`'s id is
  unreachable. Refuters are enumerated (still-issued after a pass;
  `outcome_unknown`; a second live grant; reserved ≠ 12 settled).
- **CR-3 — reservation continuity across the stop.** The 12 slots
  are `seg:87`'s own (worst-case ×12 per occurrence, keyed by
  grant, closed exactly once by its void). All 86 warm
  re-derivations ran *without* an intervening stop/restoration;
  the cold expectation (never 24; settled exactly 12) is
  source-derived and observationally checkable at every poll.
- **CR-4 — duplicate-dispatch prevention, cold-stressed.** The one
  genuinely cold-stressed invariant is *ordering*: void-then-
  regrant inside the first passes (the state machine fences it —
  issuance targets `pending` occurrences only, in transactions,
  schedule rows in `due_at` order). Crucially, it is checkable at
  **zero exposure**: any violation is visible on the read set
  before either hold lifts, while dispatch is still structurally
  impossible.

§4 treats `seg:87` in full: identity, issue context, lease terms
(15-minute lease; "expiry" is computed by a processing pass, so
the grant stands `issued` with a due row, not "expired"), its
12-slot reservation and exclusive ownership, why it cannot
dispatch on any holds-on path, and its expected fate per vehicle.

## The vehicles (§5) — and the recommendation

- **V-1 — gate-internal checkpoint GR-2C (RECOMMENDED).** The
  ruled resume sequence already places the probe *before* either
  hold lifts and verifies the wake by recorder-row effect. V-1
  inserts one named checkpoint between that verification and the
  lift decision, requiring five observations before any hold
  moves: (a) new recorder row, stage complete, within the bound;
  (b) a live registration after the pass; (c) `seg:87` voided,
  sole successor `seg:88:full` issued, occurrence `granted`, no
  second live grant — consistent on two consecutive complete
  polls; (d) reserved exactly 12 settled (24 at any poll = STOP);
  (e) dispatched/attempts still 0, phase frozen, recorder
  failures 0. It adds **zero production acts** (the probe is
  already counted), zero exposure, and zero rounds. Its one
  honest weakness: the evidence reaches you in the execution
  record, after the fact — "independently reviewable" rests on
  the protocol being pre-ruled (this assessment) plus the record,
  the same trade C1/C2/Grant 1/C3/restoration all ran on.
- **V-2 — standalone micro-gate CR-V.** The identical observation,
  taken as its own gate (census → Julie GO → one probe → paired
  polls ≤5 min for ≤15 min → closing census), so the cold evidence
  is **in your hands before any resume GO is presented to Julie**.
  Costs: one extra round, and on success a registration **stands**
  and the chain churns in-set at $0 until the resume gate — with
  two dispositions put to you, not defaulted: (i) leave standing
  under owned daily observation (its record then serves verbatim
  as the GR-3 provenance record at the resume census), or (ii) a
  separately authorized follow-on re-stop.
- **V-3 — source + harness (complement under either choice).**
  Seed the adopted state in the DO harness, `deleteAlarm()`,
  drive the probe-equivalent command, invoke `alarm()`, assert
  the CR-2/3/4 transition set. It can falsify §2's source reading
  cheaply — but the harness *invokes* the alarm, so CR-1's
  delivery half is exactly what it cannot touch (and harness-green
  is no evidence for platform behavior; the `.one()` divergence
  is the standing precedent). Never sufficient alone.

§6 fixes eight STOP rules (no row in bound; `seg:87` unvoided or
`outcome_unknown`; second live grant; reserved 24 or unsettled;
any dispatch/settled movement; recorder anomaly; census
deviation; unexpected probe receipt) and the holds story on every
path (V-1: the checkpoint precedes any lift, so holds need no
restoration on checkpoint paths, and the gate's ruled re-hold
sequence governs later aborts; V-2: holds never lift and are
read-back-verified at close). §7 specifies the recorder evidence
(row id ≥ 297 keyed against 296, stage/`drive_invoked`/error
fields, `armed_after`, health, the two-complete-poll rule for the
accounting side). §8 drafts the disposition language for both
vehicle choices — conditional-on-observation for V-1 — for you
to adopt, amend, or replace. §9 carries what stays unknown even
afterward: the W-4's root cause, post-retry-exhaustion semantics,
the platform-unverified racing-wake recheck, the unclosed
B-family, the recorder dual-failure blind spot.

## Questions for you (§10)

- **Q-1** Vehicle: V-1 (recommended), V-2, or another composition?
- **Q-2** If V-1: does the conditional-discharge construction
  (§8) satisfy readiness item 2's "independently reviewed,
  bounded verification protocol"?
- **Q-3** Is the GR-2C observation set (a)–(e) sufficient and
  correctly bounded — incl. the transient-0 permission and the
  revision arithmetic (89 or 90) being accepted on exact
  grant/occurrence/reserved values?
- **Q-4** Do you confirm the successor arithmetic: next issuable
  grant `seg:88:full`, `seg:87`'s id unreachable (assessment §2,
  M-1)?
- **Q-5** If V-2: registration disposition (i) leave standing
  under owned observation, or (ii) re-stop route?
- **Q-6** V-3 sequencing: results filed before your vehicle
  ruling, or alongside it?
- **Q-7** After a discharge: may the GR-B GO wording —
  re-drafted against the adopted predicates and the chosen
  vehicle — then be presented to Julie?

## Reply route and turn

Reply to Julie in ChatGPT, per the standing instructions; she
relays your ruling verbatim. The production hold stands throughout:
no wake, hold lift, SubmitJob, grant mutation, generation,
deployment, or Batch activation is authorized by this package, and
the preserved plan, standing grant, and exemption remain exactly
as censused.

**Turn: Rowan's** — ruling on the OQ-2 assessment (§10's
questions). On the ruling, the GR-B GO wording is re-drafted
accordingly and presented to Julie for a separate decision;
nothing is pending or implied in the meantime.

## File list (pin `<OQ2-PIN>`)

- `PHASEB-OQ2-COLD-RESTART-ASSESSMENT.md` — 51,239 B, SHA-256
  `e54188813b7cbfbbbfb12245ef1d4cee8ad02fd0fcf79af677ccb87cae613fc7`
- `PHASEB-OQ2-COLD-RESTART-ASSESSMENT.md.parts/part-01` — 9,000 B, SHA-256
  `cbfb0f6985efd0de3814fc97a5563e1677504115f1471b4a39fafdaf2ff496e8`
- `PHASEB-OQ2-COLD-RESTART-ASSESSMENT.md.parts/part-02` — 9,000 B, SHA-256
  `4834d929533e387b1bbfbe60e71abbf2493a951e07826f62bda9b9de71e14867`
- `PHASEB-OQ2-COLD-RESTART-ASSESSMENT.md.parts/part-03` — 9,000 B, SHA-256
  `76857f9306df1aa74bcd6baa89919267c79c34ae43035b528bd85968cf05922e`
- `PHASEB-OQ2-COLD-RESTART-ASSESSMENT.md.parts/part-04` — 9,000 B, SHA-256
  `21173ec9213c35f31d330cdb6109d917ac80a7661d505104c3435c68f98983f8`
- `PHASEB-OQ2-COLD-RESTART-ASSESSMENT.md.parts/part-05` — 9,000 B, SHA-256
  `fa6c25f010098d1aa16ca8ac46a1ec8bef7fdfa3169edecc8f8c677dfa05c09f`
- `PHASEB-OQ2-COLD-RESTART-ASSESSMENT.md.parts/part-06` — 6,239 B, SHA-256
  `d16da9b9f21a4b93306fce7ab96412864ffda1dc1a79574ff9f72c403011afbb`
- `PHASEB-OQ2-ASSESSMENT-ROWAN-CP.md` — this file; its size and
  SHA-256 are stated in Wren's board summary (a file cannot hash
  itself into itself).
