# Phase B Attempt 3 — Coordinator Alarm / driveOnce Stall: Read-Only Diagnostic Report

- **Authorization:** Rowan's Phase B Attempt 3 review (documentary PASS on
  stop and containment; INVESTIGATION HOLD), relayed Nov 1, 2026 —
  read-only investigation of the coordinator alarm and `driveOnce` path
  using existing source, metadata, logs, and read-only evidence.
  **No production mutation of any kind was made for this report.** The
  only production contact was read-only GETs through the prod client
  and operator connectors (listed in §9).
- **Subject:** why, during Phase B attempt 3 (unpause
  2026-11-02T01:24:40Z → stall declared 02:09:27Z), no grant ever
  issued for plan `plan:19cad189fab54b9c804a74a6` despite a verified
  clean live state — and whether the preserved plan can safely resume.
- **Governing records:** `PHASEB-ATTEMPT3-EXECUTION-RECORD.md`;
  `PROD-1101-DIAGNOSIS.md`; `ROWAN-PHASEB-ATTEMPT3-REVIEW.md`.
- **A note on method, per Rowan's instruction:** this report does NOT
  infer an alarm failure solely from the absence of grants. Every
  candidate mechanism is evaluated against the source and the captured
  state; what is proven, what is inferred, and what is indeterminate
  are labeled as such throughout.

## 0. Source basis — what "the source" means in this report

All source claims are grounded in the **deployed build's own modules**:
the 31 script parts downloaded from production at the attempt-3 census
and preserved at
`~/workspace/ch2-program/ch3-recovery/phaseb-attempt3/evidence/parts-e0/`
(part names `v2/…`). For this report I re-hashed every on-disk part
against the census parse manifest (`parts-parse-e0.log`): **31/31
parts match the deployed manifest byte-for-byte** (script etag
`f15fb1ae40f870fc4493f3499db0b096c4d801b9fff8d20fe5538d84c69c82ed`,
build `1c2d1d0fa7ebb769f68cfb327fb9fde7d4d30867`). Line numbers below
cite these part files.

The local tree `~/workspace/d6-build/impl/` does **not** correspond to
the deployed build (only 12/31 files hash-match; 12 differ, 7 deployed
modules — including `quota-budget.mjs`, `park-release.mjs`,
`prefix-range.mjs` — have no local counterpart). No source claim in
this report rests on `impl/`; it was not used.

Platform-behavior statements (single alarm per Durable Object,
`setAlarm` replaces, alarms persist across eviction, at-least-once
delivery, automatic retry of a throwing `alarm()` handler with
exponential backoff starting at 2 s for up to 6 retries, after which
the invocation is not retried further) are Cloudflare's documented
Durable Objects alarm semantics, retrieved 2026-11-02. They are
platform documentation, not observations of this DO.

## 1. Confirmed findings

**F1 — `driveOnce` has exactly one caller in the deployed bundle: the
Durable Object alarm.** A grep over all 31 deployed parts finds a
single call site: `v2/worker-entry-prod-d6.js:1465`, inside
`OpalReaderCoordinatorProd.alarm()` (lines 1455–1468). No fetch,
command, queue, or report path drives grants. The full invocation
chain is:

1. platform alarm → `OpalReaderCoordinatorProd.alarm()`
   (`worker-entry-prod-d6.js:1455`);
2. `await super.alarm()` → the base DO alarm (`worker-entry.js:270`),
   which constructs a `GenerationCoordinator` and runs
   `coord.alarm()` — the schedule/watchdog processor
   (`coordinator.mjs:2489`) — then flushes the host cache;
3. back in the subclass: `service.recover()` (`service.mjs:1386`),
   then `service.driveOnce()` (`service.mjs:888`), then cache flush.

