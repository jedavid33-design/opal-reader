# gen-pkg-1 DEPLOY PLAN — ADDENDUM CORRECTION: D0 GRANT LIFECYCLE

**Status: review-only evidence and proposal — authorizes
nothing.** This document responds to Rowan's Gate 1 D0 STOP
disposition (issue #15, comment 6528308537, ruling **(ii)**). It
corrects `DEPLOY-PLAN-ADDENDUM-D0D4.md` §§A/B.4/B.5/D.3 on the
grant-lifecycle point only, defines the per-grant
non-dispatchability proof Rowan required, and states plainly
which elements that proof can and cannot furnish on the current
live build. **Gate 1 remains stopped.** Julie's conditional
continuation (6528244638) applied only to ruling (i) and is not
triggered. Nothing in this document resumes the gate, reorders
any step, or weakens any STOP; any revised Gate 1 execution is a
later Julie production decision after Rowan's re-review of this
correction.

Method note: every live value below was read through the client
connector (`v2prod-api` GETs) — executor D0 samples
2026-10-30T16:18:01Z and 16:29:02Z (gate record:
`logs/gate1/d0/`), plus Wren's verification reads
2026-10-30T16:56:33Z. Every code claim cites the live build's
source tree (`~/workspace/d6-build/impl/worker/`), proven
identical to deployed build `ac451df8b772ddc3f64d4c6418678ce78b243d58`,
as file:line.

---

## 1. Correction of §A; two terminalities, kept separate

### 1.1 The factual error

§A's inventory row for the G10 smoke job states: "terminal; its
grant terminal (`reported`)". **That is factually wrong**, as
Rowan ruled. In the live build, the only transition to
`reported` is inside `handleReport`
(`coordinator.mjs:2067`), and the D6 executor by design does
not settle committed successes through `handleReport`: successes
are committed through the genstore execution-record path
(`generation/d6-executor.mjs` header, lines 24–35), and when an
unknown-billing outcome occurs the executor stops the message
and calls `handleReport` **not at all**
(`d6-executor.mjs:547–551`). Neither inventoried D6 grant has
ever been `reported`, and neither will become `reported` by any
automatic path in the live build.

**Corrected §A rows** (all other §A rows unchanged):

| Item | ID | Expected state at D0 |
|---|---|---|
| G10 smoke job | `plan:3183ecbf2ac4bf50bbc6166e:seg` | job state `generating`; its one grant `grant:plan:3183ecbf2ac4bf50bbc6166e:seg:1:full` in state **`issued`** (see §2.1 — provably non-dispatchable); its one occurrence `ready`, execution `committed` |
| FP Chapter 2 job | `plan:603ab416bd67ab1b25de97be:ch1` | job state `generating`; its one grant `grant:plan:603ab416bd67ab1b25de97be:ch1:1:full` in state **`issued`** (see §2.2 — provably non-dispatchable subject to the one delivery-fact leg named there); its 18 occurrence rows `granted` |

The recorded facts are preserved exactly as observed — the two
grant IDs, their `issued` states, both jobs' `generating`
states, Chapter 2's 18 `granted` occurrences. Nothing is
relabeled `reported` or "terminal" by assumption.

### 1.2 Definitions (replacing §B.4's single grant test)

- **D6 execution terminality** — a property of genstore
  execution records and plan entries: `committed` / `failed`
  are terminal; `unknown_billing` is terminal-for-driving (the
  plan is `halted_unknown`, the phase flag
  `d6_phase_state.halted_unknown_billing` is set, and no live
  path clears it). This is the plane on which the smoke plan is
  `complete` and the Chapter 2 plan is halted.
- **Coordinator grant/claim/delivery terminality** — a property
  of the legacy coordinator tables: grant states `reported` /
  `voided` / `superseded` / `closed`, a terminal claim row, a
  delivered-or-dead outbox row, a consumed-or-dead lease
  schedule row. A D6 grant is **not** required to reach a
  terminal grant state for its work to be finished; §B.4's
  demand that every grant be in one of those four states is
  therefore **withdrawn** and replaced by §2's per-grant
  non-dispatchability proof.
- **Non-dispatchable** (the D0 criterion that replaces "all
  grants terminal"): for a named grant, every server-side path
  that could cause a provider call under it — outbox drain,
  plan driver grant step, watchdog/schedule machinery, and
  executor handling of a delivered message — is shown closed,
  element by element, in §2.

§D.3 is corrected consistently: at D4 the grants arrays must be
**unchanged from D0** (same IDs, same `issued` states, same
revisions) — not "all terminal".

---

## 2. Per-grant non-dispatchability proof

### 2.0 Elements common to both grants

**(a) Issue shape.** `_issueGrant` creates the grant row
(state `issued`), the outbox dispatch row, and a lease schedule
row in one transaction (`coordinator.mjs:1669–1684`); the grant
ID is deterministic — `grant:<jobId>:<job revision>:full`
(:1666) — and targets are the job's `pending` occurrences only.
Grant `lease_expires_at` is creation + 15 min (LEASE_MS,
:129), re-anchored once to handoff-ACK + 15 min if the dispatch
is ACKed (:1844–1846).

**(b) The lease rows are dead — read from a live surface.**
`GET /v2/conflicts` (2026-10-30T16:56:33Z) returns the live
`binding_conflicts` table — exactly 2 rows exist, both
`reason: schedule_dead`, `cache_key: lease`:
- ref `grant:plan:3183ecbf2ac4bf50bbc6166e:seg:1:full`, died
  2026-10-29T23:54:14.808Z after 8 attempts, recorded error
  `LIKE or GLOB pattern too complex: SQLITE_ERROR`;
- ref `grant:plan:603ab416bd67ab1b25de97be:ch1:1:full`, died
  2026-10-30T00:24:14.632Z after 8 attempts, same error.

Schedule rows are processed only in state `pending`
(:2380–2385); at `SCHEDULE_MAX_ATTEMPTS` (8, :143) a row goes
`dead` and the failure is recorded exactly as observed
(:2387–2399). **A dead lease row never fires again**: no lease
expiry, no outcome-unknown transition, no void, and no
handoff-uncertainty transition can occur for either grant from
the lease machinery, on any future watchdog cycle or re-arm.

*Why the rows died — branch elimination against the observed
end-state.* In the lease case (:2431–2510), every undelivered
sub-branch terminates without throwing and with a visible state
change that did **not** occur (no outbox row → grant `voided`;
attempted-unsent → grant `handoff_uncertain`; never-invoked →
`_voidDispatch`, whose claim fence, :1896–1904, refuses a
claimed grant *before* its only LIKE query, so the row completes
`done`). The delivered branch (outbox row present, `sent_at`
set) is the only branch that can throw as recorded: it computes
the granted occurrences (:2491) and then runs the path's only
LIKE query — `ledger_ops … op_key LIKE 'op:<grantId>:%'`
(:2494) — **before** any occurrence transition (:2499–2506).
A throw there leaves grant, job, and occurrences byte-identical
to what D0 observed, and repeated across 8 alarm attempts it
produces exactly the two `schedule_dead` records. (Disclosure:
the identical query shape exists verbatim in the candidate's
`coordinator.mjs:2494`, inherited — noted for the record; it is
not part of this gate's proof and no candidate change is
proposed here.)

**(c) Outbox disposition — derived, and the derivation is the
proof.** The live build exposes no outbox read surface (§3).
But (b) establishes by elimination that each grant's outbox row
exists with `sent_at` **set** (acknowledged delivery) and
`send_attempted_at` set (stamped before the send is invoked,
:1808; `sent_at` is written only after the send resolves,
:1829). `drainOutbox` selects only rows with `sent_at IS NULL`
(:1750): **neither row can ever be selected again, so the drain
can never re-send either message** — not on a watchdog tick
(watchdog case = drain only, and on the base-alarm path no
sender is even wired: `worker-entry.js` hostEnv reads the
`OPALREADER_GENERATION` binding, which the production D6
script does not bind — its queue binding is
`OPALREADER_GENERATION_V2`, `gen-constants.mjs:49`), and not
under a generic re-arm. Independently: even a hypothetical
unsent row for these grants could not be sent by any future
drain, because the drain's lease fence (`now ≤
lease_expires_at`, :1797) precedes any send, both grants'
delivery windows closed on Oct 29, and every re-anchor path
requires a fresh ACK or a resolution out of `handoff_uncertain`
— a state neither grant is in.

**(d) Claim/acceptance.** The claims table likewise has no live
read surface (`jobView` projects grants as
grant_id/state/revision only, :2640–2657). Claim state is
nevertheless established by code-mediated proof: the executor
acquires a spend intent per occurrence only against a claims
row in state `claimed` held by its own consumer
(`acquireSpendIntent`, :2789–2805), and on Oct 29 nine Chapter 2
occurrences and the smoke occurrence acquired intents and
produced recorded attempts — so both grants hold claims rows,
state `claimed`, consumer `opalreader-v2-prod-d6` (the
production `_execute` consumer ID). Consequences that matter
here: a claimed grant cannot be voided by any drain/lease path
(claim fence, :1896–1904), so its accounting can never be
silently released and re-granted; and a replayed claim returns
`already_claimed` (see §2.2(e)).

**(e) No new grant can be issued for either job.** Three
independent fences, all state-based (none depends on
GENERATION_HALT, so a generic re-arm changes none of them):
the driver's grant step requires `pending` occurrences **and**
no live (`issued`) grant (`service.mjs:305–325`) — both jobs
fail both tests; `_issueGrant` itself refuses with
`nothing_pending` / `grant_exists` (deterministic ID, revision
unchanged at 2); and for Chapter 2 the durable phase halt
(`d6_phase_state.halted_unknown_billing`, set by
`markUnknownBilling`, `genstore.mjs:266–283`; read by
`d6PhaseHalt`, `grant-guards.mjs:36–42`) makes every driver
pass re-halt the plan before any grant step
(`service.mjs:284–289`). No production route, command, or alarm
path in the live build invokes D6 execution reconciliation, so
the phase flag persists until a separately authorized
reconciliation — which this document does not propose or imply.

**(f) Quota/ledger corroboration.** `GET /v2/quota`
(2026-10-30T16:56:33Z): attemptsToday 0, spentMicroCents
371485, ledgerSeq 19, settingsRevision 1, parked null —
identical to the Oct 29 record and to both D0 samples. Ledger
figures are grant-time estimates by construction (§B.3's
standing caveat) and are offered as corroboration of
immobility, never as provider spend.

### 2.1 Smoke grant — `grant:plan:3183ecbf2ac4bf50bbc6166e:seg:1:full`

- Grant/job (job view, 2026-10-30T16:56:33Z): grant `issued`,
  revision 2; job `generating`, revision 2 — grant revision
  equals job revision, and both are static.
- Outbox: row exists, `sent_at` set (§2.0(b–c) derivation);
  drain-excluded permanently.
- Lease: schedule row **dead** 2026-10-29T23:54:14.808Z
  (`/v2/conflicts` id 1).
- Claim: `claimed` by `opalreader-v2-prod-d6` (§2.0(d)).
- Execution outcome: the plan's single eligible entry is
  execution `committed`, occurrence `ready` (plan view, same
  timestamp); plan state `complete` — the driver never selects
  a `complete` plan (`service.mjs:278`).
- Executor replay: even if the message were somehow
  re-delivered, the per-occurrence loop skips any occurrence
  whose coordinator state is not `granted`
  (`d6-executor.mjs:494`); the sole occurrence is `ready`.
  **Verdict: provably non-dispatchable on the live build, every
  element.**

### 2.2 Chapter 2 grant — `grant:plan:603ab416bd67ab1b25de97be:ch1:1:full`

- Grant/job (job view, 2026-10-30T16:56:33Z): grant `issued`,
  revision 2; job `generating`, revision 2; 18 occurrence rows
  `granted` — preserved as recorded, not relabeled.
- Outbox: row exists, `sent_at` set (§2.0(b–c)); drain-excluded
  permanently.
- Lease: schedule row **dead** 2026-10-30T00:24:14.632Z
  (`/v2/conflicts` id 2).
- Claim: `claimed` by `opalreader-v2-prod-d6` (§2.0(d)).
- Per-occurrence D6 execution outcomes (plan view, same
  timestamp): 8 `failed`, 1 `unknown_billing`, 9 never attempted
  (no execution record); plan `halted_unknown` /
  `phase_halted_unknown_billing`.
- Spend-intent / unknown-billing state: each of the 8 failed
  occurrences holds a spend intent with outcome noted
  `failed_known`; a live (non-superseded) intent is final —
  re-acquisition returns the existing intent and the executor
  skips without provider contact (`acquireSpendIntent`,
  :2789–2805; executor intent fence, `d6-executor.mjs:287–312`).
  The `unknown_billing` occurrence's execution record is a
  permanent reconcile-hold: recovery classification returns
  `{reconcileHold: true}` and never contacts the provider
  (`d6-executor.mjs:262–263`). The phase flag (§2.0(e)) keeps
  the whole phase out of the driver's grant path. The unknown
  attempt's billing remains **unresolved** — nothing here
  reconciles, retires, or estimates it away.
- **(e) The stale-message leg — stated at its true strength.**
  The 9 never-attempted occurrences hold no execution record
  and no spend intent. If the original queue message were
  re-delivered while generation is enabled, the executor's loop
  would pass the nine fenced occurrences (the 8 intent-fenced
  skips and the 1 reconcile-hold do not stop the loop) and
  **would contact the provider for the 9**. Executor code alone
  therefore does *not* close this leg. It is closed by the
  delivery facts: the outbox row's `sent_at` is set, so the
  drain can never produce a second copy (§2.0(c)); the queue
  handler ACKs a message on an HTTP 200 from `_execute`
  (`worker-entry-prod-d6.js`, queue handler), and the
  executor's unknown-billing stop returns normally (HTTP 200);
  and across the ~18 hours from the Oct 29 run to the
  2026-10-30T16:56:33Z reads — generation enabled and queue
  delivery enabled throughout — the 9 remained unattempted and
  the ledger did not move, although any redelivery in that
  window would necessarily have attempted them. The queue's
  own ACK state has **no live read surface** (§B.6's disclosed
  limitation stands): this leg is proven by the derived outbox
  fact plus code plus the armed-window empirical record, **not**
  by a direct queue/outbox read. Rowan's judgment on whether
  that meets the D0 standard is exactly what §3's alternative
  is for.
- **(f) Generic re-arm.** A re-arm (halt flip + queue delivery
  enablement) changes admission and sender wiring only. It
  cannot: resurrect a `dead` schedule row (alarm selects
  `pending` only); un-send an outbox row; issue a new grant
  (§2.0(e)); supersede a spend intent (the only supersede path
  in the build is the Batch never-accepted resolution,
  :2907–2916 — no Batch maps exist for these Standard jobs);
  clear the phase halt (no live reconcile path); or revive the
  `unknown_billing` execution (reconcile-hold). The single
  conditional exposure under re-arm remains (e)'s
  redelivery hypothetical, excluded by the same delivery facts.

**Verdict, Chapter 2 grant:** non-dispatchable through every
server-side mechanism the live build contains, with the single
stale-message leg resting on derived + empirical delivery
evidence rather than a readable surface — disclosed, not
papered over.

---

## 3. Surfaces, and the gated procedural alternative

### 3.1 What the live build can and cannot furnish

| Proof element | Live surface | Furnished? |
|---|---|---|
| Grant ID / state / revision; job state; occurrence states | `GET /v2/jobs/<jobId>` | Yes — direct read |
| Plan state; per-occurrence execution outcomes | `GET /v2/d6-plans/<planId>` | Yes — direct read |
| Lease schedule-row disposition (dead + error) | `GET /v2/conflicts` (binding_conflicts) | Yes — direct read |
| Quota / ledger immobility | `GET /v2/quota`, two-sample rule | Yes — direct read |
| Queue consumer attachment / delivery state | cf-api queue + consumers GETs | Yes — direct read (no depth field; §B.6) |
| Outbox existence / `sent_at` / `send_attempted_at` | **none** (§B.5 disclosure stands) | **Derived** — §2.0(b–c) elimination from the conflicts record + code |
| Claims row state | **none** | **Derived** — §2.0(d) from `acquireSpendIntent`'s precondition + recorded attempts |
| Grant `lease_expires_at` value | **none** (jobView omits it) | **Superseded** — the lease *row* is proven dead; the value is operationally inert |
| Schedule table (retry/watchdog rows) | **none** | Bounded by code (§2.0(e), §2.2(f)): every reachable handler is inert for these grants |
| Queue message ACK state | **none** | **Empirical** — §2.2(e) armed-window record |

### 3.2 The two ways Rowan can take this

**Option A — accept the corrected proof standard (no live
sequence change).** D0 is re-run read-only under this
addendum: §§A–C as corrected, the two-sample rule, and the
§2 proof re-verified at re-run time (fresh job/plan/quota/
conflicts reads; the conflicts table must still show exactly
the two `schedule_dead` lease rows and no new rows; any change
= STOP). D1–D4 then proceed exactly as signed. No production
action is added, removed, or reordered by this option.

**Option B — pause-first containment + candidate diagnostics
(CHANGED live sequence — requires Rowan's plan review AND
Julie's separate authorization before any production action).**
If Rowan judges §2.2(e)'s delivery-fact leg insufficient, the
explicit alternative is: (1) a separately authorized
**containment step** that pauses delivery on queue
`opalreader-generation-v2` *before* D0 is re-run, removing the
redelivery hypothetical from the environment entirely (the
pause is then simply D2's first act, performed earlier under
its own authorization — the upload still happens only after
D0/D1 pass, delivery still paused); (2) D0 re-run under the
pause; (3) the halted upload per D2–D3; (4) at D4, the
candidate's operator-only diagnostics
(`GET /v2/d6-diagnostics?planId=` / `?jobId=`) confirm the
execution plane (attempt counts/outcomes, zero
`reserved`/`dispatching` attempts) before anything further is
proposed. Stated honestly: candidate diagnostics reads
execution records and the attempt log — it does **not** read
the outbox or claims tables either; Option B's added strength
is containment plus execution-plane confirmation, not a new
outbox surface. This option is **not** adopted by this
document, does **not** silently move D2 before D0, and takes
effect only if Rowan's plan review accepts the changed
sequence and Julie authorizes it separately. Re-arm after
either option remains its own later gate, untouched by both.

---

## 4. Unchanged confirmations

- D1 stands as signed, including the adversarial
  spoofed-planId test (a message-carried planId must not
  conceal a held plan when job linkage says otherwise) and the
  gate-time envelope replay against pin `f3b6e6e9…` / envelope
  SHA-256 `9cb9d0da…`.
- Fresh §C quiescence re-check immediately before any upload;
  the byte-verified rollback archive of live `ac451df8`
  (26/26 part hashes, verified at D0) stands.
- D2 pause-before-upload; D3 observability check and re-apply
  if reset; D4 read-backs (with §D.3 as corrected in §1.2); the
  Julie-attended playback/sync smoke while halted.
- The Chapter 2 `halted_unknown` / unknown-billing fence and
  the Chapter 3 parked job (`1832c21f…`, fingerprint
  `b991f18a…`) are untouched. No reconciliation, retirement,
  replay, quarantine release, re-arm, phase-binding write,
  client publication, Batch arming, generation, or spending is
  proposed, implied, or authorized by this correction.
- Gen-pkg-1 remains at 5/6 gates: plan signed; Gate 1 not
  executed.

**Whose turn: Rowan's** — re-review of this correction and the
§2 proof; then Julie's, for any revised Gate 1 execution
decision (and, under Option B, her separate containment
authorization first).

— Wren
