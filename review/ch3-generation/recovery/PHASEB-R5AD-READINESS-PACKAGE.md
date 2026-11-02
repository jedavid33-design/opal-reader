# Phase B — Gate R5a-D READINESS PACKAGE (composed deployment: containment + R5a)

**Status: READINESS PAPERWORK ONLY. R5a-D is NOT executed
by this package, and no GO is requested by it.** Rowan's
review of this package is not a GO; a production GO for
R5a-D remains a separate future step (Julie's explicit
GO, after Rowan's review — and, per §1.5, after her
ruling on Ruling Item 1). Production is under
INVESTIGATION HOLD and ends HELD. This package
authorizes nothing.

**Assignment:** Rowan's ruling on the C2 correction and
the C3 readiness package (Nov 2, 2026; recorded at
`ROWAN-C3-SEQUENCING-RULING.md`): C2 correction
ACCEPTED; C3 readiness HELD for sequencing — **Ruling 1
= Option (ii): R5a-D must execute and close BEFORE C3**;
do not execute C3 against the containment-only build;
after R5a-D is separately authorized, executed, and
accepted, C3's build and etag expectations are re-based
to the verified composed production build. **Ruling 2:**
the unverifiable remainder (live drive suppression,
genuine concurrent wake suppression, the racing-wake
recheck) remains OPEN; C3's eventual verdict is PARTIAL
regardless. This package is the R5a-D readiness package
that ruling assigns. It retains the structure Rowan
required: existing holds, fresh census, exact candidate
identity, battery requirements, mutation limits,
rollback classification, STOP conditions, ends-HELD.

**Gate structure:** R5a-D is the composed-deployment
scope of the accepted five-scope structure (C1 / C2 /
C3 / R5a-D / S1, plus standalone restoration and the
R3-V micro-scope) in
`PHASEB-RECOVERY-GATES-V4-REVISED.md` (pin
`621535f0456e3d61cc7bcbc2fda04f661dc63e49`), executed in
the order Rowan's sequencing ruling fixes: C1 (CLOSED)
→ C2 (CLOSED, readability verified) → **R5a-D (this
package)** → C3 (readiness held; to be re-based) → S1.
The R5a technical authority is
`PHASEB-R5A-REVISED-SPEC.md` (permanent condition +
per-operation arm memo dedupe + stale-age safeguard;
B3-future accepted per board comment `6584187105` and
confirmed closed in Rowan's containment-correction
ruling). The readiness form mirrors the corrected C1
readiness package (pin
`0e19d37116f6b36da02623a85d66aeb7dfcf7d6d`), whose
rollback classification (C1-1) and runtime-adoption
discipline (C1-2) this package inherits verbatim in
effect. The deploy mechanics follow the proven P2 / C1
pattern: fresh census → fresh assembly → battery
re-run → build pin → ONE upload → read-back
verification → ends HELD.

## 0. What R5a-D is — and is not

**R5a-D deploys code only.** It uploads the composed
candidate (§2) to the production worker
`opalreader-api-v2-prod` as a single script upload and
verifies the **script deployment** with passive reads.
It ends with:

- containment **INERT at NORMAL** — no transition is
  performed in this gate (budget 0, §5); the deployed
  containment state is exactly the state C1 deployed
  and C2 verified readable;
- the **R5a arming semantics deployed** in the
  coordinator part — the subject of §1, whose
  operational consequence is analyzed there in full
  and is the subject of Ruling Item 1;
- the system **HELD**: GENERATION_HALT `"1"`, queue
  `opalreader-generation-v2` delivery paused, the
  Generate button NOT live;
- the preserved Phase B plan, the idx-26 exemption,
  the parked job, and every other production fact
  exactly as at census — including the existing stale
  alarm registration, left exactly as read.

**R5a-D is not:** a containment transition of any kind;
C3 operational verification; an alarm interaction, a
wake, a command, a report, or a SubmitJob **by the
executor**; a hold flip or a queue change; any
generation; a stimulus. The executor provokes no wake
and sends nothing that could wake (§1.2 enumerates what
can). R5a-D does not touch the preserved plan
`plan:19cad189fab54b9c804a74a6` or the live idx-26
exemption in any way. What deploying the R5a
*semantics* means for wakes that arrive later, from
other sources, is not waived by this paragraph — it is
§1, and it is the reason this package carries a ruling
item.

## 1. The deployed semantic and the first-wake consequence

### 1.1 What the R5a change does, precisely

One part changes (§2): `v2/coordinator.mjs`. Per the
revised spec (`PHASEB-R5A-REVISED-SPEC.md` §§1–5), as
carried in the composed tree:

- The arming condition in `_armAlarmIfEarlier()` gains
  a **past-due disjunct**: an armed value is treated as
  unarmed when `armed <= now - ALARM_STALE_THRESHOLD_MS`,
  with `ALARM_STALE_THRESHOLD_MS = 3,600,000` ms
  (1 hour — a **provisional** candidate value, never a
  proven upper bound on platform retries; spec §4).
  Inside the threshold, shipped behavior is unchanged:
  a past-due armed value may be a legitimate retry gap
  and is never superseded.
- When the disjunct fires, registration **moves to D** —
  the earliest pending due time, computed by the
  identical `SELECT MIN(due_at) FROM schedule WHERE
  state = 'pending'` query in both arming paths. The
  computation of D is **PROVEN from source** (spec
  §2.2: one inserter for all schedule kinds, no kind
  filter, aggregate total over the pending set), with
  two named residuals: platform retry state is not a
  schedule row, and D is a query-instant snapshot.
  **B3-future is accepted behavior**: if D is in the
  future, registration re-bases to the future D.
- A **per-operation arm memo** dedupes registrations
  within a single wake operation: at most **1**
  `setAlarm` per top-level operation, at most 2 only
  when the second value is strictly earlier (work the
  same operation scheduled between evaluations). The
  memo is in-memory, per-operation, never persisted.
- The change is **permanent semantics**, not an
  incident-boxed repair (ruling decision 1 in the R5a
  revision ruling): every future wake, in every future
  incident, evaluates the revised condition.
- In the composed tree the containment arm gate
  precedes the memo logic: a containment-suppressed
  evaluation is not a registration and never touches
  the memo. At NORMAL (the only state this gate leaves
  deployed) the gate does not suppress.

**Deployment itself performs no alarm action.** A
script upload invokes no DO method and calls no alarm
API; both prior deploys in this program (P2, C1) left
`armedAt` bit-identical, observed. Deploying R5a-D
does not register, delete, or deliver any alarm. What
it changes is what the **next wake** will do when one
arrives. That is the consequence the rest of this
section analyzes.

### 1.2 What can wake the coordinator (source-enumerated)

In the deployed source (verified firsthand in the C1
deploy tree, byte-identical to the composed tree
outside the coordinator part), `wake()` has exactly
three call sites, all in `v2/coordinator.mjs`:
`handleCommand` (after its record step begins),
`requestGrant`, and `handleReport`. The paths that
reach them:

**Reaches a wake:**

1. **`POST /v2/commands` with a fresh, well-formed
   command of a known type.** `handleCommand` returns
   before `wake()` for a malformed command (missing
   `command_id`, unknown type) and for a **replayed**
   command (an existing receipt or pending record is
   answered from the store and never re-executed).
   Every other command — including one whose apply step
   will refuse it (e.g., a generation command refused
   under GENERATION_HALT) — passes `wake()` **before**
   apply. Freshness, not success, is what wakes.
