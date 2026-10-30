# gen-fix-1 — refresh-loop correction: build report

**What this is:** a repo-only corrective client package for the
gen-pkg-1 generation client, built under Julie's authorization
(Roundtable board, issue #15, comment **6530302659**, Oct 30
2026). **Publication is NOT authorized and has NOT happened** —
it awaits Rowan's source review and Julie's separate tap.
No Worker, queue, settings, or registry contact; no generation;
no spending. Worker tree untouched.

- Diagnosis filed: board **6530278010** (Handoff
  RT-H-20261030-6c04f7).
- Base: the published gen-pkg-1 client (entry `app-268.js`,
  build `d5b-v2-generation-client-2`, live `main` @ `46e853e5`),
  publish-tree digest
  `97e280948341e0d993975f46ebf089c10e9a2dfdc74487783ff80dd2069cc398`
  (81 files) — reproduced byte-for-byte from the build's `base/`
  copy under the established treehash method before building.

## The defect

Julie's device report on the published build (Forever Pucked):
*"Yup! My only note is that it constantly refreshes."*
`modules/generation-surface.js` defined
`TERMINAL_PLAN_STATES = ["complete","partial","failed","cancelled","superseded","retired"]`
— `halted_unknown` missing. Forever Pucked's Ch 2 plan is
`halted_unknown`, so the shell classified a plan that can never
advance on its own as live, forever: the book screen re-rendered
itself every 15 s and the Generation view refreshed every 5 s.

## The change (exactly one line of behaviour)

```diff
 export const TERMINAL_PLAN_STATES = Object.freeze(
-  ["complete", "partial", "failed", "cancelled", "superseded", "retired"]);
+  ["complete", "partial", "failed", "cancelled", "superseded", "retired", "halted_unknown"]);
```

in the successor module `modules/generation-surface-genfix1.js`,
plus an explanatory comment at the set (a halted plan's only
exits are operator reconcile, then retire — round 4 R4-1 keeps
every driver from selecting it — so live-plan treatment could
only ever poll and reroute). Everything else in the package is
the mechanical packaging consequence (identities below).

## Predicate-use audit (performed BEFORE building)

Every use of `TERMINAL_PLAN_STATES` / `isTerminalPlanState` in
the client (grep over the full client source; the only files
referencing the predicate are the module itself, the entry
re-export, and the shell). Line numbers are the published
`app-268.js` / `generation-surface.js`.

1. **Book-screen poll gate** — `app-268.js:1265` (renderBook's
   Generation section): if any listed plan is non-terminal, arm
   the 15 s interval that re-renders the whole book screen.
   *Effect of the fix:* a book whose plans are all terminal
   (incl. a halted one) no longer arms it — the reported defect,
   screen half. A genuinely live plan still arms it (proven,
   GF-4).
2. **Generation-view refresh gate** — `app-268.js:832`
   (renderGeneration): same predicate arms the 5 s refresh.
   *Effect:* the view no longer refreshes forever over a
   halted-only list — the reported defect, view half. A live
   plan still arms it (proven, GF-5).
