# Phase B — Containment V4 CORRECTIONS package — summary for Rowan

*Wren, Nov 2, 2026. Offline documentation/test work only —
no production calls, no deploy, no stimulus, no mutation.
Production remains under INVESTIGATION HOLD, ending HELD.
This package is in the Dropbox folder (the previous V4
files were replaced, per your instruction); the permanent
record is the pin below.*

**Package pin:** «PIN — this slot is filled in the copy of
this document delivered via Dropbox and in the board filing
comment; the pinned copy carries the slot because a commit
cannot name itself. The gates document's S1-X binding
(§S1-X (a)) resolves its pin through that same filing.»

## Your ruling, as received (REVISE BEFORE GATE APPROVAL)

R1 ACCEPT (confidence model + row 11 approved). R2 ACCEPT
(ordering claims appropriately qualified; platform
ordering/serialization unresolved). R3 CONDITIONAL,
subject to V4-1/V4-2. R4 CONDITIONAL, subject to the
ambiguous-response correction (V4-2). R5 ACCEPT the S1-X
design subject to V4-4 — not an execution authorization.
R6 REVISE evidence/risk wording. The ruling is recorded
verbatim on the board and in the pin
(`ROWAN-CONTAINMENT-V4-RULING.md`, SHA-256 `b08fb162…`).

## Correction by correction

**V4-1 — audit persistence vs the single summary.**
Design revised §4.2 now states the two persistence tiers
precisely: Tier 1, the append-only audit history
(`d6_containment_events`) — never updated, deleted, or
overwritten, the ONLY complete episode history; Tier 2,
the `prevEpisode*` summary — exactly ONE closed episode
(the most recent), overwritten by each later clear, after
which older episodes are visible ONLY in Tier 1. The same
distinction is carried in design §2.4 (what the surface
fields are and are not), §4.3 (the code/paperwork table's
persistence row and the anti-circumvention row now ground
the check in the audit history), and §6. **Required as
ordered:** a HISTORICAL AUDIT REVIEW — full append-only
history read and attached, every episode enumerated with
its exhaustion status — is now a mandatory precondition
in BOTH places: design §6 / gates standalone restoration,
and gates micro-scope R3-V precondition (i). A request
grounded in the summary alone is stated to be incomplete
on its face in both.

**V4-2 — recorded completion ≠ physical verification.**
Gates §R is rewritten in the two terms throughout:
RECORDED LOGICAL COMPLETION (the record shows the code
path ran) vs PHYSICAL VERIFICATION (a fresh live read at
re-entry re-establishes the physical fact); any step whose
record and fresh read disagree, or that cannot be freshly
read, is UNRESOLVED, and an ambiguous response stays
UNRESOLVED until a physical read resolves it. The whole
gates document was audited for record-as-proof language;
corrected spots: the C3-5 ledger row (was: "if `stopStatus`
is recorded, the step is DONE" — now recorded-complete,
physically credited only on a corroborating fresh
`getAlarm()` read; contradiction or no-read → UNRESOLVED,
resume only via `verify_chain_stop`); the C3-6 row
(attempt counting stays a record fact — conservative — but
the attempt's physical effect is re-established only by a
fresh read); the C3-1/C3-3 rows (state-write steps:
recorded completion read back consistently on BOTH
surfaces is their criterion — stated, not assumed);
the standalone restoration (the "C3 ended verified, so
the physical stop is proven" wording is replaced: the
restoration's own fresh census must corroborate the
record, or the restoration does not proceed).

**V4-3 — row 1's readable-record precondition.**
Design §2.3 row 1 now reads "record READ SUCCESSFULLY
(`verified:true`/`known:true`) — this row applies ONLY to
a readable record", and row 2 carries the explicit
precedence note. I checked the code before touching
anything: `deriveStopConfidence` (coordinator.mjs:422)
returns `unknown` for `!read || !read.verified ||
!read.known` BEFORE the enum branch — the code already
conformed; the conflation was in the table's wording
(row 1's bare "any"). **No code changed.** What was
missing was a test: CT14a exercised unreadable records
only under CHAIN_STOPPED. New test **CT14d** pins the
precondition directly — every unreadable shape × every
enum × every fresh-observation shape yields `unknown`,
never `not_applicable`, with readable non-stopped records
as the control. Disclosed in the battery header and in
design §2.3/§8.

**V4-4 — S1-X binding.** Gates §S1-X gains a Binding
subsection; the standing conditional authorization is now
valid ONLY under all five: (a) bound to ONE pinned
package — this package's pin (slot above; resolved via
the board filing), for the gates text whose SHA-256 the
filing quotes; a superseding pin lapses it; (b) bound to
ONE specific observation window — defined as opening at
S1's stimulus dispatch and closing at the completion of
S1's closing census read, for that one S1 execution only;
(c) fires only on VERIFIED trigger evidence — scheduled
S1 reads only, raw values + timestamps written into the
execution record BEFORE firing, movement outside the §7.3
set under S1's own classification standard; disagreeing
surfaces or an unreadable value = NOT verified (Layer 1 +
report, no fire); (d) SINGLE USE — consumed by one
`stop_chain` invocation; (e) EXPIRES at window close,
fired or not — no carry-over to any later window, gate,
or package. The shape (i) GO wording is rewritten in the
bound form.

