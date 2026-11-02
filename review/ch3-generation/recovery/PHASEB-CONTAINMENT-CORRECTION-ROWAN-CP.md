# Copy-paste for Rowan — containment correction package (offline; production HELD)

Rowan — this answers your R5a-revised-package ruling ("DOCUMENTARY
PROGRESS ACCEPTED. CONTAINMENT DESIGN AND EXECUTION GATES HELD FOR
CORRECTIONS"), required work A–E, item by item. Everything was
built and tested **offline only**; no production calls of any kind
were made. Production remains under INVESTIGATION HOLD (halt "1",
queue paused, preserved plan + exemption untouched). No GO is
requested by this package. Pin + hashes at the end.

**Your six decisions, as implemented:** (1) B3-future ACCEPT —
the board ruling governs; the R5a condition moves a
beyond-threshold stale registration to the verified earliest
pending D (unchanged in the candidate; no further package asserts
the superseded "preserve" reading anywhere). (2) Threshold —
CONDITIONAL candidate value only; see D below. (3) Mutation
budget — memo + strictly-earlier corrective retained; the lack of
a traffic-independent rate bound is preserved as an unresolved
execution risk, restated in the revised analysis §5.3 and carried
verbatim into Gate R5a-D's GO wording. (4) Containment REVISE —
done, A below. (5) Sequencing — the four gates (E) are ordered
C1 → C2 → R5a-D → S1, containment verified before any stimulus.
(6) R2 identity — Gate S1 IS the R2 gate, name and mandated
negative wording preserved.

## A — Containment state semantics (`PHASEB-CONTAINMENT-DESIGN-REVISED.md`)

The one-flag spec is replaced by **one singleton durable row with
one enumerated state** — `NORMAL` / `DRIVE_CONTAINED` /
`CHAIN_STOPPED` (`d6_containment_state` + append-only
`d6_containment_events`). One field, not two, chosen deliberately:
chain-stopped is drive-contained *plus* registration stopped, so
two booleans would admit a fourth undefined combination; with one
field the contained-vs-stopped distinction is structural and every
consumer switches on a single value from a single read.
`STOP_UNVERIFIED` is **not** a stored state — it is a reported
*outcome* of the stop transition (state row stands at
CHAIN_STOPPED, `stopVerified: false`, an `unverified` audit
event), so exactly three behaviors exist and no outcome is ever
reported as a silent success.

Transitions — operator route only (`POST /v2/d6-containment`,
closed allowlist, `authorizationRef` required): `contain_drive`
(NORMAL→DRIVE_CONTAINED; idempotent in-state; **rejected from
CHAIN_STOPPED** — no silent downgrade), `stop_chain`
(NORMAL|DRIVE_CONTAINED→CHAIN_STOPPED; commits the state row,
then `deleteAlarm()`, verified by `getAlarm()` read-back null —
otherwise the unverified outcome above, gates holding), `clear`
(→NORMAL; never re-arms anything itself). Unreadable current state
→ every transition rejected with no writes.

Effects (full matrix in the design, each cell code-anchored):
DRIVE_CONTAINED — drive gate after `super.alarm()` skips
recover/driveOnce (recorder row at new stage `contained`);
registration, schedule processing, and lease closure continue.
CHAIN_STOPPED — both `setAlarm` sites gated (the complete census:
exactly two, both now behind one suppression check), drive gated;
delivered passes still run base schedule processing but cannot
re-arm; schedule rows preserved in place; commands still process
but cannot resurrect the registration. Preserved plan: never
written by containment in any state.

**Flag-read failure — the proof shape you asked for.** Reads go
through one function (`readContainmentState`, never throws, never
writes, no caching — once per pass at the drive gate, once per
wake/finally at the arm gates) with three outcomes: *absent table*
= structurally verified NORMAL (reads never create the tables;
only a transition does — so absent means no stop has ever been
recorded, nothing exists to defeat); *verified value*; *anything
else* (throw, corrupt value) = **unverified → both gates take the
darker branch** (drive suppressed AND arming suppressed). So a
verified stop is (1) physical — `deleteAlarm` + null read-back, so
delivery stops regardless of later reads; (2) resurrection-proof
against read *failures* — every resurrection path consults the
read with the darker default; (3) non-silent — suppressed arms
write a transitions-ledger note, contained passes record the read
error. The honest residual: storage returning a *wrong NORMAL
successfully* is a storage-integrity failure no flag design
survives; named, not papered over. One deliberate reversal from
v1, disclosed in the design: v1's fail-open arming is gone —
unverified reads suppress arming too, because the arm paths ARE
the resurrection paths; the cost (a storage hiccup can wedge
re-arming until diagnosed) is bounded by the absent-table rule and
the loudness of the failure.

Two truths kept at full strength: containment **never interrupts
an already-running operation** (in-flight worst case = the §7.3
set: ≤1 grant, reserved ∈ {0,12}, occurrence ceiling 153,636
units ≈ $0.154, dispatched 0 under the holds); and a stopped
chain freezes lease closure too (closure needs a pass) — stated
in the matrix, not hidden.

## B — Offline build + battery (`containment/`, identities doc enclosed)

Three trees, all derived from the live instrumented build:
**containment candidate** (coordinator +242/−0 pure insertions,
entry +138/−3, service +26/−1; 28/31 parts byte-identical),
**R5a candidate** (your pinned tree, untouched), and the
**composed tree** (containment applied on top of the R5a
candidate; coordinator +295/−12 vs live — the two change sets
compose cleanly; overlap is one function, `_armAlarmIfEarlier`,
where the containment gate precedes the memo logic).

Dedicated containment battery (17 tests): normal delivery +
reads-never-create; Layer 1 (contained passes, lease closure
continuing, chain still arming); Layer 2 verified stop
(registration gone, schedule snapshot byte-identical, post-stop
command records + registers nothing, delivered pass contained +
no re-arm); read failures at every path (stopped+fault → wakes
register nothing; NORMAL+fault → pass contained, not blind);
write failures (rollback, no applied event, HTTP 500 —
no silent success); deleteAlarm failure (unverified outcome,
gates hold); handler retries under containment (rethrow
identical, base-alarm stage); in-flight grant at stop (state
untouched by the stop, later pass closes by lease, nothing new);
transition discipline + route fences + clear return path (clear
registers nothing by itself; next wake re-arms ordinarily);
preserved-plan byte integrity after every scenario.
**17/17, exit 0, on BOTH the containment candidate and the
composed tree.**

## C — Regression evidence reconciled (no behavior touched)

The P2 suite's T0 identity assertions hardcoded the retired P2
candidate. They are now **fixture-driven**: each suite run takes
an identity fixture (changed-parts set + per-part SHA-256 +
round-trip diffs + syntax-check parts) for the tree under test.
Changed assertions, one by one (full text in the identities doc):

1. P2 T0/1 — hardcoded changed-set {entry, service} + P2 SHA-256s
   + "29 unchanged" → fixture changed-set + fixture SHAs +
   "31 − |changed| unchanged". *Identity data only.*
2. P2 T0/2 — round-trip via the P2 `combined.diff` only → the
   fixture's round-trip diff list. *Identity data only.*
3. P2 T0/3 — `node --check` on scratch-parts paths → on the
   candidate tree's fixture-listed parts. *Identity data only.*
4. R5a T0/1–3 — same parameterization (differ set, coordinator
   SHA, round-trips). *Identity data only.*

No behavioral assertion was changed, deleted, or loosened; test
counts are identical to the originals (P2 32, R5a 23). Complete
runs, one log + exit code each:

| suite | tree | result | exit |
|---|---|---|---|
| P2 (parameterized) | original P2 candidate | 32/32 | 0 |
| P2 (parameterized) | R5a candidate | 32/32 | 0 |
| P2 (parameterized) | containment candidate | 32/32 | 0 |
| P2 (parameterized) | composed | 32/32 | 0 |
| R5a (parameterized) | R5a candidate | 23/23 | 0 |
| R5a (parameterized) | composed | 23/23 | 0 |
| containment | containment candidate | 17/17 | 0 |
| containment | composed | 17/17 | 0 |

The R5a suite was **not** run against the containment-only tree:
its subject (the R5a condition) is absent there by construction;
that tree is covered by the P2 regression + containment battery.
Stated rather than smoothed.

## D — Retry analysis, revised (`PHASEB-R5A-RETRY-SUPERSESSION-REVISED.md`)

Restructured into **Part I — documented** (D-1…D-7, each tagged to
the assessment's findings: at-least-once + ≤6 retries, retries
attach to the most recent setAlarm, retry-gap `getAlarm()` read,
ordinary delay ms/~1 min, no documented self-healing) and
**Part II — assumptions** (A-1 doubling multiplier — labeled, with
×4/×5 sensitivity; A-2 no other long-hold state; A-3 serialized
invocations; A-4 post-exhaustion state UNSPECIFIED, no assumption
made). The 60-minute threshold is a **provisional candidate test
value** throughout — derivation shown as an envelope (≈19× the
documented-plus-assumed ≈186 s), never as a bound; the package
was grepped for "upper bound"/"proven" drift and the threshold is
described with those words only in negation. **Residual
supersession risk** is named and walked through: the lost retry
carried one drive pass; the re-registration fires the same pass
at D; a double-arrival (S3, unspecified) is bounded by the §7.3
state-machine steps (each transition happens at most once);
spend $0 under the holds; and §5.4 shows the consequence limits —
containment deployed + verified BEFORE any stimulus (decision 5),
Layer 1 as the immediate brake, Layer 2 as the full stop, Gate
S1's observation/classification discipline. Permanent production
safety is **not** claimed (your formulation, adopted verbatim).

## E — Four gates (`PHASEB-RECOVERY-GATES-V2.md`)

Four separately scoped proposals in one file, each with preflight
census, numeric mutation budget, observability, STOP behavior,
rollback limits (incl. "rollback cannot un-fire an alarm or
un-issue a grant" in each gate's own terms), postflight evidence,
and the exact Julie GO wording:

- **Gate C1 — containment deployment.** Code only; 1 upload +
  ≤1 conditional PATCH + conditional rollback pair; ends with
  containment INERT (no transition); 0 stimulus; 0 expected
  registrations.
- **Gate C2 — containment verification. Zero mutations.** My
  choice, flagged for your ruling: **no transition is exercised
  in C2** — verification rests on the state-route + drive=1
  passive reads, the C1 record, and the offline battery. The
  first live transition use is placed inside Gate S1's preflight
  pair instead. The alternative (a C2 variant budgeting one
  contain+clear) is recorded as considered-and-not-chosen; say if
  you prefer it and C2 is rewritten before any approval.
- **Gate R5a-D — R5a deployment** on the composed tree (exactly
  one part changes vs the C1 tree); deploy only; budget
  reconciled against both setAlarm sites (0 expected in-gate);
  the provisional-threshold and no-traffic-bound limitations are
  carried verbatim into the GO wording.
- **Gate S1 — the R2 stimulus, sequenced.** Preserves R2's
  diagnostic identity exactly (one `RequestPause`, fresh
  command_id, target `alarm-wake-probe:nonexistent` verified
  nonexistent at preflight, no re-send, mandated negative
  wording). Adds two things, both named in-budget: the
  containment readiness pair (contain_drive → passive verify →
  clear → passive verify) before the stimulus, and one named
  contingency (`contain_drive` only, if movement leaves the §7.3
  set). Correction 6 carried verbatim. Ends HELD.

## Unresolved items for you

1. **C2 verification shape** — passive-only (my choice) vs a
   budgeted contain+clear inside C2. A ruling either way
   settles it; C2 as written cannot be approved until you pick.
2. **Return-from-stopped policy** — the design's `clear` exists
   and is route-gated; should any production `clear` require its
   own standalone gate (it is currently budgeted only inside
   S1's pair/contingency), or is inclusion inside a stimulus gate
   sufficient?
3. **Threshold value** — 60 minutes remains provisional; your
   ruling on the value (or on retiring it for a different
   constant) is still open, and permanent safety is not claimed
   either way.
4. **Traffic-independent rate bound** — still unresolved
   (decision 3); Gates R5a-D/S1 carry it as a stated execution
   risk rather than closing it.
5. **B3 decision** — recorded as SETTLED by your decision 1
   (board governs; MOVES to D). Not reopened here — noting it
   only so the record shows it closed.

**Pin** (opal-reader repo, branch `ui1-review`, single parent =
the R5a revision package pin `d9269517…`): this package's own pin
is recorded in its board summary on issue #15 (the cp is inside
the pin it describes).

Key hashes: containment coordinator `12d73bef…`, entry
`0183aabf…`, service `ebed452a…`; composed coordinator
`c097061a…`; design-revised, supersession-revised, gates-v2,
candidate-identities + all eight battery logs pinned alongside
with full SHA-256 in the board summary.

Offline only. Production HELD. No GO requested.

**Turn: Rowan's.**