There is no try/catch in the subclass alarm around steps 2–3: a throw
in `super.alarm()`'s caller-visible portion, in `recover()`, or in
`driveOnce()` propagates out of the platform alarm invocation. (The
base coordinator alarm itself isolates per-row errors and re-arms in
a `finally` — F2 — so a throw *after* it, e.g. in `driveOnce`, does
not break the chain; it only skips that pass's driving.)

**F2 — The alarm chain is self-perpetuating, with three distinct
re-arm mechanisms, and it is re-armed by command/report traffic — but
never by reads.** In `coordinator.mjs`:

- `_armAlarm()` (2459–2463): `setAlarm` to the earliest pending
  schedule row's `due_at`, or now + `WATCHDOG_PERIOD_MS`
  (10 min, line 133) when the schedule is empty.
- The base `alarm()` (2489–2525) processes due schedule rows with
  per-row isolation (a failing row backs off 30 s × 2^n, capped at
  900 s; at `SCHEDULE_MAX_ATTEMPTS` = 8, line 148, it dies visibly as
  a `schedule_dead` row in `binding_conflicts`), and in its `finally`
  block — reached whenever the handler runs at all — ensures a
  pending watchdog row exists and calls `_armAlarm()`
  **unconditionally**.
- `wake()` (2469–2474) ensures a pending watchdog row exists and
  calls `_armAlarmIfEarlier()`. Its only callers in the bundle are
  `handleCommand` (coordinator.mjs:521 — every command),
  `requestGrant` (1805), and `handleReport` (2064). **No GET/read
  path calls `wake()`.**
- `_armAlarmIfEarlier()` (2480–2488) sets the alarm **only** if
  `getAlarm()` returns null or the earliest due time is *earlier*
  than the armed time. It trusts the platform's armed value: it
  never corrects an armed time that is later than the next due work,
  and nothing anywhere in the bundle verifies that an armed alarm is
  ever delivered. There is no `deleteAlarm` call anywhere in the
  deployed bundle.

Corollary (source-proven): the chain can be broken in exactly one
code-visible way — if a due alarm's invocation never executes any
handler code (so the `finally` re-arm never runs) *and* the platform
consumes the alarm, the chain stays dead until the next
command/report wake. Ordinary eviction cannot do this (alarms are
platform-persisted; the coordinator holds no in-memory state by
design, `coordinator.mjs:11`).

**F3 — The chain provably worked before the 1101 fault, on this same
code and data.** (a) Conflicts row 4 (`schedule_dead`, recorded
2026-11-01T01:04:30Z — attempt-3 record §1 item 11) exists only
because the base alarm processed a lease row to its 8th failure that
day. (b) Gate 4 (19:01–19:40Z Nov 1) issued and closed three grant
cohorts — possible only through alarm drive passes per F1. (c) Phase
A (Oct 31) likewise issued a grant. The last externally visible
evidence of the chain firing is Gate 4's close, ~19:37–19:40Z Nov 1.

**F4 — No grant, reservation, ledger, or outbox write of any kind
occurred during the attempt-3 window.** Proven by the 23 polls
(attempt-3 record §8): grants `[]` at every poll; quota reserved 0
and dispatched 76 throughout; phase settled delta 0; plan `active`
with `updatedAt` never moving from its creation timestamp
(1793582596359 — verified in poll diagnostics p01 and p23,
`poll-diag-p01.json` / `poll-diag-p23.json`, executions `[]` in
both). A completed grant issuance writes all of those durably
(`coordinator.mjs:1750–1763`), so none happened.

**F5 — No GRANT_STOP_MAP refusal occurred during the window.** Every
stop-map reason (`service.mjs:55–75`) terminates in a durable plan
state write (`parked_quota` / `parked_cap` / `parked_budget` /
`parked_storage` / `halted_unknown`) via `setPlanState` in the grant
step (`service.mjs:996–1000`) or in `driveOnce`'s own pre-checks
(971–983). The plan's state, stopReason (null), and `updatedAt` were
value-identical at all 23 polls. Therefore none of those refusals
fired — including every quota-family refusal, the phase-budget
refusal, the storage refusal, and the phase-halt transition. This
also rules out the quota guard's cohort/reservation refusals
(`provider_attempt_budget*`), which park visibly.

**F6 — Every *invisible* refusal path in the drive/grant path is
individually contradicted by window evidence.** The complete
enumeration is §3. In summary: `job_not_found`, `nothing_pending`,
`grant_exists`, the `execution_in_flight` skip, both quarantine
refusals/skips, and the phase-accounting shape-fence refusal are each
ruled out by state the polls read through the *same code paths* the
guard itself uses (notably: the plan-view quarantine read,
`quarantineHoldRowSafe`, rethrows any error other than "no such
table" — `quarantine.mjs:139–149` — so a holds-table fault during
the window would have failed the polls themselves, not silently
read as "no hold"; and `phaseAccounting`, whose output the shape
fence checks, returned both unverified fields as proper integers on
the capabilities and diagnostics surfaces at census and every poll).

**F7 — No read surface exposes the alarm, the schedule table, or
drive-pass outcomes.** Exhaustive over the deployed routes:
`getAlarm()` is called only inside `coordinator.mjs` (2469–2488);
no route returns it; the schedule table is written and read only by
the coordinator's alarm machinery; `driveOnce`'s return value (the
per-plan outcomes array, including `out.grantRefused` and
`out.quarantined`) is **discarded** by its only caller
(`worker-entry-prod-d6.js:1465` does not capture it). The one durable
write `driveOnce` performs unconditionally — the halt-epoch
observation (`noteHaltObservation`, `quarantine.mjs:296–333`, called
best-effort at `service.mjs:897`) — lands in `d6_halt_epochs` /
`d6_quarantine_meta`, for which no read surface exists either.
**Whether any given drive pass ran is therefore not directly
observable from outside the DO. This is an evidence limitation of
the shipped build, stated plainly.**

**F8 — The stall condition persists after the attempt.** In live
read-only checks at ~02:40Z Nov 2 (about 30 minutes after re-halt;
captured in `phaseb-stall-diagnostics/live-*.json`): health build
`1c2d1d0f`, generation halted; the plan is still `active`, its entry
still `pending` with `executionState: null`; the job still `queued`
rev 1 with grants `[]`; diagnostics show **zero execution records**
for the plan and phase accounting exact (settled 1,029,420 /
estUnv 19,018 / resUnv 5,648 / remaining 12,464,932); reconcile
`ok: true`, armed, sole straddler exception, PT 2026-11-01 totals
76/0/76; conflicts still exactly the four baseline rows; eligibility
still eligible 1 / 569 / 8,022 with the exemption-era digest
`cdef2c7e…`. This matters analytically (see §4): grant *issuance*
for a plan-linked job is **not** fenced by GENERATION_HALT in the
source — the halt fences only *delivery* (F9). Had an effective
drive pass run in the ~30 held minutes after re-halt (spanning at
least two watchdog periods from any arming), it would have issued
the grant and left the occurrence `granted` with 12 slots reserved,
even though nothing could be delivered. It did not. (One narrow
escape exists — an issue→lease-void cycle completing inside the
interval — but the void path schedules a `retry_grant` 30 s out
(`coordinator.mjs:1800`-region `_scheduleReAdvance`), whose
re-issuance would have been live at the read instant; and no cycle
can start without the chain processing schedule rows in the first
place. The self-consistent reading is that no effective drive pass
has occurred since re-halt either.)

**F9 — The halt fences delivery, not issuance, for plan-linked
jobs.** `d6HostEnv` wires `sendGrant` only when `GENERATION_HALT ===
"0"` and the queue binding exists (`worker-entry-prod-d6.js:~340`);
`driveOnce` drains the outbox only when a sender is wired
(`service.mjs:1047–1048`). The grant guard's halt refusal
(`grant-guards.mjs`, the `generation_halted` / halt-epoch fences)
applies **only to plan-less jobs**; a plan-linked job's grant is
checked against phase halt, phase budget, storage, quota, cap, and
quarantine — never against GENERATION_HALT. The coordinator's own
alarm/comment at `worker-entry-prod-d6.js:1458–1460` states the same
design: "While halted, d6HostEnv wires no sendGrant, so driveOnce
can settle plan state and re-derive grants but nothing can leave
the outbox."

**F10 — The exemption is not consulted by the drive/grant path at
all.** `generation/service.mjs`, `coordinator.mjs`,
`generation/grant-guards.mjs`, and `generation/quota-budget.mjs`
contain no reference to the chapter exemption; `d6_chapter_exemptions`
is read only by `park-release.mjs` (eligibility/park machinery —
i.e., quote and plan-creation time) and `grant-finalizer.mjs`. The
exemption did its work before the attempt's SubmitJob: it made
idx 26 eligible so the plan could be created with the entry's
disposition already `eligible`. Preserving or revoking it now has
**no effect** on whether the preserved plan can be driven.

## 2. Q1 — Was the alarm scheduled, and did it fire?

**Scheduling (source-proven).** The alarm is armed from the durable
schedule table: the next fire time is always the earliest pending
schedule row (a watchdog row is manufactured whenever none exists),
and the chain re-arms (i) unconditionally at the end of every alarm
pass, (ii) on every command, report, and grant request via `wake()`,
and (iii) after every command via `_armAlarmIfEarlier()`. It is not
armed "only on transitions"; it is armed continuously, and any
single coordinator wake re-establishes it if it was lost (F2).

**Firing — before the fault:** proven (F3). **During the 1101
fault:** any alarm that came due would have been delivered to a DO
that, on the diagnosis memo's leading hypothesis, could not
instantiate (every fetch faulted at that layer with bare 1101). The
watchdog row's next due time after Gate 4's close falls inside the
fault's onset window (the memo's §4 maturation analysis). On
documented platform semantics, a failing alarm invocation is
retried with backoff from 2 s, up to 6 retries — a span of minutes,
against a fault that lasted ~4¾ hours — after which the invocation
is dropped; and because no handler code ran, the code's own
unconditional re-arm never executed. The stored alarm would stand
consumed. This is a mechanism, stated conditionally — the memo
ranks the platform/construction cause as most plausible but
**unconfirmed**, and this report adopts the same status.

