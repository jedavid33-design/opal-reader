# PHASE B — PROPOSAL: exemption + generation of the final Chapter 3 segment (idx 26), ends HELD

**Status: PROPOSAL — preparation only. Nothing in this document is an
execution authorization.** Julie's "Let's do phase b" (chat, Nov 1,
2026) starts the proposal pipeline: this proposal → Rowan review →
Julie's separate execution GO. No exemption has been granted, nothing
has been re-armed, unpaused, submitted, or generated in preparing it.
Read-only production reads were used for §1's preflight, with the one
disclosed exception in §1.0.

**Design basis:** CH3-GENERATION-PROPOSAL-v2 (pin `8f522593`,
ui1-review, opal-reader), Rowan DESIGN PASS 6548728089 — §5B (the
exemption mechanism), §6 Phase B (execution sequence E1b–E4b),
§10B/§10C (completion criteria). The mechanisms are already built,
Rowan source-PASSed, and live on the current build — this gate needs
**no build and no deploy**. Gate 4's final presentation (pin
`308518f4`) and execution record (pin `97a32aed`) supply the
execution shape this proposal mirrors at single-segment scale and
the closing state this proposal opens from.

---

## 0. Bottom line

- **The voice checkpoint resolves CLEAN (preflight §1.1).** Idx 26's
  POV is **Alex**, resolving to the cast voice **Charon — provider
  gemini, model gemini-3.8-flash-tts** — a live provider. No
  `voice_prompt`, no voice decision needed from Julie. (The binding
  execution-time checkpoint is still the post-exemption quote, §6.2,
  exactly as the design specifies.)
- **Fresh-modeled cost: 8,022 units ≈ $0.008** expected; the m = 1
  modeled bound is 12,808 (≈ $0.013). Proposed gate detection
  threshold: **25,000 units (≈ $0.025), detection-only** (§7.1).
- **The segment fits today's remaining quota headroom in full**
  (24 slots left of the 100/day fence; the occurrence's entire
  worst case is 12) — or on a fresh PT day after the 07:00Z rollover
  (§1.4). The choice of day is scheduling, not safety.
- **Its storage key is FREE** on both text bases — one identical key,
  re-verified today after Gate 4 (§1.3).
- **Executor mutation budget: exactly 5** (exemption, halt flip,
  unpause, re-pause, re-halt), plus exactly ONE SubmitJob command
  (the generation submission itself, counted separately as in
  Phase A), plus a contingency-only exemption revoke that is not
  counted unless used (§8). **End state: HELD.**

---

## 1. Preflight results (read-only; performed Nov 1, 2026, post-Gate 4)

### 1.0 Provenance disclosure — read this first

The drafting context's calls to the production Worker's gated `/v2/*`
read routes returned HTTP 500 (`error code: 1101`) on every attempt,
through both the client and operator connector helpers, while
`/health` (public) answered normally and the GitHub and Cloudflare
API surfaces — which use the same credential machinery — worked
throughout. The staging Worker showed the identical pattern from the
same context (gated route 1101, `/health` 200), which localizes the
fault to this drafting context's request path, **not** to the
production system; the parent agent read the production plan state
successfully through the same client helper minutes before this
preflight began, and Gate 4's executor read every surface cleanly
through 19:43Z. Per connector discipline the reads were not retried
in a loop. Consequences, stated per item below: items verifiable
through surfaces that answered **were verified fresh in this run**
(§§1.3, 1.6, and the §5 opening state where cited); items that only
the gated `/v2/*` surfaces expose rest on **Gate 4's closing census
(19:40Z today, ~25 minutes before drafting)** and are written into
§5's E0 census as binding execution-time expectations — the executor
re-reads every one live, and any mismatch is a STOP before any
mutation. No figure in this proposal that matters to safety rests
solely on the drafter's word.

### 1.1 Voice read-back — CLEAN: Alex → Charon (gemini)

**Outcome: the segment's voice assignment is clean. It is not a
`voice_prompt` case, and no voice decision is required from Julie.**

