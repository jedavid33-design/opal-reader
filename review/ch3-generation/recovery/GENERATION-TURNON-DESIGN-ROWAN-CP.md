# FOR ROWAN — GENERATION TURN-ON REVISED DESIGN PACKAGE (Workstream 1): onboarding, the state matrix, emergency re-hold, and the amended Standard gate (start here)

Read `00-INSTRUCTIONS-FOR-ROWAN.md` first if you have not. Production
hold stands; this is a **design** submission under your scoping
ruling's "next authorized work" (SCOPING PASS WITH REQUIRED
AMENDMENTS, reviewed pin `a6e5dd38…`, board 6686726351). It
authorizes nothing, presents no GO to Julie, and no production or
staging act of any kind is pending or implied. Workstream 2 is not
in this package — the B-G1 design proposal is a separate parallel
document; the scoping package's Batch assessment stands as you
accepted it.

PIN: `<DESIGN-PIN>` — one pin commit carries the package, its
verbatim parts, and this cp (repo jedavid33-design/opal-reader,
branch ui1-review). Sizes and SHA-256 are in the file list at the
bottom; verbatim 9,000-byte parts accompany the package,
exact-concat verified.

## What this is, in one paragraph

The scoping package's Workstream 1, revised per your amendments. The
turn-on mechanics are unchanged (the proven halt flip + queue
unpause; package §3). What is new: a **per-book budget onboarding
design** (Q1, §4) weighing three options and recommending **O1** —
budgets stay frozen code constants; onboarding a book is a reviewed
one-line-constant deploy plus the ALREADY-EXISTING operator binding
route (`recordPhaseBinding`, insert-if-absent, conflict-throwing) —
the exact procedure by which Forever Pucked itself was onboarded.
An **exact state-to-resumption matrix** (Q2, §5): 9 plan rows, 12
job rows (11 states — `queued` is split by plan linkage), 3 overlay
holds — 24 rows, each source-cited, with the
live inventory mapped; your floor is honored structurally
(`halted_unknown` is excluded at driver selection permanently, R4-1;
quarantine-held subjects are driver-skipped and release only
per-subject; `parked_policy` has an EMPTY transition table). The
**legacy plan-less jobs** answer (Q4, §6): a reliable read-only
inventory is **NOT FEASIBLE** on the current build — no jobs list
route exists, ids are UUIDs, diagnostics requires a named target —
with the fail-closed fence proven from source and the residual
uncertainty stated in three parts (pre-epoch births; epoch-coverage
slivers; the unprovable negative), bounded by: nothing plan-less
can self-start, ever. An **emergency re-hold design** (Q5/A2, §7):
Julie's unlimited general authority; Wren's preauthorized act only
on nine objectively checkable triggers; exactly two verified acts
(re-pause, then re-halt); immediate reporting; fresh GO for any
re-turn-on. And the **amended Standard gate** (§8): fifteen A1
preflight predicates with per-predicate drift rules and the STOP
set; the A3 smoke (Julie-submitted FP Chapter 4, freshly quoted:
20 segments, expected 375,535 units ≈ $0.38, `keepGoing` off, her
playback as acceptance); A4 soak terms — the package PROPOSES
additional submissions be allowed for onboarded books, alternative
stated; the A5 observation arrangement (`normal-ops-daily-check`,
owner Wren, distinct from the post-gate watch, with the accounting
checks — settled-matching, estimated-unverified aging,
reservation-leak flags); and A6 declaration criteria with the
prohibition stated in terms: **smoke success alone is not
normal-operations acceptance**; until the full set stands, the
system is "turned on under observation." §9 carries the revised GO
wording for your review only — not for presentation.

## Two disclosures the package makes at full strength

1. **The wrong-book binding hazard (§4.2)**: `recordPhaseBinding`
   has no unbind/rebind writer — a binding recorded against the
   wrong book would stand permanently, correctable only by a future
   code-level disposition. O1 controls it procedurally (book id
   read from the book's own surface, figure rendered on capabilities
   before the binding exists, character-for-character read-back
   before any submission). Carried as open item OI-4 in case you
   judge a procedural control insufficient for an irreversible
   record.
2. **The FP figure vs the proposed rule (§4.4)**: the package
   proposes a figure rule — the larger of 2× expected remainder and
   a projection floor (projected final settled + 270 × the largest
   chapter's chars; the 270 is the guard's own per-occurrence upper,
   12 attempts × chars/10 × 225). Worked honestly, FP's standing
   $13.50 sits BELOW that floor (≈ $14.74), because the guard sums
   a whole chapter-job's pending uppers at its first grant. Realized
   margins have held comfortably; worst-case-shaped math could park
   a late chapter on `phase_budget` — safe, self-limiting, and
   watched for in the soak. No change to FP's figure is proposed.

## The ask

Rule on: (1) the onboarding recommendation (O1) and the §4.4 figure
rule, incl. OI-4; (2) the §5 matrix — the verdicts, esp. the
RE-TESTED class for `parked_budget` / `parked_storage` (OI-1:
mechanically re-tested every pass, clearable by neither the lift
nor time — your floor names safety/quarantine/billing/operator
cases; whether these two belong in it by name is yours to move);
(3) §6's feasibility conclusion and whether the fail-closed proof +
residual uncertainty discharge Q4; (4) §7's trigger set and the
bounded procedure; (5) A4's soak-submission proposal vs its
alternative (OI-2) and the marked PROPOSAL figures (OI-3: the 60/day
smoke dispatch signal, T-6's 95%, T-9's 10, the missed-day and
voided-soak rules); (6) the §9 GO wording. Nothing here asks for,
or could be read as, a production authorization: §10 of the package
lists the non-authorizations in full.

## Reply route and turn

Reply to Julie in ChatGPT, as usual; she relays. **Turn: Rowan's**
for the design review. Julie's turn-on GO is a later, separate turn,
unrequested here. Production remains HELD at NORMAL. One time-keyed
note: Q7's OQ-5 leg (iii) — the post-gate watch's first scheduled
run is tonight, 2026-11-06 18:28 ET; the package carries it as
pending-at-drafting and as gate predicate P-14, never as verified.

## File list

- `GENERATION-TURNON-DESIGN-PACKAGE.md` — 68,257 bytes, SHA-256
  `fdff49e41db5f98041f8266f3c6d9a9de69beefb613311459f964ccf0f8a3d59`;
  parts in `GENERATION-TURNON-DESIGN-PACKAGE.md.parts/`
  (9,000-byte verbatim parts, exact-concat verified) — part-01
  (9,000 B, 33651298…), part-02 (9,000 B, 348fc6ee…), part-03
  (9,000 B, 9dca5c84…), part-04 (9,000 B, ad5ad43c…), part-05
  (9,000 B, 9abda6cb…), part-06 (9,000 B, c2594a70…), part-07
  (9,000 B, 241f1067…), part-08 (5,257 B, c3098924…).
- `GENERATION-TURNON-DESIGN-ROWAN-CP.md` — this file (its size/hash
  are those of the pinned copy; a file cannot carry its own hash).