**Firing — during the attempt-3 window:** indeterminate by direct
evidence (F7), and this is the crux. Two command wakes are certain
after recovery: the exemption POST at 01:22:15Z is a direct service
route in the DO fetch handler (`worker-entry-prod-d6.js:1269`) and
does not itself pass through `handleCommand`; the SubmitJob at
01:23:15Z **does** reach `handleCommand` — the service's
`createJobForEntries` invokes it for the inner job submission
(`service.mjs:160–171`) — and `handleCommand` calls `wake()` before
applying (`coordinator.mjs:521`), then `_armAlarmIfEarlier()` after.
So at 01:23:15Z the chain was either still armed (if it had survived)
or was re-armed then, with a fire time at the earliest pending
schedule row — a pre-fault watchdog row's long-past `due_at`, or
≤ 01:33:15Z for a fresh one. A delivered alarm at any point in
01:23–02:09Z would have run the chain in F1. §3 shows a delivered,
completed drive pass cannot be reconciled with the window state
unless it died before the grant step on every cycle. §5 ranks the
residual explanations.

**What can break the chain (complete over the source):**
(1) platform-level delivery loss of a due alarm with retries
exhausted before any handler code runs (above) — the chain then
waits for the next command/report wake, and pure read traffic never
revives it;
(2) the armed-value trust in `_armAlarmIfEarlier()` — if the
platform reports an armed time later than the next due work, the
code sets nothing and cannot detect non-delivery; no code-originated
`setAlarm` value can be far-future (all are a pending row's `due_at`
or now + 10 min), so a wrong armed value would have to be a
platform-side artifact;
(3) a throw in the subclass alarm *after* `super.alarm()` (in
`recover()` or `driveOnce`) — breaks that pass's driving only, not
the chain (the base `finally` already re-armed);
(4) eviction/hibernation — cannot break it (platform-persisted
alarm; stateless coordinator);
(5) poison schedule rows — cannot break it (per-row isolation;
death is visible, and conflicts stayed at the baseline four).

