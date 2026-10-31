# GATE-(c) EXECUTION RECORD — RE-ARM ONLY

Executed 2026-10-31, 18:40–19:48Z, under Julie's explicit
approval (issue #15 comment 6547568486 — button tap recorded by
Wren from the Coding Projects chat, 2026-10-31: "GO — re-arm
only, exactly as scoped (fresh census must read clean, halt
flip first, unpause last, watched windows)"), of the proposal
pinned `73aa1220514007107f7b3a43c19ee27ff6a3d5ec` on
`ui1-review` (`jedavid33-design/opal-reader`), which carries
Rowan's GATE-(c) PROPOSAL PASS (6547501274) after her
CONDITIONAL PASS corrections (6547455532). Live build
throughout: `945875bc26b0e2ca965d5c0f710f11c0164025f8`, script
etag `d63b61c349a3518998d29d318ec465af24a63468df6cdf4876e4ba8862849039`
— **unchanged by the flip** (content-derived: identical module
bytes, metadata-only one-value change).

**Outcome: RE-ARM COMPLETE — R0–R6 ALL PASS, no STOP, no
containment, no rollback.** End state: **live but idle** —
`GENERATION_HALT "0"`, queue delivery enabled, quota guard
armed with a fresh in-session census `ok: true`, no active
plan, nothing generated, no provider call, nothing spent,
Batch unarmed (Standard-only preserved), Chapter 3 parked.
Exactly two mutations were made: the R3 metadata-only halt
flip upload (byte-identical code, one binding value) and the
R5 queue-unpause PUT. Raw captures:
`~/workspace/ch2-program/gate-c-rearm/execution/evidence/`
(suffixes r0 / census / r3 / r4mid / r4end / r6start / r6mid /
r6end + flip and unpause artifacts).

Labels: **CONFIRMED** = read back from production in this
session. **INFERRED** = deduced from cited in-session
evidence. **OPEN** = unresolved (none outstanding).

## R0 — twelve preconditions: ALL PASS (capture 18:40:51Z; evidence/*-r0)

1. **Build identity — CONFIRMED.** `/health` build
   `945875bc…`, generation `"halted"`, coordinator `"armed"`,
   scope `"production"`. Script GET etag `d63b61c3…` exact
   (1,336,783 B); downloaded parts parsed (28 parts) and
   byte-compared against the gate-(a) d1-operative
   parts-manifest: **28/28 byte-identical, no extras**
   (evidence/parts-compare-r0.json).
2. **Hold state — CONFIRMED.** Bindings: exactly the 10
   expected names; `GENERATION_HALT "1"`;
   `OPALREADER_PHASE_POLICY "enforce"`. Observability
   enabled + logs enabled + persist (script-settings read).
3. **Queue still paused — CONFIRMED.** `delivery_paused ==
   true`, retention 86,400 s, sole consumer
   `f260f2188d80426bb0588685e9d084eb`
   (`opalreader-api-v2-prod`), sole producer the same script.
4. **Guard state — CONFIRMED.** Operator reconcile:
   `armed: true` (full fresh census is §4/RC below).
5. **Settings — CONFIRMED.** Revision **1**, lane
   `standard`, monthly cap $50. Verify only; no settings
   write was sent in this run.
6. **Phase figures — CONFIRMED.** `forever-pucked`:
   settled **579,339**; estimatedUnverified **19,018**;
   reservedUnverified **5,648**; inFlightUpper 0;
   unknownOpen **0**; remaining **12,915,013** of
   13,500,000; `unverifiedStatus: provider_unverified`.
   (Standing disclosure: the 19,018 is an occurrence-length
   model proxy, not an observed Google charge; the 5,648 is
   a modeled allowance, not a provider ceiling; the actual
   charge for the adjudicated attempt remains UNKNOWN.
   Nothing in this gate touched that record.)
7. **Watermarks — CONFIRMED.** Content **18** / bindings
   **1818**.
8. **Plan inventory — CONFIRMED.** Exhaustive list
   (nextCursor null) = exactly three plans: smoke
   `plan:3183ecbf2ac4bf50bbc6166e` **complete**; old Ch 2
   `plan:603ab416bd67ab1b25de97be` **retired** /
   `retired_unknown_billing`; fresh Ch 2
   `plan:b2dc2a3d1cd367a0245b9102` **complete**. No active
   plan; no plan quarantine-held (`held: false` on all
   three per-plan reads).
9. **Job/grant inventory — CONFIRMED.** Stale Ch 2 job
   `…:ch1` `generating` rev 2, grant
   `grant:plan:603ab416bd67ab1b25de97be:ch1:1:full`
   `issued` rev 2. Smoke job `…:seg` `generating` rev 2,
   grant `issued` rev 2. **Fresh Ch 2 job read and
   recorded:** `plan:b2dc2a3d1cd367a0245b9102:ch1` state
   `generating` rev 2, its grant `issued` rev 2, 18
   occurrence rows all `ready` — the `issued`-residue shape
   §2/§5 anticipated, covered by the plan-state proof
   (plan `complete` ∈ REFUSED); it is **not**
   `handoff_uncertain`, so the Path-E5 R0 STOP does not
   arise. Ch 3 job `1832c21f…` `parked_policy` **rev 1**,
   grants [], 27 rows (3 ready / 24 pending), fingerprint
   recomputed by the G8 recipe =
   `b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`
   (**exact**).
10. **Conflicts — CONFIRMED.** Exactly the same 3
    `schedule_dead` rows (ids 1/2/3); the conflicts payload
    is raw-hash-identical to gate-(b) B0's capture.
11. **No in-flight work — CONFIRMED.** Attempt inventory
    across the three plans' diagnostics: 7 + 51 + 79 =
    **137** attempts, **all** phase `confirmed`, zero in
    flight; all execution records terminal (committed /
    failed; the one `unknown_billing` record is the
    `reconcile_hold` class `recover()` skips).
12. **Julie's approval — CONFIRMED.** Comment 6547568486
    read firsthand from the board before any mutation: it
    records Julie's tap for exactly this gate's scope
    (R0 STOP-on-drift; fresh census `ok === true` as a hard
    precondition; halt flip first; unpause last; watched
    windows; re-arm only — no generation, Batch, or spend).

No drift → proceed.

## RC — fresh complete census: COMPLETE, `ok === true` (evidence/census-page-000…003.json)

Four operator `GET /v2/d6-quota-reconcile` reads, all
HTTP 200, archived verbatim, with a cf-api queue-pause
read-back in the same pass (`delivery_paused == true`,
evidence/queue-census.json):

| Page | Offsets (exc/drift) | exceptionCount | driftCount | censusComplete |
|---|---|---|---|---|
| 000 | default (0/0) | 1 | 0 | **true** |
| 001 | explicit 0/0 | 1 | 0 | **true** |
| 002 | explicit 1/0 (past-end probe) | 1 | 0 | false (definitional) |
| 003 | default (0/0), closing read | 1 | 0 | **true** |

Completeness under gate-(b) §5.3 — **CONFIRMED**: pages
disjoint (the offset-0 response holds the whole exceptions
array, 1 of 1; the past-end probe returns an empty slice);
union = totals (1 exception, 0 drift); totals identical on
first and last page; `censusComplete` true on the closing
offset-0 read (page 002's `false` is the confirmed
definitional semantics — true only when one response holds
both arrays whole — not a §5.4 event). Content:
**`armed: true`, `ok: true`, `currentDayBlocked: false`**,
drift EMPTY, day totals PT 2026-10-29 = 57, PT 2026-10-30 =
79, current day (2026-10-31) = 0; the single exception is
the known adjudicated attempt
`att-37d63768-db4b-447d-8150-580b7c6ee257`
(`estimated_unverified`, interval PT 2026-10-29 → 2026-10-30,
not current-day). The §4 flip precondition is satisfied **at
this moment**, in this session — gate (b)'s census was not
relied on.

## R2 — settings + routing verify-only: PASS (no write)

Settings rev 1 confirmed at R0 (item 5) — not modified.
Queue attachments read back at R0 (item 3) and again in the
census pass: sole consumer/producer `opalreader-api-v2-prod`;
bindings show the queue binding present and
`GENERATION_HALT` still `"1"`; `/health` still `"halted"`.
Precondition read-back immediately before R3 (evidence/
*-preflip.json): queue still PAUSED, halt still `"1"`, build
still `945875bc…`, reconcile still `armed/ok: true`.

## R3 — R-flip, `GENERATION_HALT "1"` → `"0"`: PASS (PUT window 18:41:58–18:42:01Z)

Mechanism — Gate-7's A4 exactly, with this gate's manifest
(the gate-(a) operative envelope). Pre-PUT proofs, all PASS:

- Live parts (R0 download) byte-identical to the operative
  parts-manifest, 28/28 (above).
- The operative upload metadata
  (`final-envelope/d1-operative/assembled-metadata.json`)
  keyed-compared against the live `/settings` bindings:
  names equal, **zero value diffs** (secret bindings are
  `inherit` in upload metadata vs `secret_text` as stored —
  the type normalization the operative deploy itself used;
  queue/DO/R2 binding targets identical).
- Flip metadata produced by targeted byte surgery on the
  operative metadata: **exactly one byte differs**
  (offset 688, `1` → `0` inside the `GENERATION_HALT`
  binding); parsed deep-diff = exactly one path
  (`.bindings[4].text`).
- **Restore check:** the envelope assembled from the live
  parts + unmodified operative metadata + the operative
  boundary reproduces the operative envelope **byte-for-byte**
  (SHA-256 `38ebec8e380f5035f1d6e30670f42e489131e1b0771b3540eb49b2f7e57ed0de`),
  so the flip envelope (SHA-256
  `18c3a37467bb287d9c0e297c27f1ce9c9f0bf97373f0d4e141a0e7af4fe437e7`,
  1,339,824 B) differs from the exact bytes that produced
  the live build by that one value only. Compatibility
  2026-08-29 + `nodejs_compat` and `main_module` preserved;
  secrets inherit-by-name.

PUT: **HTTP 200, success**; deployment id
`853c62036d524447991efb6a2413f187`; entry point
`v2/worker-entry-prod-d6.js`. The response was complete and
readable — no ambiguity arose, and no re-flip was attempted
or needed.

Read-backs (capture 18:42:09Z; evidence/*-r3): `/health`
generation **`"enabled"`**, build still `945875bc…`;
bindings exactly the 10 expected names, **name-keyed diff
vs R0 = exactly one entry** (`GENERATION_HALT "1"` → `"0"`);
script GET etag **`d63b61c3…` — UNCHANGED**, and the
downloaded parts re-verified byte-identical to the manifest
(28/28, evidence/parts-compare-r3.json). Observability
**survived** the upload (enabled + logs enabled + persist,
shape-identical to pre-flip): **no settings PATCH was
needed or sent.** Queue still paused. Every other compared
surface identical to R0.

## R4 — armed-idle window, queue still paused: PASS — zero movement

Read set (proposal §6) captured at start (the R3 capture,
18:42:09Z), middle (18:57:36Z), and end (19:13:56Z) — a
**31 min 47 s** window, ≥ the required 30 minutes (longest
relevant fuse 15 min + one full 10-min watchdog cycle +
margin), spanning multiple alarm passes. A supplementary
operator reconcile read at window end: `armed: true`,
`ok: true`, `currentDayBlocked: false`, drift 0,
exceptions 1, day totals unchanged.

Comparison, value-by-value, mid and end vs start:
**zero movement on every surface** — `/health`; bindings;
etag; observability; settings rev 1; client quota view
(attemptsToday 0, providerDispatchesToday 0, ledgerSeq 37);
plan list + all three plan reads; all three job reads
(incl. the fresh Ch 2 job, byte-identical) + Ch 3
fingerprint; **conflicts: count 3 AND max id 3, payload
identical**; phase figures; watermarks 18/1818. No new
attempt, no state or revision change, no new conflict row.
§5's prediction holds in observation: with the halt lifted
but the queue paused, the alarm machinery ran and selected
nothing.

## R5 — R-unpause, LAST: PASS (PUT 19:16:05Z)

cf-api PUT the queue with `queue_name` +
`settings.delivery_paused: false` (positional argv JSON):
HTTP 200, success. **Independent read-back**
(evidence/queue-after-unpause.json): `delivery_paused ==
false`, retention 86,400 s unchanged, sole consumer
`f260f2188d80426bb0588685e9d084eb` and sole producer
`opalreader-api-v2-prod` unchanged. An immediate full sweep
(capture 19:16:14Z) showed zero movement on every surface
except the intended queue value.

## R6 — post-unpause window: PASS — zero movement

Read set captured at start (19:16:14Z), middle (19:31:34Z),
and end (19:47:53Z) — **31 min 39 s** from the start sweep
(31 min 48 s from the unpause), ≥ the required 30 minutes,
with the queue delivering throughout. Comparison,
value-by-value, mid and end vs start: **zero movement on
every surface** (same read set as R4, incl. conflicts count
3 / max id 3 and the fresh Ch 2 job byte-identical). Any
message drained from the outbox at the flip (Path D) met
the Path A fence exactly as traced: refusal-with-ACK writes
nothing, and nothing was written — no attempt, plan, job,
grant, figure, watermark, or conflict movement of any kind.

**Final verification (closing reads, 19:47–19:48Z):**
`/health` build `945875bc…`, generation `"enabled"`;
reconcile `armed: true`, **`ok: true`**,
`currentDayBlocked: false` (evidence/reconcile-final.json);
phase figures, watermarks 18/1818, settings rev 1, Ch 3
fingerprint `b991f18a…`, conflicts (3 rows, ids 1/2/3) —
all identical to R0. Zero new attempts (137, all
`confirmed`). Batch still unarmed: capabilities read
`batch: admitted false (batch_not_armed)`, `standard:
admitted true` — the Standard-only arming state preserved.
Nothing generated, no provider/Google call, nothing spent.

## End state

**Live but idle.** `GENERATION_HALT "0"`, queue delivering,
quota guard armed with this session's fresh `ok: true`
census on record, no active plan, nothing generated,
nothing spent, Batch unarmed, Chapter 3 parked
(`parked_policy`, fingerprint exact). Rollback floor
unchanged (build `6a73d962…` was not implicated in either
direction; this gate's rollback would have been same-build
re-pause + re-halt under §7 — neither was invoked).

**Not done, by design (§8):** no `SubmitJob` or intent of
any scope; no generation, synthesis, or provider call; no
spend or top-up; no Batch arming; no Chapter 3 action; no
quarantine release; no settings change (the conditional
observability PATCH was not triggered); no client
publication; no code deploy (the R3 upload was
byte-identical code with a one-value metadata diff); no
clearing or mutation of the stale job/grant, the smoke
residue, or the 3 `schedule_dead` records; no disposition
or settlement action; no build rollback.

**Standing note for Julie's later decisions (proposal §9,
carried):** the system is now live — the app's Generate
control is live with it. Generation (the rest of Forever
Pucked) and Chapter 3 generation remain separate, distinct
approvals, each still unrequested and unauthorized, in
either order she chooses.

— Wren (execution agent)
