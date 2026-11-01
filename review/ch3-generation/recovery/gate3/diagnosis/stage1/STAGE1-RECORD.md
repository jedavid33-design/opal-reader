# Gate 3 E3 diagnosis — STAGE 1 EXECUTION RECORD (passive read-only probes)

**Outcome: COMPLETE — all six probes ran in order, every check
passed, no STOP condition fired, and the stage finished inside its
request ceiling.**

**Authorization:** Julie's Stage 1 GO, recorded on the board
(issue #15, comment 6559701645) before any probe. Governing
document: Diagnosis Proposal Amendment 1 (pin
`1e18269c24b91b8035fe9f8acc38ab696f9839ca`, repo
`jedavid33-design/opal-reader`, branch `ui1-review`), §7.1–§7.5;
Rowan TECHNICAL PASS for Stage 1 (comment 6559656456). Stage 2 is
not part of this record and was not touched: **no preview call, no
finalizer call, no write of any kind.**

**Window:** 2026-11-01T15:05:31Z → 15:06:12Z.
**Requests:** **7 of the 9 ceiling** (D1 1, D2 1, D3 1, D4 2,
D5 1, D6 1) — full ledger in `evidence/request-ledger.md`. All
seven returned HTTP 200. No retries were observed.
**Spend:** $0. **Mutations:** zero. The system remains HELD
(halt `"1"`, queue paused) and remains so after this stage.

## Probe results

- **D1 — `GET /health`: PASS.** Build
  `408f91497131a151a199b3f9ec4cbb283a8febd5`, `generation:
  "halted"`, coordinator `armed`, scope `production` — the held
  baseline the stage precondition requires.
- **D2 — `GET /v2/conflicts`: EXACT MATCH.** The complete set is
  exactly the approved four-row baseline (Gate 2D baseline pin
  `9284f5ef…`, Gate 3 proposal §4.4.1), verified mechanically
  field-by-field including millisecond timestamps:
  id 1 @2026-10-29T23:54:14.808Z
  (`grant:plan:3183ecbf2ac4bf50bbc6166e:seg:1:full`);
  id 2 @2026-10-30T00:24:14.632Z
  (`grant:plan:603ab416bd67ab1b25de97be:ch1:1:full`);
  id 3 @2026-10-31T05:14:24.089Z
  (`grant:plan:b2dc2a3d1cd367a0245b9102:ch1:1:full`);
  id 4 @2026-11-01T01:04:30.364Z
  (`grant:plan:e377a5559961b294154276b6:ch2:1:full`);
  all `lease` / `7` / `LIKE or GLOB pattern too complex:
  SQLITE_ERROR` / `schedule_dead`. No added, removed, or modified
  row — the global conflict rule (§7.1) did not fire.
- **D3 — plan read: PASS.** `plan:e377a5559961b294154276b6`
  state `active`, totals eligible 23 / done 8 / failed 0 /
  blocked 0 — the state the E3 call faced, unchanged.
- **D4 — quota reconcile (2 requests; cap 4): PASS.** Page 1
  returned `ok: true`, `armed: true`, `censusComplete: true`,
  `currentDayBlocked: false`, **drift empty** (count 0), and
  **exactly one exception**: the known adjudicated straddler
  `att-37d63768-db4b-447d-8150-580b7c6ee257`
  (`estimated_unverified`), never dispositionable. Both arrays
  completed on the first page (`driftNextOffset` /
  `exceptionsNextOffset` null, neither truncated), so
  completeness was: single disjoint page per array, union =
  totals. The totals-stability confirmation re-read at offset
  (0,0) returned byte-identical totals, dayTotals, drift, and
  exceptions. PT day totals: 2026-10-29 = **57/0/57**;
  2026-10-30 = **79/0/79**; 2026-10-31 = **44/52/96** (the
  stalled grant's 52 reserved slots remain attributed to
  2026-10-31, as expected); current PT day 2026-11-01 =
  **0/0/0**.
- **D5 — bindings changes since seq 1826: PASS (zero movement).**
  `changes` empty, `nextSeq` 1826, `highWatermark` 1826,
  `hasMore` false. Nothing has written bindings in the held
  interval. (Counts and sequences only — no record content is
  reproduced here.)
- **D6 — final conflict read: EXACT MATCH.** The set is again
  exactly the four baseline rows, and the D6 body is identical
  to the D2 body: nothing during the Stage 1 window — including
  any Durable Object activity the probes themselves caused —
  added, removed, or modified a row.

## What this establishes — and what it does not

Per the proposal's §7.4 discipline, stated at exactly its
strength:

- The conflict set was **stable across the diagnosis window**:
  identical at D2 and D6, and identical to the approved baseline
  and to the Gate 3 census set. No new `schedule_dead` row
  appeared during the window.
- No state drift confounds the E3 observation: plan, quota
  ledger, and bindings watermark are all exactly where the Gate 3
  census left them.
- **Nothing here upgrades H1.** The traced finalizer `LIKE`
  (§4.3.5 of the diagnosis proposal) remains a **supported
  hypothesis, not a proven cause** of the E3 HTTP 500. Stage 1
  cannot and does not establish which statement threw at E3, the
  engine mechanism behind the message, or whether the failure
  would reproduce — those are Stage 2 / statement-level-evidence
  questions, and no claim about intermittency is made in either
  direction from this window alone.

## Evidence

`evidence/` alongside this record: verbatim captures
(`d1-health.json`, `d2-conflicts.json`, `d3-plan.json`,
`d4-page1.json`, `d4-page2-confirm.json`, `d5-bindings.json`,
`d6-conflicts.json`), the mechanical compare sheet
(`compare-stage1.txt`), the request ledger
(`request-ledger.md`, raw `ledger.txt`, window markers), and the
**Stage 1 evidence digest** `291ddb3eda06d8d979ebd1080eca6b539ba604da7efcb9d3cc0f6d65ea3ec531`
(SHA-256 over the sorted capture-hash listing,
`stage1-hashes.txt`). This digest is a Stage 1 census-evidence
digest; no preview precondition digest exists in Stage 1 and
none is conflated with it (§7.14 discipline).

## Disposition

Stage 1 results go to Rowan for review. What they support next is
Rowan's call — a Stage 2 proposal (its own proposal, Rowan
review, and Julie's distinct approval), a code-change proposal, or
nothing further. This record authorizes none of those. The system
stays HELD.

— Wren
