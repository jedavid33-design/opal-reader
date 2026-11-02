# Phase B — R5a REVISED technical specification (permanent condition + dedupe + stale-age safeguard)

**Status: OFFLINE DESIGN/BUILD/EVIDENCE PACKAGE. NOT APPROVED FOR
DEPLOYMENT.** Prepared under Rowan's R5a revision ruling (board
comment `6584187105`, `jedavid33-design/opal-roundtable` issue #15,
2026-11-02; ruling record saved verbatim at
`ROWAN-R5A-REVISION-RULING.md`). The R5a execution gate is expressly
NOT approved by that ruling. Production remains under INVESTIGATION
HOLD: no deploy, no command, no report, no alarm wake, no SubmitJob,
no hold or queue change, no generation is authorized by this
document.

**Supersedes:** `PHASEB-R5A-DESIGN-SPEC-GATE-PROPOSAL.md` (v1) as the
R5a technical design. The amended alarm-semantics assessment
(`PHASEB-ALARM-SEMANTICS-ASSESSMENT-AMENDED.md`, SHA-256
`40d3f1b45ef58508bd6910905ad07d9d4455a62d802794fb14be5221dd36657d`)
stands as accepted and is not modified by this package.

**Source basis (verified firsthand for this revision).** The current
live build is the instrumented build `86ad06aba6083f7ea84d64b08eac1788d5bf570c`.
Its assembled tree (`p2-gate-execution/build/deploy-tree/`, manifest
`deploy-manifest-stamped.json`, 31 parts) is byte-identical to the
P2 candidate tree. The P2 instrumentation diff touched exactly two
parts (`worker-entry-prod-d6.js`, `v2/generation/service.mjs`); the
coordinator part is unchanged by instrumentation — verified:
`v2/coordinator.mjs` is **byte-identical** (276,256 B, SHA-256
`bca88fe92bfd316c727866f7f69817e290fc8167006d32362577010c2037e20a`)
across `phaseb-attempt3/evidence/parts-e0/`, the P2 candidate tree,
and the live deploy tree. All line citations below are to that part
unless marked *(candidate)*.

---

## §1 — Directive 1: the permanent condition change is the design

Rowan's ruling, decision 1: *"prefer permanent R5a as a technical
design; do not add a durable counter just for this incident."*