2. **`POST /v2/sync/position`** — the Reader client's
   listening-position sync. The API layer constructs a
   fresh `PushPositionEvents` command (fresh
   client-generated `commandId` per push) and calls
   `handleCommand` with it (verified in
   `v2/api.mjs`). **This is ordinary app use**: a
   listening session on Julie's iPhone/iPad that syncs
   progress sends these.
3. **`POST /v2/reports`** — executor reports reach
   `handleReport`, which wakes before its transaction.
   Reports originate in the generation execution path,
   which runs only from queue deliveries.
4. **`requestGrant`** — internal to job execution and
   the alarm path's own `retry_grant` processing; not
   an external surface.

**Never wakes:**

- Every GET / read surface (sync pulls, playback,
  diagnostics, eligibility, `/health`, the containment
  reads): no read path calls `wake()` — the assessment's
  standing finding, re-verified in the current source.
- Migration commands (`MigrateImportBindings`,
  `MigrateImportChunk`): the API layer routes them to
  `submitMigrationCommand` (inert Option D submission)
  and they never reach `handleCommand`.
- Replayed or malformed commands (above).
- A script deploy (this gate), a settings PATCH, a
  queue operation: none is a wake.

### 1.3 Which wake-capable traffic is expected while HELD

This is the load-bearing question for this gate, and
the answer is **not** "none":

- **Position sync (item 2) is expected in ordinary
  use.** Julie listens with the Reader app; position
  pushes are part of listening. No hold suppresses
  them — GENERATION_HALT fences generation, not sync.
  A wake from this source can arrive at any time after
  the deploy, on Julie's ordinary schedule, with no
  operator involvement and no warning.
- **Client commands (item 1)** — a Generate tap
  (apply refuses under the halt; the wake precedes the
  refusal), a client settings change (`SetSettings`) —
  are possible in ordinary use, less routine than
  position sync.
- **Reports (item 3)** are **not** expected while HELD:
  the queue is paused, so no executor runs and nothing
  reports. `requestGrant` (item 4) is likewise
  unreachable without execution.
- **Operator commands** occur only inside authorized
  gates; none is outstanding (census item 16).

**Consequence:** the gates-v4 scope text for this gate
says the R5a semantics end the gate "live but
unexercised: no wake is provoked" — true of the
**executor**, and this package preserves it as an
executor discipline. As a prediction about the
**system**, it does not hold: the deployed semantic
arms every future wake, and at least one wake source
(position sync) is ordinary, expected traffic. The
first wake after R5a-D is therefore not a remote
hypothetical to note and file; it is an expected event
on an uncontrolled schedule. §1.4 analyzes it; §1.5
puts its scope ownership to Rowan as a ruling item.

### 1.4 The first wake after R5a-D, step by step

State at any first wake, per the census baselines
(§4 items 9, 14): the preserved plan is the only
selectable plan; `armedAt` = **1793562576104**
(2026-11-01T19:49:36.104Z) — past due by ~26 hours at
the Nov 2, 2026 observations and growing; the stale
age exceeds the 3,600,000 ms threshold by more than
an order of magnitude, so **the threshold provides no
protection in this incident** (its purpose is retry
gaps; this registration is not one). Pending schedule
rows: 2 (1 watchdog). Containment: NORMAL (arm gate
open).

1. A wake arrives (§1.3: most plausibly a position
   push). The containment arm gate does not suppress
   (NORMAL). The condition evaluates: armed is
   past-due beyond threshold → the disjunct fires →
   **exactly one `setAlarm(D)`** (memo; a position
   push schedules no earlier work, so the corrective
   second registration does not arise; a command that
   does schedule earlier work could produce the
   bounded second).
2. **D's value is unobservable before this moment** —
   no shipped surface reads schedule rows (register
   R-11). The branches are those of the accepted
   alarm-semantics assessment, at its strengths:
   **B1 (D = A)** is the leading, source-invariant
   explanation (every `setAlarm` set the armed value
   to the then-earliest due; pending rows are removed
   only by alarm processing) — leading, **not proven**;
   B2 (D < A) and B3 (D > A, D future) remain open.
   The wake converts D from unobservable to observed:
   a post-wake read of `armedAt` returns the registered
   value.
3. **Under B1/B2 (D in the past):** platform behavior
   for a registration set to a past time is prompt
   asynchronous delivery (documented; the assessment's
   Q1). An alarm pass then runs the shipped path —
   schedule processing, `recover()`, `driveOnce()` —
   and the P2 recorder writes a row for it (the
   recorder is live). `driveOnce` under the holds:
   grant **issuance is not halt-fenced** (delivery is),
   and the resulting state set is exactly the
   pre-classified §7.3 set proven at the P2 gate:
   grants [] → [the one issued grant
   `grant:plan:19cad189fab54b9c804a74a6:seg:1:full`],
   occurrence `pending` → `granted`, job `queued`
   rev 1 → `generating` rev 2, derived reserved
   0 → 12 — and nothing else: **delivery stays
   halt-fenced and the queue stays paused, so
   dispatched stays 0, no attempt runs, spend stays
   $0, and all five phase figures stay frozen** (grant
   issuance touches none of them — proven in the P2
   §7.3 verification, not re-asserted from memory).
   The pass's `finally` re-arms the watchdog — **the
   chain is revived**: passes recur on the ~10-minute
   watchdog cadence, the grant lease expires and the
   grant/void cycle churns on its ~15-minute cadence
   within the §7.3 invariants (≤1 live grant; reserved
   ∈ {0, 12}; dispatched 0), recorder rows accrue
   toward the 288-row cap, and this continues
   **indefinitely** — the revived chain never
   self-terminates — until C3's stop act (a later
   gate) or another separately authorized disposition.
   Containment at NORMAL does not suppress any of it;
   NORMAL is the open state by design.
4. **Under B3 (D in the future):** no immediate pass.
   Registration re-bases to the future D; the chain
   revives when D arrives, and the watchdog
   self-perpetuates from there, with the same §7.3
   churn thereafter.
5. **Detection:** nothing reads on a schedule. The
   first evidence of a fired wake would be incidental
   — a changed `armedAt`, a recorder row, or a §7.3
   transition noticed on some later read (register
   R-02's detection bound: the next successful dual
   read that actually occurs). There is no alerting.

**In substance, the first wake is S1's stimulus
outcome — revival of the alarm chain into the bounded
§7.3 churn — arriving unplanned:** without S1's
preflight census, its observation window, its
trigger-evidence standard, or the S1-X companion
containment authorization standing ready. What bounds
it is real but narrow: the holds bound spend and
delivery to zero, and the §7.3 set bounds the state
churn. What does not bound it: duration, timing, or
detection.

### 1.5 Ruling Item 1 — whose scope owns the first wake

The package is ready for review. Whether it is ready
for a GO depends on a question this package does not
answer for Rowan:

- **(i) Inside R5a-D's scope.** The first-wake
  consequence is pre-classified (§1.4), bounded by the
  holds and the §7.3 set, and accepted as part of the
  deploy decision; the GO wording (§11) names it, so
  Julie's acceptance is informed, and S1 follows as
  the planned observation of an already-revived (or
  not-yet-revived) chain.
