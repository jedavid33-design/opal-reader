# FOR ROWAN — B-G1 BATCH DESIGN PROPOSAL (Workstream 2, design gate 1)

Read `00-INSTRUCTIONS-FOR-ROWAN.md` first if you have not. Production
hold stands; this is a **design-only** submission for your ruling
under §5 of your turn-on scoping ruling. It implements nothing,
deploys nothing, calls no provider, and changes no allowlist. No GO
is presented to Julie by it, and none is requested of you beyond the
design decisions enumerated below.

PIN: `<BG1-PIN>` — one pin commit carries the proposal and this cp
(repo jedavid33-design/opal-reader, branch ui1-review). Sizes and
SHA-256 are in the file list at the bottom; verbatim 9,000-byte
parts accompany the proposal (it exceeds ~30 KB), exact-concat
verified.

## What this is, in one paragraph

Your scoping ruling accepted the Batch source assessment and
assigned B-G1 five settlements: submission and polling quota
semantics, ambiguity accounting, retry behavior, latency and stall
classification, and rollback disposition — plus the B-2 parity
design and the B-3 prepay question, with B-1 (pricing) held OPEN.
The proposal (`BATCH-BG1-DESIGN-PROPOSAL.md`, 10 sections) makes
each settlement from the deployed source, cited by file and line,
with every design choice labeled PROPOSAL and every threshold you
are asked to fix labeled PARAMETER. Its load-bearing discovery is a
cardinality fact: the carried-over adapter submits **exactly one
occurrence per provider batch job** (adapters.mjs:364-407) and
retrieves exactly one inlined response (adapters.mjs:425-439), and
`batch_maps` is occurrence-keyed — so "Batch" on the D6 path is
per-segment asynchronous submission under the existing fence
contract, not multi-segment grouping. Assembly, grouping, and the
partial-result problem all dissolve into that fact (proposal §1.0,
§4.2).

## The settlements, compressed

**Flow (§1).** The D6 executor gains a batch branch in place of
refusal layers 1 and 3 (layer 2, the allowlist check, remains the
lane law), reproducing the legacy flow's contract discipline —
claim, spend intent, fence BEFORE submit, note-outcome — and adding
the genstore/quota recording the legacy path predates. Polling
rides drive passes. Success commits through the shared
flush-before-commit machinery; the reconciliation procedure exists
in code (executor.mjs:224-240) but has **no caller in any entry** —
its operator wiring is TO-BUILD.

**Quota (§2, decision D-1).** The cap counts *authorized
segment-syntheses, not HTTP calls*. A submission counts as its
segment count (today: 1), consumes one 12-attempt-budget unit and
one cohort-reservation slot, and — the one deliberate deviation
from Standard's timing — the dispatch-ledger row is written **at
the fence step, before the POST**, because the fence is the last
durable moment before the paid action and Batch's ambiguity can
persist indefinitely: counting there can over-count by at most one
on a fence-to-POST crash, and can never under-count an executed
submission. Polls, retrievals, and enumerations count 0 (polls are
bounded structurally — one per submitted map per drive pass — and
fully recorded on pass outcomes). Known-rejected submissions stay
counted; only their cost adjudicates. No batch-specific counter
exists anywhere in the design, so the existing derived-totals
reconcile verifies Batch identically.

**Ambiguity (§3, decision D-2).** Four arising cases, one
treatment: map `ambiguous`, intent open, upper-bound cost ledgered
in the unverified-exposure surfaces from the moment of fencing,
day-cap already counted, segment-budget unit held. PROPOSAL: a
per-job fail-closed block — while any map of a job is ambiguous,
the job makes no further submissions (already-submitted work still
polls and commits; other jobs and Standard are untouched). The
only designed exit is **adoption** via operator-invoked
enumeration. Never-accepted resolution is designed *around*, not
depended on: the evidence gate cannot be satisfied (the adapter's
verifier throws by design; your Part 1 item-3 posture), so B-G1
states plainly that an unmatched ambiguity can be terminal for its
job — bounded, visible (BATCH-AMBIGUITY-OPEN), and non-contagious
by construction. A multiple-match residual is flagged honestly at
§3.4 (the adapter returns no creation time), as decision D-6.

**Retries (§4, decision D-3).** A fenced submission is never
re-posted — adoption is a continuation, not a retry. Known
failures (rejection, terminal provider states) retry only as new
jobs in the server-owned repair chain, under REPAIR_MAX_RETRIES
inside the shared 12-attempt budget. POLICY_BLOCK: the terminal
poll currently collapses any item error into `BATCH_STATE_FAILED`
(adapters.mjs:431-436), so an **error-classification surface is a
hard B-G2 prerequisite**; with it, a batch policy block enters the
same F3 chain, but PROPOSAL: its repair job is created on the
**Standard lane** — an explicit deviation from lane inheritance at
coordinator.mjs:2536 — because the split machinery is an inline
Standard-path loop, repair volume is small by construction, and
the chain's accounting must stay single.