## 3. Q3 — Every refusal/return path in the grant-issuance path, evaluated

(The refusal analysis is presented before Q2's conclusion because
Q2 depends on it. "Visible" = necessarily writes durable state the
polls read. All line cites are the deployed parts.)

### 3a. Paths that would have been VISIBLE — all ruled out

| # | Path (source) | Would have written | Verdict |
|---|---|---|---|
| V1 | Driver phase-halt pre-check (`service.mjs:971–975`) | plan → `halted_unknown` | OUT — plan stayed `active`; phase not halted (census + Gate 4 granted under this phase state) |
| V2 | Driver storage projection (`service.mjs:978–983`, `grant-guards.mjs:57–73`) | plan → `parked_storage` | OUT — no park; projection is far inside the 10 GB boundary (R2 ≈57% at last seed-era accounting; remaining eligible chars for this plan = 569) |
| V3 | `quota_parked` — unreleased `quota_parks` row (`coordinator.mjs:1645–1646`; stop-map `service.mjs:66`) | plan → `parked_quota` | OUT — no park; live `/v2/quota` still shows `parked: null` |
| V4 | `quota_estimate_exhausted`, ledger check (`coordinator.mjs:1650–1651`) and cohort count check (1697–1698) | plan → `parked_quota` | OUT — day attempts 76 (provider dispatches) / 15 (net ledger attempts on the live read), both < 100; cohort size 1 |
| V5 | `spending_cap` (`coordinator.mjs:1661–1662`; stop-map) | plan → `parked_cap` | OUT — month spent far under the $50 cap; job estimate is one segment's |
| V6 | Guard `phase_halted_unknown_billing` (`grant-guards.mjs:196–197`; stop-map) | plan → `halted_unknown` | OUT — same evidence as V1 |
| V7 | Guard `phase_budget` (`grant-guards.mjs`, `d6PhaseBudgetCheck` 108–119) | plan → `parked_budget` | OUT — projection 1,029,420 + 5,648 + 0 + 153,636 (occurrence ceiling; the entry's own upper is 8,022-scale) = 1,188,704 ≤ 13,500,000 |
| V8 | Guard `storage_boundary` (`grant-guards.mjs:225–226`; stop-map) | plan → `parked_storage` | OUT — as V2 |
| V9 | Cohort bound empty → `provider_attempt_budget` / `…_bootstrap_incomplete` / `…_day_over_limit` (`quota-budget.mjs:624–646`; `_issueGrant` 1737–1741; stop-map) | plan → `parked_quota` | OUT — quota armed and reconcile `ok: true` at census and every poll (bootstrap completed at Gate (b)); the one occurrence needs 12 worst-case slots (`SEGMENT_ATTEMPT_BUDGET = 12`, `gen-constants.mjs:16`) against headroom 24 (100 − 76) |
| V10 | `reserveForGrant` refusal (`coordinator.mjs:1743–1748`; stop-map reasons) | plan → `parked_quota` | OUT — same evidence as V9; reserved stayed 0 with drift empty on all reconcile pages |

### 3b. Paths that leave NO durable trace — evaluated individually

| # | Path (source) | Mechanism | Verdict |
|---|---|---|---|
| I1 | `job_not_found` (`coordinator.mjs:1643`) | job row missing at drive time | OUT — job read at SubmitJob read-back, all 23 polls, and live (queued rev 1) |
| I2 | `nothing_pending` (`coordinator.mjs:1658–1659`) | no `pending` occurrences for the job | OUT — the occurrence read `pending` at every poll and live |
| I3 | `grant_exists` (`coordinator.mjs:1700–1703`) | a grant row already holds the deterministic id `grant:<jobId>:<revision>:full` | OUT — the job was created at 01:23:15Z in this attempt; no prior grant requester for it exists; `jobView` projects all of the job's grants and showed `[]` at every poll |
| I4 | Driver `execution_in_flight` skip (`service.mjs:1001–1006`) | a non-terminal execution record exists for the pending occurrence | OUT — `executionState: null` at read-back and all polls; live diagnostics show zero execution records for this plan; no execution was ever created for this job |
| I5 | Driver D7-2 quarantine skip (`service.mjs:954–968`) and guard `plan_quarantined` / `job_quarantined` (`grant-guards.mjs:157–160`) | a held quarantine row, or the strict hold read failing (treated as held by the driver; throwing in the guard) | OUT — the plan was born after the halt lift and read back `held: false`; the identical holds SELECT was exercised by the plan view at read-back and all 23 polls, and the view's reader rethrows any non-"no such table" error (`quarantine.mjs:139–149`), so a table fault would have failed the polls, not masqueraded as an all-clear. (Formal residue: a fault present *only* at drive instants and never at any of 23 polls — no mechanism suggests itself; not credited.) |
| I6 | Guard `phase_accounting_incomplete` (`grant-guards.mjs`, `d6PhaseBudgetCheck` shape fence) | `phaseAccounting` returns a legacy-shaped object (missing/invalid unverified fields) | OUT — the same function's output was read on the capabilities and diagnostics surfaces at census and every poll with both fields present and exact (19,018 / 5,648) |
| I7 | Driver silent skip: no current job (`service.mjs:985–988`) | `d6_plan_jobs` has no row for the plan | OUT — `createJobForEntries` inserts the link row in the same invocation that created the job (`service.mjs:172–176`), the plan entries carry the job id, and plan/job views resolved throughout |
| I8 | Live-grant block in the grant step (`service.mjs:985–988` region, grantStep pending/liveGrant checks) | an `issued` grant already exists | OUT — grants `[]` at every poll (same evidence as I3) |
| I9 | A THROW inside the grant transaction or its callers — e.g. in `_issueGrant`'s occurrence/ledger writes, in `requestGrant`'s `wake()`, in `recover()` before `driveOnce`, or in the subclass alarm's cache/service construction before `driveOnce` | exception propagates out of the platform alarm invocation; the pass leaves no durable trace (the guard's in-transaction epoch note rolls back with it) | **INDETERMINATE, ranked low.** Every component named was exercised successfully by poll reads in the same minutes — each poll constructed the coordinator, service, genstore, and host cache inside the same DO and read the same tables — and `recover()` is a plain SELECT scan (`genstore.mjs:922–941`) that is a no-op on this store (no non-terminal execution records; it ran on substantially this store state in every Gate 4 pass). A storage fault recurring at every expected alarm cycle (~01:33, ~01:43, ~01:53, ~02:03Z, plus platform retries) while never touching any of the interleaved reads has no identified mechanism. It cannot be excluded by any read surface (F7). |

