# Rowan cp — Gate C1 READINESS package (containment deployment)

**For Rowan, from Wren (via Julie).** The V4 corrections
round is CLOSED by your PASS (recorded verbatim on the
board). This is the focused C1 readiness package your
ruling assigned. **Paperwork only: C1 is not executed,
and no GO is requested.** Production remains under
INVESTIGATION HOLD, ending HELD.

**Pin: `<PIN-SLOT>`** (repo `jedavid33-design/opal-reader`,
branch `ui1-review`) — the slot is filled in the board
filing that accompanies this package, per the standing
convention (a commit cannot name itself); the Dropbox
copy of this cp carries the filled value, and that
one-block difference from the pinned cp is disclosed
here and on the board.

## The package (single consolidated document)

`PHASEB-C1-READINESS-PACKAGE.md` — §0 scope, §1 candidate
identity (full 31-part manifest), §2 preflight census,
§3 mutation bounds + rollback triggers, §4 observability,
§5 post-deploy verification, §6 unresolved risks,
§7 GO wording + STOP conditions, §8 battery/evidence.

**What C1 is:** ONE upload of the containment V4
candidate to `opalreader-api-v2-prod`, ending with
containment INERT at NORMAL (no transition; the tables
are created only by transitions — verified in the
candidate source — so a bare deploy creates nothing),
system HELD, Generate button not live. C1 excludes C2,
C3, R5a-D, S1, S1-X, R3-V, and restoration.

## Candidate identity (headline; verified firsthand)

Candidate = live P2 instrumented build `86ad06ab…`
(etag `ba80e81f…`) + containment v4, in exactly **3 of
31 parts**; the other 28 byte-identical:

- coordinator `6c19a50e88d8bc00d357f7a5facf33ed8425b53daa20e8d700037f9fd121b2f2` (313,063 B; **+753/−0**)
- entry `2bb0608b589a084ca275428c3236c24680f4a4692afe2245dfcb2880257983c1` (136,357 B; **+175/−3**)
- service `5c5183e664218b9746c497e9456af45c7467a8ace66fd1b9ef0928eccb3c7c14` (91,500 B; **+73/−2**)

The COMPOSED tree (coordinator `5303cb63…`, containment
+ R5a) is explicitly NOT C1's candidate — it is
R5a-D's. Gate-time flow mirrors the proven P2 gate:
fresh census → fresh assembly from the live-downloaded
parts + the three stored diffs → battery re-run →
build pin → stamp `build-identity.mjs` (deployed tree
differs from live in 4 parts: 3 code + stamp) → one
upload → read-back verification.

## Bounds and verification (summary)

- **Mutations:** exactly 1 forward upload; ≤1
  conditional observability PATCH (only if the upload
  resets logging; it survived both prior deploys); ≤1
  conditional rollback upload of the preserved
  byte-identical live parts + ≤1 conditional PATCH,
  only on named triggers T1–T6 (read-back mismatch,
  health/stamp failure, settings regression,
  containment-surface misbehavior, any preservation
  failure, `armedAt` movement); **0** transitions,
  commands, hold/queue changes; **$0**.
- **Census:** the P2 gate's 13 items re-based to build
  `86ad06ab…` / etag `ba80e81f…` (preserved plan,
  parked fingerprint, 4-row conflicts baseline, phase
  figures, reconcile + straddler, watermarks 18/1841,
  idx-26 key FREE, eligibility digest `cdef2c7e…`)
  PLUS containment items: the Nov 2, 2026 `drive=1`
  baseline as dated hard expectations (`tableState`
  missing, 0 rows, `recorderHealth: null`, `armedAt`
  1793562576104 bit-identical, pendingSchedule 2,
  pendingWatchdog 1) and the containment mechanism's
  verified ABSENCE on the live build. Any deviation =
  STOP before upload.
- **Post-deploy:** health stamp == build pin; 31/31
  read-back (27 identical + 3 candidate + stamp);
  containment reads NORMAL / absent / verified with
  `stopConfidence: "not_applicable"`; recorder baseline
  unchanged; 11-point preservation; zero movement in
  the grant/reservation/dispatch set — any movement =
  STOP (a deploy invokes no DO method).
- **Observability:** pre/post script-settings reads;
  if reset, multipart PATCH to `/settings` (observability
  only), etag-unchanged verification, inside budget.

## Battery standing for this candidate

Containment battery v4 + CT14d: **42/42, exit 0** on
the candidate tree (log `96c76d17…`); P2 parameterized
regression: **32/32, exit 0** on the candidate tree
(log `4548c21f…`). Gate-time re-runs of both suites on
the gate-assembled tree are required before upload
(package §8). The R5a suite does not apply to this
tree.

## Risks

Register (revised): 14 open of 15. Bearing on C1 at
corrected strength: R-01 (A-3 assumed), R-02 (ordering
unspecified; detection only at a successful dual read),
R-06 (recorder blind spot persists — not closed by
this build), R-07 (**deploying is not verifying**;
operational proof remains C3's, PARTIAL), R-09 (stall
cause unproven; C1 doesn't depend on it), R-12
(post-exhaustion `getAlarm()` semantics unspecified),
R-13 (lying-read residual; both surfaces read one
store). Plus three C1-specific items (read-path-first
exposure, undocumented code-adoption timing, gate-time
assembly). Package §6 states plainly what C1 does not
resolve.

## What you are asked to rule on

1. Is the C1 scope as bounded (deploy-only, ends inert)
   the correct next gate, on this candidate identity?
2. Are the census expectations (§2), mutation bounds
   and rollback triggers (§3), observability procedure
   (§4), and verification set (§5) complete and at the
   right strength?
3. Is the GO wording (§7) exact — one attempt, the
   named bounds, ends HELD? (The GO itself is Julie's
   future step after your review; it is not requested
   in this package.)

**Folder note:** per your instruction, this package
replaces the corrections-round files in the review
folder; the folder now holds only the instructions
file + this package + this cp. The candidate-identities
addendum does not ride along: §1 of the package carries
the identities in full (the addendum remains in the
GitHub archive at pin `621535f0…`).

Your turn, Rowan.
