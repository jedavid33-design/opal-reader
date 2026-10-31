# GATE-7 EXECUTION RECORD — re-arm (A0–A6)

Executed 2026-10-31, 02:28–02:32Z, under Julie's explicit
approval (issue #15 comment 6537784265 — button tap, Oct 30, 2026
~10:27 p.m. ET: "Approve re-arm — A0–A6, unpause last, no
generation"), of the re-arm proposal pinned
`75368c31677e59ea6d5a12677e84aab69d097930` + executor source-pin
supplement `afaf9780dadff52b1dba9625be057e5ab296e91b` on
`ui1-review` (`jedavid33-design/opal-reader`), which carries
Rowan's GATE-7 OPERATIONAL PLAN PASS (comment 6537764537). Live
build throughout: `6a73d9622e1b4eac00c58e289de1c674ed6b3d6b`,
script etag `a9a4c0c40ceefa6138c1cc8ebb3f0ab5b2205e7b7a057b865c8c312cbb13c39e`
— **unchanged by the flip** (content-derived: identical module
bytes, metadata-only change, exactly as at the October 29 arming).

**Outcome: RE-ARM COMPLETE — all steps PASS, no STOP, no
rollback.** End state: generation **enabled** at the Worker gate,
queue delivery **unpaused**, system **armed but idle** — no active
plan exists, nothing generated, nothing spent. Exactly two
mutations were made: the A4 binding-metadata upload (byte-identical
code, one binding value) and the A6 queue unpause PUT. Raw
captures: `~/workspace/ch2-program/rearm/execution/` (suffixes
a0/a3/a4/a5/a6 + snapshots).

## A0 — fresh pre-arm inventory: PASS (02:28Z; execution/*-a0)

Full read set re-captured and compared value-by-value against the
proposal §1 snapshot — **identical on every compared value**:

- `/health`: build `6a73d962…`, generation `"halted"`, coordinator
  `"armed"`. Script GET: etag `a9a4c0c4…` (exact), 27 module parts,
  **every part's SHA-256 byte-identical to the disposition
  envelope parts-manifest** (1,256,138 module bytes).
- Bindings (GET /settings): exactly the 10 expected names;
  `GENERATION_HALT "1"`, `OPALREADER_PHASE_POLICY "enforce"`.
- Queue `opalreader-generation-v2`: `delivery_paused == true`,
  retention 86,400 s, sole producer + sole consumer
  `opalreader-api-v2-prod` (consumer `f260f2188d80426bb0588685e9d084eb`,
  batch 10 / retries 3).
- Settings: revision **1**, lane `standard`, monthly cap $50
  (verify only — see A2).
- Quota: attemptsToday 0 / spentMicroCents 371,485 / ledgerSeq 19
  (grant-time estimate debits in the coordinator ledger, **not**
  provider-confirmed spend).
- Phase `forever-pucked` (operator diagnostics): settled 199,665;
  estimatedUnverified 19,018; reservedUnverified 5,648; in-flight
  uppers 0; unknownOpen 0; remaining 13,294,687; budget
  13,500,000; `provider_unverified` — the gate-5 billing-truth
  figures, unchanged (estimate = occurrence-length model proxy;
  reservation = internal modeled allowance, not a provider
  ceiling; unlike bases, 13,370 apart; actual Google charge
  UNKNOWN).
- Chapter 2 plan `plan:603ab416bd67ab1b25de97be`: `retired` /
  `retired_unknown_billing`; totals eligible 18 / done 0 /
  failed 8 / blocked 0; plan settled 179,991; not quarantine-held.
- Stale job `plan:603ab416bd67ab1b25de97be:ch1`: `generating`
  rev 2; stale grant `grant:plan:603ab416bd67ab1b25de97be:ch1:1:full`:
  `issued` rev 2 — unchanged, untouched.
- Plan list exhaustive (nextCursor null): exactly two D6 plans —
  the retired Chapter 2 plan + the `complete` smoke plan
  `plan:3183ecbf2ac4bf50bbc6166e`. No active plan.
- Conflicts: exactly the two known `schedule_dead` lease rows
  (id 2 = stale grant, id 1 = completed smoke grant).
- Chapter 3 job `1832c21f…`: `parked_policy` rev 1, grants [],
  27 rows (3 ready / 24 pending); fingerprint recomputed by the
  G8 recipe = `b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`
  (**exact**).
- Sync watermarks: content **18** / bindings **1800**.
- Observability (GET script-settings): enabled, logs enabled +
  persist + invocation_logs — Julie's Reader logging on.

No drift → proceed.

## A1 — Julie's approval: PASS

Approval comment 6537784265 read firsthand before any mutation:
Julie's tap approving exactly A0–A6 (fresh read-backs with STOP
on drift; settings verify-only; halt flip; armed-idle
verification; queue unpause LAST; rollback contract on drift).
No intent, generation, spend, Batch arming, Chapter 3 action, or
job/grant mutation is within its scope — none was performed.

## A2 — settings verify only: PASS (no write)

Revision 1 already carries the original arming's values (lane
`standard`, cap $50). Read back and confirmed. **Settings were not
modified** — no CAS write of any kind was sent in this run.

## A3 — consumer routing verification: PASS (02:29Z; execution/a3-*)

