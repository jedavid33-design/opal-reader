# REVISED BOUNDED RETRY PLAN — Gate 2D (attempt 2): halted deploy + re-arm of the grant-finalizer build

Opal Roundtable (Julie + Rowan + Wren) — Case #10 / issue #15,
repo `jedavid33-design/opal-roundtable`. Reviews and pins live in
repo `jedavid33-design/opal-reader`, branch `ui1-review`.

Drafted by LEAF WORKER B (drafting only — nothing pinned, nothing
posted, no production contact of any kind by this worker). Execution,
if it ever runs, is by the parent coordinator under Julie's fresh GO
and Rowan's review of the baseline + this plan (see §9).

---

## 1. Header / scope

This plan is the **retry of Gate 2D attempt 1** under the terms of
Rowan's Gate 2D deviation ruling (board comment **6552216332**).
Attempt 1 stopped at its D0 census with **zero mutations** after
finding a fourth `schedule_dead` conflict row where three were
expected (stopped-attempt record pin
`cf2b4e6f1e9eff80feacfe9571de1944ef88bf20`). Rowan's ruling requires
this retry to be anchored to a **fresh read-only baseline** that
enumerates the complete currently observed conflict set with
identities and timestamps (§2), and to carry the exact-match
Conflicts Rule of §5 in place of any signature-based exemption.

- This plan **supersedes nothing about Gate 2's PASS**. Gate 2
  stands: build record `c24bd4716d2ae386fcefd31a97b4a202968671a0`,
  Amendment 1 `4b1d2bd8b06bc7030166ff1eb7d025ff8a9fba61`, Rowan Gate 2
  source PASS (Amendment 1 re-review, "PASS FOR GATE 2D DECISION"),
  board comment **6552121744**. What is being retried is only the
  Gate 2D **deployment** of that already-passed build.
- **ONE attempt only.** This plan authorizes a single execution
  attempt. If the attempt stops at any point for any reason —
  including infrastructure failure — it is not restarted on anyone's
  interpretation; a stopped attempt ends the gate and returns to
  Julie and Rowan for a fresh disposition.
- **Julie's fresh GO is required.** Her attempt-1 GO (board comment
  **6552140714**) is **spent** — it covered attempt 1, which stopped
  at census. Nothing in this plan, in Rowan's deviation ruling, or
  in Rowan's review of the baseline + this plan substitutes for a
  new GO from Julie (§9).
- **End state: live-but-idle.** The gate ends with the finalizer
  build live, generation halt lifted, queue unpaused, Batch still
  unarmed, the stalled grant **still `issued`** (finalization is
  Gate 3, not this gate), nothing generated, no provider calls,
  **$0 spend**.
- **Total mutation budget: 3 deploy + 2 re-arm = 5 production
  mutations.** Deploy: D1 halt flip, D2 queue pause, D4 the single
  code upload. Re-arm: halt lift, queue unpause (last). The D6
  observability repair is **not** a planned mutation: it fires only
  if the upload has reset observability to null, is settings-only
  and code-etag-preserving, and is pre-authorized here as a repair
  contingency exactly as in prior gates; if it fires it is recorded
  and reported as a repair, never silently absorbed. The D3 envelope
  pin is a repo-only write in `jedavid33-design/opal-reader`
  (branch `ui1-review`), not a production mutation, and is not
  counted against this budget. No other production mutation of any
  kind is authorized by this plan.
- **Explicitly NOT in this gate:**
  - **Finalization (Gate 3)** — the finalizer is deployed and
    probe-tested only; it is never invoked for real in this gate.
    The grant remains `issued` rev 2 throughout.
  - **Continuation of the 15 segments (Gate 4)** — no generation,
    no plan advancement, no resume of the stalled plan.
  - **Phase B** (the Chapter 3 final segment / exemption path) —
    untouched.
  - **Batch** — remains unarmed; nothing in this gate arms it.