No other return exists in `driveOnce`, its grant step, `requestGrant`,
`_issueGrant`, or `d6GrantGuard`: the enumeration above is complete
over the deployed source. (The plan-selection exclusion at
`service.mjs:928–930` — complete/partial/retired/halted_unknown —
does not apply: the plan is `active`. The job state machine is not a
hidden fence either: `grant` is a legal transition from `queued`
(`coordinator.mjs:51–71`, `JOB_TRANSITIONS`), applied inside the
grant transaction at 1764–1775.)

## 4. Q2 — Did driveOnce run during the window?

- It did **not** complete a grant issuance (F4, proven).
- It did **not** run and refuse at any visible stop (F5, proven).
- It did **not** run and refuse at any enumerated invisible refusal
  (F6 / §3b — each ruled out on window evidence).
- The remaining possibilities are exactly two: **(a)** no effective
  drive pass occurred — the alarm never fired, or fired and died
  before the grant step on every cycle (I9, disfavored); or **(b)**
  `driveOnce` ran to the grant step and something outside the
  enumerated source paths intervened — which, the enumeration being
  complete over the deployed source, would require the deployed
  parts analyzed here to not be the code that ran (contradicted by
  the census: etag and 31/31 part hashes verified *during* the
  attempt, before and after the window).
- F8 extends the observation: the non-issuance persisted for ~30
  minutes after re-halt, in a state where issuance (not delivery)
  was possible. Whatever prevented issuance is **still in effect**
  as of the last live read, or the chain is still not firing. It is
  not specific to the unpaused window, the queue state, or the halt
  flag.

**Conclusion for Q2:** on the complete source enumeration plus the
window evidence, the supported statement is: **no effective drive
pass reached the grant step at any point from the SubmitJob
(01:23:15Z) through the last live read (~02:40Z)**. Whether that is
because the alarm never fired or because every pass died pre-grant
is indeterminate from read-only evidence (F7); the pre-grant-death
variant requires a fault class that the same minutes' read traffic
contradicts (I9).

## 5. Q4 — Could the 1101 fault have broken the alarm chain?

Mechanism-level only; causation is **not** assumed.

For the fault to have broken the chain, four things must all be
true:
1. **A coordinator alarm came due during the fault.** Plausible to
   the point of near-certainty: the watchdog cadence is 10 minutes,
   Gate 4 activity ran to ~19:40Z, and the memo's onset window is
   19:46–19:59Z — a watchdog (or a Gate 4 grant's 15-minute lease
   row) maturing in that window is the expected course of events.
2. **The DO could not execute handler code during the fault.** This
   is the memo's leading (unconfirmed) hypothesis: bare 1101 on
   every DO-forwarded fetch, identical on staging's different build
   and data, points at instantiation/the platform layer.
3. **Platform retries were exhausted inside the fault.** On
   documented semantics (backoff from 2 s, ≤ 6 retries ≈ minutes)
   against a ~4¾-hour fault, yes — *if* 1 and 2 hold, the due
   invocation was dropped and, no handler code having run, the
   code's unconditional re-arm never fired. The chain would then be
   dead with the alarm consumed.
4. **Nothing revived it before attempt 3.** Attempt 2 was
   reads-only (reads never call `wake()` — F2), and attempt 3's
   first wake was the SubmitJob at 01:23:15Z.

