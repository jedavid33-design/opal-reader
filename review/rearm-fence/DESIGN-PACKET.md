# RE-ARM SAFETY FENCE — DESIGN PACKET (Chapter 2 program, Workstream A)

**Status:** DESIGN ONLY. No code is built, deployed, or proposed for
deployment by this packet. No production action has been taken or is
authorized by this packet. It requests a Rowan **design ruling**;
any build follows that ruling under the Chapter 2 program's standing
authorization (Julie, Oct 30, 2026; board record 6531496748), and any
deploy / re-arm remains a separate Julie gate.

**The condition this case answers.** Rowan's D0 grant-lifecycle
re-review (comment 6528590586) ruled Option A not accepted and held,
as an operative condition later carried into the signed Option-B
amendment §5 (DEPLOY-PLAN-AMENDMENT-OPTION-B.md, pinned 66d79385):

> "…generic re-arm remains BLOCKED — no halt flip, no delivery
> enablement — until a separate reviewed control either (a) proves
> a stale Chapter 2 queue message cannot contact the provider for
> the 9 unattempted occurrences, or (b) closes that risk through an
> enforceable, tested server-side fence."

This packet is that separate case, at design stage. It takes route
(b): it does not attempt to prove a negative about the queue
platform (route (a) is, per §6 below, unprovable from readable
surfaces — the same reason Option A failed). It designs a
server-side fence that makes the platform question moot.

**Subject.** Plan `plan:603ab416bd67ab1b25de97be` (Forever Pucked
Ch 2), job `plan:603ab416bd67ab1b25de97be:ch1` (state `generating`,
rev 2), grant `grant:plan:603ab416bd67ab1b25de97be:ch1:1:full`
(state `issued`, rev 2), claim row state `claimed`, consumer
`opalreader-v2-prod-d6` (code-mediated proof, grant-lifecycle
addendum §2.0(d)). Plan state `halted_unknown` /
`phase_halted_unknown_billing`. Of the job's 18 `granted`
occurrence rows: 8 hold terminal `failed` executions with noted
spend intents, 1 holds an `unknown_billing` execution with an open
spend intent (reconcile-hold), and **9 hold no execution record and
no spend intent** — the exposure set.

**Build under analysis.** The live build is the gen-pkg-1
candidate, pin `f3b6e6e9…` on `ui1-review`. All file:line citations
are to its source tree (`worker/…` paths). This matters: the
grant-lifecycle addendum's §2.2(e) analysis was written against
the previous live build (ac451df8). §1 re-runs that analysis
against the current build, which added the D7-2 quarantine
birth-marks and the D8 fail-closed hold reads, and states exactly
what those additions do and do not change.

---

## 1. Redelivery trace in the current build

The hypothetical, stated at Rowan's standard: the original queue
message for the Ch 2 grant — payload shape `{grantId, jobId,
occurrences[18]}`, the shape `_execute` validates
(`worker-entry-prod-d6.js:595–596`) — was delivered and ACKed on
Oct 29 (the executor's unknown-billing stop returns normally, so
`_execute` answered HTTP 200 and the queue handler ACKed,
`worker-entry-prod-d6.js:896–899`). The residual is a
platform-level duplicate of that already-accepted message. Whether
such a duplicate exists has no read surface (§6). The trace answers
the conditional: **if it is delivered, what happens?**

### 1.1 Today (GENERATION_HALT = "1", queue delivery PAUSED)

**It cannot reach the provider. Three independent halt layers,
any one sufficient:**

0. Delivery is paused — no message is delivered at all. (If one
   were somehow presented:)
1. **Queue handler, layer 1** — `queueHandler` calls
   `assertGenerationEnabled(env)` before touching the coordinator
   (`worker-entry-prod-d6.js:880–881`; the assert throws unless
   `GENERATION_HALT === "0"`, `host/adapters.mjs:85–88`). The
   batch fails and the message is retried/dropped by the platform,
   never executed.