- **What this gate deploys:** the grant-finalizer build (Gate 2
  pins above), which adds exactly two operator-fenced routes on top
  of the live Chapter 3 build:
  `GET /v2/d6-grant-finalization-preview` and
  `POST /v2/d6-finalize-grant`. Both are operator-fenced; neither is
  halt-fenced (finalization is bookkeeping closure, not generation —
  it performs no provider call, no submission, and no wake).

---

## 2. Baseline incorporation — by reference and by value

### 2.1 By reference

The retry is anchored to the fresh read-only baseline captured by
LEAF WORKER A (capture window **2026-11-01T02:21:52Z →
2026-11-01T02:22:12Z**; all 21 reads HTTP 200; zero production
mutations; $0 spend):

- `~/workspace/ch2-program/ch3-recovery/gate2d-retry/baseline/BASELINE.md`
  — SHA-256
  `a3e1e2fc1f19aadb0b94d3bd9af41048ff0754e8710887e6216a8f4825d181ab`
- `~/workspace/ch2-program/ch3-recovery/gate2d-retry/baseline/baseline-summary.json`
  — SHA-256
  `0a8b3436131cb90f0ec15715e9192df9ccc6ba80586c39bbca45c92b51b8de21`
- Raw evidence under
  `~/workspace/ch2-program/ch3-recovery/gate2d-retry/baseline/evidence/`.

The baseline pin will be the parent-side anchor: the baseline and
this plan are **pinned with this plan as commit `__PIN__` on branch
`ui1-review` of `jedavid33-design/opal-reader`** (the literal token
`__PIN__` is a placeholder for the coordinator to substitute after
pinning; no SHA is asserted here). The D0 census (§4) compares
against the baseline **values** restated below and in §4 — not
against memory, and not against the stopped census, except where
this plan says the two agree.

Baseline headline state (all values restated in full in §4): live
build `63d7260ef0c87c45cdcb88c7007643bb90e1631c`, script etag
`82053d4d75533056753c5ee6225e0de56e29ecb1de980aa543cdba613a59d6be`;
generation **ENABLED** (`GENERATION_HALT "0"`), coordinator armed;
observability enabled + persisted; **10 bindings**; live parts
**29/29 byte-identical** to the Chapter 3 operative manifest; queue
**UNPAUSED**, sole consumer `f260f2188d80426bb0588685e9d084eb`.

### 2.2 By value — the expected conflict set (complete)

The baseline's complete conflict set is **exactly 4 rows**. This
enumeration is the comparison target for the Conflicts Rule (§5):

| id | at (ISO, UTC) | at (raw, ms epoch) | occurrence_id | cache_key | expected | found | reason |
|---|---|---|---|---|---|---|---|
| 1 | 2026-10-29T23:54:14.808Z | 1793318054808 | `grant:plan:3183ecbf2ac4bf50bbc6166e:seg:1:full` | lease | 7 | LIKE or GLOB pattern too complex: SQLITE_ERROR | schedule_dead |
| 2 | 2026-10-30T00:24:14.632Z | 1793319854632 | `grant:plan:603ab416bd67ab1b25de97be:ch1:1:full` | lease | 7 | LIKE or GLOB pattern too complex: SQLITE_ERROR | schedule_dead |
| 3 | 2026-10-31T05:14:24.089Z | 1793423664089 | `grant:plan:b2dc2a3d1cd367a0245b9102:ch1:1:full` | lease | 7 | LIKE or GLOB pattern too complex: SQLITE_ERROR | schedule_dead |
| 4 | 2026-11-01T01:04:30.364Z | 1793495070364 | `grant:plan:e377a5559961b294154276b6:ch2:1:full` | lease | 7 | LIKE or GLOB pattern too complex: SQLITE_ERROR | schedule_dead |

The four occurrence ids, listed in full:

- id 1: `grant:plan:3183ecbf2ac4bf50bbc6166e:seg:1:full`
- id 2: `grant:plan:603ab416bd67ab1b25de97be:ch1:1:full`
- id 3: `grant:plan:b2dc2a3d1cd367a0245b9102:ch1:1:full`
- id 4: `grant:plan:e377a5559961b294154276b6:ch2:1:full`

Every row: `cache_key` **lease**, `expected` **7**, `found`
**"LIKE or GLOB pattern too complex: SQLITE_ERROR"**, `reason`
**schedule_dead**. The set is byte-identical to the stopped
census's set — **no accretion** occurred between the stopped census
(2026-11-01T02:09:32Z) and this baseline. Row 4 is the row attempt 1
stopped on; it is now part of the expected set **because the
baseline enumerates it**, not because any signature exemption was
granted (see §5).

---

## 3. R0 — preconditions

All of the following must hold before D0 begins. Any failure is a
STOP before any read-dependent step is treated as satisfied, and is
reported; R0 makes no production contact of its own beyond what D0
then performs.

1. **Gate 2 build pins** (repo `jedavid33-design/opal-reader`,
   branch `ui1-review`):
   - Build record: `c24bd4716d2ae386fcefd31a97b4a202968671a0`
   - Amendment 1: `4b1d2bd8b06bc7030166ff1eb7d025ff8a9fba61`