- **(ii) Inside S1's scope.** Deploying the semantic
  *is* arming the stimulus; R5a-D does not execute
  until the stimulus itself is authorized and ready
  (S1 readiness + GO, or a paired R5a-D → S1 sequence
  under one plan), so the revival — whenever the wake
  lands — is the planned, observed event S1 exists to
  make it.
- **(iii) Inside R5a-D's scope only with an added
  control** — e.g., an app-use restraint interval
  between R5a-D and S1. Named for completeness; it is
  a human-factor control over an unbounded interval,
  and client position events queued offline may flush
  later, so restraint delays rather than removes the
  wake.

**Wren's recommendation (Wren's, not Rowan's):**
option (ii)'s discipline — do not request Julie's GO
on this package until Rowan rules the item; if she
rules (i), the §11 GO text already names the
consequence in terms Julie can accept or refuse with
full information. Wren recommends against (iii) as a
sole control. This recommendation decides nothing;
the item is Rowan's.

## 2. Exact candidate identity (two bases, stated precisely)

The candidate is the **composed V4 tree**
(`containment-v4/composed-tree/`): containment v4 +
the R5a revised change. All identities below were
re-computed firsthand from the trees during this
package's preparation (Nov 2, 2026) and match
`containment-v4/CANDIDATE-IDENTITIES.md` and
`CANDIDATE-IDENTITIES-REVISED.md`.

### 2.1 Against the CURRENT live build (the operative basis)

Current live: the C1 build, stamp
`27b2b3a9f1e7070ef243ee017703246744d57d5c`, script etag
`adb8e5a5b104858a20835a17ffd714a70f72cea5e066c6d61c4b80a49adac46f`
(C1 gate D2 read-back; etag re-read fresh at any
R5a-D census). The C1 deploy tree
(`c1-gate-execution/build/deploy-tree/`) was verified
byte-identical to the containment candidate tree
except for the stamped `v2/host/build-identity.mjs` —
so the live coordinator part **is** the containment
candidate coordinator, and the delta below is exact.

**Unstamped composed candidate vs current live:
exactly ONE part differs in code** —
`v2/coordinator.mjs`:

| part | bytes | SHA-256 (composed candidate) | SHA-256 (live) | diff vs live |
|---|---|---|---|---|
| `v2/coordinator.mjs` | 314,712 | `5303cb6323da01c21a5ebe9a7983f87abe08e14945660daaebce99734849e1ed` | `6c19a50e88d8bc00d357f7a5facf33ed8425b53daa20e8d700037f9fd121b2f2` (313,063 B) | **+66/−36** |

- The delta is the R5a change as applied on the
  containment base: the `ALARM_STALE_THRESHOLD_MS`
  constant block, the memo threading at the three wake
  call sites and `wake()` itself, and the
  `_armAlarmIfEarlier()` rewrite (in which the
  containment arm gate precedes the memo logic). It is
  **not** the +51/−12 figure of the R5a revised spec —
  that figure was measured against the pre-containment
  baseline coordinator, where the function the change
  rewrites was shorter. Both figures are correct
  against their stated bases; this package's operative
  figure is **+66/−36**.
- Stored unified diff:
  `containment-v4/coordinator-composed-vs-containment.diff`
  (8,975 B, SHA-256
  `8c8b96fd851054d7167f6a91f93449274cb3eeab499c3cf051ce632e7ba2af25`).
  Round-trip verified during this package's
  preparation: `patch -p1` applied to the containment
  candidate coordinator reproduces the composed
  coordinator byte-for-byte (`5303cb63…`). 
- `v2/worker-entry-prod-d6.js` (136,357 B,
  `2bb0608b…`) and `v2/generation/service.mjs`
  (91,500 B, `5c5183e6…`) are **byte-identical** in
  live, containment candidate, and composed trees.
- The remaining 28 parts are byte-identical between
  live and composed, including
  `v2/host/build-identity.mjs` **except in its stamp
  value**: live stamps `27b2b3a9…`; the unstamped
  composed scratch tree stamps `86ad06ab…` (inherited
  from its pre-C1 basis). As a file, the identity part
  therefore differs between the scratch composed tree
  and live; at gate time it is re-stamped with the new
  build pin (§3), so this is the expected stamp
  difference, not a code difference.
- **Deployed-tree delta at gate time (§3): exactly 2
  parts differ from current live** — the coordinator
  (above) + the re-stamped identity part; **29 of 31
  parts byte-identical to live.**

### 2.2 Against the pre-C1 instrumented build (the lineage basis)

For the archive's lineage: unstamped composed vs the
P2 instrumented build `86ad06ab…` (etag
`ba80e81fc301b3ff001e8ebf4eab11189221d21471261729c28e509a7ce0d7af`)
differs in exactly **3 parts** — coordinator
`5303cb63…` (**+795/−12** vs `bca88fe9…`, 276,256 B),
entry `2bb0608b…` (+175/−3), service `5c5183e6…`
(+73/−2) — the containment delta plus the R5a delta,
with stored diffs `composed-coordinator.diff`,
`entry.diff`, `service.diff` in `containment-v4/`
(round-trips verified in the V4 package). The full
31-part live manifest is the C1 closing manifest
(`c1-gate-execution/build/deploy-manifest-stamped.json`);
it is not re-printed here because §2.1's one-part
delta against the verified live tree is the operative
identity, and the census (§4 item 2) re-verifies all
31 parts against that manifest at execution time.

## 3. Gate-time assembly, build pin, and stamp (C1 pattern)

A R5a-D execution assembles its upload tree fresh,
exactly as C1 did (its §1.3):

1. **Fresh assembly.** All 31 parts are downloaded
   from the live script at census and verified
   byte-for-byte against the C1 closing stamped
   manifest. The one stored diff (§2.1) is applied
   (`patch -p1`) to the coordinator part. The executor
   asserts: exactly 1 part differs from the downloaded
   live parts, hashing exactly to `5303cb63…`; the
   other 30 byte-identical (identity part still
   carrying the live `27b2b3a9…` stamp at this stage);
   part count 31; `node --check` clean on the changed
   part.
2. **Battery re-run** on the gate-assembled tree (§8)
   — complete runs, logs + exit codes captured.
3. **Build pin.** The unstamped assembled manifest +
   the battery re-run logs are pinned as ONE commit on
   `ui1-review` (repo `jedavid33-design/opal-reader`).
   Per the standing build-marker convention, that pin
   becomes the deployed build stamp.
4. **Stamp.** `v2/host/build-identity.mjs`'s
   `BUILD_COMMIT` is replaced with the build pin (same
   40-character length; the part stays 411 B). The
   deployed tree therefore differs from live in exactly
   **2 parts** (§2.1). The full stamped manifest is
   computed and recorded before upload; `/health`'s
   build stamp == the build pin is verification item
   V1 (§7).
5. **Envelope.** Upload metadata is read fresh from
   the live `/settings` surface at build time and
   carried forward unchanged: all 10 bindings, existing
   secrets as `{"type":"inherit"}`,
   `compatibility_date` `2026-08-29` + `nodejs_compat`,
   `main_module` `v2/worker-entry-prod-d6.js`,
   GENERATION_HALT `"1"` (no setting flipped). The
   multipart envelope is round-trip parsed and verified
   byte-identical (31 parts + metadata) before upload.
   Any metadata drift vs the live read beyond the two
   documented GET-projection artifacts (the DO
   binding's `namespace_id` projection; secrets
   projected as `secret_text` where uploads carry
   `inherit`) is a STOP (§9).
