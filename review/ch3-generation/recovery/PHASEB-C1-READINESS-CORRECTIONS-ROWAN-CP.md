# Rowan cp — Gate C1 READINESS package, CORRECTED (C1-1 / C1-2)

**For Rowan, from Wren (via Julie).** Your ruling on the
C1 readiness package (pin
`2af8fb8876fd1f5b1c2dbb43865bcd813f18ead7`) was **PASS
WITH CONDITIONS — NOT YET EXECUTION-READY**: scope,
candidate identity, census, preservation, observability,
budgets, and battery requirements accepted; two
corrections required. This is the corrected package.
**Paperwork only: C1 is not executed, no GO is requested
or issued, and no production call of any kind was made.**
Production remains under INVESTIGATION HOLD, ending HELD.

**Pin: `<PIN-SLOT>`** (repo `jedavid33-design/opal-reader`,
branch `ui1-review`) — the slot is filled in the board
filing that accompanies this package, per the standing
convention (a commit cannot name itself); the Dropbox
copy of this cp carries the filled value, and that
one-block difference from the pinned cp is disclosed
here and on the board.

## What changed — exactly two corrections

The corrected document is
`PHASEB-C1-READINESS-PACKAGE-REVISED.md`. Everything not
listed below is the accepted package, unchanged —
including §1 (candidate identity), §2 (census), §4
(observability), and §8 (battery).

**C1-1 — Rollback classification** lands in §3, §5, §7:

- §3's trigger table now tags every trigger: **T1–T4
  are class A; T5 and T6 are class B.** T5/T6 still
  STOP the gate.
- New **§3.1** defines the classes and makes them
  operative. **Class A — confirmed deployment defect**:
  evidence ties the finding to the uploaded code
  (findings on surfaces the uploaded script owns; an
  error reproducing on the new build that census showed
  absent on the old; a read-back mismatch against the
  stamped manifest). Only class A permits a rollback
  inside the gate's existing budget. **Class B —
  external or causally unresolved movement**: movement
  in surfaces a script upload cannot mechanically cause
  (T5: plan/job/exemption/quota/conflicts/watermarks;
  T6: alarm registration), and ANY finding whose cause
  is undetermined. The only authorized response is
  **HOLD, preserve evidence, escalate to you and
  Julie**; a class B rollback is NOT in the C1 gate's
  budget and needs a separate ruling/GO. Doubt resolves
  to class B; the executor's own tracing never promotes
  a finding to class A.
- New **§3.2** defines when a rollback is safe, as
  preconditions of the permission: ends HELD verified
  on fresh reads; nothing in flight to strand (V7 set
  at census values); rollback target re-hashed
  byte-identical to the §1.2 manifest immediately
  before firing; defect evidence captured first; and no
  class B finding open.
- §5's V7 text and closing rule, §4's T3 note, and the
  §3 budget rows are rewritten to the same rule.
- **§7's GO wording is amended** to carry the decision
  rules: a rollback is authorized ONLY for a class A
  confirmed deployment defect after §3.2 verifies; class
  B movement authorizes NO rollback under the GO — HOLD,
  preserve, escalate.

**C1-2 — Runtime-adoption evidence** lands in §0, §5, §6:

- §5 gains an explicit preamble: the V-checks establish
  **script deployment verification** (uploaded parts
  byte-match the stamped manifest; `/health` reports
  the build pin; read surfaces answer on the new build
  where observed) and do **NOT** establish **Durable
  Object runtime adoption** — existing instances adopt
  on their own lifecycle (eviction, restart, new
  instantiation), no C1 check observes per-instance
  adoption, and an unadopted instance keeps serving the
  previous build invisibly. The only licensed success
  claim is named verbatim in §5.
- §6 item **C1-R2 is rewritten**: runtime adoption and
  the operational behavior of the containment code paths
  are explicitly UNRESOLVED after C1, not bounded by the
  D2 read-back, the stamp check, or the observation
  windows; they resolve, if at all, by independent
  observation in later scopes.
- §0, the R-07 entry, and §6's closing claim are
  narrowed to the same strength ("the script is
  deployed and its read surfaces answer with the inert
  state"), and a whole-package grep for
  running/live/adopted language was corrected at each
  hit.

## Candidate identity — UNCHANGED

Re-stated from the accepted §1 (no code changed; no new
diff; no battery re-run required or claimed): candidate
= live P2 instrumented build `86ad06ab…` (etag
`ba80e81f…`) + containment v4 in exactly **3 of 31
parts** — coordinator
`6c19a50e88d8bc00d357f7a5facf33ed8425b53daa20e8d700037f9fd121b2f2`
(313,063 B; +753/−0), entry
`2bb0608b589a084ca275428c3236c24680f4a4692afe2245dfcb2880257983c1`
(136,357 B; +175/−3), service
`5c5183e664218b9746c497e9456af45c7467a8ace66fd1b9ef0928eccb3c7c14`
(91,500 B; +73/−2). The §8 battery standing is unchanged
(containment 42/42 exit 0, log `96c76d17…`; P2 regression
32/32 exit 0, log `4548c21f…`; gate-time re-runs still
required before any upload).

## Rotation note

Per your instruction, the review folder now holds only
the instructions file + the REVISED package + this cp;
the original package and its cp were removed from the
folder (both remain in the GitHub archive at pin
`2af8fb88…`). The permanent archive continues: this pin
adds the ruling record, the revised package (+ verbatim
parts), and this cp.

Your turn, Rowan.
