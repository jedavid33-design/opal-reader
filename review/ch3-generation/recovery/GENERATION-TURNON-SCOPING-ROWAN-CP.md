# FOR ROWAN — GENERATION TURN-ON SCOPING PACKAGE: Standard normal operations + Batch arming (start here)

Read `00-INSTRUCTIONS-FOR-ROWAN.md` first if you have not. Production
hold stands; this package is a **scoping/design** submission for your
review. It authorizes nothing, presents no GO to Julie, and no
production act of any kind is pending or implied. Julie's decision of
2026-11-06 (board comment 6686374302) was to scope BOTH workstreams in
one program; each workstream keeps its own gate chain and Julie's
separate GO at each consequential step.

PIN: `<SCOPE-PIN>` — one pin commit carries the package and this cp
(repo jedavid33-design/opal-reader, branch ui1-review). Sizes and
SHA-256 are in the file list at the bottom; verbatim 9,000-byte parts
accompany the package (it exceeds ~30 KB), exact-concat verified.

## What this is, in one paragraph

With the generation-resume case closed (your DOCUMENTARY PASS, board
6686319232) and Chapter 3 accepted by Julie's playback, the program
turns to what "generation on" means as a steady state. The package
scopes two workstreams from the live build source (the Grant 1
composed tree) plus a fresh Wren census (2026-11-06T13:52Z, package
§2). **Workstream 1 — Standard turn-on** is governance, not
engineering: the Standard lane is admitted today; the only things off
are the two deliberate holds (`GENERATION_HALT` `"1"`, queue paused).
Turn-on is the resume gate's proven lift pair performed once and not
reversed, after which Julie generates from her app under the standing
in-code controls (phase guard, 100/day provider-attempt quota with
12-slot cohort bounding, $50 monthly cap, 10 GB storage projection,
quarantine fences). **Workstream 2 — Batch arming** is a real build:
admission is a frozen code constant (`D6_LANE_ALLOWLIST = ["standard"]`,
gen-constants.mjs:9), and the D6 executor refuses Batch at three
independent layers with no `submitBatch` call — while the provider
adapter, the coordinator `batch_maps` contract, and the legacy
executor's end-to-end Batch flow all exist as preserved, unwired (in
production) components. The package's gap analysis (§4.3) is
component-by-component PRESENT/ABSENT against the source.

## Workstream 1, compressed (package §3)

Mechanics (§3.1): halt flip by the proven metadata-only envelope
upload (31 parts byte-identical, etag unchanged, observability
re-checked) + queue unpause by cf-api PUT with read-back. Two counted
acts, no deploy. Operating model (§3.2): the per-plan gate regime
ends; the live client (build `d5b-v2-generation-client-3`) already
implements capabilities-driven submission with the server-quoted
confirmation; the standing chain advances plans hands-off (F2). The
re-hold pair remains the proven off-switch. Proposed gate (§3.4):
census → lifts → a bounded smoke (one chapter of Julie's choosing,
submitted by Julie from her app, observed read-only) → a 7-day
read-only soak → an execution record and your review → normal
operations declared.

Eight governance questions are put to you and Julie as open questions
(§3.3), of which the largest is **Q1**: a book with no registry row
may submit with **no phase** and runs unbudgeted at plan level
(phase-policy.mjs) — governed only by the monthly cap, daily quota,
and storage guard — and a NEW phase budget is a frozen code constant,
so budgeting a new book takes a code change + deploy + an operator
binding record. Is phase-null operation acceptable for books beyond
Forever Pucked, or must each book be budgeted first? Also asked:
automatic resumption of parked plans under a live chain (Q2); the
parked Ch 3 job simply remaining parked (Q3); halt-era staged jobs
surfacing only by quarantine refusal, there being no enumeration
surface (Q4); who may invoke the emergency re-hold, and what
re-authorizes turn-on after one (Q5); the 4 `schedule_dead` conflicts
rows left permanently (Q6); the post-gate watch terminating on its
own terms — leg (iii) lands tonight — rather than extending into a
normal-ops monitor (Q7); and the settings record's legacy
`geminiLane` key stated for the record as NOT a lane control (Q8).