6. **Rollback basis preserved.** The census-downloaded
   live parts (the C1 build, §2.1) are preserved
   byte-identical as the rollback upload source (§5).
   The permanent rollback floor (`6a73d962…`) is NOT a
   rollback target for this gate and remains untouched.
   **Rollback scope note:** a rollback to the C1 build
   removes the R5a semantic only — containment code
   remains deployed (it is C1's state, not this gate's
   to remove) — and it does **not** touch any alarm
   registration: if a wake has already fired
   `setAlarm(D)` before a rollback, the registration
   persists, and a revived chain self-perpetuates under
   the base `finally` re-arm on any build. **Rollback
   is not a remedy for a fired wake** (§1.4); it
   answers deployment defects only (§5.1).

## 4. Fresh preflight census (hard expectations)

A R5a-D execution begins with a fresh census. **Every
value below is a hard expectation to be re-read fresh
at execution time — never a presumed current fact.**
Values are those observed on Nov 2, 2026 at the C1
closing capture and the C2 closing set, labeled with
that date per the R6 evidence discipline. Any
deviation on any item = **STOP before upload**; the
executor's own tracing never clears its own stop, and
no deviation is self-cleared or retried inside the
same GO.

Items mirror the C1 census, re-based to the composed
build's predecessor (the C1 build). Item 7 enumerates
**both phase-accounting surfaces by name** — the C2
record correction (Rowan-accepted) made that a
standing requirement: a census item naming two
surfaces must enumerate reads covering both.

1. **Health** — build
   `27b2b3a9f1e7070ef243ee017703246744d57d5c`;
   generation `halted`; coordinator `armed`.
2. **Script** — etag
   `adb8e5a5b104858a20835a17ffd714a70f72cea5e066c6d61c4b80a49adac46f`;
   **31/31 parts byte-identical** to the C1 closing
   stamped manifest — which includes the coordinator
   part at `6c19a50e…` (containment-only; the R5a
   change **absent** — its presence at census would
   mean the deploy already happened or the basis
   moved); observability enabled, `logs.persist: true`.
3. **Bindings / settings surface** — exactly **10**
   bindings; GENERATION_HALT `"1"`;
   `OPALREADER_PHASE_POLICY` `"enforce"`.
4. **Settings** — revision **1** (lane standard,
   cap $50).
5. **Queue** `opalreader-generation-v2` (id
   `93b6a35fb8cf4788a91a2c90b748ae66`) —
   `delivery_paused: true`; exactly **1** consumer
   (`f260f2188d80426bb0588685e9d084eb`). (The queue
   state cannot be read by the Worker; cf-api read-back
   is the proof, as at every prior census.)
6. **Capabilities** — standard admitted; Batch
   `batch_not_armed` (`d6StandardOnly`); phase registry
   binds `forever-pucked` ↔ bookId
   `5c589095-f812-48a2-8ab2-03ba2791f2b2`.
7. **Phase accounting, exact on BOTH surfaces, each
   enumerated:** (a) the capabilities phase block
   (`GET /v2/generation/capabilities`); (b) the plan
   diagnostics body
   (`GET /v2/d6-diagnostics?planId=plan:19cad189fab54b9c804a74a6`,
   `plan.phaseAccounting`). Both must read: settled
   **1,029,420**; estimatedUnverified **19,018**;
   reservedUnverified **5,648**; inFlightUpper **0**;
   unknownOpen **0**; remaining **12,464,932** of
   13,500,000; `unverifiedStatus: provider_unverified`.
8. **Quota** — reconcile `ok: true`, drift empty,
   totals stable across pages; sole exception the known
   adjudicated straddler
   `att-37d63768-db4b-447d-8150-580b7c6ee257`
   (`estimated_unverified`, never dispositionable). PT
   dispatched totals (PT day rolls 07:00Z): 2026-10-29
   = **57**, 2026-10-30 = **79**, 2026-10-31 = **44**,
   2026-11-01 = **76**, 2026-11-02 = **0** (observed
   Nov 2, 2026); **no dispatches on any PT day after
   2026-11-01** — if the gate runs on a later day, that
   day must read 0 and every intervening day 0.
   Derived reserved **0**.
9. **Plans — exactly 5:** smoke
   `plan:3183ecbf2ac4bf50bbc6166e` `complete`; old Ch 2
   `plan:603ab416bd67ab1b25de97be` `retired`; fresh
   Ch 2 `plan:b2dc2a3d1cd367a0245b9102` `complete`;
   Ch 3 `plan:e377a5559961b294154276b6` `complete`;
   **preserved Phase B plan
   `plan:19cad189fab54b9c804a74a6` `active`**, totals
   {eligible 1, done 0, failed 0, blocked 0, prompts
   0}, single entry (FP chapterIndex 2, idx 26,
   occurrenceId
   `2a85f74f-353d-4c25-a86a-4a4db392868b`, 569 chars)
   `pending` / `executionState: null`; its job
   `plan:19cad189fab54b9c804a74a6:seg` `queued` rev 1,
   quarantine `held: false`, **grants []**. No other
   non-terminal plan; no live grant.
10. **Eligibility** — chapter bound **26** / parked
    **0** / eligible **1**; segment eligible **1** /
    **569** chars / **8,022** units; the chapter,
    segment, and book scopes' digests mutually
    consistent at
    `cdef2c7ec7bb8434b4e2fac66af49983ac7fa4b4e65bb0eda40354be51ff52d1`
    (the post-exemption digest standing since Phase B
    attempt 3).
11. **Conflicts** — exact-match to the pinned four-row
    `schedule_dead` lease baseline: id 1 @
    2026-10-29T23:54:14.808Z (`grant:plan:3183ecbf…:seg:1:full`);
    id 2 @ 2026-10-30T00:24:14.632Z
    (`grant:plan:603ab416…:ch1:1:full`); id 3 @
    2026-10-31T05:14:24.089Z (`grant:plan:b2dc2a3d…:ch1:1:full`);
    id 4 @ 2026-11-01T01:04:30.364Z
    (`grant:plan:e377a555…:ch2:1:full`); all cache_key
    `lease`, expected `7`, found `LIKE or GLOB pattern
    too complex: SQLITE_ERROR`, reason `schedule_dead`.
12. **Parked job** —
    `1832c21fcf0425454227c4736048a8a632f422abca4a2685ddb775bb1681406a`
    `parked_policy` rev 1, definition fingerprint
    `b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`
    exact, grants [].
13. **Watermarks + occupancy** — content **18**;
    bindings **1841**, **0** binding rows for the
    idx-26 occurrence, **0** changes since seq 1841;
    the idx-26 R2 key
    (`audio/07d145f7b87b9621497d3b8a2c5828141592b94425fd5696fffedde9957d9590`)
    **FREE** (LIST empty).