2. **Coordinator execute, layer 2** — `_execute` repeats the same
   assert before building the executor
   (`worker-entry-prod-d6.js:589–596`).
3. **Provider seam, layer 3** — every synthesize path in the
   adapters asserts generation-enabled before any provider call
   (`host/adapters.mjs:85–88`, asserted at :290, :299, :344, :376).

Today's safety therefore rests entirely on the halt flag — which
is precisely what a re-arm removes. The trace that matters is
§1.2.

### 1.2 In the re-armed state (GENERATION_HALT = "0", delivery enabled)

**The stale message reaches the provider for the 9 never-attempted
occurrences.** Step by step:

| # | Step | Evidence | Result for the stale message |
|---|------|----------|------------------------------|
| 1 | Queue handler consumes the v2 queue; halt assert passes; message body POSTed to the coordinator's `/internal/execute` | `worker-entry-prod-d6.js:880–902` | passes |
| 2 | Base class route dispatches `/internal/execute` to the production subclass's `_execute` | `worker-entry.js:215–216` → `worker-entry-prod-d6.js:589` | passes |
| 3 | `_execute` validates the payload shape (grantId, jobId, occurrences array — all present in the original payload), builds the D6 executor with consumer `opalreader-v2-prod-d6` (env default; identical string in the Oct 29 build) | `worker-entry-prod-d6.js:595–613` | passes |
| 4 | `handleMessage`: batch refusals (message mode/lane; job lane) — the job's lane is `standard` | `generation/d6-executor.mjs:472–482` | passes |
| 5 | **D7-2/D8-1 quarantine read** (strict on store-backed coordinators): refuses only if a HELD quarantine row exists for the job's plan or the job | `generation/d6-executor.mjs:500–527` | **passes — no hold exists.** Holds are written only for a NEW plan submitted while halted (`generation/service.mjs:744–749`, "a pre-existing plan is never retro-marked") or by the grant guard for plan-less jobs (`generation/grant-guards.mjs:133, 170`); sole writer `recordQuarantineHold`, `generation/quarantine.mjs:173`. The Ch 2 plan was born while generation was ENABLED, so it carries no hold and can never acquire one retroactively. |
| 6 | **Plan-state check: NONE EXISTS.** The executor never reads plan state — zero occurrences of `halted` / plan-state logic in `generation/d6-executor.mjs`. The plan's `halted_unknown` state is invisible on this path. | grep-verified, see TRACE-EVIDENCE | **the gap** |
| 7 | `claimGrant`: the claims row exists (state `claimed`) → returns `already_claimed` with the row. The executor stands down only when the claim's consumer DIFFERS from its own; here it is the same production consumer → falls through to execution | `worker/coordinator.mjs:2696–2705` (existing-claim check precedes all grant-state checks); `generation/d6-executor.mjs:529–533` | passes (Rowan 6528590586, accepted finding 4) |
| 8 | Occurrence loop: each row is read fresh; skip unless row state is `granted` — all 18 rows are `granted` | `generation/d6-executor.mjs:539–546`; D0 job read | enters loop for all 18 |
| 9 | The 9 adjudicated occurrences: existing executions are found; the 8 `failed` are terminal (`TERMINAL_EXECUTION_STATES = {committed, failed}`, `generation/d6-executor.mjs:70`), the 1 `unknown_billing` is a reconcile-hold (recovery returns `{reconcileHold: true}`, never a provider call). Each then reaches `acquireSpendIntent`, which returns the existing non-superseded intent with `acquired: false` → `intent_fence` skip | `generation/d6-executor.mjs:551–565`, `:287–312`; `worker/coordinator.mjs:2789–2810` | skipped, **no provider contact — and the loop does not stop** |
| 10 | **The 9 never-attempted occurrences:** no execution record → `workSource` returns the eligible payload → `runFresh`: `createExecution` creates a record; `acquireSpendIntent` **ACQUIRES** (claim is live, same consumer, no prior intent); execution transitions to `attempted`; `wrappedSynthesize` reserves an attempt and calls the provider | `generation/d6-executor.mjs:279–352`; provider call at **`:335`** (`providers.synthesize`) | **PROVIDER CONTACT** |
| 11 | Per-segment outcomes then follow ordinary rules: audio returned → flush, verify, commit, binding projection (real spend, unauthorized work product); known failure → `failed_known`; an unknown outcome → the phase re-halts — after contact, not instead of it | `generation/d6-executor.mjs:328–466` | spend/commit possible |
| 12 | After the loop, results are reported (`handleReport`); `_execute` returns 200; the queue handler ACKs. The stale message is consumed — after doing the work | `generation/d6-executor.mjs:605–613`; `worker-entry-prod-d6.js:896–899` | terminal, too late |