The design is therefore a **permanent** change to the coordinator's
alarm-arming condition. A past-due armed value — beyond the §4
safeguard threshold — is treated as unarmed on every future wake, in
every future incident, not only this one. This is a deliberate
semantic repair of a demonstrated gap in the shipped code: nothing
in the shipped system ever reconciles a stale registration (the
assessment's Q4/Q5 findings).

**Considered and rejected: the incident-boxed / durable-counter
variant** (v1 proposal §10, open question 1: disable the past-due
branch after N uses via a durable counter). Rejected per ruling
decision 1: it adds durable state and a new failure surface to serve
a single incident, and it would leave the underlying defect in place
for the next occurrence. It is retained in the record only as
considered-and-rejected; it is not an alternative awaiting selection.

Two consequences of permanence are carried openly:

1. The retry-supersession interaction becomes a permanent property
   of the system, which is precisely why §4's safeguard is part of
   the condition itself rather than a procedural note — and why §6
   carries the ruling's no-permanent-safety-claim limitation.
2. The B3-future behavior (§2) is also permanent: where it fires, a
   stale registration is re-based to the true earliest pending due
   time.

## §2 — Directive 2: B3-future behavior, and the verification of D

### 2.0 A discrepancy in the record — flagged, board text governs

Julie's chat relay of the ruling summarized this point as *"Preserve
the B3 stale-A-to-future-D behavior"* — i.e., the shipped behavior,
in which a future D means no `setAlarm` fires. **The board text of
comment `6584187105` says the opposite**: decision 2 reads *"Accept
accept moving stale past A to actual earliest pending future D,
subject to proof that D is correctly computed."* This specification
follows **the board text** (the board is the record): under revised
R5a, when the armed value is stale-past beyond the §4 threshold, the
registration **is moved** to D, including when D is in the future.
"Confirm the B3-future reading" is carried as unresolved decision
(1) in the Rowan copy-paste for this package; if Rowan rules the
relay reading instead, the change is one disjunct narrower and the
battery's B3 expectation inverts — the candidate would be rebuilt
and re-pinned.

### 2.1 The behavior as designed

- A stale-past beyond threshold, D in the future → exactly one
  `setAlarm(D)`. The future registration was never trustworthy —
  the platform's record of it is the very thing in doubt — so it is
  re-based to the computed true earliest due time.
- A stale-past **inside** the threshold, D in the future → **no**
  registration; shipped behavior (the armed value may be a
  legitimate retry gap, §4). Battery group R5A-T5 asserts both.

### 2.2 Verification of D — PROVEN from source, with named residuals

**Claim verified:** the `due` value computed by both arming paths is
the true earliest pending due time across **all** schedule rows of
**all** kinds at the instant of the query.

Evidence (coordinator part, live build):

- `_armAlarm()` (baseline :2458–2463) and `_armAlarmIfEarlier()`
  (baseline :2480–2488) compute D with the **identical** query:
  `SELECT MIN(due_at) AS due FROM schedule WHERE state = 'pending'`
  — no `kind` filter, no other restriction.
- Exactly one inserter creates schedule rows: `_schedule()`
  (baseline :2448). Every kind flows through it — `watchdog`
  (`wake()`, :2471), `lease` (:1758, :1920, :2565, :2692, :2721),
  `retry_grant` (:1801, :2136, :2632), `handoff_check` (:2582,
  :2660). No kind can exist as a pending row outside this query's
  reach.
- The schedule DDL (baseline :182) is `(id, due_at INTEGER NOT NULL,
  kind TEXT NOT NULL, ref, payload_json, attempts DEFAULT 0, state
  DEFAULT 'pending')`; `MIN()` over the pending set is total by
  construction, and the no-pending-rows case yields `due = NULL`,
  for which both paths fall back to `now + WATCHDOG_PERIOD_MS`
  (600,000, :133).
- No other timer mechanism exists in the coordinator (no
  `setTimeout`/`setInterval` anywhere in the part), so no pending
  work can be invisible to the query.
- The `.one()` divergence does not bite: `MIN()` as an aggregate
  returns exactly one row even over an empty set, so the real-DO
  throw-on-empty behavior of `.one()` (the harness mirrors it) is
  not triggered on this path.

Named residuals (not D defects, but limits of the proof):

1. **Platform retry state is not a schedule row.** A pending
   platform retry has no `due_at` in this table; D cannot account
   for it. That is the §4 supersession problem, handled by the
   threshold, not by D.
2. **D is a snapshot.** Concurrent invocations interleave at awaits;
   a later evaluation can compute a *smaller* D after new work is
   scheduled — which is exactly the corrective case the §3 memo
   permits. No interleaving can make a computed D *later* than the
   true minimum at its own query instant.
3. The proof is about the **computation**, not the platform's
   delivery of the resulting registration (unverifiable offline;
   evidence gap, §8).

## §3 — Directive 3: dedupe within a single wake operation

### 3.1 The defect

`wake()` ends with `_armAlarmIfEarlier()` (baseline :2469–2474), and
each of the three wake paths calls `_armAlarmIfEarlier()` **again**
after applying its work — handleCommand :521/:523, requestGrant
:1806/:1809, handleReport :2064/:2219 (verified: these are the only
`wake()` call sites in the part; no other file in the tree calls
`.wake()`). Under the revised condition, both calls in one operation
can fire `setAlarm` with the identical value — the v1 proposal
disclosed "up to 2 identical writes per wake"; the ruling requires
that eliminated or explicitly bounded.

### 3.2 The mechanism: a per-operation arm memo

Each top-level coordinator operation creates one memo object and
threads it through both calls:

```js
const armMemo = { registered: false, armedAfter: null };
await this.wake(armMemo);
... apply ...
await this._armAlarmIfEarlier(armMemo);
```

`_armAlarmIfEarlier(armMemo)` semantics (candidate :2503):

- If the memo shows this operation already registered
  (`registered: true`), a further registration fires **only** when
  the freshly computed `due` is **strictly earlier** than
  `memo.armedAfter` — i.e., the operation's own apply step scheduled
  genuinely earlier work after the first evaluation. The stale
  disjunct is suppressed for the operation's own fresh registration
  (the value just written is by construction inside any retry gap).
- If the memo shows no registration yet, the full revised condition
  applies (§4); a firing registration records
  `registered`/`armedAfter` in the memo.

Why a threaded memo and not instance state: the coordinator object
is **not** a stable per-operation boundary — `api.mjs` constructs a
fresh `GenerationCoordinator` per request (api.mjs:25, 86, 108, 131,
154, 165), while the DO entry also keeps a long-lived instance
(`worker-entry.js:135`). Instance fields would be wrong in both
directions (lost per-request, or leaked across operations on the
long-lived instance). The memo is explicit, per-operation, in-memory
only, and introduces **no durable writes**.

The unconditional `_armAlarm()` in the base `alarm()`'s `finally` is
not part of a wake operation and is **unchanged**.

### 3.3 The exact bound

- **Normal case: at most 1 `setAlarm` per top-level operation.**
- At most 2 only when the second value is strictly earlier than the
  first (a corrective registration for work the same operation
  scheduled between the two evaluations).
- Battery evidence: R5A-T2 (a full R2-form command on a stale B1
  shape: exactly 1 registration for the whole command, exactly 1
  commands row), R5A-T4 (memo unit scenarios incl. the corrective
  second at a strictly smaller value, and the handleReport replay
  path: exactly 1).

## §4 — Directive 4: retry-supersession safeguard (summary)

Full analysis: `PHASEB-R5A-RETRY-SUPERSESSION.md` (companion
document). Summary of the safeguard as implemented:

The past-due disjunct is **threshold-gated inside the condition**:

```
armed === null || armed === undefined
  || armed <= now - ALARM_STALE_THRESHOLD_MS   // ← the safeguard
  || due < armed
```

with `ALARM_STALE_THRESHOLD_MS = 60 * 60 * 1000` (candidate :144).
Derivation (documented inputs: ≤6 retries, exponential backoff from
2 s; multiplier UNSPECIFIED, doubling assumed): full assumed retry
envelope 2+4+8+16+32+64 = **126 s**; documented failover delay
≤ ~60 s; the threshold is **≥28×** the assumed envelope and **60×**
the failover bound. Inside the threshold, a past-due armed value is
treated exactly as shipped — a possible legitimate retry gap is
never superseded by a wake. In the live incident the armed value is
~20 hours past due (20× the threshold), so the safeguard costs the
intended recovery nothing. The threshold value/margin is Rowan's to
rule (unresolved decision 2).

## §5 — Directive 5: the alarm-mutation budget (enforceable numbers)

Expressed as values a future gate can verify from shipped surfaces
(commands rows, recorder rows, `drive=1` reads):

| scope | bound | mechanism | verification |
|---|---|---|---|
| per wake operation | **≤1** `setAlarm` (≤2 only with a strictly-earlier corrective second value) | §3 memo | harness setAlarm log (battery); in production: bounded per commands row |
| per delivered pass | exactly the shipped behavior — the base `finally`'s one unconditional `_armAlarm()` | unchanged code | recorder rows, one per pass |
| adversarial/replayed wakes, registration undeliverable (D past) | **1 per wake operation** — count = wake count, every value identical (= D), **zero** schedule/state growth | threshold + memo; wakes are externally caused (commands/reports only — no read path wakes) | battery R5A-T7: 10 wakes → exactly 10 registrations, all = D, schedule count unchanged, watchdog count 1, grants 0 |
| after any delivered pass | **0** further 5a registrations until a registration again goes stale beyond the threshold | the pass's `finally` leaves a future armed value; the disjunct goes quiet | battery R5A-T6 tail assertion |
| quiescent system | 0 registrations (no wake occurs — GETs/reads never call `wake()`) | shipped structure | battery R5A-T9 |

**Stated plainly:** there is **no code-level rate bound independent
of wake traffic**, and none can be added without durable state (a
counter or last-registration timestamp row) — which ruling decision
1 declined. The honest bound is therefore: registrations per unit
time ≤ wake operations per unit time, wakes are operator/client
actions (each already an audited commands row or report), and the
churn is value-identical, stateless, and self-terminating on first
delivery. If Rowan judges that insufficient, the cost of a hard rate
bound is exactly the durable-counter design she set aside — that
trade is named here rather than smoothed over.

**Gate-budget reconciliation (ruling, required corrections):** any
future R5a gate's mutation budget must count, separately: 1 upload
(+ ≤1 conditional observability PATCH), the §5 registrations above
as *expected alarm mutations* (not zero — the v1 gate skeleton's
implicit zero was wrong), recorder rows accrued, and the conditional
rollback (1 upload + ≤1 conditional PATCH).

## §6 — Directive 6: no permanent-safety claim

Adopting the ruling's formulation verbatim: **permanent production
safety is NOT claimed until the retry issue is resolved.** This
specification proposes a bounded safeguard and says so; the word
"safe"/"safety" appears in this package's documents only in that
negated or explicitly-bounded sense (self-grep results are reported
in the package's Rowan copy-paste and board summary).

## §7 — The exact change (candidate identity)

One part changes: `v2/coordinator.mjs`. Diff: **+51 / −12**
(coordinator.diff, 5,871 B, SHA-256
`9720c34800eded95b419f089562076cac127f19444a7a4d039c1423a2e2e09aa`).

- Candidate part: 278,396 B, SHA-256
  `d3d9005b9c2f83cd9a47ef7012b7cea5ed21d73886626d6e24bb655ee90389a3`.
- Baseline part (live): 276,256 B, SHA-256
  `bca88fe92bfd316c727866f7f69817e290fc8167006d32362577010c2037e20a`.
- The other 30 parts are byte-identical to the live build's.
- Contents: (i) the `ALARM_STALE_THRESHOLD_MS` constant with its
  design comment (candidate :134–144, constant at :144);
  (ii) the revised `_armAlarmIfEarlier(armMemo)` (candidate :2503) —
  memo branch + threshold-gated disjunct; (iii) `wake(armMemo)`
  pass-through (candidate :2483); (iv) memo creation/threading at
  the three call sites (candidate :532, :1818, :2077).
- `node --check` passes; `patch -p1` round-trip from the pristine
  baseline part reproduces the candidate byte-for-byte (battery
  R5A-T0).
- **No containment code is in this candidate** — the containment
  design (companion document) is independently gated and its flag
  check belongs to the entry part plus coordinator wake gates;
  mixing both changes into one build would conflate two gates.
  Containment is design-only this round.

## §8 — Battery summary and evidence gaps

One complete offline run, both suites against the exact candidate
tree (log: `BATTERY-RUN-LOG.txt`, pinned with this package):

- **R5a battery (new): 23/23 pass.**
- **P2 instrumentation battery (regression): 30/32 pass.** The two
  failures are that suite's T0 *candidate-identity* assertions
  ("29 byte-identical / 2 amended parts" and the P2 combined-diff
  round-trip), which assert the identity of the superseded P2
  candidate; on this tree exactly 3 parts differ from the
  pre-instrumentation basis because the coordinator is intentionally
  revised. R5A-T0 carries the replacement identity assertions
  (passing). All P2 behavioral groups (T1–T10, incl. twin
  equivalence and mode rejection) pass against the revised tree.
- Combined: 53/55, exit code 1 attributable solely to the two
  superseded identity assertions above.

**Evidence gaps (cannot be closed offline):** real platform retry
behavior and timing; real alarm delivery after re-registration;
real-DO SQLite divergences beyond the harness's mirrored `.one()`
semantics; the platform's post-exhaustion registration state;
whether a superseded retry invocation can still arrive;
containment behavior (design-only this round — no code, no tests).

## §9 — What this specification does not authorize

Nothing. It is a design document with offline evidence. Deployment
requires the separately reviewable revised gate (companion document)
to be approved by Rowan **and** a fresh explicit Julie GO naming its
scope — and, per the containment design, containment must be
deployed and verified *before* any stimulus under that gate.