14. **`drive=1` recorder + alarm baseline** (C2
    closing set, Nov 2, 2026, identical across all
    three C2 sets): `tableState: "missing"`,
    `drivePasses: []`, `recorderHealth: null`;
    `armedAt` **1793562576104** =
    2026-11-01T19:49:36.104Z, `pendingSchedule` **2**,
    `pendingWatchdog` **1**. Hard expectations: the
    recorder fields exact; **`armedAt` bit-identical**
    — an `armedAt` that already differs at census
    means a wake or a pass has already occurred under
    the CURRENT build (whose condition cannot
    re-register a stale value — so a difference means
    something else moved first) = STOP and classify
    before anything else.
15. **Containment projection, both surfaces** —
    `GET /v2/d6-containment` and the `drive=1`
    diagnostics containment block both read: state
    **NORMAL**, `absent: true`, `verified: true`,
    `stopConfidence: "not_applicable"`, the v4
    stop-record and episode fields at their empty
    values (null / 0 / false) — the C2-verified
    readability baseline. Any other value = STOP.
16. **No work in flight** — no gate executing, no GO
    outstanding or partially consumed, no operator
    action pending; the executor records the GO
    (§11) on the board BEFORE the census begins, as at
    prior gates.

## 5. Mutation bounds, rollback, and classification

| Write class | Bound | Notes |
|---|---|---|
| Forward worker script uploads | **exactly 1** | 31 parts, byte-identical to the stamped manifest (§3) |
| Observability PATCH after forward upload | **≤1, conditional** | ONLY if the post-upload read shows observability reset (§6) |
| Rollback uploads | **≤1, conditional** | ONLY for a **class A** confirmed deployment defect (§5.1), after the §5.2 safety conditions verify; the byte-identical preserved C1-build parts (§3 item 6). **Class B findings never fire a rollback inside this gate** |
| Observability PATCH after rollback | **≤1, conditional** | Same condition, after a class A rollback upload |
| Containment transitions | **0** | No `contain_drive`, no `stop_chain`, no `clear`, no `verify_chain_stop` |
| Commands / reports / SubmitJob **by the executor** | **0** | The executor sends nothing that wakes (§1.2) |
| Hold flips / settings flips / queue changes | **0** | GENERATION_HALT stays `"1"`; queue stays paused |
| Alarm registrations caused by this gate | **0 expected** | A deploy is not a wake (the P2 and C1 deploys left `armedAt` bit-identical, observed); any `armedAt` change is a finding to classify (trigger T6), not a budget item. **Post-gate** registrations by later wakes are §1.4's subject and Ruling Item 1's — they are not caused by the executor and are not counted here, but they are not invisible either: they are the named consequence the GO must own (§11) if Rowan rules (i) |
| Recorder rows caused by this gate | **0 expected** | The recorder writes only from the alarm handler |
| Spend | **$0** | No dispatch is possible under the holds; dispatched must remain 0 (§7, V7) |

**Rollback triggers (named). Every trigger STOPs the
gate. What follows the STOP is decided by the trigger's
class (§5.1) — no trigger causes a rollback
automatically.**

- **T1** — post-upload read-back parts not
  byte-identical to the stamped manifest. **[Class A]**
- **T2** — `/health` build stamp ≠ the build pin, or
  generation not `halted`, or coordinator not `armed`.
  **[Class A]**
- **T3** — settings/bindings regression: settings
  revision ≠ 1, bindings ≠ 10, GENERATION_HALT ≠ `"1"`,
  phase policy ≠ `enforce`, or observability not
  restorable within the §6 budget. **[Class A]**
- **T4** — containment surface misbehavior: the state
  route or the `drive=1` containment projection errors,
  reports any state other than NORMAL, reports
  `verified: false` against an absent store, or
  `stopConfidence` ≠ `"not_applicable"` at rest.
  **[Class A]**
- **T5** — any §7 preservation item fails: a change vs
  census in the preserved plan, its job, the exemption
  projection, the parked job, the conflicts baseline,
  any phase figure, quota, or the watermarks that is
  not fully explained by the deploy itself (the deploy
  explains ONLY the script etag, the build stamp, and
  the coordinator part changing). **[Class B]** — with
  the §1.4 refinement: a preservation change that is
  exactly a §7.3-set transition (grant issued,
  occurrence `granted`, job `generating`, reserved 12)
  is evidence a **wake fired the deployed semantic**;
  it is still class B for response purposes (the deploy
  did not mechanically perform it; a wake did), and
  its disposition follows Ruling Item 1 (§5.1).
- **T6** — `armedAt` changed across the upload, or at
  any verification window (alarm-registration movement
  the executor did not cause). **[Class B]** — the
  §1.4 refinement applies as for T5: under this build
  an `armedAt` change is the signature of a wake
  evaluating the new condition; it is reported with
  its source evidence (commands rows, recorder rows)
  and follows Ruling Item 1.

### 5.1 Finding classification and permitted responses

Inherited from the corrected C1 package (§3.1 there),
unchanged in effect:

- **Class A — CONFIRMED DEPLOYMENT DEFECT.** The
  evidence ties the finding to the uploaded code or to
  the upload itself: the finding sits on a surface the
  uploaded script owns (script parts / etag, the build
  stamp, the settings/bindings projection, the
  containment surfaces); OR an error reproduces on the
  new build that the §4 census showed absent on the
  old build; OR a post-upload read-back mismatches the
  stamped manifest. T1–T4 are class A by construction.
  **Permitted response:** rollback inside this gate's
  §5 budget — at most one rollback upload plus at most
  one conditional observability PATCH — once **every**
  §5.2 safety condition is verified. Nothing else
  beyond the rollback sequence and HOLD is authorized.
- **Class B — EXTERNAL OR CAUSALLY UNRESOLVED
  MOVEMENT.** Movement with no established causal link
  to the deploy's mechanics: movement in surfaces a
  script upload cannot mechanically cause (T5), alarm
  movement a deploy cannot mechanically perform (T6),
  and ANY finding whose cause is undetermined after
  the evidence is captured. **Permitted response —
  the only one authorized: STOP, HOLD, preserve the
  evidence exactly as read, and escalate to Rowan and
  Julie.** A rollback for a class B finding is **NOT**
  inside this gate's budget and **NOT** authorized by
  this gate's GO; it requires a separate Rowan ruling
  and a separate Julie GO.
- **Doubt resolves to class B.** A finding is class A
  only when the executor can affirmatively tie it to
  the uploaded code with qualifying evidence. The
  executor's own tracing never promotes a finding to
  class A.
- **Ruling Item 1 refinement (T5/T6 wake signature).**
  §1.4 establishes that the deployed semantic makes a
  wake-caused §7.3 transition a *foreseen* possibility,
  neither a deployment defect nor unexplained in the
  ordinary sense. How such a finding is dispositioned
  inside an executing gate depends on Rowan's ruling:
  under ruling **(i)**, the transition is the
  pre-classified accepted consequence — the gate STOPs
  its remaining steps, records the transition and its
  source evidence in full, ends HELD, and the finding
  is reported as the named consequence having occurred
  (not as a defect, not as a surprise); under ruling
  **(ii)** or **(iii)**, or absent a ruling, the same
  finding is class B in full: HOLD, preserve evidence,
  escalate, and the gate's outcome is for Rowan to
  classify. In no branch does the gate roll back,
  transition containment, or otherwise respond beyond
  STOP + record + HOLD.

### 5.2 When a rollback is safe (class A only)

A class A rollback upload may fire only when ALL of
the following are verified from fresh reads first:

