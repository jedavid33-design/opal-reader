# EXECUTION RECORD — Gate 3: production finalization of the stalled Chapter 3 grant

Executed 2026-11-01 under Julie's Gate 3 GO (board comment
**6559241292**, Nov 1, 2026 ~9:24 a.m. ET, recorded on the board
BEFORE any step), following the amended Gate 3 proposal
(GATE3-PROPOSAL.md Amendment 1, pin
`1610a314d66d363a48361f9a1497e3418eaa216d`, repo
`jedavid33-design/opal-reader`, branch `ui1-review`) and Rowan's
TECHNICAL PASS FOR JULIE'S DECISION (board 6559214332).

## OUTCOME: STOPPED AT E3 — the finalizer was NEVER called

E0 census **ALL PASS**. E1 halt flip **PASS** (mutation 1 of 3).
E2 queue pause **PASS** (mutation 2 of 3). **E3 — the single
operator preview call — returned HTTP 500** with the error body:

```
{"error":"LIKE or GLOB pattern too complex: SQLITE_ERROR"}
```

Under the proposal §5/§6 STOP law, execution stopped
immediately. **E3.5 was not run as a step, and E4 (the finalizer
action) was never called.** The preview was called exactly once
and was not retried. Exactly **2 of the 3 budgeted mutations**
were made (halt flip, queue pause). The system ends **HELD** —
generation halted, queue paused — by design: containment of a
stopped Gate 3 is staying held (§8). **$0 spend.** Julie's GO
(6559241292) is consumed by this one attempt; any further
attempt requires a fresh ruling / GO.

The error string is byte-identical to the `found` field of the
four standing `schedule_dead` conflicts rows (the known,
unfixed lease SQL quirk). **That identity is an observation,
not a diagnosis**: this execution establishes only that the
preview's precondition derivation threw this SQLite error on
live production data and the route surfaced it as HTTP 500.
The root cause is NOT established here. Read-only diagnosis is
a separate question for Rowan and Julie; the executor does not
clear its own stop.

## E0 — Fresh census (2026-11-01T14:26:12Z → 14:26:25Z, read-only): ALL PASS (21/21)

Full capture set (21 reads, all HTTP 200) compared mechanically
against GATE3-PROPOSAL.md Amendment 1 §4 (`compare-e0.txt`:
**VERDICT: ALL PASS (21/21 pass)**):

- **§4.1** /health: build
  `408f91497131a151a199b3f9ec4cbb283a8febd5`, generation
  `enabled` (pre-hold), coordinator `armed`, scope
  `production`, ok true. Live script **30/30 parts
  byte-identical** to the Gate 2D retry operative manifest, no
  extras; etag
  `7b4081f6c50702774b20bb359443368fdc1af549171c5f4afdbcd8a0233202a2`
  (1,430,356 B). Bindings exactly **10**; `GENERATION_HALT "0"`;
  `OPALREADER_PHASE_POLICY "enforce"`. Observability enabled +
  persisted on both `/settings` and `/script-settings`.
  Settings revision **1**; Batch `batch_not_armed`.
- **§4.2** Plan list exhaustive (`nextCursor: null`): exactly
  the 4 known plans (Ch 3 `active`; fresh Ch 2 `complete`; old
  Ch 2 `retired`; smoke `complete`). Ch 3 plan `active`, totals
  23 / 8 / 0 / 0 / 0. Job `generating` rev 2; 8 `ready` / 15
  `pending`; exactly one grant: `grant:plan:e377a5559961b294154276b6:ch2:1:full`,
  **`issued` rev 2**. Parked job `parked_policy` rev 1,
  fingerprint recomputed exact
  (`b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`).
  Eligibility 15 / 11 / 1, 20,864 chars, expected 294,137,
  digest `9453ab5dc7ee6ade7c650d14066054b965875f2ef1b65eb24bc633588d778e67`
  exact. Phase accounting exact on BOTH surfaces (diagnostics +
  capabilities): settled **732,303**; estimatedUnverified
  **19,018**; reservedUnverified **5,648**; unknownOpen **0**;
  remaining **12,762,049** of 13,500,000. Watermarks bindings
  **1826** / content **18**. Queue unpaused at census start,
  sole consumer `f260f2188d80426bb0588685e9d084eb`.
- **§4.3** Quota reconcile (complete paginated census):
  `ok: true`, drift **empty**, guard **armed**,
  `currentDayBlocked: false`, censusComplete true; **sole
  exception** the adjudicated straddler
  `att-37d63768-db4b-447d-8150-580b7c6ee257`
  (`estimated_unverified`). Historical PT days fixed:
  2026-10-29 = 57/0/57; 2026-10-30 = 79/0/79; **2026-10-31 =
  dispatched 44 / reserved 52 / consumed 96** (dayTotals
  presentation). Census-day PT totals observed fresh:
  2026-11-01 = 0/0/0.