Fresh read-backs immediately before the flip: queue attachments
unchanged (sole consumer `f260f218…` on `opalreader-api-v2-prod`,
sole producer the same script); bindings read-back shows the
queue binding `OPALREADER_GENERATION_V2` present and
`GENERATION_HALT` still `"1"`; `/health` still `"halted"`.
Nothing was attached or detached.

## A4 — halt flip: PASS (upload window 02:30:09–02:30:11Z)

Mechanism — **the same as the October 29 arming** (G9
continuation HALT-FLIP-RECORD): the freshly downloaded live parts
re-uploaded byte-identical with the live upload metadata, the
parsed-JSON metadata diff being **exactly one value**:
`GENERATION_HALT` binding text `"1"` → `"0"`. Pre-upload gates,
all PASS:

- The 27 live parts were verified byte-identical to the
  disposition envelope parts-manifest (hashes + sizes).
- The flip envelope was assembled from those live parts + the
  disposition deploy's `assembled-metadata.json` with the single
  value changed; with the value restored to `"1"` the assembled
  envelope reproduces the disposition envelope **byte-for-byte**
  (SHA-256 `7d82eccf80b1f8fd5d38f9dd7deafb1f2b41a72829f14dc1b4e962acc394ee32`),
  so the upload differs from the exact bytes that produced the
  live build by that one value only. Flip envelope: 1,263,057 B,
  SHA-256 `4f7c64660cac0dbd23c719f446fc2c3589d371dc42c4837d5278d3b9bd00deb0`.
- Precondition read-back immediately before the PUT: queue still
  PAUSED, halt still `"1"`, build still `6a73d962…`.

PUT: **HTTP 200, success, no errors**; deployment id
`8a83afd0b82944a1801a6d25c84e4749`; entry point
`v2/worker-entry-prod-d6.js`; compatibility 2026-08-29 +
nodejs_compat preserved; secrets inherit-by-name.

Read-backs (execution/a4-*): `/health` generation now
**`"enabled"`**, build still `6a73d962…`; bindings exactly the 10
expected names, **name-keyed diff vs A0 = exactly one entry**
(`GENERATION_HALT "1"` → `"0"`); script GET etag
**`a9a4c0c4…` — unchanged**, 1,259,873 B, and the downloaded parts
re-verified byte-identical to the manifest (27/27, checked in the
A5 pass). Observability **survived** the upload (enabled + logs
enabled + persist true, shape-identical to pre-flip): **no
settings PATCH was needed or sent.**

## A5 — armed-idle verification (queue still paused): PASS (execution/*-a5)

24/24 checks. `/health` `"enabled"`; queue **still paused**; plan
list unchanged (retired + complete only — no active plan exists
to drive); phase figures unchanged (199,665 / 19,018 / 5,648 / 0 /
13,294,687, `provider_unverified`); quota unchanged (attemptsToday
0 / spent 371,485 / ledgerSeq 19 — zero new attempts); conflicts
unchanged (the two known rows); watermarks unchanged (18 / 1800);
settings revision still 1; stale job/grant byte-identical in
state + revision; Chapter 3 fingerprint exact. **No plan, grant,
attempt, or figure movement** in the armed-but-paused interval —
the only machinery that could run was the alarm driver, and it
selected nothing, exactly as proposal §2 Path B predicts.

## A6 — queue unpause, LAST: PASS (PUT 02:31:18–02:31:19Z)

PUT queue with `queue_name` + `settings.delivery_paused: false`:
HTTP 200, success. **Independent read-back** (never trusted from
the PUT alone): `delivery_paused == false`, sole consumer and
retention (86,400 s) unchanged.

Post-unpause final verification sweep (execution/*-a6): **24/24
PASS** — the A5 read set repeated: `/health` `"enabled"`, build
`6a73d962…`, `GENERATION_HALT "0"`, 10 bindings; quota unchanged
(0 / 371,485 / 19); plan states unchanged (retired + complete);
phase figures unchanged incl. `provider_unverified`; conflicts
unchanged; watermarks 18 / 1800; stale job/grant unchanged;
Chapter 3 fingerprint exact; settings revision 1. **Zero movement
attributable to the old plan after unpause** — §2's prediction
(Path A fence refusal-on-delivery / nothing to deliver, Path B
driver exclusion) is consistent with the observed state; no stale
message, if any survived, produced any execution, attempt, or
ledger movement.

## End state

**Armed but idle.** `GENERATION_HALT "0"`, queue delivery enabled,
no active plan, no generation, no spend. The fresh Chapter 2
intent remains Julie's separate future go — and per proposal
§3.2 it must carry minting semantics (e.g. keepGoing `true`): a
byte-identical resubmission would converge on the retired plan
and create nothing. Batch remains unarmed. Chapter 3 remains
parked. The stale job/grant remain untouched historical residue,
refused at the executor pre-claim fence if ever presented.
Rollback floor unchanged: build `6a73d962…` remains the minimum
build that may ever run against this data.

**Not done, by design:** no intent or plan submitted; no provider
/Google call; no generation; no spend; no settings write; no
deploy of new code (the A4 upload was byte-identical code with a
one-value metadata change); no quarantine release; no Chapter 3
action; no stale job/grant mutation.

Rollback was not needed at any step. Had any step drifted, the
contract was: re-pause the queue + re-halt (reverse A4) and STOP
— neither was invoked.

— Wren