**Ledger/grant movement caused by the stale message (step 10):**
new execution records, new spend intents, new attempt-log rows,
and — on any success — a commit and a sync-plane binding. This is
not a read-only brush: the message spends.

**Checks affirmatively verified ABSENT from this path** (each is
real, and each lives somewhere else):

- *Phase budget / phase halt* — `d6_phase_state.halted_unknown_billing`
  is read by the grant guard at ISSUANCE (`generation/grant-guards.mjs:49`,
  `d6GrantGuard` at :78) and by the driver; the executor path never
  consults it. `reserveAttempt` records an upper bound and checks
  nothing (`generation/genstore.mjs:127–145`).
- *Driver exclusion* — `driveOnce` never selects `halted_unknown`
  plans (`generation/service.mjs:824`), but that governs NEW grant
  issuance. This grant already exists; its message does not pass
  through the driver.
- *Admission fence (R3-2)* — `PLAN_FENCE_TERMINAL`
  (`generation/service.mjs:607`) gates NEW intent submission
  (`submitIntent` overlap check). It does not gate dispatch of an
  existing grant's message.
- *Drain* — `drainOutbox` selects only `sent_at IS NULL` rows
  (`worker/coordinator.mjs:1748–1750`); the Ch 2 row's `sent_at` is
  set, so no server-side path re-sends. Irrelevant to a platform
  redelivery, which does not pass through the drain.
- *Retirement* — `retireHaltedPlan` transitions ONLY plan state
  plus an audit row (`generation/service.mjs:458–492`). It does not
  touch the grant, the claim, or the job — and since the executor
  never reads plan state, even a completed retirement leaves this
  trace unchanged step-for-step. (This is why option (b) fails as
  a standalone fence; see §2.)
- *Old executor* — `worker/executor.mjs` also has a `handleMessage`,
  but it is not wired to the v2 queue in the production D6 script:
  that script's queue export is its own handler
  (`worker-entry-prod-d6.js:904–905`) routing to the D6 executor.
  There is exactly one consumer path for a v2 grant message.

**Conclusion of the trace:** gen-pkg-1's D7-2/D8 hardening does
NOT change the addendum's §2.2(e) conclusion. In the re-armed
state, a redelivered stale Ch 2 message contacts the provider for
the 9 never-attempted occurrences. The single missing check is a
plan-state read on the dispatch path.

---

## 2. Fence design options

### Option A — Plan-state dispatch fence in the D6 executor (RECOMMENDED)

**Shape.** In `handleMessage`, inside the existing pre-claim
defense block (after the quarantine read, before `claimGrant` at
`generation/d6-executor.mjs:529`): resolve the job's plan
AUTHORITATIVELY from server-side records — the `d6_plan_jobs`
link first, then the job's `data_json` — never from message-carried
fields. If a plan is resolved, read its state strictly (on a
store-backed coordinator, a read failure refuses, mirroring D8-1:
`{ refused: "plan_state_check_failed" }`). Refuse, with a normal
return, iff the plan's state is one the driver itself can never
drive:

```
REFUSED = { complete, partial, retired, halted_unknown }
        = the complement of driveOnce's selection
          (service.mjs:824: state NOT IN (...those four...))
```

Refusal shape: `{ refused: "plan_not_dispatchable", planId,
planState }` — a normal return, so `_execute` answers 200 and the
queue handler ACKs: the stale message is terminally consumed, not
retried. If a message carries a `planId`/`d6PlanId` that disagrees
with the server-resolved link, refuse
(`plan_link_mismatch`) — fail-closed against mislabelled payloads.
Plan-less jobs resolve no plan and pass unchanged.

**What it proves.** For ANY message — stale, replayed, or
hand-delivered — whose job belongs to a plan in a refused state:
zero provider calls, zero execution/intent/attempt creation, zero
claim or ledger movement, by a deterministic state read at the
last checkpoint before the spend machinery. The guarantee does not
depend on whether a stale message exists; it holds if one is
delivered the second delivery resumes. It also converts the
already-planned Ch 2 retirement into a dispatch fact: after
retire, the plan is refused under `retired` even before any fresh
intent exists.

**What it cannot prove / does not do.** It governs the D6
executor dispatch path only. A message for a plan legitimately
`active` at delivery time dispatches — by design (that is what
active means; its already-adjudicated occurrences remain protected
by the per-occurrence spend-intent fence, step 9). It does not
reconcile the unknown billing, clear the phase halt, or touch
admission.

**Blast radius.** Legitimate dispatch is congruent with the
driver by construction: the refused set is exactly the set of
states for which the driver can never have issued a grant in the
plan's current state, so no message the system would honor today
changes behavior — EXCEPT one deliberate case: a duplicate
delivery of the very message that completed a plan, arriving
after completion, is now refused at the fence instead of being
absorbed by the intent fences downstream. Same zero-spend result,
cleaner terminal outcome. Parked plans (`parked_quota` and family)
are NOT refused — `driveOnce` selects them, so their messages
dispatch exactly as today; the fence invents no second policy.
The parked Ch 3 JOB is untouched: it is a coordinator-level job
with no D6 plan and no `d6_plan_jobs` link (its occurrences never
enter an eligible set), so the fence resolves no plan and passes;
independently, no grant — hence no message — exists for it, and a
hypothetical message would die at claim discipline
(`unknown_grant`). Its resume machinery never traverses this code.

**Test strategy.** §4, T1–T9.

### Option B — Retire-before-rearm sequencing + grant invalidation on retire

**Shape.** Operational sequencing (reconcile the unknown attempt,
then `retireHaltedPlan`, before any re-arm) plus extending
retirement to void the plan's outstanding grants and terminate
their claims.

**Analysis — insufficient in every reduced form, corrosive in its
sufficient form.**
- Sequencing + retirement as they exist today fence NOTHING:
  retirement changes only plan state, and §1 step 6 shows the
  dispatch path never reads plan state. The stale message's trace
  is identical before and after retirement.
- Adding grant voiding still fences nothing: `claimGrant` checks
  the claims row BEFORE any grant-state check
  (`worker/coordinator.mjs:2701–2705`), so a voided grant with a
  live claim still returns `already_claimed` and falls through;
  `acquireSpendIntent` likewise reads the claim, not the grant.
- The sufficient form — terminating the claim row — works
  mechanically (a `completed`/`closed` claim makes the executor
  drop the message) but falsifies the delivery-evidence record.
  Claim rows are the probe's ONLY source of truth
  (`probeVerdict`, `worker/coordinator.mjs:2730–2736`), and the
  build's own contract refuses to close a claimed grant: "a
  claimed grant REFUSES closure (never closed out from under its
  consumer)" (`closeAcceptance`, :2745–2749). The Ch 2 claim WAS
  accepted and claimed; rewriting it to manufacture a fence
  corrupts the audit primitive the entire D0/D6 evidence chain
  rests on.