1. **Ends HELD verified** — GENERATION_HALT `"1"` and
   queue `delivery_paused: true` on fresh read-backs.
2. **Nothing in flight to strand** — the §7 V7
   no-movement set at its census values (no live grant,
   no dispatch, no command or generation in progress),
   and no containment transition performed (none can
   occur in this gate — budget 0). **If a wake has
   fired and a grant is live (the §1.4 set), this
   condition FAILS by construction**: the gate is then
   in the §5.1 wake-signature branch, not in rollback
   evaluation, until Rowan rules.
3. **Rollback target verified** — the preserved
   C1-build parts (§3 item 6) re-hash byte-identical
   to the C1 closing stamped manifest immediately
   before the rollback upload.
4. **Evidence captured first** — the failing reads, the
   upload response, and the D2 read-back are recorded
   before the rollback upload is sent; rollback never
   erases the record of the defect it answers.
5. **No class B finding open** — if any unexplained or
   wake-signature movement is under classification, the
   gate is in a class B HOLD and no class A rollback
   proceeds until Rowan rules on the class B finding.

If any condition cannot be verified, the rollback does
not fire: the gate stays STOPPED and HELD and the
finding is escalated — the safety conditions are part
of the permission, not a formality after it.

**Rollback shape and limits (class A only, §5.1/§5.2).**
Rollback = ONE upload of the preserved byte-identical
C1-build parts (build `27b2b3a9…`) + D2-style read-back
+ ≤1 conditional observability PATCH, then the §7
verification set re-run against the restored build.
Rollback removes the R5a semantic from the deployed
script; containment code remains (C1's state). It
cannot un-create containment tables (none are created
in this gate), un-register an alarm a wake has already
re-registered (§3 item 6), un-issue a grant, or stop a
revived chain. If rollback itself fails or its
read-back mismatches, the executor STOPs, holds, and
reports — no second rollback attempt inside the same
GO. **Any rollback after the gate closes needs its own
authorization.** Ends HELD in every path, including
the rollback path.

## 6. Observability checks

Standing deploy law (every Worker code upload): an
upload can silently reset script-settings observability
to null; it must be checked and, if reset, re-applied —
and the settings PATCH must not touch code.

- **Pre-upload:** census item 2 records observability
  enabled + `logs.persist: true` from the
  script-settings read.
- **Post-upload:** the D2 read-back re-reads
  script-settings. Precedent: observability SURVIVED
  the range-fix, P2, and C1 uploads (PATCH unspent
  every time) — survival is the expectation, not an
  assumption.
- **If reset:** re-apply via a multipart PATCH to
  `/workers/scripts/{name}/settings` — the settings
  WRITE path (the GET path `/script-settings` accepts
  no PATCH) — with a single part named `settings`
  (Content-Type application/json) carrying ONLY the
  observability object (enabled + logs persisted).
  Then verify: observability enabled + persisted on
  re-read, AND the script etag unchanged by the PATCH.
  The PATCH counts against the §5 budget (≤1 per
  upload leg).
- **If observability cannot be restored within
  budget:** STOP; trigger T3 is class A, so rollback
  evaluation proceeds under §5.1/§5.2.

## 7. Post-deploy verification (read-only)

All verification is passive reads (no read wakes —
§1.2). Two observation windows, mirroring the C1
gate's practice: an immediate post-deploy set and a
second set after a platform-slack interval (C1 used
≈ +10 min and ≈ +25 min); preservation must pass at
both.

**What this section proves — and what it does not
(C1-2 discipline, inherited).** These checks establish
**script deployment verification**: the uploaded
script's parts match the stamped manifest
byte-for-byte, `/health` reports the build pin, and
the read surfaces exercised below answer on the new
build where observed. They do **NOT** establish
**Durable Object runtime adoption**: existing DO
instances adopt new code on their own lifecycle, no
check here observes per-instance adoption, and an
instance not yet adopted keeps serving the previous
build without any surface here reporting that fact.
For this gate the adoption gap has a specific edge
(§10, item RD-R2): the R5a semantic takes effect per
instance as instances adopt, so a wake handled by a
not-yet-adopted instance evaluates the OLD condition
and does nothing, while a later wake on an adopted
instance fires the disjunct — the first-wake timing
is doubly uncontrolled, and no §7 result narrows it.
Nor does any check here observe the R5a semantic's
effect: **no shipped read surface reports the arming
condition, the threshold, or whether the disjunct has
ever fired.** The only evidence the semantic is
deployed is the coordinator part's byte-match plus
the build stamp; its effect becomes observable only
retrospectively, through `armedAt` and recorder rows
after a wake. A fully passing §7 therefore supports
exactly one claim: **the composed script is deployed
and verified as a script, the surfaces read during
verification answered consistently with it, and no
wake signature was observed during the windows.** The
windows do **not** bound the §1.4 consequence: the
first wake may arrive after the gate closes, and no
window length inside this gate retires that.

- **V1 Health** — `/health` build stamp == the §3
  build pin; generation `halted`; coordinator `armed`.
- **V2 Script identity** — new etag ≠ the census etag
  (required); 31 parts; **29 byte-identical to live**,
  the coordinator byte-identical to its §2.1 composed
  hash (`5303cb63…`), the identity part byte-identical
  to its stamped form.
- **V3 Settings surface** — revision still **1**;
  exactly 10 bindings; GENERATION_HALT `"1"`; phase
  policy `enforce`; observability per §6.
- **V4 Queue** — `delivery_paused: true`, exactly 1
  consumer (cf-api read-back; the gate makes no queue
  call).
- **V5 Containment reads** — `GET /v2/d6-containment`
  and the `drive=1` containment projection: state
  **NORMAL**, `absent: true`, `verified: true`;
  `stopConfidence: "not_applicable"`; the v4
  stop-record and episode fields at their empty
  values; the recorder fields unchanged vs census
  item 14 (`tableState: "missing"`, zero rows,
  `recorderHealth: null`); `armedAt` **bit-identical**
  to census — any change is trigger T6 (§5.1).
- **V6 Preservation** — census-to-close, every item
  exact: preserved plan `active` {1,0,0,0,0} with its
  entry `pending`; its job `queued` rev 1, grants [],
  quarantine unheld; the exemption projection (chapter
  bound 26 / parked 0 / eligible 1; segment 1 / 569 /
  8,022; digest `cdef2c7e…`); GENERATION_HALT `"1"`;
  queue paused; conflicts exact 4-row baseline;
  watermarks content 18 / bindings 1841 with 0 idx-26
  rows and 0 changes; all five phase figures frozen on
  both surfaces (§4 item 7); quota reconcile
  `ok: true` with the sole straddler; parked job
  fingerprint exact.
- **V7 No-movement** — no grant issued (grants []),
  the occurrence still `pending`, the job still
  `queued` rev 1, derived reserved **0**, dispatched
  (current PT day) **0**, no new plans, commands by
  the executor, or conflicts rows. A code deploy
  invokes no DO method, so **any** movement in this
  set = STOP and report; its classification follows
  §5.1 (T5/T6, including the wake-signature branch).
- **V8 Record** — execution record with the census
  transcript, assembly + battery logs (hashes), the
  upload response, D2 read-back, observability reads,
  both containment reads, the closing census repeat,
  and the ends-HELD certification; filed on the board
  with a Rowan cp. Classification of any unexpected
  finding is Rowan's, not the executor's.

Any V-item failure = STOP. The response then follows
the §5.1 classification. STOP prevents further
operator action inside the gate; per the standing
correction-6 discipline, STOP is never represented as
affecting an alarm chain (none is provoked by this
gate, and a chain a wake revives outside the gate is
not stopped by the gate's STOP).

## 8. Battery requirements and evidence status

**Standing results for this exact composed tree**
(complete runs; full logs + exit codes captured;
hashes re-verified firsthand during this package's
preparation, Nov 2, 2026):

| suite | tree | result | exit | log SHA-256 |
|---|---|---|---|---|
| Containment battery v4 + CT14d (`containment-v4/tests/containment-battery.test.mjs`, `2b2befa5…`, 67,037 B) | v4 composed | **42/42 pass** | 0 | `a3b5e310720146e70a245e8a097b107abbf64fef64a252c05883b0dba595421f` (`containment-v4/logs/containment-v4-corrections-composed.log`) |
| Containment battery v4 (41 tests, pre-CT14d file) | v4 composed | **41/41 pass** | 0 | `976778a7773c0c8cd6aa665510e6a0f89d0af51c31eab9203b120364a86e8b0d` (`containment-v4/logs/containment-v4-composed.log`) |
| R5a suite (`suites/r5a-battery.test.mjs`, unmodified) | v4 composed | **23/23 pass** | 0 | `0165246f1faa42bd182da4be0f7c542834e2d93eb7890d297d565bba0712e8ae` (`suites-v4/logs/r5a-v4-composed.log`) |
| P2 parameterized regression (`suites/p2-battery.test.mjs`, unmodified) | v4 composed | **32/32 pass** | 0 | `81ec122b4e9608c23ccbb9580325ab73c8efe5ba69ee0ebae489d15cd2b32e55` (`suites-v4/logs/p2-v4-composed.log`) |

The 42-test containment run supersedes the 41-test run
on the same tree (CT14d is the only difference; no
existing assertion was modified, deleted, or loosened
in either round). The R5a suite's coverage is the
semantic's offline evidence: the condition and
threshold behavior (R5A-T5 both branches), the memo
bounds (R5A-T2/T4: exactly 1 registration per
operation; the strictly-earlier corrective second),
the adversarial-wake churn bound (R5A-T7: 10 wakes →
10 value-identical registrations, zero state growth),
self-termination on first delivery (R5A-T6), and
quiescent silence (R5A-T9: reads never wake). Harness
caveats stand: the harness invokes `alarm()` directly
and cannot prove real platform delivery, platform
retry behavior, platform storage-effect ordering, or
real-DO SQLite behavior beyond its mirrored `.one()`
throw semantics. In particular the battery proves the
condition's behavior **when a wake is handled by the
new code**; it says nothing about per-instance
adoption (§7 preamble, §10 item RD-R2).

**Gate-time re-run requirement.** Before any upload, a
R5a-D execution re-runs on the **gate-assembled tree**
(the §3 fresh assembly, not the scratch composed
tree), against the composed fixtures:

1. the containment battery (42 tests incl. CT14d);
2. the R5a suite (23 tests);
3. the P2 parameterized regression (32 tests).

All three must pass in complete runs with exit code 0;
the logs are pinned with the build pin (§3 item 3) and
cited in the execution record. Why: the pinned logs
above are evidence about the pinned scratch tree; the
gate uploads a fresh assembly, and the assembly that
ships is the assembly that was tested (the standing
P2 B3 / C1 precedent). Any divergence = STOP before
upload (§9).

## 9. STOP conditions

Any one of the following stops the attempt; the GO is
consumed; no retry without a fresh GO:

- any §4 census item deviates from its hard
  expectation — including `armedAt` differing at
  census (a wake or pass has already occurred; classify
  first, deploy nothing);
- assembly mismatch: the gate-assembled tree differs
  from §2 in any part, count, or hash;
- any §8 battery re-run failure or divergence from the
  standing results;
- envelope/metadata drift vs the fresh live read
  beyond the two documented projection artifacts
  (§3 item 5);
- an ambiguous upload response — no re-upload is made
  until a read-back classifies the first attempt;
- any §5 trigger (T1–T6) post-upload → STOP, then the
  §5.1 classification decides the response: class A →
  rollback evaluation inside the same GO, gated on the
  §5.2 safety conditions; class B (including the
  T5/T6 wake signature, per §5.1's Ruling Item 1
  refinement) → HOLD, preserve evidence, escalate —
  no rollback inside this GO; a failed or mismatched
  class A rollback → STOP, hold, report;
- any movement in the §7 V7 no-movement set;
- observability unrestorable within the §5/§6 budget;
- any wake signature (T5/T6 evidence of a fired wake)
  observed at any point in the gate — the gate does
  not continue past the arrival of the §1.4 consequence
  as if nothing had happened, in any Ruling Item 1
  branch.

## 10. Unresolved risks bearing on R5a-D

From the corrected register
(`PHASEB-UNRESOLVED-RISK-REGISTER-REVISED.md`, pin
`621535f0…`): **14 of 15 entries remain open** (R-14
resolved by Rowan's R1 acceptance). The entries that
bear on R5a-D, at their corrected strength:

- **R-03 — Retry supersession is bounded, not
  eliminated.** A pending platform retry is not a
  schedule row; D cannot account for it, and a
  registration fired by the past-due disjunct could in
  principle supersede a retry that is still pending.
  The threshold safeguard bounds this to registrations
  stale beyond 3,600,000 ms; the documented inputs
  (≤6 retries, exponential backoff from 2 s, multiplier
  UNSPECIFIED) give an assumed envelope of 126 s, and
  the live registration is ~26 hours stale — so in
  **this** incident the supersession window is not
  credibly occupied. The residual is the
  unspecified-platform-behavior tail, and permanence
  (§1.1) means the interaction is a permanent property
  of the system. **Permanent production safety is NOT
  claimed** (spec §6).
- **R-05 — The 3,600,000 ms threshold is a provisional
  candidate value only**, never a proven upper bound
  on platform retries. In this incident it is not
  load-bearing for *whether* the disjunct fires
  (staleness exceeds it ~26×); it is load-bearing for
  the permanent semantics' behavior in future, younger
  incidents.
- **R-04 — No traffic-independent rate bound exists.**
  Registrations per unit time ≤ wake operations per
  unit time; the memo bounds each operation to ≤1
  (≤2 corrective). §1.3 sharpens what "wake traffic"
  now includes: ordinary client position sync — the
  rate is bounded by Julie's app use and other audited
  command/report traffic, not by an operator. Each
  wake's registration is value-identical (= D),
  stateless, and self-terminating on first delivery
  (battery R5A-T7/T6); a durable counter was the
  declined alternative (spec §5).
- **R-11 — D was unobservable pre-R5a; it remains
  unobservable pre-wake.** No surface reads schedule
  rows. The first wake retrospectively reveals D (the
  post-wake `armedAt` IS the registered value); until
  then the B1/B2/B3 branch is unresolved (Ruling 2's
  remainder family), and §1.4 carries all three.
- **R-12 — `getAlarm()` semantics after retry
  exhaustion are UNSPECIFIED.** The live `armedAt`
  sits inside that unspecified region; every gate
  value here is a re-read expectation, never an
  assumption, and this gate neither relies on nor
  tests delivery.
- **R-02 — Storage-effect ordering is unspecified.**
  Detection of any divergence happens only at the next
  successful dual read that actually occurs; no surface
  reads on a schedule. This is why §7 treats
  read-backs, not ordering, as ground truth — and why
  §1.4's detection statement is as weak as it is.
- **R-01 — Cross-invocation serialization (A-3) is
  assumed, not documented.** The memo is per-operation
  in-memory state threaded through one operation's
  awaits; interleavings across concurrent invocations
  lean on A-3. Harness evidence is harness-strength.
- **R-06 — Recorder dual-failure blind spot.** If a
  drive pass and its recorder write both fail, the
  pass is invisible on shipped surfaces. After a
  revival (§1.4), §7.3-set state checks bound what an
  invisible pass could have done; they do not
  eliminate the blindness.
- **R-09 — The attempt-3 stall's causation is
  unproven (H1/H4).** The recovery program proceeds
  cause-unproven; R5a-D does not depend on the cause
  and does not advance it.
- **R-13 — The lying-read residual.** A storage read
  that successfully returns a WRONG NORMAL cannot be
  detected by construction; the two containment
  surfaces read the SAME store, so their agreement
  corroborates nothing. §4/§7 cross-checks against
  facts containment does not control bound this at
  census and postflight time only.

**R5a-D-specific risks:**

- **RD-R1 — The first-wake consequence (§1.4) and its
  scope ownership (§1.5, Ruling Item 1).** The
  dominant risk of this gate is not the upload; it is
  that the deployed semantic converts ordinary future
  traffic into the revival stimulus, on an uncontrolled
  schedule, with incidental detection, and with
  duration bounded only by a later gate's stop act.
  The consequence set itself is bounded and
  pre-classified (§7.3 set; $0; no dispatch); the
  *governance* of its arrival is what is unresolved.
- **RD-R2 — Runtime adoption is UNRESOLVED, with a
  semantic edge.** Inherited from C1-R2: script
  deployment verification does not establish that every
  existing DO instance has adopted the new code, and
  no check observes per-instance adoption. Here it
  cuts deeper than in C1: the deployed artifact is a
  *behavioral condition*, and it takes effect per
  instance as instances adopt. A wake handled by a
  not-yet-adopted instance evaluates the shipped
  condition and leaves the stale registration exactly
  as today; a later wake on an adopted instance fires
  §1.4. The first-wake consequence can therefore be
  deferred by adoption timing in a way no surface
  reports — one more reason its arrival cannot be
  scheduled or certified absent.
- **RD-R3 — The deployed tree is assembled at gate
  time** (inherited from C1-R3). Bounded by: hash
  assertions against §2 at assembly, the three-suite
  battery re-run on the assembled tree (§8), and the
  stamped-manifest read-back (V2).

**What R5a-D does NOT resolve, stated plainly:**
whether the alarm actually revives (only a wake +
delivery shows that — S1's subject, or §1.4's
unplanned arrival); the B1/B2/B3 branch (resolved only
retrospectively by a wake); why the alarm stalled
(R-09); whether containment works operationally (C3,
PARTIAL by construction, and C3 cannot even be
executed until this gate closes and its expectations
are re-based to the composed build — Rowan's Ruling
1); live drive suppression, concurrent wake
suppression, and the racing-wake recheck (Ruling 2's
remainder — OPEN, preserved for a separately reviewed
S1 safety assessment; nothing in this package treats
harness evidence or any physical stop as proof of
them); any generation question. After a fully
successful R5a-D, the system differs from today in
exactly two respects: the composed script is deployed
and verified as a script, and **the next wake — from
any source in §1.2 — will evaluate the R5a condition
against the stale registration**, with the §1.4
consequence. The second difference is the gate's real
content, and it is why §11's GO text names it.

## 11. Explicit GO wording and authorization discipline

**The GO this package contemplates** (for a future
execution, only after Rowan's review of this package
**and her ruling on Ruling Item 1 (§1.5)**; NOT
requested here):

> "GO — execute exactly one Gate R5a-D attempt as
> pinned in the R5a-D readiness package (pin
> `<READINESS-PIN>`): fresh census, battery re-run
> (containment 42 + R5a 23 + P2 32) on the
> gate-assembled composed tree, build pin, exactly
> one upload of the composed candidate (coordinator
> `5303cb63…`; entry `2bb0608b…` and service
> `5c5183e6…` byte-identical to the live C1 build) to
> `opalreader-api-v2-prod`, at most one conditional
> observability PATCH, and — ONLY for a confirmed
> deployment defect (class A, package §5.1: triggers
> T1–T4, or any finding affirmatively tied to the
> uploaded code by qualifying evidence) and ONLY
> after the package's §5.2 rollback-safety conditions
> are all verified — conditionally one rollback
> upload of the preserved C1 build `27b2b3a9…` parts
> plus at most one conditional PATCH; any external or
> causally unresolved movement (class B, package
> §5.1, including triggers T5–T6) authorizes NO
> rollback under this GO — the response is HOLD,
> preserve evidence, and escalate to Rowan and Julie,
> and any rollback then needs its own ruling and GO;
> passive reads only; NO containment transition, NO
> command, NO wake or stimulus **by the executor**, NO
> hold or queue change; ending HELD with containment
> inert at NORMAL. I understand that this deploy
> changes what the next wake does: after it, the
> first wake from any source — including my own
> ordinary app use (listening-position sync, a
> settings change, a Generate tap) — is expected to
> re-register the stale alarm to the earliest pending
> due time, which may revive the alarm chain into the
> package's bounded grant/void cycle (§1.4: at most
> one live grant, no dispatch, no attempts, $0 spend,
> phase figures frozen), continuing until a later
> gate stops it; and I accept that consequence as
> part of this GO."

The final sentences of that wording are operative only
under Rowan's ruling **(i)** on Ruling Item 1. Under
ruling (ii) or (iii), or absent a ruling, this GO text
is **inoperative** and the package returns for revision
— the consequence's scope ownership changes what a GO
must say, and this package does not pre-decide it.

**Authorization discipline:** Rowan's review of this
package is not a GO. Julie's GO is not requested by
this package. If given later, the GO covers exactly
one R5a-D attempt in the wording above and nothing
else: not C3 (whose readiness is separately held and
must be re-based to the composed build after this
gate closes), not S1, not any transition, not any
stimulus.

## 12. Package contents and turn

This package is a single consolidated document.
Candidate identities are carried in full in §2; the
stored diff (§2.1) and the battery logs (§8) are cited
by hash and live in the GitHub archive. Companion
documents in the archive: the R5a revised spec
(`PHASEB-R5A-REVISED-SPEC.md`), the retry-supersession
analysis (`PHASEB-R5A-RETRY-SUPERSESSION-REVISED.md`),
the corrected C1 readiness package (this package's
form), and the C1/C2 execution records (this package's
census basis). The companion cp
(`PHASEB-R5AD-READINESS-ROWAN-CP.md`) summarizes this
package for the review folder, including Ruling Item 1.

**Production remains under INVESTIGATION HOLD. Nothing
in this package executes, deploys, transitions, wakes,
or mutates anything. Turn: Rowan's — independent review
of this R5a-D readiness package, including Ruling
Item 1 (§1.5).**