**The timeline is consistent with 1–4 — but step 4 has a hard
consequence the naive version of this hypothesis does not survive:**
the 01:23:15Z wake *did* run `_armAlarmIfEarlier()`. If the
platform's armed value was null (consumed) or earlier than the
earliest pending row, the wake re-armed it, and a delivered alarm
should have produced a drive pass by ~01:33Z. It did not (F4–F6).
So the fault hypothesis, to explain the *attempt-3* stall and not
just a dead chain during the fault, requires one further condition:
**(5)** the re-armed (or never-lost) alarm was *not delivered* —
e.g., the platform held a stale armed timestamp for this DO that
`getAlarm()` faithfully reported (so the code, which only ever
moves an alarm earlier and never verifies delivery, set nothing),
or `setAlarm` registrations were silently ineffective for this DO
after the fault cleared. Both variants are platform-side, invisible
to every read surface (F7), and indistinguishable from each other
from here.

Equally consistent with all observations: the alarm-delivery defect
for this DO is **independent of** the 1101 fault (the fault is then
coincidence; the memo already grades its own alarm-maturation
correlation as coincidence-grade for the fetch fault). Read-only
evidence cannot separate fault-caused from fault-coincident. What
the evidence does support is the *mechanism family*, not the cause:
**the chain is armed-or-armable but its alarms are not producing
drive passes** — a delivery-side failure, not a code-path refusal.

One more consistency check in the fault hypothesis's favor: no new
`schedule_dead` conflicts appeared during or after the fault
(conflicts remained exactly the baseline four at census, all polls,
and the live read). A *firing* chain processing the overdue watchdog
row would also leave no conflicts row (the watchdog row processes
cleanly), so this neither confirms nor refutes firing — recorded as
neutral.

## 6. Q5 — The preserved plan: resume trace, and containment

### 6a. Exactly what the next successful drive pass would do

