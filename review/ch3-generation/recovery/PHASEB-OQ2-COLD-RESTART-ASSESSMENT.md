# Phase B — OQ-2 Cold-Restart Assessment (adopted GR-B state)

**What this document is.** The focused OQ-2 assessment commissioned
by Rowan's final generation-resume readiness ruling
(`ROWAN-FINAL-RESUME-READINESS-RULING.md`, item 6), against the
**adopted GR-B state** determined in that ruling's item 1. It
separates what the existing 296 drive passes and 87 grants
**establish** from what they **do not**, decomposes the
cold-restart gap into separately answerable sub-questions, and
proposes the smallest safe, bounded, independently reviewable way
to establish the missing behavior. **Nothing in this document is
an execution proposal.** Every vehicle specified here is a
proposal for Rowan's ruling; any vehicle that touches production
additionally requires Julie's separate GO. No wake, hold lift,
SubmitJob, grant mutation, generation, deployment, or Batch
activation is authorized by this assessment or by the ruling that
commissioned it.

**Strength discipline.** Every material claim is labeled
**ESTABLISHED** (observed on production and recorded),
**SOURCE-DERIVED** (read from the deployed composed source — the
Grant 1 build tree at `containment-v4/composed-tree/`, build
`fdb02395b3775dc945baa395591a73060ab146c4` — cited by file and
line), or **UNRESOLVED** (no evidence in hand decides it).
Source-derived expectations are predictions the specified
observations would confirm or refute; they are never presented as
observations.

**Operative state (the adopted GR-B baseline).** From the final
readiness confirmation (pin `ad42c9e9…`), §3.2 baseline census
2026-11-06T02:58Z, artifacts in `resume-confirmation-baseline/`:

| Element | Value |
|---|---|
| Containment | NORMAL both surfaces; episode 3 closed into `prevEpisode*` (3 / 1 / false / 1793933356719); `stopConfidence not_applicable` |
| Alarm registration | **none** — `armedAt` null at every read since C3's stop deleted the standing registration; restoration re-armed nothing |
| Pending schedule rows | 2 (one `lease` row for the standing grant, one `watchdog` row), both long past due |
| Recorder | 296 rows, latest #296 @ 1793825819071 (2026-11-04T20:56:59.071Z), all stage `complete`; `recordingFailures` 0 |
| Preserved plan `plan:19cad189fab54b9c804a74a6` | `active`, totals {eligible 1, done 0, failed 0, blocked 0, prompts 0}; sole entry `granted`; quarantine `held: false` |
| Phase B job `plan:19cad189fab54b9c804a74a6:seg` | `generating`, revision **88** |
| Grants | 87 total: `seg:1`–`seg:86` **voided** sequentially; **`grant:plan:19cad189fab54b9c804a74a6:seg:87:full` ISSUED (live)** |
| Occurrence `2a85f74f-353d-4c25-a86a-4a4db392868b` (569 chars) | `granted` |
| Derived reserved | **12** (the live grant's reservation; §5.3) |
| Dispatched / provider attempts / settled movement | **0 / 0 / 0** — across the window, C3, restoration, and the baseline census |
| Holds | GENERATION_HALT `"1"`; queue `opalreader-generation-v2` delivery **PAUSED** |
| Phase accounting | frozen: settled 1,029,420; estimatedUnverified 19,018; reservedUnverified 5,648; remaining 12,464,932 of 13,500,000 |

**OQ-2 as originally posed** (resume package §9, pin `0946f9f2…`,
quoted verbatim):

> **OQ-2 (blocking, branch GR-B only) — re-issuance after a void.**
> When the §7.3 grant stands voided (lease expiry under the holds)
> and the holds later lift, does a drive pass issue a **new** grant
> for the occurrence? With what id (the `:seg:1:full` sequence —
> incremented, or re-used)? What is the occurrence's state path out
> of `granted`-post-void, and the job's revision path? The records
> establish the void state (window classifications W-2) but do not
> establish re-issuance mechanics; §2.3.2's expectations wait on
> this ruling.

The window's course answered the *mechanics* half of that question
for the warm chain (§1). What remains open — the subject of this
assessment — is narrower and harder: whether the same mechanics
run **cold**, in a Durable Object whose alarm registration was
deleted by a verified stop, whose containment episode has closed
through a standalone restoration, and which has recorded no drive
pass since 2026-11-04T20:56:59Z.

---

## 1. What the 296 passes and 87 grants ESTABLISH

All items below are **ESTABLISHED** — observed on production and
recorded in the S1 window record (pin `f75130c6…`), the C3
execution record (pin `b4727c40…`), or the restoration record
(pin `304e0309…`).

- **E-1 — Sequential lease-expired reissuance on a delivering
  chain.** From the Grant 2 wake (2026-11-03T23:26:13Z; first pass
  ~1.9 s later) to pass #296 (2026-11-04T20:56:59.071Z) — a span
  of 21h30m44s — the chain ran 296 recorded passes and cycled the
  preserved plan's single occurrence through 87 grants: each
  grant, on reaching its lease-expired state, was voided, and a
  later pass issued its sequential successor (`seg:1` → `seg:2`
  at job revision 3, observed at the window's set 4; `seg:24`
  live at revision 25 at +30h; `seg:87` live at revision 88 at
  +54h). The successor's id increments with the job revision —
  the package §9 question's "incremented, or re-used" is answered
  for the warm chain: **incremented, never re-used**.
- **E-2 — Never two live grants.** At no completed read in the
  window were two grants live simultaneously; the standing member
  was always exactly one, and the void of grant *N* always
  preceded the issuance of grant *N+1*.
- **E-3 — Reservation stability across 86 re-derivations.** Derived
  reserved read **exactly 12** at every completed window check
  from the first issuance through the close. The window record
  states the cross-check expressly: a concurrent second grant
  would have read 24; a leaked release would have read 0 or a
  multiple. Eighty-six consecutive void/reissue cycles neither
  double-counted nor leaked the reservation.
- **E-4 — Zero dispatch and zero spend under both holds,
  throughout.** Dispatched 0 and provider attempts 0 at every
  read; phase accounting frozen on both surfaces; $0 across the
  window, C3, and restoration. The churn is a grants-only motion:
  it consumed no provider attempt, no quota dispatch, and no
  money.
- **E-5 — Recorder completeness for the warm chain.** All 296
  rows read stage `complete` with null error fields;
  `recorderHealth.recordingFailures` remained 0 at every completed
  check. (The standing dual-failure caveat applies to any
  inference from *absent* rows — §6 — but the 296 rows present are
  complete as recorded.)
- **E-6 — Pattern stability.** The cycle's period is consistent
  with its source constants (§2): a 15-minute grant lease
  (`LEASE_MS`) processed on a 10-minute watchdog cadence
  (`WATCHDOG_PERIOD_MS`) — 87 grants over ~21.5 hours ≈ one cycle
  per ~14.8 minutes of wall clock, with no drift, no acceleration,
  and no degradation across the span.
- **E-7 — The pre-fault wake arithmetic works on this build.**
  The Grant 2 stimulus — the same `RequestPause` against
  `alarm-wake-probe:nonexistent` the resume gate's probe will use
  — produced a recorded pass ~1.9 s after dispatch on a chain that
  had been dormant for over two days, on the current composed
  build (R5a deployed by Grant 1 the previous day). This is the
  design precedent for the probe. Its limits are stated at CR-1:
  that registration had never been deleted, and delivery
  subsequently **failed** on the same registration lineage (the
  W-4) — E-7 establishes that the wake *can* work on this build,
  not that it *will* work cold.

---

## 2. The mechanics the source prescribes (SOURCE-DERIVED)

These are the code paths any cold restart will execute, read from
the Grant 1 build source. They ground the expectations at §3 and
the observation sets at §4.

- **M-1 — Grant identity is the job revision.**
  `_issueGrant` computes
  ``grantId = `grant:${jobId}:${job.revision}:${probe ? "probe" : "full"}` ``
  (`coordinator.mjs:2037`) and refuses with `grant_exists` if a
  grant of that id already exists (:2038–2039). The grant's own
  transition then advances the job revision by exactly one
  (`applyJobEvent`, :776–779) and the grant row's stored revision
  is updated to the post-transition value (:2095–2101). Hence
  `seg:87` was issued at job revision 87 and the job now stands at
  88; **the next grant this job can ever issue is
  `seg:88:full`, and `seg:87`'s id can never be re-issued** —
  re-issuance under an old id is structurally impossible, not
  merely unobserved.
- **M-2 — A grant can only cover `pending` occurrences.**
  `_issueGrant` targets `occurrences WHERE state = 'pending'`
  (:1988) and applies the occurrence event `grant`
  (pending → `granted` per `OCC_TRANSITIONS`, :92–99) inside the
  issuance transaction. A `granted` occurrence is not a target.
  The single-live-grant property (E-2) is therefore emergent from
  the state machine, not a counter: a successor for this
  occurrence can only be issued **after** the standing grant's
  void returns the occurrence to `pending`.
- **M-3 — The lease.** Issuance inserts the grant `issued` with
  `lease_expires_at = now + LEASE_MS`, `LEASE_MS = 15 * 60 * 1000`
  (:463; insert :2073–2075), and schedules a `lease` row at the
  same instant (:2088). "Expiry" is not an event that happens to
  the grant in wall-clock time; it is a **state a later pass
  computes** when it processes the due `lease` row. A grant whose
  lease time has passed but whose row no pass has processed
  remains `issued` — exactly `seg:87`'s posture today.
- **M-4 — What a pass does with a due lease row.**
  `alarm()` processes every pending schedule row with
  `due_at <= now`, in `due_at` order (`coordinator.mjs:3272–3301`),
  and in its `finally` ensures a watchdog row exists and re-arms
  (`_armAlarm`). The `lease` case of `_processScheduleRow`
  (:3318–3410) branches on the grant's delivery posture:
  reported/voided → skip; **outbox row present but never invoked
  (`sent_at` null, `send_attempted_at` null) → the round-4 safe
  void** — `_voidDispatch(..., "lease_expired_undelivered")` then
  `_scheduleReAdvance(jobId)` (:3370–3375); outbox absent → the
  grant is retired `voided` outright (:3376–3383); attempted but
  unacknowledged → `handoff_uncertain`, nothing voided, nothing
  released (:3355–3368); **delivered (`sent_at` set) → the
  occurrence takes `lease_expired` → `outcome_unknown`**
  (:3399–3406). A DO-internal freeze (`_frozen()`, meta key —
  not GENERATION_HALT) tolls the lease instead (:3338–3353); no
  freeze directive stands in production.
- **M-5 — The void.** `_voidDispatch` (:2283–2353) refuses a
  **claimed** grant outright (`void_refused_claimed` — a claimed
  dispatch's reservations are never released and its work never
  re-granted under it); otherwise it releases each attempt
  reservation exactly once (idempotent `rel:` ledger rows),
  applies the occurrence event `defer` (`granted` → `pending`),
  sets the grant `voided`, closes the grant's quota reservations
  exactly once (`closeReservationsForVoidedGrant`,
  `generation/quota-budget.mjs:718`), voids the pending `lease`
  schedule row, deletes the outbox row, and logs the transition.
  The occurrence's state path out of `granted`-post-void is
  therefore: **`granted` —(defer, at the void)→ `pending`
  —(grant, at the successor's issuance)→ `granted`**.
- **M-6 — Re-advancement.** `_scheduleReAdvance` (:2119–2132)
  enqueues exactly one `retry_grant` row at +30 s after a safe
  void (deduplicated: never two pending for one job; generating
  jobs only). The `retry_grant` case (:3411–3423) calls
  `requestGrant` (:2136–2143), which wakes and issues. Where the
  retry row's +30 s due time precedes the next watchdog, the
  re-arm at the end of the processing pass arms the alarm at the
  earlier due — so void and successor issuance may land in
  **consecutive passes minutes apart, or the drive sweep (M-8)
  may re-grant within the same pass**; the observation set at §4
  is written to accept either shape.
- **M-7 — Reservation composition and ownership.** On issuance
  under the D6 flag, `reserveForGrant`
  (`generation/quota-budget.mjs:544`) reserves **worst-case 12
  provider-attempt slots per granted occurrence** (:588; the
  proposal §3.2.2 ×12), keyed to the issuing grant. Ownership is
  per-grant (Gate 4's per-row rule): the standing 12 belongs to
  `seg:87` alone; the void closes exactly those 12 exactly once
  (M-5); the successor reserves a fresh 12 of its own. Derived
  reserved therefore reads 12 whenever exactly one grant's
  reservation is open, 0 in the transient between a void's close
  and a successor's reserve, and 24 if two were ever open
  together — the arithmetic E-3 verified 86 times warm.
- **M-8 — The pass as a whole.** The entry's `alarm()`
  (`worker-entry-prod-d6.js`, alarm handler) runs (1) the base
  coordinator `alarm()` (M-4/M-6 schedule processing), then —
  containment permitting — (2) `service.recover()` and
  `service.driveOnce()`, the drive sweep that settles plan state
  and re-derives grants; `driveOnce`'s only caller is this alarm
  handler (attempt-3 diagnostic, pin `cccfea62…`). The pass is
  recorded in `d6_drive_passes` by `_recordDrivePass`
  (entry :1899–1944): `at`, `finished_at`, `stage`,
  `drive_invoked`, the outcomes array, error fields, and
  `armed_after` (a `getAlarm()` read-back taken at record time).
  Retention is 288 rows (`DRIVE_PASS_RETENTION`, entry :459); the
  diagnostics read returns the latest 50.
- **M-9 — Why nothing can dispatch while the holds stand.**
  `sendGrant` is wired **only when `GENERATION_HALT === "0"`**
  (entry :326, :343). With the halt at `"1"`, `env.sendGrant` is
  absent, and the watchdog case drains the outbox only
  `if (typeof this.env.sendGrant === "function")`
  (`coordinator.mjs:3310–3312`) — so no outbox row can ever be
  invoked, `send_attempted_at` can never be set, and every grant
  issued under the halt is born into the never-invoked posture of
  M-4's safe-void branch. The queue's `delivery_paused` is a
  second, independent fence behind it. Dispatch under both holds
  is not merely unobserved (E-4); on this source it is
  **structurally unavailable** at the worker layer.
- **M-10 — The wake.** A fresh command's `handleCommand` calls
  `wake()` before apply (replayed commands short-circuit on their
  receipt first and never wake — the probe's freshness is its
  mechanism). `wake()` (`coordinator.mjs:3204–3210`) ensures a
  watchdog row exists, then `_armAlarmIfEarlier` (:3220–3271):
  subject to the containment arm gate (NORMAL does not suppress),
  it takes `due = MIN(due_at)` over pending schedule rows and
  calls `setAlarm(due)` when the current registration is **null**,
  or past-due by more than `ALARM_STALE_THRESHOLD_MS`
  (3,600,000 ms, :144 — the R5a disjunct), or later than `due`.
  At the resume census the registration is null, so the **null
  branch** is the operative one: the probe's wake registers the
  alarm at the earliest pending due time — both pending rows are
  long past due, so the registered time is in the past, and
  documented platform behavior for a past-due `setAlarm` is
  prompt delivery. Prompt delivery is an **expectation**, not a
  guarantee (§3, CR-1).

---

## 3. What the record does NOT establish — the cold-restart gap, decomposed

The warm chain proves the mechanics run when the chain is
**delivering**. Every cold-restart unknown below shares one root:
since pass #296, this Durable Object has been through a verified
`stop_chain` (registration **deleted**, read back null), a
standalone restoration (a reasoned `clear` that by design re-arms
nothing), and a dormancy in which no `setAlarm` has been issued
and no `alarm()` has run. No observation in hand covers that
combination. The gap decomposes into four separately answerable
sub-questions.

### CR-1 — Will a fresh registration be created, and will it DELIVER?

Two distinct halves, with different evidence:

- **Creation — SOURCE-DERIVED, high confidence.** At the probe,
  `wake()` → `_armAlarmIfEarlier` reads `getAlarm()` = null (the
  baseline census state) and takes the null branch (M-10):
  `setAlarm(due)` with `due` the earliest pending due time.
  Creation is directly observable after the fact: the diagnostics
  read's alarm block reports the registered value, and the first
  new recorder row carries `armed_after`. **UNRESOLVED** in one
  narrow respect: post-retry-exhaustion `getAlarm()` semantics
  are UNSPECIFIED (alarm-semantics assessment, pin `06bbba51…`) —
  the platform's behavior for registrations on a DO whose alarm
  previously exhausted retries and was then deleted is not
  documented, and no read can distinguish "registration created"
  from "registration created and correctly held" until delivery
  is attempted.
- **Delivery — UNRESOLVED, with a live counterexample class.** The
  W-4 stands: a registration on this very DO stood **26h14m37s
  past due** at the window's close with no delivery, for reasons
  that remain UNCONFIRMED, temporally coincident with — not
  attributed to — the second 1101 platform fault. Passes in fact
  continued *inside* the fault's onset bracket until
  2026-11-04T20:56:59Z and then stopped; no surface explains the
  stop. The Grant 2 precedent (E-7) shows delivery working on
  this build after a two-day dormancy — but that registration
  had never been deleted, the DO had not been through a verified
  stop and an episode close, and the fault had not yet occurred.
  Attempt 3 supplies a second, older cautionary shape: a
  registration existed and a wake could not advance it on the
  pre-R5a build (B1 — D = A — the LEADING, unproven explanation;
  the B-family is not closed). On the current build the cold
  case differs from both precedents in the operative respect:
  the registration is **null**, so the wake's `setAlarm` is
  unconditional (M-10) rather than an arithmetic no-op — but
  whether the platform **delivers** a past-due registration
  created fresh on this DO, after this DO's history, is exactly
  what no record establishes. **Confirming observation:** a new
  recorder row (id ≥ 297) appears within the ruled bound after
  the probe. **Refuting observation:** the bound expires with no
  row — the gate's GR-2 failure shape, already ruled: preserve
  the raw polls, end HELD, return for review; no second probe.

### CR-2 — What does the FIRST cold pass do with `seg:87`?

**SOURCE-DERIVED expectation, stated precisely.** `seg:87`'s
`lease` row is among the two pending schedule rows and is due;
the first cold `alarm()` processes it (M-4). `seg:87` was issued
under the halt, so by M-9 its outbox row was never invoked
(`sent_at` null, `send_attempted_at` null) — the grant's
`issued` state, the occurrence's `granted` state, and dispatched
0 on every surface are jointly consistent only with that
posture. The lease case therefore takes the **safe-void
branch**: `_voidDispatch(..., "lease_expired_undelivered")`
voids `seg:87` (occurrence `defer` → `pending`; its 12
reservations closed exactly once), `_scheduleReAdvance` enqueues
the +30 s `retry_grant`, and a successor — `seg:88:full`, the
only id M-1 permits — is issued for the same occurrence by the
retry path or by the same pass's `driveOnce` sweep (M-6),
reserving a fresh 12 and returning derived reserved to exactly
12, the occurrence to `granted`, and the job revision from 88 to
89 (or 90 if both the void's re-advance and a drive re-derivation
each apply a job event — the observation set at §7 accepts the
transition by its grant/occurrence/reserved values, not by an
exact revision count). **What would refute it:** (a) `seg:87`
still `issued` after recorded passes have run — the lease row
was not processed as prescribed; (b) the occurrence in
`outcome_unknown` — the pass treated the grant as delivered,
contradicting M-9 and E-4, a STOP-grade finding; (c) any second
live grant at any read; (d) derived reserved ≠ 12 once the cycle
settles, or 24 at any read. *Caveat at full strength:* the
outbox row's internal fields are on no read surface; the
safe-void expectation rests on the source branch structure plus
the grant/occurrence/dispatched triad, and only the cold pass's
observed transition converts it to ESTABLISHED.

### CR-3 — Reservation ownership continuity across the stop

The reservation is not a free-floating number: it is 12
provider-attempt slots reserved **by `seg:87`** (M-7), closable
exactly once by `seg:87`'s void, and replaceable only by a fresh
reserve against the successor. The warm chain re-derived it 86
times without double-count or leak (E-3) — **but all 86
re-derivations occurred inside one continuous delivering chain,
with no intervening stop, deletion, or restoration.** The
cold question is whether the stop/restoration interval changed
anything the arithmetic depends on: the reservations live in the
quota ledger keyed by grant, untouched by containment
transitions (C3's and restoration's censuses both read
reservedUnverified 5,648 and derived reserved 12, frozen), and
no source path couples them to the alarm or containment state.
**SOURCE-DERIVED expectation:** the cold void closes `seg:87`'s
12 exactly once and `seg:88` reserves its own 12; derived
reserved is never observed at 24 and reads exactly 12 once the
cycle settles. **Confirming observation:** the §7 reads across
the transition (12 → transient 0 permitted between void and
reissue if a poll lands inside the gap → 12). **Refuting
observation:** 24 at any read (double-count — the successor
reserved while the predecessor's closure failed), or a settled
reading ≠ 12, or reservedUnverified phase movement — each a
STOP.

### CR-4 — Duplicate-dispatch prevention on the cold path

The invariants, and which of them cold restart stresses in a way
warm churn did not:

| Invariant | Mechanism | Cold stress |
|---|---|---|
| Single live grant per occurrence | Issuance targets `pending` occurrences only (M-2); successor impossible until the void's `defer` lands | **Stressed**: the cold pass must perform the void *first*, in the same processing sweep that can also re-grant (M-6/M-8). Warm churn never combined a 26-hour-stale lease row, a past-due watchdog, and a fresh registration in one pass. The state machine's ordering — schedule rows in `due_at` order, issuance inside transactions — is the fence; the observation is E-2's property re-verified cold. |
| Grant-id uniqueness | Id = job revision at issuance; `grant_exists` refusal (M-1) | Not stressed: the id space moved monotonically through 87 grants and the next id is forced. |
| Job revision monotonicity | `applyJobEvent` increments by exactly 1 per applied event; expected-revision CAS available to appliers | Mildly stressed: two re-grant paths (retry row, drive sweep) converge on one job in one pass window; a revision conflict would surface as a logged rejection, visible in the transition record and as a grants-list anomaly — covered by the §7 observation set. |
| No dispatch without a live grant under lifted holds | Dispatch consumes a grant through the queue; claims fence voids (M-5's claimed-grant refusal) | Not stressed pre-lift: under the holds, dispatch is structurally unavailable (M-9) regardless of grant state. Post-lift, the gate's own ruled sequence governs, and this assessment adds nothing to it. |
| Quota cohort bound | `reserveForGrant` / `boundGrantTargets`: 12 worst-case slots per fresh occurrence against the 100/day cap; the day's ledger count can never exceed the limit | Stressed only arithmetically: the cold cycle consumes the same 12-slot reservation shape the warm chain consumed 87 times on prior PT days; the census-day figures (attempts 0, dispatches 0) leave full headroom. A reservation reading beyond 12 for this single-occurrence job refutes — STOP (CR-3). |

**Net:** CR-4's genuinely cold-stressed element is the
*ordering* of void-then-regrant inside the first passes. It is
fully observable on the §7 read set (grants list + occurrence
state + reserved at every poll), and any violation is visible
before either hold lifts, while dispatch is still structurally
impossible. That asymmetry — the stressed invariant is checkable
at zero exposure — is what makes the §5 vehicles possible.

---

## 4. The currently issued grant — `seg:87:full`, in full

- **Identity and issue context (ESTABLISHED).**
  `grant:plan:19cad189fab54b9c804a74a6:seg:87:full`, state
  `issued`, stored revision 88, for the preserved plan's sole
  occurrence `2a85f74f-353d-4c25-a86a-4a4db392868b` (FP chapter
  index 2, idx 26, 569 chars, Alex → Gemini Charon per the Phase
  B record). It is the 87th sequential grant of the window churn:
  live at the +54h window check (2026-11-05T05:20:53Z) with job
  revision 88 and `seg:1`–`seg:86` voided behind it. (The window
  record does not separately timestamp `seg:87`'s issuing pass;
  it was issued during the churn's final sequence on 2026-11-04,
  within the recorded 296 passes. Stated at that strength.)
- **Lease terms (SOURCE-DERIVED).** Issued with
  `lease_expires_at = issuance + 15 minutes` (M-3) and a `lease`
  schedule row at the same instant — one of the two pending
  schedule rows at every census since. The lease **expired in
  wall-clock terms on 2026-11-04**, minutes after issuance. But
  per M-3, expiry is computed by a processing pass, and no pass
  has run since #296: the grant is not "expired" in any state
  the system records — it is `issued`, with a due lease row
  awaiting the first cold pass. Nothing about the long interval
  changes the branch the pass will take (M-4 keys on the outbox
  posture, not on how stale the row is).
- **Reservation and ownership (ESTABLISHED + SOURCE-DERIVED).**
  The grant owns the system's entire current reservation:
  **12 worst-case provider-attempt slots** (M-7), reserved at its
  issuance by `reserveForGrant` and keyed to its grant id;
  phase-surface counterpart reservedUnverified 5,648 ledger units
  (frozen at every census). Ownership is per-grant and
  exclusive: no other grant holds any reservation (86 predecessors
  closed theirs at their voids), and the 12 can be released
  exactly once — by `seg:87`'s void (M-5), by a claim-side
  settlement if it were ever claimed (it cannot be under the
  holds, M-9), or by no other path.
- **Why it cannot dispatch on any holds-on path
  (SOURCE-DERIVED).** Dispatch requires the outbox row to be
  invoked by `sendGrant`; `sendGrant` is not wired while
  GENERATION_HALT is `"1"` (M-9), and the queue's paused delivery
  stands behind that. The grant can therefore be **voided and
  succeeded** under the holds, but it cannot be **sent**: on
  V-1 and V-2 alike (§5), the only motions available to it are
  the M-4 safe void and the M-6 re-advancement. This is the same
  structural fact that kept dispatched at 0 through 87 grants
  (E-4).
- **Expected fate, per path.**
  - **V-1 (in-gate):** voided by the resume gate's first cold
    pass, before either hold lifts; succeeded by `seg:88:full`;
    its reservation closed and re-derived in the same cycle
    (CR-3's observation). If the gate then proceeds, `seg:88` —
    not `seg:87` — is the grant standing when the holds lift,
    and the gate's ruled dispatch expectations apply to it.
  - **V-2 (standalone micro-gate):** the same void + succession,
    observed as the micro-gate's entire object; `seg:88` then
    stands live and itself begins cycling (its own lease voids
    and reissues as `seg:89`, `seg:90`, … on the chain's cadence)
    for as long as the resulting registration stands — the
    window-proven churn, resumed. The micro-gate's record fixes
    the provenance of everything that follows.
  - **V-3 (harness only):** `seg:87` is untouched in production;
    a seeded replica of it is voided in the harness (§5.3).
  - **No vehicle:** it stands `issued` indefinitely; nothing in
    the system ages it out without a pass.

---

## 5. The candidate vehicles

Each vehicle is specified as a bounded, independently reviewable
protocol: its acts, its observation set, its stop rules, and its
ends state. None is authorized by this document. V-1 and V-2 each
consume exactly **one** production command (the same ruled probe)
and no other production act; V-3 consumes none.

### 5.1 V-1 — Gate-internal verification: the cold-restart checkpoint GR-2C

**The argument.** The resume gate's already-ruled sequence
places the probe at GR-2 — after the execution census and the
voice checkpoint, **before either hold lifts** — and verifies
the wake by its recorder-row effect within the 15-minute bound
under paired polling (GR-2 as corrected). What OQ-2 adds is one
observation the ruled sequence did not name: the first cold pass
does not merely prove delivery — it necessarily performs the
cold grant transition (CR-2), because `seg:87`'s lease row is
due in that very pass. Under both holds, that transition is
exposure-free by construction (M-9: the pass can churn; it
cannot dispatch). V-1 therefore inserts **one named checkpoint,
GR-2C, between the wake verification (GR-2) and the GR-3
lift decision**, at which the executor must observe the cold
transition in full before any hold moves:

| # | Required observation at GR-2C (all from the gate's existing read set) | Discharges |
|---|---|---|
| (a) | A new recorder row, id ≥ 297, `stage complete`, `drive_invoked` 1, error fields null, `at` within the GR-2 bound of the probe | CR-1 delivery |
| (b) | The row's `armed_after` (or the diagnostics alarm block) shows a live registration — the chain stands armed after the pass | CR-1 creation, re-verified post-pass |
| (c) | Job read: `seg:87:full` **voided**; exactly one live grant, `seg:88:full`, `issued`, for occurrence `2a85f74f…`; occurrence `granted`; no second live grant at any poll | CR-2; CR-4 ordering |
| (d) | Derived reserved exactly **12** at the settling polls (a transient 0 inside the void/reissue gap is the only other permitted value; 24 at any poll is a STOP) | CR-3 |
| (e) | Dispatched 0 and provider attempts 0 on every surface, phase figures frozen, `recorderHealth.recordingFailures` still 0 | CR-4; E-4 re-verified cold |

Pass (the two-complete-poll discipline of correction 2, applied
to the job/quota reads): the transition must read consistently
on **two consecutive complete polls** before GR-2C is declared
met. Any element missing, unexpected, or contradicted → the
gate's existing failure behavior, unchanged: the raw polls are
preserved, the gate ends HELD and returns to Rowan and Julie for
review. On that path the holds never lifted, so there is nothing
to re-hold; the ends state is HELD with a **live, in-set churning
chain under both holds** — the window-proven contained posture —
and OQ-5's post-gate observation duty (as specified in the
confirmation §8 and accepted with conditions) attaches to the
abort path, so the churn is owned and watched, not abandoned.

**What V-1 discharges, and its one honest weakness.** If the
GR-2C observations land as specified, CR-1 through CR-4 are each
discharged **by observation on the actual object, in the actual
gate, before any exposure** — the strongest evidence form
available to this program. The weakness is review timing: the
evidence is produced inside the gate and reaches Rowan in the
execution record, after the fact. "Independently reviewable" is
satisfied by the protocol's pre-specification (this assessment,
ruled on in advance, with the observation set and stop rules
fixed before any act) plus the record — **not** by Rowan seeing
the cold evidence before Julie's GO is sought. If Rowan prices
pre-GO evidence review above the costs at §5.2, V-2 is the
vehicle; §5.4 states the recommendation and its reasons.

**Incremental cost over the already-ruled gate:** zero
additional production acts (the probe is already counted, GR-4;
the checkpoint is reads only), zero additional exposure (the
checkpoint sits entirely inside the holds-on phase), and one
named stage in the gate's ledger.

### 5.2 V-2 — Standalone holds-on cold-restart observation (micro-gate "CR-V")

A separate micro-gate, executed and reviewed **before** the
resume gate is presented to Julie, whose entire object is the
cold transition.

**Protocol.** (1) Fresh census — the confirmation §3 read set,
expected values = the §0 baseline of this assessment; any
deviation STOPs before any act. (2) Julie's GO, recorded on the
board before the census (the established ordering), naming
exactly: one probe, both holds standing throughout, the
observation window below, and no other act. (3) The probe:
identical in body, route, and freshness to the gate's GR-2 probe
(`RequestPause` against `alarm-wake-probe:nonexistent` via the
client connector, freshly minted `command_id`), counted as
exactly one production command. (4) Observation: paired reads of
the §7 set at most 5 minutes apart for up to **15 minutes** from
the probe (the GR-2 bound, adopted unchanged). **Success** =
the §5.1 observations (a)–(e), identically specified — recorder
row(s) showing the cold pass and the CR-2 transition as
source-derived. **Failure** = no row within the bound, or any
unexpected transition, state, or figure: no second probe, no
corrective act; preserve the raw reads and return for review.
(5) Closing census: the full §3 set repeated; ends state
verified — both holds standing (halt `"1"` read back from the
script settings; queue `delivery_paused` read back), containment
NORMAL, dispatched 0, $0.

**The standing-registration consequence — Rowan's choice, not a
default.** On success, a registration **stands** and the chain
**churns in-set at $0** (the window-proven posture, E-1–E-6)
until some later authorized act. Two dispositions are specified;
the micro-gate's GO wording takes whichever Rowan rules:

- **(i) Leave standing, under owned observation.** The
  micro-gate's record documents the registration's provenance
  (created by the CR-V probe, at a stated time, by a stated
  act), and that record then serves **verbatim** as the GR-3
  provenance record at the resume gate's execution census —
  closing the provenance question the confirmation §5.3 left
  open. An owned read-only observation duty (daily checks on
  the tail-watch precedent; classifications QUIET / MOVEMENT
  with immediate escalation and no act) runs from CR-V's close
  until the resume gate executes or a further ruling ends it.
  The resume gate thereafter opens onto a **warm** chain — the
  state the window already proved — carrying CR-V's cold
  evidence in hand.
- **(ii) Re-stop under a separate micro-authorization.** A
  follow-on `stop_chain` (its own Rowan ruling + Julie GO +
  census, on the C3 pattern) deletes the registration and
  returns the system to the present dormant posture. Noted for
  completeness: a stop executed against a **live, delivering**
  chain would also produce the live-suppression evidence C3
  could not (its chain was not delivering) — a possible
  incidental benefit, named here only so Rowan can weigh it;
  it is not a reason this assessment advances for choosing (ii),
  and (ii) spends a containment episode and a further gate
  round to buy back dormancy the resume gate will immediately
  need to undo.

**What V-2 discharges:** CR-1 through CR-4 identically to V-1 —
the same observations on the same object — with the evidence
**reviewed by Rowan before any resume GO is presented to
Julie**. Its costs are the extra gate round, and — under
disposition (i) — an open-ended interval in which the chain
stands live and churning (contained, proven, $0 — but live)
between CR-V and the resume gate.

### 5.3 V-3 — Source + harness assessment (complement, not substitute)

**What it can establish without any production act.** Build the
composed tree in the Durable Object test harness; seed storage
to the adopted GR-B state (grants `seg:1`–`seg:86` voided +
`seg:87` issued with a past `lease_expires_at` and an unsent
outbox row; occurrence `granted`; job `generating` rev 88;
pending `lease` + `watchdog` schedule rows, both past due;
containment row NORMAL in its post-restoration form; `seg:87`'s
12 quota reservations open; GENERATION_HALT `"1"` in env); call
`deleteAlarm()`; drive the probe-equivalent fresh command
through `handleCommand`; invoke `alarm()`; and assert the full
CR-2/CR-3/CR-4 transition set against the resulting state
(`seg:87` voided with a `lease_expired_undelivered` transition
record; `seg:88` issued; occurrence `granted`; reserved 12;
exactly one live grant; revision advanced monotonically). The
lease handler's branch table on `seg:87`'s exact posture can
additionally be enumerated source-only, as §2 does. This
sharpens every source-derived expectation in §3 into an
executable assertion and would catch a source misreading in
this assessment before any production vehicle runs.

**Its standing limitation — why it cannot substitute.** The
harness *invokes* `alarm()` directly: CR-1's delivery half —
the one sub-question with a live counterexample — is exactly
the part a harness cannot touch, because its `getAlarm` /
`setAlarm` are fakes and no platform delivery occurs. The
program's precedents are uniform: harness-green is no evidence
for platform behavior (the DO `.one()` divergence — the harness
fake returns null where real DO SQLite throws — is the standing
example, and C1's ruling already limits deployment evidence to
what production reads prove). V-3 can discharge the
**source-behavior halves** of CR-2, CR-3, and CR-4 at
harness strength; it cannot discharge CR-1 at any strength, and
therefore cannot alone support an OQ-2 disposition for GR-B.

**Recommendation within the vehicle set:** run V-3 regardless
(documentary; needs no production authorization) as an annex to
whichever of V-1 / V-2 Rowan selects — its assertions either
confirm §2's reading or falsify this assessment cheaply, before
production is touched.

### 5.4 Evaluation and recommendation

| | V-1 (in-gate GR-2C) | V-2 (standalone CR-V) | V-3 (harness) |
|---|---|---|---|
| Discharges CR-1 (creation + delivery) | Yes — observed in the actual DO, pre-lift | Yes — same observation, earlier | **No** — delivery untestable |
| Discharges CR-2 / CR-3 / CR-4 | Yes — observed pre-lift | Yes — observed | Source-behavior halves only, harness strength |
| Additional production acts | **0** (probe already counted in the gate) | 1 (the probe) + a gate round | 0 |
| Exposure at any point | None — checkpoint is holds-on | None — holds never lift | None |
| Evidence reviewed by Rowan | In the execution record (protocol pre-ruled) | **Before** the resume GO is sought | As an annex, anytime |
| Side consequences | Abort path leaves a live churning chain under holds (owned by OQ-5 duty) | Success leaves a live churning chain under holds for an open interval (disposition (i)) or spends a re-stop (ii) | None |
| Rounds added | 0 | 1 micro-gate (+ possibly a re-stop gate) | 0 |

**Recommended: V-1, with V-3 run as its documentary complement.**
V-1 is the smallest vehicle that discharges every sub-question
by observation: it adds no production act, no exposure, and no
round to a gate whose every other element Rowan has already
ruled, and it places the cold-restart test at the one moment
when its failure is free — holds on, dispatch structurally
impossible, abort already specified. Its single trade —
evidence reviewed after execution rather than before the GO —
is the same trade every prior gate in this program has run on
(C1, C2, Grant 1, C3, restoration: pre-ruled protocol, evidence
in the execution record), and the GR-2C observation set is
specified here, in advance, at the same strictness as those
gates' censuses. **V-2 is fully specified above as Rowan's
alternative** if she prices pre-GO evidence review above the
extra round and the standing-chain interval; the assessment
takes no position that would foreclose it, and the disposition
language at §8 is drafted for both.

---

## 6. Stop rules and restoration of both holds — every permitted path

**Stop rules (any vehicle that touches production).** Each of
the following, observed at any poll, is a STOP: preserve the raw
reads exactly as taken, take no corrective or further act under
the vehicle's authorization, and return to Rowan and Julie for
review.

- **S-1.** No new recorder row within the 15-minute bound
  (CR-1's refuting observation).
- **S-2.** `seg:87` still `issued` after a recorded pass has run,
  or the occurrence in `outcome_unknown` (CR-2 refuted).
- **S-3.** A second live grant at any read, or any grant other
  than the standing member and its single sequential successor.
- **S-4.** Derived reserved at 24 at any read, or settled at
  anything other than exactly 12; any movement in
  reservedUnverified or any phase figure.
- **S-5.** Dispatched > 0, provider attempts > 0, or any settled
  movement, at any read — under the holds each is a
  structural-impossibility made real (M-9), the gravest class
  this protocol can observe.
- **S-6.** Any recorder row with a non-`complete` stage or
  non-null error fields, or `recordingFailures` > 0 (with the
  §9 dual-failure caveat stated, not smoothed).
- **S-7.** Any deviation in the pre-act census from the §0
  baseline, in any field — the standing executor STOP law: the
  vehicle does not begin.
- **S-8.** A probe receipt other than the expected
  `{"outcome":"rejected","reason":"job_not_found"}` — the
  command layer itself is off-design; nothing downstream of it
  may be interpreted until Rowan classifies it.

**Restoration of both holds.**

- **V-1:** the checkpoint sits *before* any lift, so on every
  GR-2C path — success or STOP — both holds stand untouched and
  need no restoration. On paths where the gate later lifts and
  then aborts, the gate's existing re-hold sequence governs
  (queue re-pause, then GENERATION_HALT restored, each verified
  by read-back, in the ruled order) — correction 2's A-7 and the
  package §2.3.3 sequence, unchanged by this assessment. The
  closing census verifies both holds standing on every path,
  success included (GR-6a ends re-held by design).
- **V-2:** the holds **never lift**; "restoration" is
  discharge-by-verification: the closing census reads
  GENERATION_HALT `"1"` from the script settings surface and
  `delivery_paused: true` from the queue surface, and the
  micro-gate record states both reads. If either read fails,
  that is itself an S-7-class finding for the next round — the
  micro-gate holds no act with which to repair it, and none may
  be improvised.
- **V-3:** no production state exists to restore.

---

## 7. Recorder evidence specification

The evidence for CR-1 and CR-2 is the recorder, read through the
gate's existing surfaces — `GET /v2/d6-diagnostics?drive=1`
(operator) for the pass rows and alarm block, the client job
read for the grants list, and the quota/diagnostics surfaces for
reserved and dispatched. Per row and per poll, the protocol
captures:

- **Row identity and timing:** `id` (≥ 297 for the first cold
  row), `at`, `finished_at` — establishing the probe-to-row
  interval against the 15-minute bound and the ≤5-minute paired
  polling cadence (poll timestamps recorded by the executor
  alongside each read).
- **Row quality:** `stage` (`complete` required), `drive_invoked`
  (1 required — a `contained`-stage row would mean the drive was
  suppressed and nothing in CR-2 was tested; under the NORMAL
  baseline it is also an S-6-class surprise), `error_name` /
  `error_message` (null required), and the outcomes array (the
  preserved plan's outcome present, its state `active`).
- **Chain state:** `armed_after` on the new row(s) — non-null
  and in the future relative to the row's `at` (the chain stands
  armed for its next pass) — corroborated by the diagnostics
  alarm block (`armedAt`, `pendingSchedule`, `pendingWatchdog`)
  at the same poll.
- **Recorder health:** `recordingFailures` (0 required) and
  `lastRecordedAt` advancing to the new row's `at`. The
  two-complete-poll rule (correction 2) applies to the grant/
  accounting side of the transition: the job and quota reads
  must agree with the row's implication on two consecutive
  complete polls before the transition is called observed.
- **Retention note:** the table retains 288 rows; the read
  returns the latest 50. All 296 warm rows remain within
  retention at the time of writing, so the cold rows' ids
  continue the warm sequence unambiguously (297, 298, …) — the
  specification keys on the **latest-row id and its delta from
  296**, not on full-table enumeration.

---

## 8. Proposed OQ-2 disposition language — for Rowan's ruling

Drafted for adoption, amendment, or replacement by Rowan. The
assessment proposes; it does not rule.

**If V-1 is selected:**

> OQ-2 is DISCHARGED for the adopted GR-B state by the bounded
> in-gate verification protocol GR-2C, as specified in the OQ-2
> cold-restart assessment: the discharge is **conditional on the
> GR-2C observations landing exactly as specified** (recorder
> row, safe void of `seg:87`, sole successor `seg:88`,
> reserved exactly 12, dispatched 0), is at OBSERVED-EVIDENCE
> strength for the cold transition the gate records, and covers
> the first cold reissuance after the C3 stop and the
> restoration on this plan and job only. Any GR-2C deviation
> voids the discharge for that attempt; the gate ends HELD and
> the question returns. Nothing in the discharge asserts
> cold-restart behavior generally, on any other plan, job, or
> build.

**If V-2 is selected:**

> OQ-2 is DISCHARGED for the adopted GR-B state on the CR-V
> micro-gate's recorded evidence, at the same strength and with
> the same scope limit as above; the resume gate thereafter
> opens onto the documented warm chain whose provenance the
> CR-V record supplies for GR-3.

**In either case**, the confirmation's GO wording must then be
re-drafted against the **adopted** GR-B predicates and the
chosen vehicle (the GR-A-only wording stands NOT APPROVED, per
the readiness ruling item 5) and presented to Julie as a fresh
decision. This assessment contains no GO wording and seeks none.

---

## 9. What remains unknown even after the recommended vehicle

- **The W-4's root cause remains UNCONFIRMED.** A successful
  cold restart would show delivery working *now*; it would not
  explain why delivery stopped on 2026-11-04, and the
  possibility of a recurrence during the gate's own live phase
  is carried by the gate's existing instruments (the sliding
  stall test, A-7, the 3-hour checkpoint) — not retired by
  anything proposed here.
- **Post-retry-exhaustion `getAlarm()` semantics remain
  UNSPECIFIED** (CR-1): the discharge covers the observed
  behavior of this DO across this stop/restoration cycle, not
  the platform's general contract.
- **The racing-wake recheck remains PLATFORM-UNVERIFIED**
  (harness-proven only, C3's carried limitation): no vehicle
  here exercises a wake racing a stop, and none should.
- **The B-family is not closed generally.** B1 remains the
  leading, unproven explanation of attempt 3's stall on the
  pre-R5a build; the cold case bypasses the B-question (null
  registration, unconditional `setAlarm`) rather than resolving
  it.
- **The recorder dual-failure blind spot** (a pass whose SQL
  record and health note both fail leaves no row) bounds every
  absence-based inference in this protocol — mitigated, not
  removed, by requiring the row **and** its accounting-side
  transition to agree (GR-6: a grant transition without its
  recorder row is an R-06 discrepancy, never sufficient alone —
  and under §6 the converse pairing is required here too).
- **Durable Object runtime adoption generally** remains
  unproven in the standing sense; nothing here depends on it
  beyond the reads the censuses actually take.

---

## 10. Questions for Rowan

- **Q-1 — Vehicle.** Does Rowan select **V-1** (in-gate GR-2C
  checkpoint; recommended), **V-2** (standalone CR-V micro-gate),
  or V-1/V-2 with a different composition? V-3 is proposed as a
  complement under either selection — does she want its results
  filed as an annex **before** she rules, or is the §5.3
  specification sufficient at this round? (Q-6 below repeats
  this as a sequencing question so it can be answered either
  way.)
- **Q-2 — Conditional discharge.** If V-1: does Rowan accept the
  §8 construction — OQ-2 discharged by a pre-ruled protocol
  **conditional on its observations landing exactly as
  specified** — as satisfying item 2 of the readiness ruling
  ("an independently reviewed, bounded verification protocol")?
  If not, what form must the discharge take?
- **Q-3 — GR-2C observation set.** Are observations (a)–(e) at
  §5.1 sufficient and correctly bounded — in particular the
  transient-0 permission in (d) and the acceptance of either
  revision arithmetic (89 or 90) at (c)'s settling polls,
  provided the grant/occurrence/reserved values are exact?
- **Q-4 — Successor arithmetic.** Does Rowan confirm the §2
  reading: the next grant issuable on this job is
  `seg:88:full` (id from job revision 88 at issuance), and
  `seg:87`'s id is unreachable by construction (M-1)? If her
  reading of the issuance transaction differs, the observation
  set must be corrected before any vehicle runs.
- **Q-5 — If V-2: registration disposition.** Leave the
  registration standing under owned observation (disposition
  (i)), or direct the re-stop route (disposition (ii))? And if
  (i): is the daily cadence + QUIET/MOVEMENT classification
  pair, on the tail-watch precedent, the duty she wants?
- **Q-6 — Sequencing of V-3.** Should the harness run's results
  be filed and ruled on **before** the vehicle ruling (as a
  check on §2's source reading), or alongside it?
- **Q-7 — After a discharge.** May the GR-B GO wording —
  re-drafted against the adopted predicates and the selected
  vehicle — then be presented to Julie for her separate resume
  GO decision? (The assessment assumes yes only on Rowan's
  express word; the readiness ruling's item 5 stands until
  then.)

---

## 11. Non-authorizations

This assessment authorizes nothing. It does not authorize the
probe, any wake, any hold lift, any SubmitJob, any grant
mutation, any generation, any deployment, or any Batch
activation; it does not present, and does not ask Julie for, any
GO. Production remains HELD in NORMAL: GENERATION_HALT `"1"`,
queue paused, containment NORMAL, the preserved plan, the
standing grant `seg:87:full`, and the idx-26 exemption exactly
as censused. The next act in this case is Rowan's ruling on
§10's questions.

**Turn: Rowan's** — ruling on the OQ-2 assessment (vehicle,
discharge construction, and §10's questions), via Julie's poke.
On her ruling, the GR-B GO wording is re-drafted accordingly
and presented to Julie for a separate decision. Nothing is
pending or implied in the meantime.