3. **`findActivePlan`** — `generation-surface.js:212–216`:
   first plan matching book + scope semantics that is NOT
   terminal. Two consumers:
   a. **Sheet prepare reroute** — `app-268.js:736`
      (prepareGenSheet): an exact-semantics active plan
      reroutes the sheet to the Generation view ("already
      being generated", Start disabled). *Effect, stated
      honestly:* a halted plan no longer reroutes. Ordering
      matters — prepareGenSheet checks the server's
      capabilities FIRST and stops at that gate whenever the
      server reports generation not-enabled, which is
      production's current state, so **the fix has no
      client-visible reroute effect today**. In a future
      server-enabled state, a sheet opened on a halted plan's
      exact scope would proceed to the server's eligibility
      quote and offer Start; on Start the server decides —
      an identical intent converges on the halted plan
      (`created:false`, no new work), and an
      overlapping-but-different intent is refused
      `plan_overlap_conflict`, which the client renders in
      plain words ("another plan is already running over some
      of the same segments. Nothing was started."). The
      authority is the server's R3-2 fence
      (`PLAN_FENCE_TERMINAL = ["complete","partial","retired"]`,
      worker `service.mjs:607`, refusal at :686), which does
      NOT treat halted plans as terminal and is **untouched**
      by this client-only package. No double generation is
      possible from the client change.
   b. **Submit-timeout recovery fallback** — `app-268.js:689`
      (`otherActive`): after a submit whose answer was lost,
      a state-agnostic exact-semantics match (`started`) is
      checked FIRST and is unaffected; the fallback then looks
      for a different-settings non-terminal plan of the same
      book to report as "already going". *Effect:* a halted
      plan is no longer reported as "a run with different
      settings is already going" — it is not going anywhere,
      so the old sentence would have been false; the flow now
      falls through to the retry-safe note. No safety loss.
4. **Eligibility quote** — server-side
   (`GET /v2/d6-eligibility`, worker `service.mjs` ~:1137):
   computed from the eligibility builder's per-occurrence
   dispositions over a fresh plane; it takes no plan-state
   input, so the client change cannot affect it. It is
   advisory only; submission revalidates server-side.

**Non-uses (verified):** rendering never consults the terminal
set. `renderGeneration` lists every plan; the book Generation
section lists the book's first 5 plans unfiltered;
`planStatusText` and `planMoneyText` carry dedicated
`halted_unknown` cases ("Stopped — a charge needs checking
before it can continue"; "Settled … so far — plus a charge
that isn't confirmed yet"). **The halted plan stays fully
visible with its correct text after the fix** (asserted on the
rendered lines in GF-2/GF-3). No other client module
(`screens.js`, `storage-state.js`, …) references the predicate.
The worker's fence constant is a separate server-side set —
not touched; the worker tree is not part of this package.

**Safety judgement:** no audited use makes adding
`halted_unknown` unsafe or wrong. The two poll gates are the
defect; the reroute change is fenced server-side and inert in
today's halted state; the recovery-fallback change removes a
false statement. The build proceeded on exactly the authorized
one-line scope.

## Disclosed candidate-suite amendment

`tests/generation-unit.mjs` GU8 in the gen-pkg-1 candidate
suite asserted `!isTerminalPlanState("halted_unknown")` (label:
"round 3: retired is terminal, halted_unknown is not"). Round 3
added only `"retired"`; the halted exclusion pinned the
complementary state and was, in hindsight, the defect's premise.
The correction **reverses that assertion**, disclosed in place
at the assertion with the full reasoning (the Q9/Q6
candidate-suite amendment discipline). This is the candidate
suite, not a baseline suite — zero baseline edits, as ever.
Halted status/money TEXT assertions (GU8/GU13) are unchanged
and still pin the exact wording.

## New client identity (packaging line's conventions)

| | gen-pkg-1 (live) | gen-fix-1 (candidate) |
|---|---|---|
| entry | `app-268.js` | `app-269.js` |
| service worker | `sw-genpkg1.js` | `sw-genfix1.js` |
| cache | `opalreader-shell-genpkg1` | `opalreader-shell-genfix1` |
| styles | `styles-155.css` | `styles-156.css` |
| modules | `*-genpkg1.js`, `generation-surface.js` | `*-genfix1.js`, `generation-surface-genfix1.js` |
| packaging marker | `gen-pkg-1` | `gen-fix-1` |
| build marker | `d5b-v2-generation-client-2` | `d5b-v2-generation-client-3` |

Changed files get NEW names; no live path is overwritten;
rollback to gen-pkg-1 (or ui-pkg-4) stays exact
(`PURGE_ON_ACTIVATE` empty). Shelf bridge byte-identical
(SHA-256 `bc0a5879fbf4a6f455170ead8e0fbe1aa19d82126df4eb631bd0ebad9112ec8e`,
checked by the packager). `index.html` delta is the two
pointers only (`app-269.js?v=gen-fix-1`,
`styles-156.css?v=gen-fix-1`); its inline crash note still
carries the stale ui-pkg-4 build string inherited verbatim
from the published gen-pkg-1 index — a pre-existing wart,
deliberately out of this correction's scope.

**Publish digest (treehash method of record):**
`cd7d589a101d511f14abee3c3343b383ca6b5f0ae7bc7a24d8c0557885e717a8`
— 89 paths (base 81 + 8 added; `index.html` modified; delta
exactly 9 paths). Twin-tree assembly byte-identical; packager
checks pass (delta set exact, non-delta byte-identical to the
published base, bridge pinned, SW SHELL == import closure,
PURGE empty). Log: `logs/client-package.log`.

## Test evidence (one full run of each suite on the corrected tree)

- `tests/generation-unit.mjs` — **14/14 PASS**, exit 0
  (13 carried rows incl. the disclosed GU8 amendment, + new
  **GU14** "gen-fix-1: halted_unknown is terminal for matching;
  halted plan never reroutes, still renders": the full terminal
  set, live states still live, `findActivePlan` returns null
  for a halted-only list at chapter/book/segment scope, still
  finds a live plan beside a halted one, halted status/money
  text intact). Log: `logs/client-generation-unit.log`.
- `tests/unit-battery.mjs` — **13/13 PASS**, exit 0
  (carried unchanged). Log: `logs/client-unit-battery.log`.
- `tests/refresh-fix-proof.mjs` — **Chromium proof, 6/6 PASS,
  0 page exceptions**, exit 0. Log:
  `logs/client-refresh-fix-proof.log`. Rows:
  - **GF-1** boot under `sw-genfix1.js`, connect, library;
    build marker `-3` and packaging marker `gen-fix-1` read
    back from the introspection handle.
  - **GF-2** *(task a + c, book screen)* FP's only plans are
    terminal (one `halted_unknown`, one `complete`): the
    halted plan renders with "a charge needs checking" +
    "isn't confirmed yet" + its settled figure; over 17.5 s
    (> the 15 s poll) the stub records **zero** further
    plan-list fetches and the rendered plan line is the same
    DOM node throughout — no poll runs.
  - **GF-3** *(task a, Generation view)* same list: over 12 s
    (> two 5 s cycles) zero further plan-list fetches, line
    node identical; also pins the enabled-state sheet
    behaviour — no reroute for the halted plan's book, the
    server quote renders (Start never clicked).
  - **GF-4** *(task b, book screen)* a genuinely live
    (`active`) plan appears: the 15 s poll DOES run (fetch
    count rises; the screen re-renders).
  - **GF-5** *(task b, Generation view)* with the live plan
    present, the 5 s refresh DOES run.
  - **GF-6** nothing was submitted anywhere in the proof
    (stub recorded 0 commands) and the state/Shelf
    fingerprint is byte-stable end to end.

  Method note: the stub counts `GET /v2/d6-plans` list
  requests — each poll cycle performs exactly one — and rows
  also assert DOM node identity, so "no poll" is proven two
  independent ways. Fixture figures are synthetic (the GP-14
  discipline: a round known-settled $0.30; the unconfirmed
  charge carried by state + qualifier text, never folded into
  the settled figure). One earlier run of this proof failed
  GF-5/GF-6 for harness reasons since corrected (the reroute
  exists only at a plan's exact scope — GF-5 now opens the
  sheet from the active plan's own chapter; the GF-6 drift
  appeared only downstream of that timeout and does not occur
  in the clean flow, byte-stable at 8,784 bytes).

## Build layout (local)

`~/workspace/gen-pkg-1/client-build/genfix1/` — `base/` (the
published gen-pkg-1 tree), `src/` (delta sources generated by
`make-src.py` from base via exact anchored replacements),
`assemble.py` (twin trees), `package-assemble.py` (publish +
delta + static checks), `tests/`, `package/` (publish tree,
manifest). Local record: `~/workspace/gen-pkg-1/logs/refresh-fix/`.

**Turn: Rowan's** (source review). Publication remains Julie's
separate gate after that.