**Latency & stall (§5, decision D-4).** No provider latency figure
exists anywhere in the record and none is invented. Polls ride
drive passes (production-observed cadence ~10 min while work is
outstanding); classifications are parametric: BATCH-IN-FLIGHT /
BATCH-LATENCY-EXTENDED (P-EXT, proposed 1 h) / BATCH-STALLED (no
movement across P-STALL-PASSES observed passes — proposed 12 —
and age ≥ P-STALL-AGE — proposed 6 h; escalation to observation
only, never an auto-halt; EXPIRED stays the provider's own bound) /
BATCH-AMBIGUITY-OPEN (P-AMB, proposed 24 h) / NO-PASS-OBSERVED —
the W-4 class, named so a silent alarm chain is never misread as a
provider stall. Every stall clock counts *observed* passes: under
an alarm-delivery failure, batch work is inert — no polls, no
spend, no false timeouts — and resumes from durable rows.

**Rollback (§6, decision D-5).** A submitted provider job cannot
be un-submitted; rollback is Reader-side only, per stage. Post-flip
it splits in two: admission rollback (allowlist back to
`["standard"]`, capabilities read-back; in-flight batch plans park
by refusal and do not corrupt) and in-flight disposition —
PROPOSAL: **INVENTORY-AND-HOLD**, adopted in advance at the arming
gate: maps inventoried into the rollback record, retained never
deleted, unpolled under the rolled-back build, exposure already
counted at upper bound, resumable if a Batch-capable build returns,
never re-submitted. Whether B-G2 should additionally design an
explicit terminal `abandoned` map state is D-5's second half — the
current state machine has none and B-G1 does not invent one.
Standing rule: **a Batch failure never rolls back Standard.**

**B-2 / B-3 (§7).** The parity checklist (P-1..P-5) produces a
filed evidence record and fails closed — if staging's entry is the
legacy-wiring `worker-entry.js`, no D6 claim may be drawn from
staging at all. B-3 is answered as far as the record allows, from
Wren's read-only reads today: **the staging script carries no
`GEMINI_API_KEY` binding at all** — as deployed, staging cannot
make a provider call, so nothing is currently shared. The sharing
question becomes real only when B-G3 provisions the secret; since
secret values are write-only, the settlement is procedural:
provisioning-time attestation naming the key's source in
non-secret terms, recorded in the B-G3 evidence, with a fail-safe
default (absent attestation, staging spend is treated as drawing
on Julie's production prepay). The B-G3 test budget is shaped as
parameters: P-TEST-SEGS (proposed 12 synthetic segments) and
P-TEST-UNITS at the lane-blind upper bound. **B-1 remains OPEN** —
no discount assumed anywhere; the cost model stays lane-blind.

**B-G2 preview (§8).** The ruling's six families enumerated as
named test intents: throw-safe (T-1..T-4), crash-window (C-1..C-5,
including crash between acceptance and `noteBatchSubmitted`),
reconciliation (R-1..R-4, incl. no-match byte-identical state),
accounting (A-1..A-5), repair (F-1..F-4), Standard regression
(S-1..S-4, incl. the inertness rehearsal for B-G4).

## The ask

Rule on decisions **D-1** (quota counting rules, §2.2), **D-2**
(ambiguity settlement, §3), **D-3** (repair-lane deviation +
classification prerequisite, §4.3), **D-4** (stall parameters,
§5.4), **D-5** (inventory-and-hold + the abandoned-state question,
§6.1), and **D-6** (multiple-match adoption rule, §3.4). A design
PASS here authorizes B-G2's build preparation for its own review —
not any deployment, staging act, provider call, or the allowlist.

## Reply route and turn

Reply to Julie in ChatGPT, as usual; she relays. **Turn: Rowan's**
for the B-G1 design ruling. Production remains HELD at NORMAL;
Workstream 1's revised design package travels separately under its
own turn.

## File list

- `BATCH-BG1-DESIGN-PROPOSAL.md` — 53,191 bytes, SHA-256
  `aabf6cafadc31dce49ad39c0e2036ad4afa7f76e5caf49b7adc4092cb6a13d17`;
  parts in `BATCH-BG1-DESIGN-PROPOSAL.md.parts/`
  (9,000-byte verbatim parts, exact-concat verified) — part-01
  (9,000 B, 56d7b696…), part-02 (9,000 B, 52d34805…), part-03
  (9,000 B, cce37efa…), part-04 (9,000 B, b63e46eb…), part-05
  (9,000 B, 177b4c4b…), part-06 (8,191 B, 91993ba2…).
- `BATCH-BG1-DESIGN-ROWAN-CP.md` — this file (its size/hash are
  those of the pinned copy; a file cannot carry its own hash).