**V4-5 — risk register wording.** Four entries corrected
in place, ids and order stable, corrections marked
inline. **R-02:** the "DETECTED at the next read" claim
is replaced by the actual bound — detection occurs only
at a read that (i) actually happens (no surface reads on
a schedule; an unread divergence persists indefinitely),
and (ii) is a successful DUAL read (record readable +
`getAlarm()` returning); a failed leg yields `unknown`,
not detection. **R-08:** the "`prevEpisode*` persists"
bound is corrected — the summary holds the most recent
closed episode only and is overwritten by the next clear;
older exhausted episodes are visible only in the audit
history, and enforcement rests on the mandatory audit
review (V4-1). **R-13** (same family): the dual-surface
bound implied corroboration — both surfaces read the SAME
store, so agreement detects nothing; the real bound is
preflight census cross-checks only. **R-15:** rewritten
as commit-to-record uncertainty with the known/unknown
split stated exactly — after the enum commit, the record
shows a stop was initiated; it does NOT show whether the
physical act was initiated, issued, or landed, and a
landed delete with no record write is indistinguishable
in the record from one never attempted (the fresh read at
re-entry is the only separator — the basis of V4-2's §R).
**Also:** R-14 is marked RESOLVED (your R1 acceptance of
row 11), retained in place for the record.

**Async analysis v4: UNCHANGED.** No correction touches
it (R2 was accepted). The Dropbox set carries the original
file (`PHASEB-CONTAINMENT-ASYNC-ANALYSIS-V4.md`, SHA-256
`9f93f158…`); no revised copy was created.

## Candidate identities

**No candidate code changed in this round** (V4-3 was a
wording + test correction; see above). All six changed
parts re-hashed byte-identical to the V4 package:
candidate coordinator `6c19a50e…` (313,063 B), entry
`2bb0608b…` (136,357 B), service `5c5183e6…` (91,500 B);
composed coordinator `5303cb63…` (314,712 B), entry and
service identical to the candidate's. No new diffs; the
V4 diffs and round-trips stand. Full detail:
`containment-v4/CANDIDATE-IDENTITIES-REVISED.md`.

## Test results (complete runs, logs + exit codes captured)

The extended containment battery (41 + CT14d = 42 tests;
no existing assertion modified, deleted, or loosened) was
run complete on both exact v4 trees:

- v4 candidate tree: **42/42 pass, exit 0** (log SHA-256
  `96c76d17…`)
- v4 composed tree: **42/42 pass, exit 0** (log SHA-256
  `a3b5e310…`)
- CT14d ✔ on both trees.

P2 regression (32/32, both trees) and R5a (23/23,
composed) were NOT re-run: no code they exercise changed;
their V4-package results stand as the record for these
exact trees (stated here so the absence is a decision, not
an omission).

## Documents (Dropbox set = pin set)

| document | bytes | SHA-256 |
|---|---|---|
| `PHASEB-CONTAINMENT-DESIGN-V4-REVISED.md` | 26,738 | `aa878fda…` |
| `PHASEB-RECOVERY-GATES-V4-REVISED.md` | 50,219 | `37054a55…` |
| `PHASEB-UNRESOLVED-RISK-REGISTER-REVISED.md` | 13,019 | `29f239a7…` |
| `PHASEB-CONTAINMENT-ASYNC-ANALYSIS-V4.md` (unchanged) | 13,684 | `9f93f158…` |
| this cp | — | (in the pin) |

## Remaining open risks

15 register entries, ids stable; **14 OPEN** (R-14
resolved by your R1 acceptance). Unchanged platform-only
uncertainties: A-3 serialization (R-01), storage-effect
ordering (R-02, bound corrected), retry-supersession
residual + provisional 3,600,000 ms threshold (R-03/R-05),
no traffic-independent rate bound (R-04), recorder
dual-failure blind spot (R-06), C3 live-chain remainder
(R-07), paperwork-only anti-circumvention (R-08, audit-
review enforced), H1/H4 causation unproven (R-09), B2 open
(R-10), D unobservable pre-R5a (R-11), post-exhaustion
`getAlarm()` semantics unspecified (R-12), lying-read
residual (R-13, bound corrected), commit-to-record
uncertainty (R-15, stated exactly). Nothing in this round
executes anything: no gate is approved by this package,
and none is requested.

**Dropbox rotation:** the five V4 package files in the
folder were deleted and replaced by this corrected set
(three REVISED documents + the unchanged async analysis +
this cp); `00-INSTRUCTIONS-FOR-ROWAN.md` untouched — the
folder holds exactly those six files.

Your turn, Rowan.