- **§4.4 CONFLICTS RULE: EXACT MATCH.** The complete live set
  is exactly the four individually enumerated rows of the Gate
  2D approved baseline (pin `9284f5ef`): ids 1/2/3/4, at
  2026-10-29T23:54:14.808Z / 2026-10-30T00:24:14.632Z /
  2026-10-31T05:14:24.089Z / 2026-11-01T01:04:30.364Z;
  occurrences seg/ch1/ch1/ch2 of plans
  3183ecbf/603ab416/b2dc2a3d/e377a555; all cache_key `lease`,
  expected `7`, found `LIKE or GLOB pattern too complex:
  SQLITE_ERROR`, reason `schedule_dead`. No accretion, no
  missing row, no changed field.
- **§4.5 BINDINGS: ALL 8 PASS.** For each of the 8 committed
  occurrences (§2.3), the production binding (bindings sync
  snapshot, structural metadata only) is present, not
  tombstoned, and carries **revision_key == cache_key**.

Census tooling note (transparency): the first comparison run
flagged two items (4.2.9, 4.2.12) that were **field-name
assumptions in the executor's compare script**, not data
deviations — the grant object keys its id as `grant_id`, and
phase figures are carried under `*MicroCents` names. The raw
values were verified firsthand against the proposal figures
(grant `issued` rev 2, exact id; settled 732,303 / 19,018 /
5,648 / 0 / 12,762,049 on both surfaces), the script's key
mapping was corrected, and the re-run on the SAME raw captures
is the ALL PASS record. The capabilities surface carries every
§2.4 figure except `unknownOpen` (not a field on that surface;
the diagnostics surface carries it: 0).

**Census evidence digest** (SHA-256 over the sorted sha256sum
listing of all `*-e0.json` census captures):
`bef72c47e31414e08796b7e5a3d84511a761c7d746bd9950067519f0aeb16b19`.
(Kept distinct from any preview precondition digest per
§7.14 — see the E3 outcome below: **no preview precondition
digest exists**, because the preview errored before returning
one.)

## E1 — Halt flip (2026-11-01T14:28:26Z → 14:28:28Z): PASS — mutation 1 of 3

Settings-only multipart PATCH to
`/workers/scripts/opalreader-api-v2-prod/settings` (single
`settings` part) carrying the full 10-binding list read live at
E0 with exactly one value changed — `GENERATION_HALT` `"0"` →
`"1"` — secrets as `{"type":"inherit"}`. Response: **HTTP 200**.
Read-backs: halt `"1"`; 10 bindings; observability enabled +
persisted on both reads; **script etag UNCHANGED**
(`7b4081f6c50702774b20bb359443368fdc1af549171c5f4afdbcd8a0233202a2`,
1,430,356 B — the flip did not touch code); /health generation
**`halted`**, build unchanged. Post-halt conflict re-fetch
(§5 E1 duty): **still exact-match** vs the §4.4.1 baseline
(4 rows).

## E2 — Queue pause (2026-11-01T14:28:49Z → 14:28:50Z): PASS — mutation 2 of 3

cf-api PUT queue `93b6a35fb8cf4788a91a2c90b748ae66` with
`{queue_name: "opalreader-generation-v2", settings:
{delivery_paused: true}}`: **HTTP 200, success true**.
Read-back: `delivery_paused: true`, retention 86,400 s, sole
consumer `f260f2188d80426bb0588685e9d084eb`.

## E3 — Preview (2026-11-01T14:29:00Z → 14:29:01Z): STOP — HTTP 500

Exactly one operator call:
`GET /v2/d6-grant-finalization-preview?grantId=grant:plan:e377a5559961b294154276b6:ch2:1:full&planId=plan:e377a5559961b294154276b6&jobId=plan:e377a5559961b294154276b6:ch2`
(scope/instance headers, operator connector). Response
(`preview-e3.json`, preserved verbatim):

- HTTP status **500**
- body: `{"error":"LIKE or GLOB pattern too complex: SQLITE_ERROR"}`

The preview did not classify the grant `finalizable` and
returned **no precondition digest**. Under §4.6/§5/§6 this is
a STOP before the action call. The preview was **not retried**
(one GO = one attempt; the STOP law forbids blind retries).

## E3.5 / E4 — NOT RUN

- **E3.5** (pre-action conflict re-check): not reached as a
  step. (Post-STOP evidence reads, below, confirm the conflict
  set is unchanged — that is containment evidence, not an
  E3.5 pass.)
