# CHAPTER 3 RE-ARM EXECUTION RECORD — RE-ARM ONLY

Executed 2026-10-31, 22:30:28–23:38:51Z, under Julie's
explicit approval (issue #15 comment 6549988362 — button tap
in the Coding Projects chat recorded by Wren, 2026-10-31
~6:28 p.m. ET: "GO — re-arm (one R0–R6 attempt)"), of the
proposal pinned `19af668f95f10518aa4c6a96960f362f4345983e`
on `ui1-review` (`jedavid33-design/opal-reader`), which
carries Rowan's PASS FOR JULIE DECISION (6549974399). The
decision text Julie approved carried the disclosure
prominently: flipping `GENERATION_HALT` to `"0"` makes the
app's Generate button live immediately, even while the
queue remains paused. Live build throughout:
`63d7260ef0c87c45cdcb88c7007643bb90e1631c`, script etag
`82053d4d75533056753c5ee6225e0de56e29ecb1de980aa543cdba613a59d6be`
— **unchanged by the flip** (content-derived: identical
module bytes, metadata-only one-value change).

**Outcome: RE-ARM COMPLETE — R0–R6 ALL PASS, no STOP, no
containment, no rollback.** End state: **LIVE-BUT-IDLE** —
`GENERATION_HALT "0"`, queue delivery enabled, quota guard
armed with a fresh in-session census `ok: true`, no active
plan, nothing submitted, nothing generated, no provider
call, nothing spent, Batch unarmed (Standard-only
preserved), Chapter 3 parked, the three mechanism tables
still nonexistent (no release/exemption row written; the
eligibility read is byte-identical in composition to the
pre-state). Exactly **two mutations** were made: the R1
metadata-only halt flip upload (byte-identical code, one
binding value) and the R4 queue-unpause PUT. The
conditional observability PATCH was **not** triggered —
observability survived the flip upload, as it has at every
deploy and flip in this chain. Raw captures:
`~/workspace/ch2-program/ch3-rearm/execution/evidence/`
(354 files; suffixes r0 / census / preflip / r1 / r2mid /
r2end / r3 / r4 / r5mid / r5end / r6 + flip and unpause
artifacts).

Labels: **CONFIRMED** = read back from production in this
session. **INFERRED** = deduced from cited in-session
evidence. **OPEN** = unresolved (none outstanding).

## R0 — preconditions: ALL PASS (capture 22:30:28Z; evidence/*-r0)

1. **Julie's approval — CONFIRMED.** Comment 6549988362
   read firsthand from the board before any mutation: it
   records Julie's tap for exactly this gate's scope (one
   R0–R6 attempt; fresh `ok === true` census as a hard
   precondition; halt flip first; unpause last; two
   ≥30-minute watched windows; containment pre-authorized
   inside the gate; no release/exemption, no submission,
   no generation, no spend, no Batch).
2. **Build identity — CONFIRMED.** `/health` build
   `63d7260e…`, generation `"halted"`, coordinator
   `"armed"`, scope `"production"`. Script GET etag
   `82053d4d…` exact (1,383,556 B); downloaded parts
   parsed (29 parts) and byte-compared against the **Ch 3
   deploy pin's 29-part inventory**: **29/29
   byte-identical, no extras**
   (evidence/parts-compare-r0.json).
3. **Hold state — CONFIRMED.** Bindings: exactly the 10
   expected names; `GENERATION_HALT "1"`;
   `OPALREADER_PHASE_POLICY "enforce"`. Observability
   enabled + logs enabled + persist (script-settings
   read).
4. **Queue still paused — CONFIRMED.** `delivery_paused ==
   true`, retention 86,400 s, sole consumer
   `f260f2188d80426bb0588685e9d084eb`
   (`opalreader-api-v2-prod`), sole producer the same
   script.
5. **Guard state — CONFIRMED.** Operator reconcile:
   `armed: true` (the full fresh census is item 13 below).
6. **Settings — CONFIRMED.** Revision **1**, lane
   `standard`, monthly cap $50. Verify only; no settings
   write was sent in this run.
7. **Phase figures — CONFIRMED.** `forever-pucked`:
   settled **579,339**; estimatedUnverified **19,018**;
   reservedUnverified **5,648**; inFlightUpper 0;
   unknownOpen **0**; remaining **12,915,013** of
   13,500,000; `unverifiedStatus: provider_unverified`.
   (Standing disclosure: the 19,018 is an
   occurrence-length model proxy, not an observed Google
   charge; the 5,648 is a modeled allowance, not a
   provider ceiling; the actual charge for the
   adjudicated attempt remains UNKNOWN. Nothing in this
   gate touched that record.)
