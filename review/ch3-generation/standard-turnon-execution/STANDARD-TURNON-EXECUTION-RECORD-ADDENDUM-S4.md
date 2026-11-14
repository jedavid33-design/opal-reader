# STANDARD SMOKE GATE — EXECUTION RECORD ADDENDUM (§4 RECONCILIATION)

Case: Opal Roundtable, issue #15. Date: 2026-11-14.
Parent record: STANDARD-TURNON-EXECUTION-RECORD.md, pin
`38613833766e369cec658c4cdc3edab874da0ba8` (repo
`jedavid33-design/opal-reader`, branch `ui1-review`).
Authority for this addendum: Rowan's Standard smoke-gate execution
ruling §4 (verbatim board comment 6883625102) + Julie's preparation GO
(board comment 6883636191). Documentary only; no production contact
was made or is needed for anything in this addendum. All findings are
derived from the gate's own preserved captures, pinned with this
addendum (see §5).

## 1. The question

Stage 2 (Chapter 5) settled at 422,397 units against the quote's
expected figure of 410,880 — an excess of 11,517 units (~2.8%). The
estimate was not a hard spending ceiling (ruling §4; package ST-G2).
Separately, the census supplement named settlement beyond expected
figures as a reactive operator STOP threshold. This addendum
establishes: (a) when the excess first became observable; (b) whether
any generation remained outstanding at that point; (c) how the closing
decision was made. The estimate is not characterized as a breached
hard cap, and the supervision threshold is not erased.

## 2. What the supervision observed during Stage 2

The executed supervision polled the Chapter 5 plan every ~2 minutes
(stage2-progress.log, pinned). That surface reports totals only — it
carries no cost field. Observed progression (UTC): 19:45:44 0/21;
19:47:45 0/21; 19:49:46 0/21; 19:51:47 1/21; 19:53:47 6/21; 19:55:48
8/21; 19:57:49 11/21; 19:59:49 14/21; 20:01:50 15/21; 20:03:50 19/21;
20:05:51 19/21; 20:07:51 **21/21 — complete**. Failed 0 and blocked 0
at every poll. Immediately after the terminal poll, the poller read
quota, phase accounting and the bindings watermark (the log's three
"final" lines): phase settled 1,848,546 — the first cost observation
of the stage in the executed supervision. A foreground accounting
read (attempt diagnostics) followed within the same minute and
confirmed the per-attempt composition.

**First observability of the excess: ~20:07:51Z, in the poller's
end-of-stage accounting reads** — the settled total (422,397 over
Stage 2) less the pre-stage settled figure (1,426,149) exceeded the
expected 410,880 for the first time there.

## 3. Whether generation remained outstanding at that point

**None.** At the moment the excess became observable, the plan was
already 21/21 complete (20:07:51Z poll), all 21 executions committed,
provider reservations 0. The last poll with generation outstanding
was 20:05:51Z (19/21).

## 4. Reconstruction: the excess did not exist while generation ran

Per-occurrence settled costs (attempt diagnostics, pinned) in
position order 113–133, cumulative: the 19 occurrences complete by
the 20:05:51Z poll sum to **380,097** — below the expected 410,880.
The final two occurrences settled 22,419 (position 132) and 19,881
(position 133): after position 132 the cumulative stood at 402,516,
still below expected; **the cumulative crossed 410,880 only on the
final occurrence's commit, reaching 422,397**. The conclusion is
order-independent for the last two: either completion order leaves
the 20-occurrence cumulative below expected (399,978 or 402,516).

Therefore the condition the reactive STOP threshold names —
settlement beyond expected figures — **did not obtain at any moment
while generation remained outstanding**. Even a supervisor polling a
cost surface at the executed cadence could not have observed an
excess in time to act on it, because there was no excess to observe
until the stage was complete. The threshold was not breached in its
operative sense, and it is not erased: it governed a condition that
never arose during the stage.

Stated limitation: the diagnostics carry no per-attempt timestamps;
the reconstruction rests on the poll log's done-count progression
(which bounds the final two completions to 20:05:51–20:07:51Z) plus
the per-occurrence cost records. No stronger timing claim is made.

## 5. The closing decision

At first observability the stage was complete and fully committed.
The remaining specification-conforming acts were Julie's playback
acceptance and the mandatory closing acts (re-hold, re-pause,
terminal census) — the STOP threshold's object (further provider
spend) no longer existed, and the estimate was not a cap whose
crossing could invalidate a completed stage. The executor proceeded
to acceptance and closing on that basis, and reported the settled
figure and its excess over expected openly in the execution record
(§Expenditure), which is what brought it to review.

**Supervision-design note (carried into the operational-release
proposal):** totals-only polling cannot observe a cost threshold
mid-stage. On this stage's arithmetic that limitation changed no
outcome; as a general matter, any future attended supervision that
carries a reactive cost threshold should poll a cost surface
(capabilities phase settled) at the same cadence as totals.

## 6. Evidence preservation

The gate's complete capture set is pinned with this addendum at
`review/ch3-generation/standard-turnon-execution/evidence/` (same
repo/branch): the opening/boundary/terminal census captures, both
flip scripts and their ledgers + PUT responses, the queue mutation
responses, the submission body + response, both eligibility quotes,
the stage poll script + progress log, the attempt-diagnostics
captures for both stages, the reconcile captures, and Julie's
in-window balance screenshot. The pin of this addendum is the
immutable reference for the set; SHA-256 + size for each file are
listed in the addendum's evidence manifest (same directory,
`EVIDENCE-MANIFEST.md`).

Turn: Rowan's (documentary review of this addendum, alongside the
operational-release proposal).