- The builder never voice-evaluates idx 26 today: both parked fences
  precede the voice check in disposition precedence
  (`eligible-set.mjs` rules 2–3 before rule 4), so no live quote can
  show its voice disposition pre-exemption. The determination is
  therefore made the way the shipped code itself resolves it, over
  the live content data:
  - **Work-source resolution** (`d6-work-source.mjs` — the
    executor's own resolution path): the Oct 31, 2026 collision
    preflight (pin `614ba5fa`; report
    `ch3-generation/preflight/PREFLIGHT-REPORT.md`) drove the shipped
    `createD6WorkSource` against the live Forever Pucked entity and
    recorded: **all 27 Chapter 3 segments resolve `ok`, every segment
    pov Alex → cast voice Charon / gemini / gemini-3.8-flash-tts**
    (style direction 289 chars, SHA-256 `947c6ac6…`). Idx 26 is one
    of the 27; its work-source status was `ok` — not
    `removed_provider`, not `unmapped_pov`.
  - **Plane resolution** (`content-plane-adapter.mjs`
    `resolvePovKey` + `eligible-set.mjs` rule 4): segment pov "Alex"
    resolves by unique cast-name match to the Alex cast entry;
    provider gemini is not in `REMOVED_PROVIDERS`
    (azure | fish | speechify | elevenlabs), so with the fences
    lifted by a live exemption the builder's disposition for idx 26
    is **`eligible`**, not `voice_prompt`.
  - **Corroboration from bound audio:** the chapter's already-bound
    segments were produced in this same voice — R2 object metadata
    for idx 0's audio reads `provider: gemini, voiceId: Charon`
    (re-read in this run, §1.3).
- **Currency of the evidence:** the resolution inputs are the book's
  content entity and cast. The content sync watermark stood at **18**
  at the Oct 31 preflight and at **18** in Gate 4's closing census
  today — the entity has not changed between the derivation and now.
  Bindings changed (1818 → 1841) but bindings do not enter voice
  resolution. §5's census re-reads the content watermark: **if it is
  not 18, this derivation must be re-run before the exemption, and
  the executor STOPS until it has been.**
- The design's binding checkpoint is unchanged and still applies at
  execution (§6.2): the post-exemption segment quote must show
  `eligible`; a `voice_prompt` there STOPS the gate for Julie's
  voice decision regardless of this preflight.

### 1.2 Fresh quote — modeled 8,022 (≈ $0.008); live quote is the E1b read-back

- **Modeled quote (design §7 basis, recomputed):** 569 chars →
  expected `round(569 / 15.96 × 225)` = **8,022 units ≈ $0.008**;
  single-attempt upper `round(569 / 10 × 225)` = **12,803**;
  per-occurrence guard ceiling `12 × 12,803` = **153,636**.
- **Live quote today (expectation, from Gate 4's closing census —
  see §1.0):** with no exemption in force, the segment-scope quote
  (`scope=segment&occurrenceId=2a85f74f…`) reads eligible **0**,
  exclusions **parked 1**; the chapter-scope quote reads bound **26**
  / parked **1** / eligible **0**, eligibility digest **`9453ab5d…`**
  (the value Gate 4's census recorded). These are §5 census
  expectations, verified live by the executor before any mutation.
- **The binding quote is the post-exemption read-back (§6.2):**
  segment quote must show **eligible 1 / 569 chars / expected 8,022**
  — any char or cost mismatch = STOP (design §6 E1b).

### 1.3 Storage-key occupancy — FREE (verified fresh in this run)

- Idx 26's first-pass fingerprint is **identical on both text
  bases**: its `text` and `speechText` are the same string (the
  Oct 31 preflight's Set A whole-26 and Set B flush-26 rows carry
  the same fingerprint), so the standing two-text-bases caveat
  collapses to a single key for this segment:
  `audio/07d145f7b87b9621497d3b8a2c5828141592b94425fd5696fffedde9957d9590`
  (the executor's flush key; format `.wav`).
- **Fresh check (this run, via the Cloudflare API, post-Gate 4):**
  R2 LIST on prefix `audio/07d145f7…` in `opalreader-storage`
  returned **zero objects — the key is FREE.** Mechanism validated
  in the same run against a known-occupied key: idx 0's prefix
  returned its object at 2,171,878 bytes, byte-equal to its binding
  record's size (and carrying the Charon/gemini metadata cited in
  §1.1).
- What this proves and does not: no pre-existing object sits at the
  one key this generation will write, so the Chapter 2
  adoption/collision shape has no foothold here. A key free at
  check time is free *then*; nothing else writes `audio/` keys
  absent an authorized generation run (§9 of the Oct 31 preflight,
  carried forward).

### 1.4 Day-headroom arithmetic — fits today in full; rollover also available

- PT 2026-11-01 dispatches stand at **76** (Gate 4's closing census:
  dispatched 76 / reserved 0 / consumed 76) of the 100/day fence →
  **24 slots of headroom remain today**. The system has been HELD
  with the queue paused since (re-verified §1.6), so no further
  dispatch has occurred.
- This segment's demand: **1** first-pass dispatch expected (569
  chars is under the 1,200-char pre-split ceiling — no pre-split);
  the per-occurrence worst case is **12** dispatches total (split
  tree + repair chain combined, the shipped attempt budget). Cohort
  bounding reserves against the same 12-slot figure at grant
  issuance.
- **Verdict: 24 ≥ 12 — Phase B fits today with its entire worst
  case inside the day's remaining headroom**, leaving 12 slots
  unspent even at the bound. Executing after the next PT rollover
  (07:00Z) starts from a fresh 100. Both are arithmetically sound;
  the proposal takes no position beyond the arithmetic — the GO
  names the attempt, and §5's census re-reads the day totals live
  and applies the same ≥ 12 test to whatever day execution lands
  on (a day with < 12 headroom = STOP, never a partial fit).

### 1.5 Exemption journal state — no exemption exists; no read surface (named substitutes)

- **No read surface exposes the exemption records.** Source audit of
  the live build's entry: the only routes touching
  `d6_chapter_exemptions` / `d6_chapter_exemption_events` are the
  two POST operator routes (grant / revoke). No GET route projects
  the singleton row or the journal. The records' only read-side
  consumer is `liveParkFenceRecords` → the plane's `exemptIds`,
  which surfaces only as eligibility dispositions/digest.
- **Evidence that no exemption is live for idx 26 today:** (i) the
  chapter quote at Gate 4's census (today, 19:01Z) showed idx 26
  still fenced (parked 1, digest `9453ab5d…`) — a live exemption
  flips it to `eligible` and changes the digest; (ii) the exemption
  route has never been called in production except the
  credential-less probes at the Ch 3 deploy, which the operator
  fence refused (403 `migration_operator_required`) and which write
  nothing; (iii) Gate 4's mutation budget was exactly 4 and did not
  include any exemption call.
- **Execution-time substitutes (§§5–6):** (a) E0 census re-reads the
  chapter digest + parked count — any live exemption breaks the
  expected digest and STOPS the gate; (b) the exemption call's own
  response is a fence: the executor requires `outcome: "applied"`
  with **`alreadyExempted: false`** — `alreadyExempted: true` means
  a live row pre-existed the gate = STOP (contingency revoke only
  under Julie's further word, §10); (c) the post-exemption quote
  must show exactly the §6.2 figures.

### 1.6 Opening state — verified items (this run) and census-carried items

Verified fresh in this run through surfaces that answered:
`/health` — build **`1c2d1d0fa7ebb769f68cfb327fb9fde7d4d30867`**,
coordinator `armed`, generation `halted`; queue
`opalreader-generation-v2` `delivery_paused: true` (cf-api; last
modified 19:40:22Z = Gate 4's re-pause); R2 occupancy (§1.3);
ui1-review head `97a32aed…` (gh-api).

Carried from Gate 4's closing census (19:40Z today; §5 re-verifies
every item live): plan `plan:e377a5559961b294154276b6` `complete`
23/23, failed 0, all grants `reported`, **no live grant, reserved
0** — with no active plan, the halted-state grant churn does not
run; phase settled **1,029,420** / estimatedUnverified 19,018 /
reservedUnverified 5,648 / unknownOpen **0** / remaining 12,464,932
of 13,500,000; bindings watermark **1841**; content watermark **18**;
conflicts exactly the pinned four `schedule_dead` rows; parked job
`1832c21fcf0425454227c4736048a8a632f422abca4a2685ddb775bb1681406a`
`parked_policy` rev 1, fingerprint basis `b991f18a…` unchanged, its
live park release (the 23 ids of idx 3–25) unchanged; settings
revision **1**; Batch unarmed; worker etag `f15fb1ae…`,
observability enabled + persisted.

---

## 2. Scope and identity

**In scope — exactly this:**

- **Book:** Forever Pucked, bookId
  `5c589095-f812-48a2-8ab2-03ba2791f2b2`; phase `forever-pucked`;
  lane `standard`; `keepGoing: false`.
- **The one occurrence:** Chapter 3 (chapterIndex 2), position
  idx 26 — the chapter's final segment — occurrenceId
  **`2a85f74f-353d-4c25-a86a-4a4db392868b`**, **569 chars**,
  currently `excluded_parked` on the live plane (a row of the
  parked job, beyond its definition set), unbound.
- **The parked job (context, never touched):**
  `1832c21fcf0425454227c4736048a8a632f422abca4a2685ddb775bb1681406a`,
  `parked_policy` rev 1; its definition set is idx 0–25
  (definitionDigest `b90c3cb3…`); idx 26 is the beyond-definition
  singleton.

**Explicitly out of scope:** every definition member of the parked
job (idx 0–25 — the exemption refuses them by name and this gate
never calls the release route); the completed Gate 4 plan and any
other plan; any other chapter or book, including the rest of
Forever Pucked (its own later gate — idx 26 does not ride along
with it; it is handled here or not at all, per design §11); Batch
arming or any Batch lane use; any change to the parked job's state
or rows; any settings change; any code upload or deploy; any
rollback; quarantine releases of any subject; the finalizer routes;
clearing any conflicts row; a second exemption, second submission,
or retry beyond §10's convergence rule. The Generate button is
live between re-arm and the closing holds — foreign generation =
STOP (§7.2).

## 3. Design basis and shipped-code conformance

The gate executes the DESIGN-PASSed Phase B (§6 E1b–E4b) on the
shipped build `1c2d1d0f`. Conformance notes — read before citing
the design against the code:

1. **The mechanism as shipped** (`worker/generation/park-release.mjs`,
   live tree): `POST /v2/d6-exempt-chapter-occurrence`, operator
   fence only, **no halt fence** (an execution-time fence adjustment
   that creates no work by itself — it may be called while HELD).
   Closed body allowlist `{jobId, occurrenceId, authorizationRef,
   source, note}` — a singleton by construction; one call can exempt
   exactly one occurrence. Fences, all before any write, in one
   transaction: job exists and is `parked_policy`; definition
   re-derived mechanically from the pinned records and cross-checked
   against the job's live identity and rows (any disagreement
   refuses pre-write); the occurrence is a row of THIS job; it is
   **outside** the definition set (a definition member refuses
   `chapter_exemption_inside_definition`); it is unbound; it is not
   covered by the live park release. Success returns
   `{outcome: "applied", alreadyExempted, jobId, occurrenceId,
   exemption: {…}}`; every anticipated refusal returns HTTP 200
   `{outcome: "rejected", reason}` and writes nothing.
2. **The append-only journal is a shipped addition beyond the v2
   text.** The design specified the singleton table with a tombstone
   flag; Rowan's build review (6548945443) additionally required
   `d6_chapter_exemption_events` — every state change (exempted /
   revoked / reactivated) journaled immutably *before* the
   projection update, in the same transaction. The shipped build
   carries it. Strengthening, not a conflict.
3. **No `chapter_exemption_not_beyond_definition` reason exists in
   the shipped code** (the design named it "as applicable"):
   beyond-set membership is enforced by the conjunction of
   is-a-row-of-this-job + not-inside-definition; there is no
   separate reason string. No operational difference for idx 26,
   the job's only beyond-definition row.
4. **How the exempted occurrence becomes generatable (shipped
   trace):** the live exemption rides the plane as `exemptIds`
   (content-plane adapter ← `liveParkFenceRecords`); the builder
   skips both parked dispositions for it and evaluates bound →
   voice → eligible. Generation carriage is then the ordinary D6
   path: one segment-scope SubmitJob (§6.4) builds the eligible set,
   filters to this occurrence, and creates a plan whose single entry
   is idx 26 (`eligible`, upper 153,636); the coordinator's grant
   machinery, phase fence, quota guard, and executor apply
   unchanged. The exemption creates no grant path of its own.
5. **Birth-mark ordering (load-bearing, from shipped
   `submitIntent`):** a plan submitted while GENERATION_HALT is "1"
   is quarantine-marked at birth (`born_while_halted`) and its
   spend authority is fenced behind an operator quarantine release
   — a mutation this gate does **not** carry. The execution order
   therefore places the submission **after** the halt lift (§6.4
   after §6.3), so the Phase B plan is born unmarked, exactly as
   Phase A's plan was born into the already-re-armed system. Any
   order that submits while halted is a defect in execution, not a
   variant.
6. **Voice-checkpoint placement:** the design places the binding
   voice read-back **after** the exemption (E1b), because no live
   surface evaluates idx 26's voice before the fences lift (§1.1).
   This proposal keeps the design's order. The §1.1 preflight
   derivation (shipped-code resolution over the unchanged live
   entity) is evidence the checkpoint will pass — it does not
   replace the checkpoint. The exemption is the cheapest mutation
   to hold under a STOP: it creates no work, spends nothing, and is
   tombstone-reversible (§8 contingency).

## 4. Figures

| figure | value |
|---|---|
| chars (live-plane basis) | 569 |
| expected cost `round(chars/15.96 × 225)` | **8,022 ≈ $0.008** |
| single-attempt upper `round(chars/10 × 225)` | 12,803 ≈ $0.013 |
| per-occurrence guard ceiling (12 × upper) | 153,636 ≈ $0.154 |
| phase fence at submission: settled 1,029,420 + reservedUnverified 5,648 + inFlightUpper 0 + pendingUpper 153,636 | **1,188,704 ≤ 13,500,000** ✓ |
| phase settled after, expected | ≈ 1,037,442 of 13,500,000 (7.7%) |
| first-pass dispatches expected / worst case | 1 / 12 |
| day headroom today (PT 2026-11-01) | 24 (≥ 12 ✓) |

**Settled cost as a function of the realized duration multiplier m**
(Gate 4 R1 method; settled ≤ m × 12,803 + (0.5m + 4.5), the
per-occurrence rounding allowance): m = 0.63 (Chapter 3's realized
ratio across both prior runs) → ≈ **8,071**; m = 1 → **12,808**;
m = 1.5 → ≈ 19,210; m = 2 → ≈ 25,612; m = 3 → ≈ 38,415; m = 5 →
≈ 64,022 (≈ $0.064 — still inside the phase fence by two orders of
magnitude).

**Cash view (qualified, per the R1 ruling):** Google bills per
input character. Submitted chars are bounded by 12 calls × 569 =
**6,828** (each call submits ≤ the whole segment; split leaves
partition it), converting to ≈ **$0.096** at the introductory rate
(≈ $14.10 per million chars, converted from Julie's verified
$0.81/audio-hour at the pinned 15.96 chars/sec) and ≈ $0.19 at the
doubled post-intro rate. The ledger figures above are duration-model
units (micro-dollars despite the `MicroCents` naming), not
provider-confirmed prices. Julie's prepay balance was **$17.83 as of
her Oct 29, 2026 screenshot — historical, not freshly verified**;
auto-reload is off. The $50 monthly cap gates only legacy-ledger
estimates at issuance and is not cited as a safeguard.

## 5. E0 — execution census (runs first; every item a hard expectation)

Read-only, in-session, before any mutation. Expectations are Gate
4's closing figures (§1.6); the executor verifies each live:

1. `/health`: build `1c2d1d0f…`, coordinator `armed`, generation
   `halted`. Worker etag `f15fb1ae…`; observability enabled +
   persisted (script-settings read).
2. Queue `delivery_paused: true` (cf-api read-back).
3. Capabilities: Batch unarmed; standard lane admitted; phase
   policy `enforce`; phase registry binds `forever-pucked` ↔ FP
   bookId (above).
4. Settings revision **1**.
5. Phase accounting opening set: settled **1,029,420**;
   estimatedUnverified **19,018**; reservedUnverified **5,648**;
   unknownOpen **0**; remaining **12,464,932**.
6. Quota: PT day dispatched **76** / reserved **0** / consumed **76**
   (or, on a later PT day, that day's own totals with **≥ 12 slots
   of headroom** — the census applies the §1.4 test to the live
   day); reconcile **`ok: true`** on full pagination, sole exception
   the known adjudicated straddler
   (`att-37d63768-db4b-447d-8150-580b7c6ee257`,
   `estimated_unverified`, never dispositionable). Prior PT days
   stand: 57 (Oct 29), 79 (Oct 30), 44/0/44 (Oct 31).
7. **No live grant; no active plan.** Plan `plan:e377a5559961b294154276b6`
   `complete` 23/23, failed 0, its grants all `reported`. Any live
   grant or non-terminal plan = deviation.
8. Chapter quote (chapterIndex 2): bound **26** / parked **1** /
   eligible **0** / voice_prompt **0**; digest **`9453ab5d…`**.
   Segment quote (idx 26): eligible **0**, exclusions parked **1**,
   same digest. (A live exemption from any prior act breaks items
   8's figures — §1.5 substitute (a).)
9. Content watermark **18** (the §1.1 voice derivation's input —
   any other value STOPS the gate until the derivation is re-run);
   bindings watermark **1841**; no bindings row for idx 26.
10. Conflicts: **exact match** to the pinned four-row
    `schedule_dead` baseline (ids 1–4 with their recorded
    occurrence ids and timestamps). No row cleared, none added.
11. Parked job: `parked_policy` rev 1, job-view body byte-identical
    to the Gate 3 closing capture (fingerprint basis `b991f18a…`);
    its live park release still names exactly the 23 ids of
    idx 3–25, state `live`.
12. R2: idx 26's storage key (§1.3) still FREE (re-LIST).

**STOP law (standing, verbatim in effect):** if any census item,
binding, plan state, grant state, or hard-stop figure differs from
the paperwork expectation — even by one item, even if it looks like
harmless known bookkeeping — STOP before any further mutation,
preserve the current state (apply containment holds if the gate has
already moved: re-pause first, then re-halt), and report the exact
deviation + proposed explanation to Julie and Rowan. The executor's
own tracing never clears its own stop. **The GO is consumed by a
STOP; no retry.** One GO = one execution attempt.

## 6. Execution sequence

### 6.1 E1 — Exemption (mutation 1)

Exactly ONE `POST /v2/d6-exempt-chapter-occurrence` (operator
fence) with body `{jobId: 1832c21f…, occurrenceId: 2a85f74f…,
authorizationRef: <Julie's recorded Phase B GO>, source, note}`.
No halt fence applies; the system is still HELD and paused, and
the call creates no work. Required response: `outcome: "applied"`,
**`alreadyExempted: false`**, and the returned exemption view
naming exactly idx 26 / the parked job / FP / chapterIndex 2,
`tombstoned: false`. **Any `rejected` outcome, any refusal reason,
or `alreadyExempted: true` = STOP** (§§1.5, 10) — refusals write
nothing, so a STOP here leaves the system byte-identical to census.

### 6.2 Voice checkpoint — HARD GATE (design §6 E1b read-back)

Immediately after E1, re-read the segment eligibility quote
(`scope=segment&occurrenceId=2a85f74f…`). Required: **eligible 1 /
569 chars / expected 8,022**, exclusions all zero, and the chapter
quote now bound 26 / parked **0** / eligible **1**. This read-back
is the binding quote for the gate.

- If the segment instead reads **`voice_prompt`** = **STOP**: no
  submission, no re-arm. A voice-mapping choice is Julie's separate
  decision and is not part of this gate. Under the same GO the
  exemption may be tombstoned (§8 contingency) to restore the
  pre-state, and that fact is reported before anything else
  happens (design §6 E1b). The GO is consumed.
- Any other mismatch (chars, counts, digest movement beyond the
  single disposition flip) = STOP under the STOP law.

### 6.3 R1 — re-arm: halt lift (mutation 2)

Lift GENERATION_HALT "1" → "0" FIRST, by the proven settings-only
mechanism (the operative-envelope flip used at Gate 4: the envelope
differs by exactly the halt value; code bytes otherwise identical).
Read-backs: `/health` generation `enabled`; script etag unchanged
(`f15fb1ae…`); parts inventory byte-identical apart from the halt
value; observability intact (no settings PATCH spent); queue still
paused; dispatched still at the census figure (nothing can deliver
while the queue is paused).

### 6.4 E2 — Submission (exactly ONE SubmitJob command)

Exactly ONE `SubmitJob` via `POST /v2/commands`, command_id
`fresh-ch3-<yyyymmdd>-fp-chapter3-idx26-v1` (execution date),
envelope `{command_id, type: "SubmitJob", payload: {bookId,
lane: "standard", data: {d6Intent: {scope: "segment",
occurrenceId: "2a85f74f…", phase: "forever-pucked",
keepGoing: false}}}}` — the intent nested at `payload.data.d6Intent`
(the shipped shape; an intent placed directly under `payload` is
rejected `job_shape` pre-write, Phase A's lesson). Submitted only
after R1, so the plan is born unmarked (§3.5).

Immediate plan read-back required: plan `active`; totals eligible
**1**; the single entry is idx 26 at **569 chars** with upper
**153,636**; a job created for exactly that entry. Ambiguous
submission response = read the plan inventory first; a byte-identical
retry converges on the same plan (shipped intent-key semantics) and
is the only permitted re-send; **no second intent with altered
semantics, ever, under this GO.** A `plan_overlap_conflict`,
`nothing_eligible` outcome, or any entry mismatch = STOP +
containment (re-halt; the queue was never unpaused).

### 6.5 Step 0 — delivery-safety verification

Before unpausing, verify from live reads that the grant the queue
will deliver belongs **exclusively** to the Phase B plan and its
single-occurrence cohort: grant id names the new plan and its
segment scope; the granted set is exactly {idx 26}; reservation
arithmetic closes (12 slots reserved against the live day, inside
the §5 headroom test); dispatched still at the census figure. Any
successor grant appearing during the gate receives the same
verification (Gate 4 R4 rule). An unverifiable or non-exclusive
deliverable grant = STOP + containment (re-halt).

### 6.6 R2 — queue unpause (mutation 3; last opening move)

PUT the queue `delivery_paused: false`; cf-api read-back proves it.
Generation is autonomous from here; the executor submits nothing
further and calls nothing manually.

### 6.7 G — monitored generation

Poll at Gate 4's standard (plan view, job view, quota, reconcile,
phase accounting, bindings watermark, conflicts) until the plan
leaves `active`. Expected shape: one grant, one cohort of one
occurrence; 1 first-pass dispatch; the grant closes `reported`
(the executor's end-of-message report — the Phase A stuck-grant
shape is watched for, §7.3); plan `complete` 1/1. POLICY_BLOCK
handling is the shipped machinery's: recursive splitting without
voice substitution, server-owned repair chains, all inside the
occurrence's 12-dispatch budget. A terminal POLICY_BLOCK (plan
ends `partial` / blocked) = STOP outcome, reported plainly: the
chapter is then **not** finished until a separate gated program
resolves it. An `unknown` billing outcome halts the phase itself
and = STOP + containment; no figure is ever written as a known
charge on a model's say-so (the Chapter 2 law).

## 7. Monitoring rules

### 7.1 Detection figures (Approach 2 labeling — detection-only, never a cap)

- **Forecast line: 12,808 units** (the m = 1 modeled bound, §4).
  Cumulative gate settled-delta crossing it = STOP + containment,
  treated as evidence of unmodeled work (Gate 4's rule, scaled).
- **Detection threshold — PROPOSED: 25,000 units (≈ $0.025)**,
  cumulative across the gate. It is a **detection threshold, not a
  guaranteed cap** (Rowan's R1 ruling, carried forward): polls
  observe the running settled total; crossing = STOP + containment
  (re-pause → re-halt). The figure sits at 3.1× the expected cost
  and ≈ 1.95× the m = 1 bound; it is crossed only at realized
  m ≈ 1.95 — audio at ~5.1 chars/sec against a model floor of 10
  and a realized Chapter 3 ratio of ≈ 0.63 (≈ 16 chars/sec). Even
  the m = 5 scenario (≈ $0.064) is bounded by the phase fence
  (§4) and the prepay backstop. Rowan's review may set this figure;
  it is labeled PROPOSED here deliberately.
- Inter-poll exposure is bounded by the single in-flight cohort:
  one occurrence, ≤ 12 dispatches, ≤ the §4 m-parameterized bound.

### 7.2 Foreign generation = STOP

Any movement not belonging to the Phase B plan — another plan/job
changing state, a grant not naming the Phase B plan, phase settled
delta beyond this plan's own settlements, bindings watermark
advancing by anything other than this segment's single binding,
the parked job or its release record changing in any way, Batch
arming — = STOP + containment (re-pause → re-halt), no repair, GO
consumed. The Generate button is live from R1 until the closing
holds; Julie's hands-off understanding from Gate 4 applies
unchanged.

### 7.3 Stall, scaled to one segment

Healthy completion is expected in minutes (Gate 4's cohorts of 8
closed in ≈ 6 minutes). Stall test = Gate 4's sliding window
applied to the single grant: observations **≥ 35 minutes apart**,
with all intervening observations checked, showing no progress —
where *progress* means any of: grant state change, attempt
recorded, plan totals change, grant voided-and-replaced (a lease
expiry + successor grant is continuation, not stall, provided the
successor passes §6.5 verification). The Phase A signature —
grant still `issued` past its 15-minute lease with its reservation
unclosed and no successor issuable — is a stall if it persists
across the window. A declared stall = STOP + containment; the GO
is consumed; the finalizer is **not** invoked under this GO under
any circumstance.

### 7.4 Rollover

Execution is expected to complete inside one PT day. If the run
crosses 07:00Z mid-generation, rollover is normal continuation:
before/after day snapshots are taken (Gate 4 A5 protocol), the
§7.1 figures remain cumulative across the rollover, and the new
day's dispatches count against the new day's fence.

## 8. Executor mutation budget — exactly 5, plus two named non-mutations

| # | mutation | mechanism |
|---|---|---|
| 1 | **Exemption grant** | `POST /v2/d6-exempt-chapter-occurrence` (§6.1) |
| 2 | **Halt flip** (lift) | settings-only envelope flip (§6.3) |
| 3 | **Queue unpause** | cf-api queue PUT (§6.6) |
| 4 | **Queue re-pause** | cf-api queue PUT (§9.1) — first closing move |
| 5 | **Halt restore** | settings-only envelope flip (§9.1) |

Named acts that are **not** executor state mutations (counted and
limited separately, as in Phase A / Gate 4): **exactly ONE
SubmitJob command** (§6.4 — the generation submission itself), and
the board filings (GO record + execution record — record-keeping,
not production state).

**Contingency only — not counted unless used:** ONE
`POST /v2/d6-revoke-chapter-exemption` (§6.2's voice_prompt STOP,
or a §10 STOP after E1 where restoring the pre-state is the safe
containment), with its own authorizationRef under the same GO,
journaled by the shipped append-only events table. If used, it is
reported as a sixth mutation with its reason before anything else
is claimed about the gate. The revoke is never used speculatively
and never after successful generation (tombstoning cannot
un-publish a binding — design §5B.2.4).

No other mutation is authorized: no second exemption call (the
route's idempotent duplicate is a no-op success but is still not
called twice), no release-route call, no quarantine release, no
finalizer call, no settings write, no code upload.

## 9. Closing, read-backs, acceptance

### 9.1 Closing holds

On plan completion (or on any §7 STOP after R2): **re-pause the
queue FIRST** (mutation 4; cf-api read-back `delivery_paused:
true`), **then restore the halt** (mutation 5; read-back
GENERATION_HALT "1", `/health` `halted`, etag unchanged,
observability intact).

### 9.2 E4 — closing read-backs (all required)

1. Phase B plan `complete`, totals eligible 1 / done 1 / failed 0 /
   blocked 0; its grant(s) all `reported`.
2. **Chapter quote: bound_already 27 / parked 0 / eligible 0 /
   voice_prompt 0** — every segment of the chapter as it exists
   live has audio (design §10C.1). A bindings row for idx 26
   exists; the chapter delta from census is exactly that one
   occurrence moving parked → bound (design §10B.2).
3. Bindings watermark **1842** (= 1841 + exactly 1); content
   watermark **18** unchanged.
4. Phase accounting: settled increased by this plan's recorded
   settlement only (expected ≈ +8,022); estimatedUnverified /
   reservedUnverified unchanged; unknownOpen **0**; reconcile
   `ok: true`, no new exceptions.
5. PT day totals consistent with §§1.4/7.4 (expected: +1 dispatch;
   bound: ≤ +12).
6. Conflicts exact-match to the pinned four-row baseline; settings
   revision 1; parked job byte-identical to census (still
   `parked_policy` rev 1 — by design it keeps its 24 pending rows;
   the release record unchanged; the exemption record reads `live`
   naming exactly idx 26, with exactly one `exempted` event in its
   journal).
7. End state HELD certified: queue paused + halt "1" + build
   `1c2d1d0f…` + etag `f15fb1ae…` + observability on + Batch
   unarmed + nothing in flight.

### 9.3 Julie's playback check — the acceptance step (hers, outside the executor's verdict)

Julie opens Chapter 3 in the app. Expected header: **"Complete
27/27"** — the shipped client projection's full-completion form
(`projection.js`: label `Complete` renders `Complete ${total}/${total}`;
the `Partial n/27` form appears only while segments are missing).
Caveat: the label is computed from device-verified audio, so an
"Uncertain" reading on a device that has not yet verified the new
segment's bytes is a device-verification state, not a generation
failure (Gate 4 precedent). Acceptance = the chapter plays **in
sequence through its end**: idx 26's audio present and audible as
the chapter's final segment (design §10C.3). Only with §§9.2 +
9.3 both holding is Chapter 3 called **finished**.

### 9.4 Record

The executor writes the execution record (every census line, the
exemption response, the checkpoint quote, each mutation with
timestamps and read-backs, the generation timeline, closing
figures, ends-HELD certification), pins it as a child of this
proposal's pin, and files the summary on the board (issue #15)
with a fresh RT-H ID. Julie's playback result is recorded when she
gives it, as at Gate 4.

## 10. STOP law and GO semantics

The §5 STOP law governs every stage. Stage-specific containment:
before E1 — nothing to contain (system untouched); after E1, before
R1 — the §8 contingency revoke is available under the same GO to
restore the pre-state, and is reported first; after R1, before R2 —
re-halt; after R2 — re-pause, then re-halt. **One GO = one
execution attempt.** A STOP consumes the GO at every stage,
including the §6.2 voice checkpoint. No stage is retried, re-run,
or repaired under the same GO.

## 11. NOT authorized by this gate

Phase B execution itself (until Julie's separate GO after Rowan's
review); any use of the exemption for any other occurrence or job;
any release-route call; the rest of Forever Pucked; Batch; any
deploy, merge, or code change; Issue #16; legacy snapshot
retirement; clearing any conflicts row; the winner-provenance read.

## 12. Decision points

- **Rowan:** review of this proposal — in particular the §7.1
  PROPOSED detection threshold (25,000), the §6 order (exemption →
  checkpoint → R1 → submission → step 0 → R2, per the §3.5
  birth-mark constraint), and the §1.5 no-read-surface substitutes.
- **Julie (after Rowan):** the execution GO — naming idx 26, its
  quote (569 chars; expected 8,022 ≈ $0.008), and the detection-only
  character of the §7.1 figures. Scheduling note (arithmetic only,
  §1.4): the gate fits today's remaining headroom in full, or a
  fresh PT day after 07:00Z.

— Wren (preparation; no production state touched)