8. **Watermarks — CONFIRMED.** Content **18** / bindings
   **1818**.
9. **Plan + job/grant inventory — CONFIRMED.** Exhaustive
   plan list (nextCursor null) = exactly three plans:
   smoke `plan:3183ecbf2ac4bf50bbc6166e` **complete**; old
   Ch 2 `plan:603ab416bd67ab1b25de97be` **retired** /
   `retired_unknown_billing`; fresh Ch 2
   `plan:b2dc2a3d1cd367a0245b9102` **complete**. No active
   plan; no plan quarantine-held (`held: false` on all
   three per-plan reads). Stale Ch 2 job `…:ch1`
   `generating` rev 2, 18 rows all `granted`, grant
   `grant:plan:603ab416bd67ab1b25de97be:ch1:1:full`
   `issued` rev 2. Smoke job `…:seg` `generating` rev 2,
   grant `issued` rev 2. **Fresh Ch 2 job read and
   recorded:** `plan:b2dc2a3d1cd367a0245b9102:ch1` state
   `generating` rev 2, its grant `issued` rev 2, 18
   occurrence rows all `ready` — the `issued`-residue
   shape §2/§5 anticipated, covered by the plan-state
   proof (plan `complete` ∈ REFUSED); it is **not**
   `handoff_uncertain`, so the Path-E R0 STOP does not
   arise. Ch 3 job `1832c21f…` `parked_policy` **rev 1**,
   grants [], 27 rows (3 ready / 24 pending), fingerprint
   recomputed by the G8 recipe =
   `b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`
   (**exact**).
10. **Conflicts — CONFIRMED.** Exactly the same 3
    `schedule_dead` rows (ids 1/2/3), all with the known
    `LIKE or GLOB pattern too complex: SQLITE_ERROR`
    lease signature; the conflicts payload is raw-hash-
    identical to the Ch 3 deploy's closing capture
    (SHA-256 of canonical body
    `57258e91e77ac3c5cbe5498a9889111eea4644c9194d571dd8a2c7bbd806f436`).
11. **No in-flight work — CONFIRMED.** Attempt inventory
    across the three plans' diagnostics: 7 + 51 + 79 =
    **137** attempts, **all** phase `confirmed`, zero in
    flight; all execution records terminal (committed /
    failed; the one `unknown_billing` record is the
    `reconcile_hold` class `recover()` skips).
12. **Mechanism surface untouched — CONFIRMED.** Chapter
    3 chapter-scope eligibility read: eligible **0**;
    exclusions `bound_already: 3, parked: 24` (voice_prompt
    0, other 0); digest
    `12930307b7bda4cb438e2f981a62e052f40ede5dd5533be1a3b5c3fc67b4e71d`
    — identical to the deploy's closing read. No release
    or exemption has been written by anyone since the
    deploy.
13. **The fresh census (hard gate) — COMPLETE,
    `ok === true`** (22:31:04Z;
    evidence/census-page-000…003-r0.json). Four operator
    `GET /v2/d6-quota-reconcile` reads, all HTTP 200,
    archived verbatim, with a cf-api queue-pause read-back
    in the same pass (`delivery_paused == true`,
    evidence/queue-census.json):

    | Page | Offsets (exc/drift) | exceptionCount | driftCount | censusComplete |
    |---|---|---|---|---|
    | 000 | default (0/0) | 1 | 0 | **true** |
    | 001 | explicit 0/0 | 1 | 0 | **true** |
    | 002 | explicit 1/0 (past-end probe) | 1 | 0 | false (definitional) |
    | 003 | default (0/0), closing read | 1 | 0 | **true** |

    Completeness under gate-(b) §5.3 — **CONFIRMED**:
    pages disjoint (the offset-0 response holds the whole
    exceptions array, 1 of 1; the past-end probe returns
    an empty slice); union = totals (1 exception, 0
    drift); totals identical on first and last page;
    `censusComplete` true on the closing offset-0 read
    (page 002's `false` is the confirmed definitional
    semantics — true only when one response holds both
    arrays whole — not a §5.4 event). Content:
    **`armed: true`, `ok: true`,
    `currentDayBlocked: false`**, drift EMPTY, day totals
    PT 2026-10-29 = 57, PT 2026-10-30 = 79, current day
    (2026-10-31) = 0; the single exception is the known
    adjudicated attempt
    `att-37d63768-db4b-447d-8150-580b7c6ee257`
    (`estimated_unverified`, interval PT 2026-10-29 →
    2026-10-30, not current-day). The §3 flip precondition
    is satisfied **at this moment**, in this session — no
    earlier census was relied on.