**Verdict.** Rejected as the fence. Retirement remains in the
Chapter 2 program for its own purpose (clearing the R3-2
admission fence so a fresh intent can later be admitted) — and
under Option A it additionally acquires dispatch meaning. The two
compose; neither substitutes for the other.

### Option C — Claim-epoch (generation) fencing

**Shape.** A dispatch epoch counter held server-side; claim rows
record the epoch at claim time; the re-arm operation increments
the epoch; the executor refuses any message whose claim predates
the current epoch.

**What it proves.** Broader than A: EVERY pre-re-arm message, for
any plan or job, is refused after a re-arm — a time-based, not
state-based, guarantee.

**What it cannot prove / costs.** It also refuses legitimate
in-flight messages of ACTIVE plans at the moment of re-arm. Those
plans self-heal only if the driver re-grants (it does, on alarm,
for D6 plans); plan-less legacy jobs would depend on the base
watchdog's re-grant paths — a composition that is untested and
would strand a job's `granted` rows behind a live claim if any
path fails to re-derive. It requires a claims schema change (or a
side table), an atomicity requirement between the epoch bump and
the halt flip in the re-arm sequence, and it permanently changes
claim semantics for every future re-arm and every book — a global
blast radius to answer a question about one plan. It also still
requires the same "where does the check live" answer as A (the
executor), so it buys breadth, not depth.

**Verdict.** Not recommended. Held in reserve if Rowan prefers a
time-based guarantee over a state-based one.

### Adjunct (not a fence) — queue purge before unpause

A Cloudflare queue purge at re-arm time would delete any
still-queued messages (queue config: `max_retries = 3`, 24-hour
retention on Free, no DLQ — `generation/wrangler-queues.md`). But
the stale message was already delivered and ACKed; a hypothetical
duplicate lives in the platform's delivery machinery, where
neither a purge result nor any API read can prove a negative —
the same unprovable surface as Option A. A purge may be included
in a future re-arm sequence as zero-cost hygiene; it must never
be represented as the reviewed control.

---

## 3. Recommendation

Adopt **Option A**: a plan-state dispatch fence in the D6
executor's `handleMessage`, placed in the existing pre-claim
defense block, resolving the plan authoritatively from
server-side records, refusing exactly the four states the driver
can never drive (`complete`, `partial`, `retired`,
`halted_unknown`) with a normal-return refusal (message ACKed and
terminally consumed), under D8-1 strict-read discipline on
store-backed coordinators.

Reasons, in order of weight:

1. **It answers the condition at the exact point of risk.** The
   exposure is one missing read (§1 step 6). The fence is that
   read, at the last checkpoint before any spend machinery —
   claim, execution, intent, attempt, provider — can move.
2. **It converts an unprovable platform negative into a provable
   server positive.** The safety claim stops being "no stale
   message exists" (unreadable) and becomes "any stale message is
   refused by durable state" (testable, §4).
3. **Congruence with the driver** (`service.mjs:824`) means the
   fence cannot diverge from issuance policy: dispatchable ⟺ the
   driver could have issued the grant in the plan's current
   state. No legitimate work changes behavior; parked plans and
   plan-less jobs are untouched; Ch 3 is untouched.
4. **Smallest blast radius of the sufficient options** — one read
   and one refusal in one function, reusing the D7-2/D8 block's
   placement, resolution helpers, and strictness discipline. No
   schema change, no claim/grant mutation, no evidence-record
   edits.
5. **It composes forward**: it makes retirement
   dispatch-meaningful, it protects every future halted/retired
   plan's stale messages (not just Ch 2's), and it remains live
   permanently — including during any future halt, as a fourth
   layer beneath the three halt layers of §1.1.

---

## 4. Adversarial test list (exact)