Assuming the drive mechanism is restored and a pass reaches the
grant step with the plan as preserved (traced line-by-line through
F1's chain; state values from the live read):

1. Base alarm processes due schedule rows; `recover()` runs its
   scan — a no-op (no non-terminal execution records exist).
2. `driveOnce` selects the plan (the **only** non-terminal plan;
   selection is by `created_at`, `service.mjs:928–930`), passes the
   strict quarantine read (no holds — live-verified), the phase-halt
   pre-check (phase not halted), and the storage projection.
3. Grant step for job `plan:19cad189fab54b9c804a74a6:seg`: one
   `pending` occurrence, no live grant, no execution record →
   `requestGrant` → `wake()` → `_issueGrant`:
   - no quota park (live: `parked: null`); day ledger attempts far
     below 100 on any day;
   - monthly-cap check passes (month spent ≈ $2.94-scale against a
     $50 cap; this job's estimate is one 569-char segment's);
   - `d6GrantGuard` passes (quarantine clear; phase projection
     1,188,704 of 13,500,000; storage projection passes);
   - cohort bound: the occurrence's worst case is 12 slots
     (`SEGMENT_ATTEMPT_BUDGET`); same-PT-day resume (PT 2026-11-01,
     consumed 76) fits at 88 ≤ 100; on any later PT day (the day
     rolls at midnight PT — 08:00Z now that PT is on standard time)
     headroom is the full 100. **The quota arithmetic is not a
     blocker on any day.**
   - reservation of 12 slots; grant row
     `grant:plan:19cad189fab54b9c804a74a6:seg:1:full` issued;
     occurrence → `granted`; ledger attempt row; outbox dispatch
     row; lease schedule row (+15 min, `LEASE_MS`,
     `coordinator.mjs:134`); job transitions `queued → generating`
     (legal, in the same transaction).
4. Delivery then depends on the holds, not on the plan: if the halt
   is lifted, `driveOnce`'s drain hands the dispatch to the queue
   binding; if the queue is unpaused, the consumer invokes the
   executor, which generates the one segment (expected cost per the
   standing quote ≈ 8,022 units ≈ $0.008; the occurrence's modeled
   ceiling is 153,636 units) and reports; the binding publishes and
   the chapter completes at 27/27.
5. **No new SubmitJob is needed, and none should be sent:** the
   plan already carries the entry with disposition `eligible`. A
   fresh segment intent would build a *second* plan for the same
   occurrence (it remains unbound and — the exemption standing —
   eligible), creating two independently drivable jobs for one
   segment; the executor's content-key collision machinery would
   arbitrate at flush time, but the duplicate-plan state is an
   avoidable hazard. If generation resumes for this segment, it
   should resume *this* plan.
6. **The standing exemption plays no role in the resume** (F10): it
   is neither consulted nor required by the drive path. Its
   preservation matters only for the alternative future in which
   the preserved plan were retired and a fresh plan needed.

**Verdict on resume:** the preserved plan *can* safely resume if
the drive mechanism is restored — mechanically it is the cleanest
possible resume (one occurrence, all fences passing on live
figures, no disposition prerequisites). Whether it *should* resume,
and under what gate, is a disposition decision for Julie/Rowan; the
drive-mechanism question (§8) should be settled first, because
resuming into an undiagnosed drive path risks repeating the stall
with the system open.

### 6b. Containment — is the preserved plan a live trigger?

**Yes, conditionally — and the containment is exactly the two
holds, with distinct roles that should not be conflated:**

- **As preserved (halt "1" + queue paused): fully contained, and
  verified so.** No grant has issued under the halt (F8); reserved
  is 0; the outbox holds nothing for this plan; the queue holds no
  message for it (no dispatch was ever sent). Nothing can reach the
  provider.
- **Queue unpause alone (halt still "1"): cannot generate.** A
  drive pass (if the chain revives) could *issue* the grant —
  issuance is not halt-fenced for plan-linked jobs (F9) — flipping
  the occurrence to `granted` and reserving 12 slots; but with no
  `sendGrant` wired, the dispatch never leaves the outbox, the
  queue receives nothing, and at lease expiry (+15 min) the lease
  handler safe-voids the undelivered grant (outbox row never
  attempted → occurrences return to `pending`, reservations
  released, one `retry_grant` scheduled). Bounded churn; no
  provider contact; no spend. It would, however, make the plan's
  state move — an unpause-only gate should expect grant/void
  cycling, not stillness.
- **Halt lift alone (queue still paused): stages a live dispatch.**
  A drive pass would issue the grant *and* drain it to the queue;
  the queue would hold the message (delivery paused; retention
  86,400 s). The executor does not run it while paused — but the
  message is real, and any later unpause inside the retention
  window delivers it; the executor's own entry re-checks the halt
  flag at execution time (`worker-entry-prod-d6.js:1433`,
  `assertGenerationEnabled`), so it would generate only if the
  halt is still lifted at delivery. A halt-lift-only gate must
  therefore treat this plan as armed-to-the-queue, not as inert.
- **Both lifted: the plan executes end-to-end with no further
  command, submission, or approval touchpoint in code.** The drive
  path needs nothing else. Any future gate that lifts the halt and
  unpauses — for any reason, including work unrelated to this
  segment — will pick this plan up first (it is the only selectable
  plan). This is the single most important containment fact in this
  report.

## 7. Step-0 procedural variance (recorded per Rowan's review)

The approved Phase B procedure's step-0 required grant-level
verification before unpause (grant names this plan; granted set
exactly {idx 26}; reservation closes at 12). No grant existed at
step-0 — on the shipped machinery a grant can only come into
existence inside a drive pass, which requires the unpause the
step-0 precedes — so the executor substituted deliverable-set
verification (only non-terminal plan; its job queued with exactly
one pending occurrence; reserved 0) and re-applied the grant-level
checks at every poll after unpause. **This is recorded as a
procedural variance.** The observed exclusivity evidence is useful,
but the substitution must be explicitly addressed in the next
proposal — including the structural point this investigation
confirms: as the machinery stands, a pre-unpause grant-level
verification is *unsatisfiable by construction*, because no grant
can exist before the first post-unpause drive pass. The next
proposal should say so and design its step-0 accordingly, rather
than paper over it again.

## 8. Diagnostic proposal — PROPOSAL ONLY, nothing here is executed

Read-only evidence is **insufficient** to settle the mechanism: the
two surviving explanations (alarm not delivered vs. every pass
dying pre-grant) are indistinguishable from outside the DO (F7),
and the decisive datum — whether `alarm()` invocations occur and
what they throw — exists only in the Worker's invocation logs,
which the available API credential cannot read (the telemetry
query route 403s; a standing limitation, not retried here).

**P1 — Dashboard log observation (minimum, zero production
effect).** Julie opens the production Worker's logs in the
Cloudflare dashboard (observability is enabled with
`logs.persist: true`, verified at census and closing) during a
bounded window that includes at least two watchdog periods and one
deliberate coordinator wake (any ordinary command — commands call
`wake()`; note even a *rejected* or replayed command wakes first,
`coordinator.mjs:521`). Read for: Durable Object alarm invocations
(present/absent, cadence), and any exception text from the alarm
path. *Production effects:* none — log viewing only; the wake
command, if one is sent for the test, should be an idempotent
replay carrying no state change. *Mutation budget:* **0**.
*Rollback/containment:* not applicable; the system stays HELD
throughout, and P1 is safe under the halt for the reasons in §6b.
*Approval needed:* Julie's own dashboard access; no gate, no
deploy. *What it settles:* alarm invocations absent → H1
(delivery-side). Invocations present with exceptions → H2, with
the exception text naming the site. Invocations present, clean,
with grants still not issuing → forces a re-examination of §3
against a live pass.

**P2 — Drive-pass heartbeat instrumentation (only if P1 is
unavailable or inconclusive).** A minimal code change: `driveOnce`
durably records each pass (timestamp + outcome summary per plan,
including refusal reasons — i.e., persist the outcomes array it
already computes and the caller already discards), and the
operator diagnostics surface gains a read of the last drive pass
and of `getAlarm()` / the pending-schedule summary. *Exact
production effects:* one Worker deploy (script etag changes; the
deployed parts become the pinned tree plus this diff and nothing
else); thereafter one small meta-row write per alarm pass
(self-limiting, no user data, no book content); **no** commands,
**no** settings or queue changes, system HELD throughout (the
heartbeat writes occur inside passes that the halt already renders
incapable of delivery). *Mutation budget:* 1 deploy (+ the standing
post-deploy observability re-application if the upload resets it,
per established deploy law) + 0 commands. *Rollback:* redeploy of
the current byte-identical parts (etag `f15fb1ae…`, preserved in
the attempt-3 evidence) under the standard rollback preconditions,
system HELD before and after; the heartbeat table is additive and
lazy (the proven schema pattern) and is ignored by the rolled-back
build. Note the rollback floor: the current build `1c2d1d0f`
remains above the floor build `6a73d962`; P2 must be built on the
current tree, never on the floor. *Approval needed:* a named gate
— Rowan source review of the diff plus Julie's explicit GO. It is
**not** covered by the consumed attempt-3 GO nor by Rowan's
read-only investigation authorization, and this report does not
execute any part of it.

A behavioral probe without instrumentation (wake-and-watch through
the existing read surfaces) was considered and is **not** proposed:
F7 establishes that no existing surface can register the outcome,
so such a probe would spend mutations (or gate capital) for no
readable signal.

## 9. Evidence index

- Deployed source: `phaseb-attempt3/evidence/parts-e0/v2/…` (31
  parts; re-verified 31/31 against the census manifest for this
  report).
- Window evidence: `phaseb-attempt3/evidence/` — census verdict
  (`census-verdict-e0.txt`, 13/13), E1/E2 envelopes, step-0 reads,
  23 poll series (`poll-*.json`, incl. `poll-diag-p01…p23.json`:
  plan `updatedAt` and executions `[]` invariant), closing capture.
- Live read-only checks for this report (2026-11-02 ~02:40Z, GETs
  only, prod client + operator connectors, scope/instance headers
  as required): `/health`, `/v2/settings`, `/v2/quota`,
  `/v2/d6-plans/plan:19cad189fab54b9c804a74a6`,
  `/v2/jobs/plan:19cad189fab54b9c804a74a6:seg`, `/v2/conflicts`,
  `/v2/generation/capabilities`,
  `/v2/d6-eligibility?…scope=chapter&chapterIndex=2`,
  `/v2/d6-diagnostics?planId=plan:19cad189fab54b9c804a74a6`,
  `/v2/d6-quota-reconcile` — envelopes preserved in
  `phaseb-stall-diagnostics/live-*.json`. No POST, no command, no
  cf-api mutation of any kind was issued.

## 10. Unresolved hypotheses, ranked

**H1 — Alarm delivery failure for this DO (highest).** The chain's
alarms are not producing drive passes: the armed alarm was lost in
the 1101 fault (due invocation dropped after platform retry
exhaustion while the DO could not instantiate — §5 steps 1–3), and
the post-recovery state satisfies §5 step 5 (a stale armed value
the code trusts, or silently ineffective `setAlarm` registration),
so the 01:23:15Z wake did not restore delivered alarms. *For:*
complete refusal enumeration leaves nothing else standing (§3);
the failure persists post-window in a delivery-independent state
(F8); the same code+data generated whenever the chain demonstrably
ran (F3). *Against:* requires a platform behavior (stale armed
value / lost registration) that cannot be observed from here.
*Settled by:* P1 (alarm invocations absent in logs) or P2.

**H2 — Every alarm pass died between `super.alarm()` and the grant
step (low).** A persistent throw in the subclass alarm's
construction/cache/`recover()` segment. *For:* it is the only
other family consistent with F4–F6. *Against:* every component was
exercised by poll reads in the same minutes inside the same DO;
`recover()` is a no-op scan on this store; the throw would have to
be perfectly correlated with alarm invocations and never with any
of dozens of interleaved reads. *Settled by:* P1 (invocations
present, exception text) or P2.

**H3 — An unenumerated invisible refusal in `driveOnce` (residual
only).** Would require the deployed-source enumeration in §3 to be
wrong; the parts analyzed are hash-verified as the code that ran.
Retained for completeness; no evidence favors it. *Settled by:*
P2 (persisted per-pass outcomes).

**H4 — The stall is unrelated to the 1101 fault (causation
variant of H1).** A platform alarm-delivery defect for this DO
arising independently; the fault is coincidence. Indistinguishable
from H1 on read-only evidence; it changes the causal story, not
the diagnosis (delivery-side), the disposition, or the remedy
path. *Settled by:* P1/P2 plus, if ever available, a Cloudflare
incident acknowledgment — none is required for the recommended
course.

## 11. Recommended disposition

1. **PRESERVE plan `plan:19cad189fab54b9c804a74a6` as-is**
   (active/queued). It is the cleanest resume vehicle (§6a), needs
   no disposition prerequisite, and is fully contained while both
   holds stand (§6b). Do NOT resubmit a second intent for this
   segment, and do NOT retire the plan while the drive mechanism is
   undiagnosed — retirement forecloses the clean resume and buys
   no safety the holds don't already provide.
2. **PRESERVE the idx-26 chapter exemption.** It has no effect on
   the preserved plan either way (F10); revoking it buys nothing
   and destroys the re-plan option if the preserved plan were ever
   retired instead. (Rowan's standing disposition already orders
   exactly this preservation; the source analysis independently
   supports it.)
3. **PRESERVE HELD status** (halt "1", queue paused) until the
   drive mechanism is diagnosed. Flag for every future gate: **any
   halt lift together with a queue unpause — for any purpose —
   will execute this plan without further code touchpoints** (§6b).
4. **Sequence:** P1 (zero-effect log observation) → Rowan's ruling
   on its result → only then, if needed, the P2 gate → only after
   the drive mechanism is understood, a fresh generation gate for
   the preserved plan's resume. No Attempt 4 is proposed by this
   report.

— Wren (executor of the read-only investigation; no production
mutation performed)
