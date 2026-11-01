3. Script-settings observability enabled + persisted (a census read, exactly as at every prior gate).
4. Queue `opalreader-generation-v2` (`93b6a35fb8cf4788a91a2c90b748ae66`): `delivery_paused: true`, sole consumer unchanged. **HELD is the required starting posture** — a census that finds the system not held is a deviation and a STOP; the executor never silently re-holds as a "fix" and proceeds (containment re-holds, §5.7, are for mid-gate deviations and are themselves STOP actions).

### 4.2 Plan / quote / money (exact)

5. Plan `plan:e377a5559961b294154276b6`: state `active`, stopReason `null`, totals eligible 23 / done 8 / failed 0 / blocked 0 / prompts 0; quarantine not held.
6. The 15 remaining entries are exactly the §2.3 set (occurrenceId + position + charCount), each `occurrenceState` ∈ {`pending`, `granted`}; the 8 committed entries unchanged (`ready`/`committed`); positions 65–67 `bound_already`; position 91 `excluded_parked`.
7. Eligibility quote re-read at census: eligible 15 / 20,864 chars / expected 294,137 / digest exactly `9453ab5dc7ee6ade7c650d14066054b965875f2ef1b65eb24bc633588d778e67`.
8. Phase accounting exact on both surfaces (capabilities + plan diagnostics): settled 732,303 / estimatedUnverified 19,018 / reservedUnverified 5,648 / inFlightUpper 0 / unknownOpen 0 / remaining 12,762,049.
9. Parked job fingerprint exactly `b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`, state `parked_policy`; zero exemption writes ever (no exemption journal entries for the chapter's final segment).

### 4.3 Quota (invariant — the cycle makes exact values phase-dependent)

10. Reconcile (full pagination): `ok: true`, drift empty, `censusComplete: true`, sole exception the known adjudicated straddler `att-37d63768-db4b-447d-8150-580b7c6ee257` (`estimated_unverified`, never dispositionable).
11. Historical PT days exact: 2026-10-29 = 57/0/57; 2026-10-30 = 79/0/79; 2026-10-31 = 44/0/44 (dispatched/reserved/consumed).
12. Current PT day (the census day): **dispatched exactly 0**; reserved ∈ {0, 96} depending on the cycle instant (a fresh cohort open, or the void instant between cohorts); consumed = dispatched + reserved accordingly; `currentDayBlocked: false`. A reserved value outside {0, 96}, or any dispatch at all, is a deviation and a STOP.
13. No grant for the plan's job in state `handoff_uncertain`, and no execution for the plan's job in state `unknown_billing` — by the best available read surface (see Q1, §10; the executor names the surface it used in the record).

### 4.4 Conflicts (exact match)

14. `GET /v2/conflicts` returns exactly the Gate 2D approved baseline four `schedule_dead` lease rows, field-for-field: id 1 @ 2026-10-29T23:54:14.808Z, `grant:plan:3183ecbf2ac4bf50bbc6166e:seg:1:full`; id 2 @ 2026-10-30T00:24:14.632Z, `grant:plan:603ab416bd67ab1b25de97be:ch1:1:full`; id 3 @ 2026-10-31T05:14:24.089Z, `grant:plan:b2dc2a3d1cd367a0245b9102:ch1:1:full`; id 4 @ 2026-11-01T01:04:30.364Z, `grant:plan:e377a5559961b294154276b6:ch2:1:full` — all cache_key `lease`, expected `7`, found `LIKE or GLOB pattern too complex: SQLITE_ERROR`. No fifth row; no changed field. (The §0.2 cycle has added none in ~an hour of cycling; a fifth row at census is a deviation and a STOP — its remedy is a new baseline + Rowan review, never an executor judgment call.)

### 4.5 Settings / lanes (exact)

15. Settings revision 1 (lane `standard`, monthly cap $50); capabilities read: standard admitted, **batch not armed** (`batch_not_armed`), generationState `halted`.
16. Bindings: sync watermarks content 18 / bindings 1826 (unchanged since Gate 3); the 8 Phase A bindings still read revision_key == cache_key.

---

## 5. Execution sequence (proposed — NOT executed by this filing)

### 5.1 Shape and mutation budget

| Step | Act | Mutations |
|---|---|---|
| E0 | Census (§4) | 0 (reads only) |
| R1 | Re-arm: halt lift, settings-only (§5.2) | exactly 1 (the GENERATION_HALT flip) |
| R2 | Queue unpause (§5.3) | exactly 1 (the queue PUT) |
| G | Monitored generation by the shipped machinery (§5.4) | 0 by the executor — generation itself performs provider attempts inside §5.5's bounds; this is the gate's purpose, counted and reported, never hidden |
| C | Closing: re-pause, then re-halt (§5.6) | exactly 2 |
| E4 | Read-backs (§6) | 0 |

Executor-initiated mutations total **exactly 4** (halt flip, unpause, re-pause, re-halt). Observability is re-checked after the settings mutation; the settings-only halt flip at gate (c) and Gate 2D provably did not disturb it, and if it were found disturbed the remedy is the conditional observability-only settings PATCH under the family's standing rule — counted and reported if used.

**Generate-button disclosure (for Julie's briefing, stated here so the record carries it):** from the R1 halt lift until the C closing re-halt, the system is live and **the app's Generate button is live with it**. The gate's subject is one plan that is already driving itself; any *other* generation Julie (or a stray tap) started in that window would consume the same 100/day provider cap and monthly cap, and would appear in monitoring as foreign attempts — a STOP (§7). Hands off Generate, for anything, until the gate closes.

### 5.2 R1 — re-arm sub-gate (its own decision point inside the single GO)

Precondition, hard: a **fresh full reconcile at R1 time reads `ok: true`** (the gate-(c) precondition, carried verbatim in strength) — the census reconcile (§4.3) does not substitute if time has passed; R1 re-reads it. Then, in the proven order of gate (c) and the Chapter 3 re-arm:

1. **Halt lift FIRST**: GENERATION_HALT `"1"` → `"0"`, settings-only mutation; read back the setting, the script etag (must be unchanged — the settings path does not touch code), observability (must still read enabled + persisted), and `/health` (build unchanged, generation now enabled).
2. No other act belongs to R1. In particular R1 does **not** unpause the queue: after R1 the sender is wired but the queue still holds everything — the system is armed-but-undelivered, the exact intermediate state the family's re-arms verified before unpausing.

Julie's GO covers R1 and R2 as **separately named sub-gates**: if R1's read-backs deviate in any particular, the gate STOPs *between* the sub-gates — R2 is never executed to "see if it helps," and containment (§5.7) returns the system to HELD.

### 5.3 R2 — queue-unpause sub-gate (last opening act)

1. Verify once more, immediately before: `/health` generation enabled on build `1c2d1d0f`; plan still `active` 23/8/0/0/0; reconcile still `ok: true`.
2. **Unpause LAST**: PUT the queue with `delivery_paused: false` (body carries `queue_name` + settings, per the cf-api law); read the queue back — `delivery_paused: false` is the only acceptable read-back.
3. From this instant, delivery is live: the current cohort grant's dispatch (or its void-and-regrant, §3.4) will reach the executor. Monitoring (§5.4) starts at the unpause, not after it.

### 5.4 G — monitored generation

- **Poll cadence:** plan read + quota/reconcile read every ~15 minutes (aligned to the watchdog/lease rhythm), plus a read at every observed plan-totals change the executor can catch. Each poll records figures only — plan totals, per-cohort grant settlements as visible through totals and derived day totals, dispatched/reserved/consumed, phase settled — **never segment text, never attempt payloads** (standing no-spoilers / technical-data law).
- **Expected progression:** plan done 8 → 23 in cohort steps (§3.3); each cohort's grant settles (`reported`) before the next issues; derived day consumption rises by dispatches and falls back at each settlement to dispatched-only.
- **PT-day rollover during G** is a named non-event (§3.3): monitoring notes the day change, the parked-on-quota interval if any, and continues. It is not a stall and triggers no act.
- **Duration honesty:** no completion time is promised. Phase A's cohort executed 8 segments in ~9 minutes of flow once delivered; the full 15 with settlement gaps and a possible rollover may take materially longer. The gate ends on completion criteria (§5.6), not on a clock — except that the stall STOP (§7) is clock-armed.

### 5.5 Bounds (hard)

- **Provider attempts:** ≤ 100 per PT day, enforced by the shipped quota guard itself (cohort bounding + reservation derivation + reconcile). The executor adds no attempts of its own — it issues no commands at all during G.
- **Cost ceiling:** cumulative recorded settled-cost delta attributable to this plan during G must remain **≤ 600,000 units (≈ $0.60)**. Crossing it is a STOP + containment (§7) — noting honestly that containment stops *further* spend; spend already settled is not clawed back (§8).
- **Phase fence (code):** the grant guard refuses any grant whose projection would breach the 13,500,000 phase budget (`grant-guards.mjs`); with §2.4's figures this fence is not expected to be approached.
- **Monthly fence (code):** settings cap $50 (the quota read's November ledger figure at drafting was 156,944 units — far from the cap under any composition; the cap itself is a settings value the census re-reads, §4.5).

### 5.6 Completion criteria and the closing sub-gate C — ends HELD (recommended)

Completion requires **all** of: plan state `complete` with totals 23/23/0/0/0 (§3.6); no grant for the job in `issued` or `handoff_uncertain`; fresh eligibility quote eligible 0 / digest recomputed over the completed set; reconcile `ok: true` with the gate's dispatches fully settled (no open reservations for the job's grants); phase settled delta within the §5.5 ceiling; conflicts still exactly the baseline four.

Then C, in containment order: **re-pause the queue** (PUT, read back `delivery_paused: true`), **then re-halt** (GENERATION_HALT `"0"` → `"1"`, settings-only, read back; etag and observability verified). **End state: HELD — halted + paused, exactly as found.**

Why HELD and not live-idle (the recommendation Rowan is asked to rule on, **Q3**): every gate in this family that was not itself a re-arm gate has ended held (Gate 2D deploy, range-fix deploy, Gate 3, Gate 3 retry); the two re-arm gates that ended live-idle (gate (c), Chapter 3 re-arm) did so because re-arming *was their entire purpose* and a generation gate followed immediately under its own GO. Gate 4's purpose is a bounded generation, after which the next pieces of work (Phase B, Batch) are separately gated and undecided — leaving the Generate button live in the interim would leave live a capability nobody has a current GO to use, against Julie's standing caution after gate (c) ("hands off it until a generation approval is in place" — Rowan's closing caution, adopted). Ending held costs nothing: any future gate re-arms under its own GO, in minutes, by the proven sequence.

### 5.7 Containment (pre-authorized, narrow — deviation response only)

On any §7 STOP after R1: **re-pause the queue first, then re-halt** (the family's proven containment order), read both back, and STOP. Containment is exactly two mutations, is the *only* executor act a deviation authorizes, and never licenses continuing the gate. A STOP before R1 needs no containment (nothing was opened) — the executor simply reports. A STOP during C: the closing steps already in progress are completed if safely possible (they *are* containment-shaped), then reported.

---

## 6. Readback checklist (E4 — all required, ends HELD)

After C, the executor reads back and the record reports, item by item:

1. `/health`: build `1c2d1d0f`, generation `halted`.
2. Settings: GENERATION_HALT `"1"`; etag unchanged from census; observability enabled + persisted.
3. Queue: `delivery_paused: true`.
4. Plan: state `complete`, totals 23/23/0/0/0, stopReason `null`.
5. Eligibility: eligible 0, bound_already 26, parked 1, expected 0 — digest recorded verbatim.