All tests on a store-backed coordinator harness whose `.one()`
semantics mirror production (throws on empty) for every
empty-result path the fence touches. Provider is a counting
double; "zero movement" assertions compare full row sets of
`grants`, `claims`, `d6_execution_records`, `spend_intents`,
`d6_attempt_log`, `d6_plans`, `jobs` before/after.

- **T1 — the headline replay.** Fixture = the production Ch 2
  shape: plan `halted_unknown`; job `generating` rev 2; grant
  `issued` rev 2; claim `claimed` by `opalreader-v2-prod-d6`;
  18 `granted` rows; 8 `failed` executions with noted intents;
  1 `unknown_billing` execution with open intent; 9 bare. Replay
  the exact message `{grantId, jobId, occurrences: [all 18]}`.
  Expect `{refused: "plan_not_dispatchable", planState:
  "halted_unknown"}` returned NORMALLY (no throw); provider calls
  **0**; zero new rows in every table above; claim row unchanged.
- **T2 — retired.** T1 fixture with plan `retired` → refused,
  `planState: "retired"`, zero calls, zero movement.
- **T3 — complete.** T1 fixture with plan `complete` → refused,
  zero calls, zero movement.
- **T4 — legitimate active dispatch (smoke shape).** Plan
  `active`, one eligible occurrence, live grant + claim, no
  execution/intent → message dispatches: claim proceeds, intent
  acquired, synthesize called exactly once, commit lands. (The
  fence does not break the one proven production path.)
- **T5 — parked plan congruence.** Plan in a `parked_*` state
  with a live grant message → dispatches exactly as the
  pre-fence build (driver selects parked plans; fence invents no
  policy).
- **T6 — plan-less job.** Legacy plan-less job, granted rows,
  live claim, no `d6_plan_jobs` link → behavior identical to the
  pre-fence build (this fence takes no position; the job's own
  machinery governs).
- **T7 — Ch 3 shape.** Coordinator job in `parked_policy`, no
  plan link, no grant → a hypothetical message dies at claim
  discipline (`unknown_grant`); the fence neither engages nor is
  needed; zero provider calls. Documents Ch 3 as out-of-scope
  and unaffected.
- **T8 — fault injection (D8-1 discipline).** Plan read throws
  on a store-backed coordinator → `{refused:
  "plan_state_check_failed"}`, zero provider calls, zero
  movement. A database fault never reads as dispatchable.
- **T9 — mislabelled payload.** T1 fixture, but the message
  carries a `planId` naming a DIFFERENT, active plan → refused
  (`plan_link_mismatch` or the server-resolved halted state —
  either refusal is a pass; dispatch is a fail). The fence never
  trusts message-carried plan identity over the server link.

Plus the standing regression requirement: the full worker battery
re-run on the fenced tree with the baseline failing set unchanged
(the gen-pkg-1 discipline), and the D6 correction suites unmodified
except candidate-suite additions for T1–T9.

---

## 5. Interactions