- **E4** (finalizer action): **NEVER CALLED.** No
  `POST /v2/d6-finalize-grant` was made under this GO, with any
  body, at any point. Mutation 3 of 3 was not spent.
  `authorizationRef` 6559241292 was therefore never presented
  to the finalizer, and **no audit row was written by this
  execution** (the action is the only writer of
  `d6_grant_finalizations`, and it never ran).

## Post-STOP containment read-backs (2026-11-01T14:30Z, read-only)

- /health: build `408f91497131a151a199b3f9ec4cbb283a8febd5`,
  generation **`halted`**, coordinator armed.
- Queue: `delivery_paused: true`, sole consumer unchanged.
- Grant: **still `issued` rev 2**; job `generating` rev 2;
  plan **still `active`**, totals 23/8/0/0/0.
- Conflicts: **still exactly the §4.4.1 baseline set** (4
  rows, every field).

## §7 readback checklist — disposition under the STOP

Items 1–6, 14: **not applicable / not reached** — they verify
the effects of an action that was never performed (grant
`reported`, claim `completed`, 8 reservations closed
`grant_settled`, audit row). The grant's pre-action state is
instead confirmed intact above: grant `issued` rev 2,
reservations untouched (the E0 census's derived PT 2026-10-31
totals 44/52/96 stand; nothing in this execution could close
a reservation), 44 attempts/dispatch rows untouched (no
provider contact of any kind was made). Items 7–13, 15 are
confirmed by the E0 census plus the post-STOP read-backs:
plan active 8/23/0/0/0; job generating rev 2, 8 ready / 15
pending; eligibility unchanged (digest exact at census);
phase money unchanged (732,303 / 19,018 / 5,648 / 0 /
12,762,049 at census; no mutation in this gate can move it);
watermarks 1826/18; conflicts exactly the baseline set;
park release live / zero exemptions as proven at census by the
§4 surfaces (the preview-derivation proof itself is the step
that failed); hold state: `GENERATION_HALT "1"`, queue paused,
build unchanged, observability enabled + persisted, Batch
unarmed.

**Digest statement (§7.14, kept explicit):** preview
precondition digest — **NONE EXISTS** (the E3 preview errored;
no digest was returned, none was passed anywhere). Census
evidence digest —
`bef72c47e31414e08796b7e5a3d84511a761c7d746bd9950067519f0aeb16b19`
(defined above). The two are not conflated; there is only one
digest in this record and it is the census one.

## Mutation ledger (exactly 2 of the budgeted 3)

1. E1 halt flip (settings PATCH, GENERATION_HALT → "1").
2. E2 queue pause (PUT delivery_paused true).

No upload, no finalizer call, no preview retry, no other
production mutation. Total spend: **$0**. Nothing generated,
submitted, exempted, retired, or re-armed.

## End state (final, 2026-11-01T14:30Z)

**HELD.** Worker `opalreader-api-v2-prod` on build
`408f91497131a151a199b3f9ec4cbb283a8febd5`; `GENERATION_HALT
"1"` — generation **halted**; queue `opalreader-generation-v2`
**paused**. The stalled grant remains **`issued` rev 2**, the
Ch 3 plan **active 8/23**, its 8 reservations still open (52
residual slots still held on PT 2026-10-31), the parked job
untouched, conflicts exactly the baseline's 4 rows, phase
settled 732,303, Batch unarmed. Gate 3 did **not** complete.
Releasing this hold, any read-only diagnosis of the preview
failure, and any further Gate 3 attempt each require a fresh
explicit ruling — nobody un-halts or unpauses on their own
authority (§8).

## What is asked next

Rowan: a ruling on this STOP — in particular whether the
HTTP 500 preview failure (a) warrants a separately scoped
read-only diagnosis of the finalizer's derivation path against
live data before any new Gate 3 attempt, and (b) whether the
held state should stay exactly as-is in the meantime (the
executor's position: yes, per §8). Julie: no action requested
by this record beyond noting the STOP; her GO 6559241292 is
consumed and does not carry to another attempt.

## Evidence

`execution/evidence/` — E0 capture set (21 reads + parts
parse/compare), `compare-e0.txt` (ALL PASS 21/21),
`census-evidence-digest-e0.txt`, E1 payload/response/headers +
read-backs (bindings, script-settings, script meta, health,
conflicts), E2 response + queue read-back, `preview-e3.json`
(the 500, verbatim) with its window timestamps, post-STOP
read-backs (health/queue/plan/job/conflicts `-stop`). Tools in
`execution/tools/` (capture.sh, compare_census.py, cf helpers).

— Wren (Gate 3 executor)