2. **Rowan Gate 2 source PASS** (Amendment 1 re-review, "PASS FOR
   GATE 2D DECISION"), board comment **6552121744**.
3. **Rowan Gate 2D deviation ruling**, board comment **6552216332** —
   the authority for this revised plan's baseline + exact-match
   Conflicts Rule shape.
4. **Stopped-attempt record** pin
   `cf2b4e6f1e9eff80feacfe9571de1944ef88bf20` — the D1–D8 sequence
   wording and the STOP-law precedent for this gate.
5. **Baseline**: `BASELINE.md` SHA-256
   `a3e1e2fc1f19aadb0b94d3bd9af41048ff0754e8710887e6216a8f4825d181ab`
   and `baseline-summary.json` SHA-256
   `0a8b3436131cb90f0ec15715e9192df9ccc6ba80586c39bbca45c92b51b8de21`,
   pinned with this plan as commit `__PIN__` (see §2.1). If either
   hash does not verify at execution time, STOP — the anchor has
   moved.
6. **Julie's fresh GO** for this retry (§9) — obtained after Rowan's
   review of baseline + this plan. Attempt-1 GO 6552140714 does not
   satisfy this precondition.
7. **Finalizer-tree diff — verified by this plan's drafter
   (read-only, local trees only).** Recursive diff of
   `~/workspace/ch2-program/ch3-recovery/finalizer-build/worker-build/`
   vs `~/workspace/ch2-program/ch3-build/worker-build/`
   (`diff -rq --no-dereference`; note `v2` is a symlink to `worker`
   in both trees, so the no-dereference form is the true surface —
   a follow-symlinks diff shows the same files twice, once per
   path). **Actual diff surface — 8 paths, nothing else:**
   - **New (finalizer build only):**
     `worker/generation/grant-finalizer.mjs` (830 lines) — the
     finalizer module.
   - **Modified (only differing file):**
     `worker/worker-entry-prod-d6.js` — **+122 / −2** vs the
     Chapter 3 build: the `grant-finalizer.mjs` import, the two
     internal finalizer handlers, and the two public routes joining
     the operator-fence class. (Verified line counts: 122 added,
     2 removed — matching the stopped attempt record's +122/−2.)
   - **New test files (finalizer build only):**
     `tests/grant-finalizer.test.mjs`,
     `tests/grant-finalizer-continuation.test.mjs`,
     `tests/grant-finalizer-routes.test.mjs`,
     `tests/grant-finalizer-sameday.test.mjs`,
     `tests/helpers/grant-finalizer-fixture.mjs`.
   - **Nothing else differs.** No other file is added, removed, or
     modified anywhere in either tree. The differences are confined
     to the finalizer module, the entry, and test files — exactly
     the expected surface. At execution time the executor re-runs
     this diff before D3 assembly; any larger surface is a STOP.

---

## 4. D0 — census (fresh, complete, read-only)

Before any mutation, the executor takes a fresh complete census
using the same surfaces and methods as the baseline capture, and
compares **every** figure against the baseline values below. D0
makes reads only. Any mismatch on any hard-stop item — the
Conflicts Rule (§5) included — triggers the STOP LAW (§7) before
any mutation.

### 4.1 Expected values (all restated FROM THE BASELINE)

- **Health:** build
  `63d7260ef0c87c45cdcb88c7007643bb90e1631c`; generation `enabled`;
  coordinator `armed`; scope `production`; version `2.0.0`;
  ok `true`.
- **Worker script:** etag
  `82053d4d75533056753c5ee6225e0de56e29ecb1de980aa543cdba613a59d6be`
  (1,383,556 bytes); live parts **29/29 byte-identical** to the
  Chapter 3 operative manifest, no extra parts, no differing part.
- **Observability:** enabled + persisted (logs enabled, persist
  `true`, invocation_logs `true`), on both the `/settings` and
  `/script-settings` reads.
- **Bindings: 10.** `GENERATION_HALT "0"` (generation enabled);
  `OPALREADER_PHASE_POLICY` `enforce`; scope `production`.
- **Settings:** revision **1**; monthlyCap 50; geminiLane
  `standard`.
- **Phase accounting** (`forever-pucked`, book
  `5c589095-f812-48a2-8ab2-03ba2791f2b2`), identical on both the
  capabilities and operator-diagnostics surfaces: budget
  13,500,000; **settled 732,303**; **estimatedUnverified 19,018**;
  **reservedUnverified 5,648**; **remaining 12,762,049**;
  inFlightUpper 0.
- **Plans:** plan list exhaustive (`nextCursor: null`).
  `plan:e377a5559961b294154276b6` **active, 8/23** (totals: eligible
  23 / done 8 / failed 0 / blocked 0 / prompts 0);
  `plan:b2dc2a3d1cd367a0245b9102` complete;
  `plan:603ab416bd67ab1b25de97be` retired;
  `plan:3183ecbf2ac4bf50bbc6166e` complete.
- **Stalled grant / job:** grant
  `grant:plan:e377a5559961b294154276b6:ch2:1:full` state **issued**,
  revision **2**; job `plan:e377a5559961b294154276b6:ch2` state
  `generating`, revision 2; **23 job rows: 8 ready / 15 pending**.
- **Parked job:** `1832c21fcf0425454227c4736048a8a632f422abca4a2685ddb775bb1681406a`,
  state `parked_policy`, revision 1; fingerprint recomputed by the
  baseline method must equal
  `b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`
  exactly; 27 rows (3 ready / 24 pending); grants `[]`.
- **Eligibility** (book `5c589095-f812-48a2-8ab2-03ba2791f2b2`,
  chapter index 2): **15 eligible / 11 bound_already / 1 parked**;
  totalChars **20,864**; expectedCostMicroCents **294,137**; digest
  `9453ab5dc7ee6ade7c650d14066054b965875f2ef1b65eb24bc633588d778e67`
  exact.
- **Sync watermarks:** bindings **1826** / content **18**.
- **Queue:** `opalreader-generation-v2` **unpaused**
  (`delivery_paused: false`); sole consumer
  `f260f2188d80426bb0588685e9d084eb` (script
  `opalreader-api-v2-prod`); sole producer the prod script.
- **Batch:** unarmed — capabilities batch lane admitted `false`
  (`batch_not_armed`); standard lane admitted `true`.
- **Conflicts:** the complete set must equal the baseline's
  enumerated set **exactly** — see §5, which is part of D0.

**Permitted variance (the only variance):** per-read server
timestamps (capabilities `asOf`, eligibility `quotedAt`) differ on
every read by construction and are not deviations; and the PT-day
rollover presentation under the Quota Rule (§4.2). Every other
figure must match the baseline exactly. A difference that is "only
a timestamp" in any other field is a deviation, not a variance.

### 4.2 Quota rule (part of D0)

Quota reconcile (operator, 4-page census pattern, read-only):

- **Historical days are fixed:** 2026-10-29 dispatched 57 /
  reserved 0 / consumed 57; 2026-10-30 dispatched 79 / reserved 0 /
  consumed 79. These must read exactly in the retry census
  regardless of when it runs.
- **Baseline current PT day was 2026-10-31** (the baseline capture
  at 02:21–02:22Z landed before the 07:00Z rollover): dispatched
  **44** / reserved **52** / consumed **96** of 100.
- **If the retry census lands on PT day 2026-10-31:** the
  current-day figures must equal the baseline's exactly —
  dispatched 44 / reserved 52 / consumed 96.
- **If the retry census lands on a LATER PT day:** the new current
  day is read fresh and stated as observed (its figures are new
  facts, not expectations); the 2026-10-31 figures become
  historical and **must then read dispatched 44 / reserved 52 /
  consumed 96**; the historical 2026-10-29 and 2026-10-30 figures
  must still read 57 and 79.
- **In either case:** reconcile must be `ok: true`, drift empty,
  `censusComplete: true`, guard **armed: true**,
  `currentDayBlocked: false`, with the **sole exception** being the
  straddler `att-37d63768-db4b-447d-8150-580b7c6ee257`
  (`estimated_unverified`, spanning 2026-10-29/2026-10-30) — the
  permanent, never-dispositionable exception. Any second exception,
  any drift entry, or `ok` not `true` is a STOP.
- **Rollover changes nothing structural, and this must be stated in
  the execution record:** the PT-day rollover does **not** close
  the issued grant `grant:plan:e377a5559961b294154276b6:ch2:1:full`
  and does **not** release its **52-slot reservation**; the
  reservation stays attributed to PT day **2026-10-31** after
  rollover. A fresh current day showing headroom is not evidence
  that the stall cleared.

---

## 5. THE CONFLICTS RULE (the heart of this revision)

> The retry census fetches the **complete** conflict set and
> compares it **EXACTLY** against the baseline's enumerated set
> (§2.2): **same count (4), same ids (1, 2, 3, 4), same timestamps,
> and the same occurrence_id / cache_key / expected / found / reason
> for every row.** **ANY additional row, ANY missing row, or ANY
> changed field in ANY row = STOP before any mutation**, preserve
> state, and file the deviation for Rowan. **NO exceptions. NO
> executor judgment calls. NO "matching signature" exemption** —
> Rowan expressly refused an unlimited exemption for further
> same-signature rows in ruling 6552216332, and this plan grants
> none.

Why this strength, stated plainly: attempt 1 stopped because its
expectation (3 rows) was fixed before row 4 existed. This retry
fixes the expectation to the baseline's enumerated 4 rows — but it
does **not** convert "rows like these are expected" into a standing
permission. Because the grant remains `issued` and the lease quirk
is **unfixed**, further accretion between the baseline and the
retry census is genuinely possible. If it happens, the remedy is a
**NEW baseline + Rowan review** — never a judgment call at the
gate, never an executor determination that a new row "matches the
signature" and may therefore pass. The executor's comparison is
mechanical: equal, or STOP.

The rule applies twice: at D0 (before any mutation, §4) and again
at D8 (after the deploy, §6) — with the post-deploy reporting duty
stated in §6/D8.

---

## 6. D1–D8 — deploy sequence (identical to attempt 1)

Executed in order, exactly once each, only after D0 passes in full
(§4 + §5). Deploy mutations: D1, D2, D4 (plus the conditional D6
repair contingency, §1).

- **D1 — Halt flip.** Set `GENERATION_HALT` to `"1"` via a
  **settings-only multipart PATCH** to
  `/workers/scripts/{name}/settings` — a single part named
  `settings` (Content-Type `application/json`) holding the settings
  JSON. (The settings **write** path is `/settings`; the
  `/script-settings` path is read-shaped for this purpose and its
  PATCH changes nothing.) **Verify the script etag is unchanged**
  after the PATCH — the halt flip must not touch code. Read back:
  halt `"1"`, generation halted.
- **D2 — Queue pause.** PUT the queue with `queue_name` +
  `settings.delivery_paused: true`. **Read back
  `delivery_paused: true`** before proceeding (a bodiless or
  mis-shaped request changes nothing; only the read-back proves the
  pause). The queue stays paused through D8.
- **D3 — Envelope assembly + pin (repo-only, no production
  contact).** Assemble the upload envelope from
  `~/workspace/ch2-program/ch3-recovery/finalizer-build/worker-build/`.
  **Parts are counted FROM the assembled manifest — never from
  memory.** The envelope is **pinned as a single-parent child of
  the baseline pin** (commit `__PIN__`, §2.1) on branch
  `ui1-review` of `jedavid33-design/opal-reader` **BEFORE upload**;
  the pin SHA becomes the `/health` build stamp of the deployed
  build. If the assembled parts count or any part byte disagrees
  with the finalizer tree verified at R0 (§3.7), STOP.
- **D4 — Exactly ONE upload.** One multipart code upload of the D3
  envelope. No second upload under any circumstance in this gate;
  if the upload's outcome is unknown, STOP and read back — do not
  retry blind.
- **D5 — Byte verification.** Download the live script and verify
  **all parts byte-for-byte against the uploaded manifest** (every
  part present, byte-identical, no extras), plus **etag read-back**.
  Any part mismatch = STOP (state is already halted + paused;
  containment is §8's, invoked on Julie/Rowan direction).
- **D6 — Observability check, conditional repair ONLY.** GET the
  script settings: a code upload is known to reset observability to
  null, so check explicitly. If observability is intact (enabled +
  persisted), do nothing. **Only if it is null**, re-apply it via
  the settings-only multipart PATCH to `/settings` (observability
  object only), then **verify the script etag is unchanged** — the
  repair must not touch code. Record whether the repair fired.
- **D7 — Denied probes (both finalizer routes).** With **no
  credentials**, call both new routes on the deployed build:
  `GET /v2/d6-grant-finalization-preview` and
  `POST /v2/d6-finalize-grant`. Each must refuse with the
  operator-required refusal (**403, `migration_operator_required`
  pattern**). Any other result — a 200, a different error, a route
  missing — = STOP and report. The probes invoke nothing: no
  preview is computed for a real grant, no finalization is
  attempted.
- **D8 — Full read-backs.** Verify the complete post-deploy state:
  - `/health` build = the **new pin build** (the D3 pin SHA);
    generation reports halted at this point (halt still `"1"` —
    re-arm is §8, a separate phase of this gate).
  - Settings / observability: bindings intact; observability
    enabled + persisted.
  - Queue **still paused** at this point (`delivery_paused: true`
    read back).
  - Grant **STILL `issued` rev 2** — **NO finalization in this
    gate**; job rows still **8 ready / 15 pending**; plan
    `plan:e377a5559961b294154276b6` still **active 8/23**.
  - Parked job fingerprint still
    `b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`.
  - Phase figures **byte-equal to the census**: settled 732,303;
    estimatedUnverified 19,018; reservedUnverified 5,648; remaining
    12,762,049 of 13,500,000.
  - Eligibility digest still
    `9453ab5dc7ee6ade7c650d14066054b965875f2ef1b65eb24bc633588d778e67`
    (15 / 11 / 1; 20,864 chars; expected 294,137).
  - **Conflicts set compared AGAIN post-deploy: it must still equal
    the baseline set exactly** (§5: same 4 rows, same ids,
    timestamps, and per-row fields). By this point the deploy has
    already happened, so a change here cannot un-happen — the duty
    is therefore explicit: **any change to the conflict set found at
    D8 is reported to Julie and Rowan immediately**, verbatim and
    in full, in the execution record and in the gate report, before
    any re-arm step is taken. Re-arm (§8) does not proceed on a
    changed conflict set without a fresh ruling.
  - Watermarks, settings revision, and quota state re-read and
    recorded (quota per §4.2's rule, applied to the post-deploy
    reads).

---

## 7. STOP LAW (restated in full — governs every step of this gate)

- **Any census mismatch on ANY hard-stop item — the Conflicts Rule
  (§5) included — = STOP before any further mutation.** No step
  after the stop fires in that attempt.
- **Preserve the halted/paused state if already reached.** A stop
  after D1/D2 leaves generation halted and the queue paused; nobody
  "tidies up" by un-halting or unpausing on their own authority.
  Containment moves (§8) happen only as pre-authorized there or on
  a fresh instruction.
- **Report the exact deviation + the proposed explanation to Julie
  and Rowan.** The deviation is stated verbatim (the differing
  value, field, or row, in full), separately from any explanation
  offered for it.
- **Proceed only on a fresh explicit GO or a Rowan ruling for that
  deviation.** A general "keep going" that does not name the
  deviation is not approval for it.
- **An executor's own tracing never clears its own stop.** That the
  executor can explain a deviation — even correctly, even as known
  bookkeeping — does not convert the stop into a pass. (This is the
  Gate (a) lesson, and attempt 1 of this gate obeyed it: the STOP
  at D0 stood even though row 4's provenance was traceable.)
- **Rowan's post-hoc acceptance does not retroactively authorize
  proceeding.** A later PASS on the technical record closes the
  record; it does not rewrite a decision to proceed past a stop
  into authorized scope.
- **One attempt only** (§1): a stop ends this gate's attempt. Any
  retry is a new plan, a new review, and a new GO.

---

## 8. RE-ARM (identical to attempt 1)

Re-arm runs only after D8 passes in full, inside this same gate and
this same GO. Re-arm mutations: 2 (halt lift, then queue unpause
LAST).

- **Hard precondition — fresh reconcile.** A fresh quota reconcile
  must return **`ok: true`**, drift empty, `censusComplete: true`,
  guard armed, with the **sole exception** of the straddler
  `att-37d63768-db4b-447d-8150-580b7c6ee257` (estimated_unverified,
  never dispositionable). Anything else = no re-arm; the system
  stays halted + paused and the STOP LAW (§7) applies.
- **Halt lift.** Set `GENERATION_HALT` back to `"0"` via the
  settings-only multipart PATCH to `/settings` (single `settings`
  part). **Verify the code bytes / etag are unchanged** by the lift
  and that **observability is still enabled + persisted**.
- **Queue unpause LAST.** Unpause the queue only after the halt
  lift is verified, with a **read-back** of `delivery_paused:
  false`. Nothing after the unpause except observation.
- **Two watched 30-minute windows.** After re-arm, observe two
  30-minute windows for unexpected movement (generation, spend,
  plan/grant changes). Stated at their true strength: **the windows
  are bounded observation, NOT proof** — quiet windows do not prove
  no stale work exists; **the code fences that refuse stale work
  whenever it fires carry the real safety argument.**
- **Containment (pre-authorized inside this gate):** on any
  unexpected movement or discovered divergence during or after
  re-arm, the executor may — without waiting for a new approval —
  **re-pause the queue first, then re-halt** (in that order), and
  reports immediately to Julie and Rowan. Containment is the only
  post-re-arm mutation pre-authorized by this plan.
- **End state check:** live-but-idle — finalizer build live, halt
  lifted, queue unpaused, Batch still unarmed, grant still
  `issued` rev 2, plan still active 8/23, nothing generated, $0
  spent. Gate 3 (finalization) and Gate 4 (continuation) remain
  separate future decisions.

**Julie-facing warning (must be surfaced to Julie with the GO
decision, §9):**

> Re-arming makes the app's Generate button live again.

---

## 9. Julie decision

Sequence: (1) this plan + the baseline go to **Rowan for review**;
(2) after Rowan's review, **Julie decides**.

- **Julie's decision is GO (one attempt) / HOLD, given via
  tappable buttons**, with the §8 warning sentence in front of her when she decides:
  "Re-arming makes the app's Generate button live again."
- A GO authorizes **exactly one attempt** at this gate as written —
  D0 → D8 → re-arm, under the STOP LAW. It does not authorize Gate
  3, Gate 4, Phase B, or Batch, and it does not survive a STOP: a
  stopped attempt needs a new disposition, not a resumption.
- **Nothing in Rowan's review substitutes for Julie's GO.** Rowan's
  review is technical; the deployment decision is Julie's. Her
  attempt-1 GO (6552140714) is spent and confers nothing here.
- On HOLD: nothing runs, nothing is pinned further, production
  remains exactly as the baseline found it — live-but-idle on build
  `63d7260ef0c87c45cdcb88c7007643bb90e1631c`, grant still `issued`,
  reservation still held against PT day 2026-10-31.

---

## Appendix — identifier index (all values copied from the baseline / task record)

- Live build: `63d7260ef0c87c45cdcb88c7007643bb90e1631c`
- Live script etag: `82053d4d75533056753c5ee6225e0de56e29ecb1de980aa543cdba613a59d6be`
- Baseline `BASELINE.md` SHA-256: `a3e1e2fc1f19aadb0b94d3bd9af41048ff0754e8710887e6216a8f4825d181ab`
- Baseline `baseline-summary.json` SHA-256: `0a8b3436131cb90f0ec15715e9192df9ccc6ba80586c39bbca45c92b51b8de21`
- Baseline + plan pin: `__PIN__` (placeholder — coordinator substitutes after pinning)
- Gate 2 build record: `c24bd4716d2ae386fcefd31a97b4a202968671a0`
- Gate 2 Amendment 1: `4b1d2bd8b06bc7030166ff1eb7d025ff8a9fba61`
- Stopped-attempt record pin: `cf2b4e6f1e9eff80feacfe9571de1944ef88bf20`
- Rowan Gate 2 source PASS: board comment `6552121744`
- Julie attempt-1 GO (spent): board comment `6552140714`
- Rowan deviation ruling: board comment `6552216332`
- Book: `5c589095-f812-48a2-8ab2-03ba2791f2b2`; chapter index 2
- Plan: `plan:e377a5559961b294154276b6`
- Grant: `grant:plan:e377a5559961b294154276b6:ch2:1:full` (issued rev 2)
- Parked job: `1832c21fcf0425454227c4736048a8a632f422abca4a2685ddb775bb1681406a`;
  fingerprint `b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`
- Eligibility digest: `9453ab5dc7ee6ade7c650d14066054b965875f2ef1b65eb24bc633588d778e67`
- Queue consumer: `f260f2188d80426bb0588685e9d084eb`
- Quota straddler (sole exception): `att-37d63768-db4b-447d-8150-580b7c6ee257`
- Finalizer routes (deployed by this gate, probed at D7, never
  invoked): `GET /v2/d6-grant-finalization-preview`,
  `POST /v2/d6-finalize-grant`

*End of plan. Drafting attestation: this file was written from the
baseline files, the stopped attempt's execution record, and local
read-only tree diffs only. No production contact, no network
writes, no pins, no board posts were made by the drafter.*