No drift → proceed. Precondition read-back immediately
before R1 (evidence/*-preflip.json): queue still PAUSED,
`/health` still `"halted"`, build still `63d7260e…`.

## R1 — R-flip, `GENERATION_HALT "1"` → `"0"`: PASS (PUT window 22:31:36–22:31:38Z)

Mechanism — gate (c)'s executed flip exactly, with this
gate's manifest (the Ch 3 deploy pin's 29-part inventory).
Pre-PUT proofs, all PASS:

- Live parts (R0 download) byte-identical to the deploy
  pin's parts inventory, 29/29 (above).
- Flip metadata produced by targeted byte surgery on the
  deploy's operative assembled metadata
  (`ch3-deploy/execution/operative/assembled-metadata.json`):
  **exactly one byte differs** (offset 688, `1` → `0`
  inside the `GENERATION_HALT` binding); parsed deep-diff
  = exactly one path (`.bindings[4].text`).
- **Restore check:** the envelope assembled from the live
  parts + the unmodified operative metadata + the deploy
  boundary (`----opalreader-final-envelope-d1`) reproduces
  the deployed operative envelope **byte-for-byte**
  (SHA-256
  `a371621d0d22bcfdf7f7e137966bf2f301bf0970d5898a25e65968ee93bfeaa7`,
  1,386,657 B), so the flip envelope (SHA-256
  `c0c7732660442543b2f9080b8f164ce40561b65aa999974db78aeebf3d9b18ff`,
  1,386,657 B) differs from the exact bytes that produced
  the live build by that one value only. Compatibility
  2026-08-29 + `nodejs_compat` and `main_module`
  preserved; secrets inherit-by-name.

PUT: **HTTP 200, success**; deployment id
`0e05aa5e91554cd0a2ea6a0e10e92ab4`; entry point
`v2/worker-entry-prod-d6.js`. The response was complete
and readable — no ambiguity arose, and no re-flip was
attempted or needed.

Read-backs (capture 22:31:51Z; evidence/*-r1): `/health`
generation **`"enabled"`**, build still `63d7260e…`;
bindings exactly the 10 expected names, **name-keyed diff
vs R0 = exactly one entry** (`GENERATION_HALT "1"` →
`"0"`); script GET etag **`82053d4d…` — UNCHANGED**, and
the downloaded parts re-verified byte-identical to the
inventory (29/29, evidence/parts-compare-r1.json).
Observability **survived** the upload (enabled + logs
enabled + persist, shape-identical to pre-flip): **no
settings PATCH was needed or sent.** Queue still paused.
A full watched-set comparison r1 vs r0, with the two
intended changes masked, shows **zero** other
differences — including the Chapter 3 eligibility digest,
unchanged.

## R2 — First watched window (armed-idle, queue still paused): PASS — zero movement

Watched set (proposal §6) captured at start (the R1
capture, 22:31:51Z), middle (22:48:16Z), and end
(23:04:38Z) — a **32 min 47 s** window, ≥ the required 30
minutes (longest relevant fuse 15 min + one full 10-min
watchdog cycle + margin), spanning multiple alarm passes.
Comparison, value-by-value, mid and end vs start: **zero
movement on every surface** — `/health`; bindings; etag;
observability; settings rev 1; client quota view
(attemptsToday 0, providerDispatchesToday 0, ledgerSeq
37); reconcile summary (`armed: true`, `ok: true`,
`currentDayBlocked: false`, drift 0, exceptions 1, day
totals unchanged); plan list + all three plan reads; all
four job reads + all three grant reads (incl. the fresh
Ch 2 job, byte-identical) + Ch 3 fingerprint; **conflicts:
count 3 AND max id 3, payload raw-identical**; phase
figures; watermarks 18/1818; Chapter 3 eligibility
composition (0 / `bound_already: 3, parked: 24`, digest
unchanged). No new attempt, no state or revision change,
no new conflict row. Per §5.4 the window is bounded
observation, not exhaustive schedule proof — the §5
source-path fences, not the window, are the load-bearing
proof; the observation corroborates them: with the halt
lifted but the queue paused, the alarm machinery ran and
selected nothing.

## R3 — Mid-state verification: PASS (capture 23:05:03Z)

With the queue still paused and R2 clean: the full §6
watched set re-verified once more — identical to R0
except the two intended R1 changes. Queue state re-read
by cf-api: `delivery_paused == true` still (the unpause
had not happened), sole consumer unchanged. Settings rev
1 unmodified (canonical hash identical to R0 — this gate
sent no settings write; the conditional observability
PATCH was not triggered at R1). Chapter 3 eligibility
read still returns the parked inventory (eligible 0;
`bound_already: 3, parked: 24`; digest unchanged) — the
mechanism surface still untouched with the halt now
lifted. No mismatch → proceed to R4.

## R4 — R-unpause, LAST: PASS (PUT 23:05:32Z)

cf-api PUT the queue with `queue_name` +
`settings.delivery_paused: false` (positional argv JSON):
HTTP 200, success. **Independent read-back**
(evidence/queue-after-unpause.json): `delivery_paused ==
false`, retention 86,400 s unchanged, sole consumer
`f260f2188d80426bb0588685e9d084eb` and sole producer
`opalreader-api-v2-prod` unchanged. An immediate full
sweep (capture 23:05:33Z) showed zero movement on every
surface except the intended queue value. No mutation
follows R4 in this gate.

## R5 — Second watched window (live, queue delivering): PASS — zero movement

Watched set captured at start (23:05:33Z), middle
(23:22:03Z), and end (23:38:25Z) — **32 min 52 s** from
the start sweep (32 min 53 s from the unpause), ≥ the
required 30 minutes, with the queue delivering
throughout. Comparison, value-by-value, mid and end vs
start: **zero movement on every surface** (same read set
as R2, incl. conflicts count 3 / max id 3 with payload
raw-identical, the eligibility digest unchanged, and the
fresh Ch 2 job byte-identical). Any message drained from
the outbox at the flip (§5 Path D) met the §5 Path A
fence exactly as traced: refusal-with-ACK writes nothing,
and nothing was written — no attempt, plan, job, grant,
figure, watermark, eligibility, or conflict movement of
any kind. As at R2, this is bounded observation
corroborating the fences, not a proof of schedule
emptiness.

## R6 — Closing inventory + final state: PASS (capture 23:38:51Z)

Closing sweep of the full §6 watched set, plus a fresh
reconcile summary read: `armed: true`, **`ok: true`**,
`currentDayBlocked: false`, drift 0, exceptions 1, day
totals PT 2026-10-29 = 57 / 2026-10-30 = 79 /
2026-10-31 = 0 (evidence/reconcile-r6.json — a summary
read; the R0 census remains this gate's census of
record). Full-set comparison vs R0, with the three
intended changes masked (`GENERATION_HALT "0"`,
`/health`/`capabilities` generation `"enabled"`, queue
`delivery_paused false`): **zero differences.** In
detail: `/health` build `63d7260e…`, generation
`"enabled"`, coordinator `"armed"`; script etag
`82053d4d…` unchanged; phase figures, watermarks 18/1818,
settings rev 1, Ch 3 job `parked_policy` rev 1 with
fingerprint `b991f18a…`, eligibility (0 /
`bound_already: 3, parked: 24`, digest
`12930307…`) — all identical to R0. Zero new attempts
(137, all `confirmed`). No release or exemption rows
exist — the eligibility composition is the direct
observable, and it never changed. Batch still unarmed:
capabilities read `batch: admitted false
(batch_not_armed)`, `standard: admitted true` — the
Standard-only arming state preserved. Nothing generated,
no provider/Google call, nothing spent.

## End state

**Live but idle.** `GENERATION_HALT "0"`, queue
delivering, quota guard armed with this session's fresh
`ok: true` census on record, no active plan, nothing
generated, nothing spent, Batch unarmed, Chapter 3 parked
(`parked_policy`, fingerprint exact), mechanism tables
still nonexistent. Rollback floor unchanged (build
`6a73d962…` was not implicated in either direction; this
gate's reversal would have been same-build re-pause +
re-halt under §7 — neither was invoked).

**Not done, by design (§9):** no `SubmitJob` or intent of
any scope; no call — valid, invalid, or probative — to
any of the four Chapter 3 operator routes (no release, no
exemption, no revocation, and therefore no creation of
`d6_park_releases`, `d6_chapter_exemptions`, or
`d6_chapter_exemption_events` rows or tables); no
generation, synthesis, or provider call; no spend or
top-up; no Batch arming; no Chapter 3 action beyond the
read-only eligibility and job reads in the watched set;
no quarantine release; no settings change (the
conditional observability PATCH was not triggered); no
client publication; no code deploy (the R1 upload was
byte-identical code with a one-value metadata diff); no
clearing or mutation of the stale job/grant, the smoke
residue, or the 3 `schedule_dead` records; no disposition
or settlement action; no build rollback.

**Standing note for Julie's later decisions (proposal
§§0/10, carried):** the system is now live — the app's
Generate control is live with it. Phase A (Chapter 3, the
23 released segments), Phase B (the final segment),
generation for the rest of Forever Pucked, and Batch
remain four separate, distinct approvals, each still
unrequested and unauthorized.

— Wren (execution agent)
