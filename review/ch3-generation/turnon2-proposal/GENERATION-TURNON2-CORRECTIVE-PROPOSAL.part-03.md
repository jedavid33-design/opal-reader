improvised at the lifts. The mechanical consequence is unavoidable and must be designed around: **the parked plan and Julie's new submission are released by the same two holds.** There is no sequence of lifts that enables her tap without also making the parked plan resumable, and the drive chain — alive, registered, passing on its ~10-minute cadence throughout the holds — will carry the plan's resumption on an early pass after the lifts, before any submission of Julie's can be expected. Any design that pretends the new smoke starts on a blank slate is false to the machinery.

### 4.2 Options

**P-1 — in-gate sequencing (RECOMMENDED).** The new gate names the parked plan as its **first observed item**, ahead of the smoke:

1. The census (§7) verifies the plan fresh against its last-verified values (state, totals, position 107 pending/unattempted, watermark 1861, phase settled 1,406,466). Any deviation is a census STOP under the standing law — the executor's own tracing never clears it.
2. The lifts run (the gate's only counted acts; §7). The observer's first watch is the parked plan, not the submission window.
3. **Julie does not submit until the parked plan reaches a terminal state and Wren reports it.** The expected clean outcome: the plan resumes on an early post-lift pass, position 107 executes (its dispatches land in the new PT day, reserved per §4.3), the plan completes 20/20 with the 20th binding (watermark 1861 → 1862), and its completion is classified as its own line — **the parked plan's completion, under the smoke gate's observation but not part of the smoke's evidence set**.
4. **Non-clean branch — PRE-SMOKE STOP**: if the resumption produces anything else — a re-park, a failed entry, an unexpected dispatch pattern, a trigger evaluation — the gate treats it as a pre-smoke STOP: the re-hold pair runs, the gate ends HELD, the smoke never starts, and the outcome is reported to Julie and Rowan for disposition. The turn-on attempt is not consumed by a failure of the inherited plan; the new gate simply does not proceed past its first item.
5. **Silent-chain branch**: if the plan shows no resumption across **3 drive passes / ~35 minutes** after the lifts (the stall-test cadence, applied to observation only), the gate **pauses and asks Julie** — the base package authorizes **no wake act** (no command of any kind is spent on the plan). Whether a single pre-authorized wake probe (the generation-resume gate's proven `RequestPause` mechanism) should be added is OQ-4; Wren's recommendation is no — the alarm chain's post-fault behavior is precisely what this program has repeatedly found platform-unverified, and a wake act whose effect cannot be verified buys nothing the pause does not.

**P-2 — separate completion gate first.** A standalone mini-gate (its own GO) lifts the holds, rides the parked plan to completion under observation, re-holds, and closes; the turn-on gate is then papered against a clean inventory (all plans terminal). *Merits*: perfect separation — a resumption failure cannot touch the turn-on attempt, and the turn-on census returns to the familiar all-terminal baseline. *Costs*: a second full gate cycle (second GO, second census, second pair of lift/hold cycles on the same machinery) to move one segment; each hold cycle is itself a small risk and a full round of everyone's attention. **Not recommended** — P-1's PRE-SMOKE STOP branch buys the same protection inside one gate — but it is the conservative alternative if Rowan prefers separation over economy.

### 4.3 Accounting treatment (applies under P-1)

- The parked plan's completion dispatches land in the **new PT day** and are counted in it: the day-planning reserve **R = 12** (the cohort worst-case figure) is held against them in every fit computation (§3-B table, §5). Its expected cost is far lower (one segment; observed per-segment maximum 6 dispatches; ~1,461 chars) — the reserve is a bound, not a forecast.
- Its settled units land in the forever-pucked phase accounting inside the gate window. The gate reports them as **their own line** — the parked plan's completion delta, measured between the census phase figures and the post-completion read — and **never** attributes them to the new smoke's plan. The new smoke's three-line exposure is computed on its own plan's delta alone.
- **The smoke's bindings baseline is struck at the parked plan's terminal read**: the smoke's "exactly N new bindings" test counts from the watermark standing at that moment (expected 1862 if the clean branch lands), not from the gate-open watermark. This prevents the inherited completion from either inflating or contaminating the smoke's evidence set.

## §5. Recommendation (Q-1)

**Adopt A-variant + C + P-1, with B retained only as an advisory census fit test.** In one paragraph: the gate runs in the morning (lifts ~12:30–13:00Z; Julie's submission window to 15:00Z) so the smoke starts on a young PT day whose only prior consumption is the parked plan's reserved completion; the parked plan is the gate's first observed item and must reach a clean terminal state — or stop the gate pre-smoke — before Julie submits; the decision bound becomes two-tier, with `parked_quota` re-classified as an in-bounds WAIT state under a hard outer bound (first reset + 4h; one progress-earned extension; absolute cap T0 + 52h), so a quota park can no longer kill a smoke by calendar accident; and at census the new chapter's quote is run through the §3-B fit test at w = 8 with R = 12 — **advisory only**: it tells Julie and the record whether a park is likely and sizes the expected number of WAIT windows, but under C a park is a survivable event, so a chapter that fails the fit test is smoked anyway if Julie names it, with its expectation stated in the record. Option D is deferred to the normal-ops era (§3-D). The smoke target is a single Forever Pucked chapter Julie names at GO — expected to be **Chapter 5 (chapterIndex 4)**, the next chapter with eligible segments once Chapter 4 completes under §4; if its fresh quote is very large, Julie may name a smaller later chapter instead. Her choice, recorded.

## §6. Q-2 — fault-clearance prerequisites for the new gate

Gate 1 asked nothing about platform health before it started; a fault arrived mid-gate and, because the plan was already parked, the two events compounded into a suspension. The new gate treats clearance as a **precondition with evidence**, in four parts.

### 6.1 The clearance set (the routes whose health is the question)

The 1101 signature faulted the **DO-backed** routes while `/health` and the Cloudflare control plane stayed readable. Clearance is therefore judged on the DO-backed subset, each required to return **HTTP 200 with its expected response shape** (a bare non-500 is not a pass):

- client `GET /v2/d6-plans` and `GET /v2/d6-plans/<the parked plan>` (the census's own plan reads);
- operator `GET /v2/d6-containment` and the `drive=1` diagnostics projection (both containment surfaces);
- operator `GET /v2/d6-diagnostics` for the parked plan (carries its phase accounting);
- client `GET /v2/generation/capabilities`; client `GET /v2/quota`; operator `GET /v2/d6-quota-reconcile`; client `GET /v2/conflicts`.

`/health` and the control-plane pair (cf-api queue GET; worker `/settings` GET) are read as well — they were never the faulted surfaces, and their agreement is part of the T-8 discipline — but **they cannot substitute** for any member of the DO-backed set.

### 6.2 The two-set rule

Clearance requires **two complete passes of the clearance set, separated in time**: (i) the gate's census read set itself, all-200 at every member; and (ii) a **confirmation set** — the same reads repeated **not less than 30 minutes after** the census set completed — again all-200. **The lifts may not begin until the confirmation set passes.** A single healthy snapshot proves nothing about a platform that faults in episodes; two snapshots half an hour apart, on top of §6.3's lookback, is the minimum pattern that distinguishes "cleared" from "between episodes" on the evidence this program actually has. (The 30-minute figure sits deliberately beside the program's standing ≥35-minute stall-window discipline; Rowan may set it — OQ-7's companion.)

### 6.3 The lookback (fault-free history on evidence that exists before the gate)

The clearance clock starts at the **last 1101-class failure observed by any admissible source**. Admissible sources are logs, not recollections:

- **The scheduled monitor's run log** (`fp-ch2-generation-monitor`, running every **20 minutes** against the same route family — plan, job, quota, bindings snapshot — with its log at `~/workspace/goals/opal-roundtable/hidden_files/fp-ch2-monitor-log.md`). It detected this fault from its first affected run (23:06 ET, Nov 6) and logged the signature continuously thereafter; it is a working tripwire on exactly the surfaces §