- **D8 hold reads (quarantine).** Same pre-claim block, same
  strict/fail-closed discipline, complementary subjects: holds
  fence plans/jobs BORN under a halt (operator release is their
  exit); the plan-state fence covers plans born under enablement
  whose exit is a state transition. Neither subsumes the other —
  the Ch 2 plan is exactly the case the hold system cannot see
  and the state fence can. Order inside the block: hold read
  first (preserves D8's tested behavior), state read second; a
  refusal from either is terminal for the message.
- **R3-2 admission fence.** The two fences bookend a plan's life:
  `PLAN_FENCE_TERMINAL` + `halted_unknown` refuse NEW paid work
  over a fenced plan's occurrences at admission; the dispatch
  fence refuses OLD messages at execution. They share three of
  four refused states (`complete`, `partial`, `retired`); the
  dispatch fence adds `halted_unknown`, which at admission is a
  fencing (non-terminal) state and at dispatch must be a refused
  state — the asymmetry is the point, and the packet names it
  explicitly so it is a reviewed decision, not an accident.
- **retireHaltedPlan.** Unchanged: still requires reconciliation
  of the unknown attempt first (`unknown_billing_open` refusal),
  still Julie-authorized per use, still the only exit from
  `halted_unknown`. Under the fence, retirement additionally
  dispatch-fences the plan's grants — defense in depth for the
  window between retirement and any fresh intent. Note the fence
  does NOT depend on retirement happening: `halted_unknown` is
  itself refused, so the fence is live for Ch 2 from the moment
  the fenced build deploys.
- **Re-arm sequence (future, separately authorized).** The fence
  must be LIVE before any halt flip: (i) fence build under this
  design ruling + Rowan source sign-off; (ii) halted deploy of
  the fenced build by the Gate-1 pause-first pattern (queue stays
  paused, halt stays "1"); (iii) re-arm preflight verifies the
  DEPLOYED build identity (build marker) — the fence's presence
  is carried by pinned-tree adversarial proof (T1–T9) plus build
  identity, NOT by a live replay of the real message, which would
  itself be a production action and is expressly not required:
  the fence is deterministic state logic, and T1 replays the
  exact production shape in the harness; (iv) only then the
  remaining re-arm steps (any reconcile/retire under their own
  authorizations, settings, halt flip, delivery enablement LAST).
  With the fence live, retire-before-unpause stops being
  load-bearing for safety — sequencing of the Ch 2 clearance
  versus the re-arm becomes Rowan's/Julie's choice rather than a
  safety dependency.
- **Workstream B (adapter fix package).** Independent and
  complementary. B governs FUTURE legitimate Ch 2 work (a fresh
  intent, admitted after reconcile + retire, driven by
  `driveOnce` under a new `active` plan — the fence passes it by
  design, T4/T5). The fence governs the PAST (the stale message).
  Neither substitutes for the other; Ch 2 generation requires
  both, plus the re-arm gate.

---

## 6. Honest scope statement

What remains unprovable, unchanged by this design:

- Whether a duplicate of the Oct 29 queue message exists inside
  the platform's delivery machinery. The queue's ACK state and
  message depth have **no read surface** (the §B.6 limitation,
  carried through amendment §5). The original message's ACK is
  itself derived (HTTP 200 return path, §1) plus the empirical
  armed-window record — the Option-A evidence, which Rowan has
  already ruled insufficient as a safety basis. This packet does
  not re-argue it.
- The claim row's exact contents rest on the addendum's
  code-mediated derivation (§2.0(d)) — claims have no read
  surface. The trace's exposure branch requires the
  same-consumer case; that case is the production reality (the
  Oct 29 attempts could only have acquired intents against a
  `claimed` row held by the production executor's consumer ID,
  and that ID string is identical across the Oct 29 build and
  the current build). If the consumer somehow differed, the
  executor stands down at claim and `acquireSpendIntent`
  independently refuses — the fence design is indifferent to
  which branch holds, because it refuses before either.

Why the fence makes the unprovable moot: Rowan's condition is
satisfied by route (b) — an enforceable, tested server-side
fence — precisely because the guarantee no longer quantifies
over platform behavior. Grant the worst case in full: a
duplicate exists, survives every purge, and is delivered in the
first second of the re-armed state. The server's response is
then determined entirely by durable plan state at the last
checkpoint before the spend machinery: refused, ACKed, gone,
with zero provider contact and zero ledger movement — for this
grant, and for any future plan that ever reaches a refused
state. The unprovable fact stops being load-bearing.

**Ask of Rowan:** a design ruling on Option A as specified
(placement, authoritative resolution, refused set, refusal
shape, strictness), or the corrections she requires. No build
starts before the ruling; no deploy, re-arm, reconcile, retire,
or generation is requested or implied by this packet.

— Wren (Workstream A, Chapter 2 program)
