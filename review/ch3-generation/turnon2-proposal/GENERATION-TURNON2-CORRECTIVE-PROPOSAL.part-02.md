 inside a named submission window ending **15:00Z (10:00 a.m. ET)**. At submission the PT day is ~8 hours old, but its dispatch counter is what matters, not its age: under the holds nothing generates, so the day's only consumption before Julie's tap is the parked plan's completion (§4, reserved at ≤12). The smoke chapter therefore starts with **≥76 dispatches of start-headroom** for its pre-final segments — the best achievable position short of the 2 a.m. form, at a humane hour.

- *Residual exposure*: 76 headroom against a Chapter-4-class chapter (first-19 = 89) still parks near the end. **A-variant alone does not resolve Q-1 either** — which is why it is recommended only in combination with Option C.
- *Deadline discipline*: the submission window is a named gate bound. If no submission arrives by 15:00Z, the gate stands down: the re-hold pair runs as the stand-down close (a gate act, not an emergency act), the gate ends HELD, and the GO's consumption is governed by the validity rule proposed at §6.4 / OQ-6. The system is never left enabled awaiting a tap indefinitely (§2.8.4 carried forward, §7).

### Option B — reduced smoke scope (size the smoke to fit one day)

Size the smoke's eligible set N so that even at the planning worst case it fits a single PT day. The binding constraint is the **start of the final segment**: the first N−1 segments must total ≤ 88 dispatches (or ≤ 76 after §4's reserve R = 12 for the parked plan's completion, which shares the day). Rule: **(N−1)·w ≤ 88 − R**.

| planning worst case w | N without reserve (R=0) | N with parked-plan reserve (R=12) |
|---|---|---|
| 6 (observed maximum, no margin) | 15 | 13 |
| **8 (proposed, §2)** | **12** | **10** |
| 10 (heavy margin) | 9 | 8 |

- *The structural weakness*: the app submits by **chapter or book scope** — Julie cannot submit "the first 10 segments of a chapter" from the app, and the smoke's entire evidentiary point is that it proves *her normal path*. A reduced scope therefore means *choosing a smaller chapter*, not trimming one: the smoke target becomes whichever Forever Pucked chapter's fresh quote fits the table — a real constraint on Julie's choice, and chapter sizes are not known until the census quotes them. Note also that **Chapter 4 itself (20 eligible) fits no row of the table** — Option B alone could never have smoked the chapter the program actually cares about next.
- *Verdict*: **not recommended as the primary resolution**. It is retained in the recommendation in one limited form: an **advisory fit test at census** (§5), which informs Julie's chapter choice and the outer bound's sizing under Option C, without making fit a pass/fail condition the gate can die on.

### Option C — window redesign (make the gate's clock contain the park) — RECOMMENDED CORE

Replace the single 4-hour decision bound with a **two-tier bound** in which a quota park is a defined, in-bounds **WAIT state**, not an incompleteness the clock runs out on:

1. **Inner bound — unchanged**: T0 + 4 hours. If the plan completes inside it, classification proceeds exactly as gate-1 §2.8.1 (COMPLETE on the full evidence set; FAILED on a stall/trigger/evidence failure; the fault path per §6.5).
2. **WAIT entry**: if, at the inner bound, the plan's *only* obstruction is `parked_quota` with stopReason `provider_attempt_budget`, totals failed = 0, and every other predicate stands clean (containment NORMAL, reconcile ok, conflicts at baseline, no trigger fired, recorder discipline clean), the plan enters WAIT. The classification does **not** land at the inner bound; the gate record names the WAIT phase and its bound, satisfying the no-indefinite-enabled predicate (gate-1 §2.8.4(i) is extended by enumeration to include "the smoke in WAIT inside its outer bound").
3. **Outer bound**: the **first PT reset after the park + 4 hours** — the plan receives the same 4-hour working window on the fresh day that it received on the first. **Extension rule**: if the plan re-parks in WAIT, it earns exactly one further window (second reset + 4 hours) **only if its done-count increased during the preceding fresh-day window** — a progressing plan earns time; a plan that re-parks with zero progress does not. **Absolute cap: T0 + 52 hours**, beyond which the classification lands regardless.
4. **WAIT discipline**: the sliding 35-minute stall test is **suspended for the quota park specifically** (the park is explained by definition; a stall declaration against it would be a false reading). Every other protection stays live at full strength: the nine emergency triggers (§2.8.3 carried forward), the unavailable-source law (an UNKNOWN on a /v2-sourced trigger still blocks COMPLETE), foreign-generation detection, containment and reconcile checks. Observation continues read-only; once the plan is parked and the picture is frozen, the observer's cadence may relax (proposal: hourly checks during WAIT, returning to ~5-minute polling at the reset and on any movement).
5. **Exit from WAIT other than by completion**: any non-quota stop state (`parked_storage`, `halted_unknown`, any state other than the named quota park), any failed entry appearing, or any trigger firing exits WAIT immediately into the ordinary classification path — the event is judged on its own terms at that moment, not at the outer bound.
6. **Classification law under C, stated completely**:
   - **COMPLETE**: the gate-1 §2.7 evidence set, evaluated **whenever it first stands complete within the outer bound** — plan done N / failed 0, job complete, exactly N new bindings against the smoke baseline (§4.3), phase delta in the three-line form, recorder discipline clean. Park events inside the window are recorded as in-bounds events, never disqualifying. (The smoke's N, quote, and watermark arithmetic are the new chapter's own, fixed at its census.)
   - **FAILED**: gate-1 §2.8.1(b) with "the decision bound" read as **the outer bound** — incompleteness at the outer bound for any reason other than a verified fault; a stall declared and not recovered by the outer bound; a fired trigger; an unattainable evidence set; Julie withdrawing. The failure close is gate-1's, unchanged (re-hold pair, Julie's contemporaneous countermand right preserved, the incomplete plan left exactly as it stands).
   - **SUSPENDED-BY-FAULT**: §6.5 (the fault rule, conformed to the executed precedent).
7. *What C concedes, honestly*: the gate can now span ~22–46 hours end-to-end (morning submission → possible next-morning completion). That is a longer enabled window than gate 1 ever contemplated, and it is only acceptable because every protection except the park-specific stall test runs uninterrupted throughout, and because WAIT is a named, bounded phase — never an unmarked overrun (the exact defect the gate-1 R2 law exists to prevent).

### Option D — guard-parameter change (code path — NOT recommended now)

Raise the 100/day cap, or reduce the 12-slot cohort headroom, so chapters fit more easily. Analysis only:

- **The cap is not ours alone to raise**: the 100 figure in the guard (`PROVIDER_ATTEMPT_DAILY_LIMIT`, honestly labeled app-selected when it was built) sits at the same value as the provider's own daily request quota as Julie has verified it for her account (100 requests/day, day boundary midnight PT — the same boundary the guard's 07:00Z reset implements). Raising the app cap above the provider's quota would trade a clean, explainable park for raw provider refusals mid-chapter — worse evidence, worse failure shape, no gain.
- **The headroom has a real job**: the 12 slots bound one fresh occurrence's worst-case split tree. The observed maximum is 6 — on this sample, a headroom of 8 would have admitted segment 20 (89 + 8 = 97 ≤ 100). But the sample is 19 segments of one chapter of one book; shrinking a safety bound to fit a single observation is how guards stop guarding. A defensible headroom re-derivation needs the dispatch distribution of normal operations (which do not exist yet — this gate is what creates them).
- **Cost of the path**: any parameter change is a code change — its own spec, candidate build, test battery, review, and deploy gate, sequenced *before* the turn-on gate and consuming its own round of Julie's and Rowan's attention — to solve what §3-C solves in gate law alone. **Deferred, not dismissed**: §9 carries it as future design work for the normal-ops era, when real dispatch data exists to size it.

## §4. The parked plan — sequenced, not discovered

### 4.1 The fact pattern the new gate inherits

`plan:8f14c8885548b9c5ddd6b8df` stands (last verified, record poll 22) in `parked_quota` — an **auto-resume state**. The gate-1 package's FAILED-close law already anticipated this moment: *"a later turn-on gate re-censuses it as a non-terminal plan under P-5 and it receives its own disposition there."* This section is that disposition, designed in advance rather than 