## Workstream 2, compressed (package §4)

Where `batch_not_armed` lives (§4.1): the frozen allowlist constant
and its four consultation sites; arming is a code change + deploy,
and the allowlist edit is the LAST step, not the first — admission
without a D6 Batch execution path would mint plans whose dispatches
are refused wholesale. Design record (§4.2): Gemini Batch API, one
occurrence per batch job, fence-before-submit, ambiguous-submission
reconciliation by display name, never-accepted resolution; same
model/voices/format as Standard, differing only in timing. **No
design document asserts a Batch price differential**; the cost model
in code is lane-blind (225 units/audio-second) — carried as OPEN
ITEM B-1, not as a claim. Gap table (§4.3): adapter submit/poll/
retrieve PRESENT; `batch_maps` PRESENT; legacy end-to-end flow
PRESENT but not wired in the production entry; **D6 Batch execution
ABSENT** (three refusal layers); commit machinery shared but
integration ABSENT; repair-chain integration ABSENT; **quota
accounting for batch calls NOT DESIGNED** — the quota design flags
it verbatim: "If Batch is ever armed, its polling and submission
calls need their own accounting ruling — flagged here, not
designed." Client (§4.4): **no client change required** — the live
client's source (publication lineage established:
`gen-pkg-1/client-build/genfix1/src/app-269.js`, marker in-file)
renders the Batch button capability-driven, and its click handler
selects Batch exactly when the server admits it; exposure becomes a
verification item in the arming gate. Staging (§4.5) is the test
target, with two open items: B-2 (staging's deployed entry vs the
tree's `worker-entry.js` wiring, to be established at build time)
and B-3 (whether staging Gemini calls share production's prepay
balance — to be established before any staging provider call).
Risks (§4.6) include admission-before-execution, accounting bypass,
ambiguity spend, Batch latency semantics vs the driver's stall
habits, rollback asymmetry, and the v1-era Batch history recorded
as context for the testing burden, not as evidence. Proposed chain
(§4.7): B-G1 design (incl. the accounting ruling) → B-G2 build +
harness → B-G3 staging proof on synthetic content → B-G4 production
arming (inert build first, allowlist flip as its own act, one
Julie-submitted Batch smoke, your review) — sequenced AFTER
Workstream 1's declaration.

## The ask

Rule on: (1) the §3.3 governance questions Q1–Q8 (Q1 above all);
(2) the §3.4 turn-on gate shape; (3) the §4.3 gap analysis at
source strength — is anything PRESENT that we call ABSENT, or the
reverse; (4) the §4.7 Batch gate chain and the placement of the
quota-accounting ruling inside B-G1; (5) open items B-1/B-2/B-3 —
disposition or explicit bounding. Nothing here asks for, or could
be read as, a production authorization: §6 of the package lists the
non-authorizations in full.

## Reply route and turn

Reply to Julie in ChatGPT, as usual; she relays. **Turn: Rowan's**
for the scoping review. Julie's gate GOs are later, separate turns,
unrequested here. Production remains HELD at NORMAL; the post-gate
watch runs tonight on its own terms; nothing in this package
touches the preserved parked job, the conflicts rows, or any plan.

## File list

- `GENERATION-TURNON-SCOPING-PACKAGE.md` — 35,378 bytes, SHA-256
  `fcc5f78cb045e9fcf497a04e67474d3bf8069322485c1c3675a252f28c044bd9`;
  parts in `GENERATION-TURNON-SCOPING-PACKAGE.md.parts/`
  (9,000-byte verbatim parts, exact-concat verified) — part-01
  (9,000 B, fba6b576…), part-02 (9,000 B, f133fa2e…), part-03
  (9,000 B, 0eacdf9c…), part-04 (8,378 B, 61f0a5a5…).
- `GENERATION-TURNON-SCOPING-ROWAN-CP.md` — this file (its size/hash
  are those of the pinned copy; a file cannot carry its own hash).
