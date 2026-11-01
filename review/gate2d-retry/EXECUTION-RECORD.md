# EXECUTION RECORD — Gate 2D RETRY: halted deploy + re-arm of the grant-finalizer build

Executed 2026-11-01 under Julie's fresh Gate 2D RETRY GO (board
comment **6552369883**, Oct 31, 2026 ~10:31 p.m. ET, recorded before
any step), following the revised bounded retry plan pinned
`9284f5efee47cd87b2c5639e9dfe50e6fb7e908a` (repo
`jedavid33-design/opal-reader`, branch `ui1-review`) and Rowan's
retry TECHNICAL PASS (relayed by Julie, recorded 6552362383).
Attempt 1 (record pin `cf2b4e6f1e9eff80feacfe9571de1944ef88bf20`)
stopped at its census; Rowan's deviation ruling 6552216332 required
the fresh baseline + exact-match Conflicts Rule this retry ran
under.

## OUTCOME: ALL PASS — Gate 2D retry COMPLETE

D0 census ALL PASS (21/21, conflicts exact-match); D1–D8 all
PASS; re-arm PASS; both watched windows zero-movement. Exactly
the 5 budgeted production mutations (3 deploy + 2 re-arm); the
D6 observability repair did not fire; **$0 spend**; the finalizer
was deployed and fence-probed but **never invoked** — the stalled
grant remains `issued` rev 2 for Gate 3. System ends
**live-but-idle** on build
`408f91497131a151a199b3f9ec4cbb283a8febd5`. No STOP fired at any
step; no containment was needed. Execution window:
2026-11-01T02:35:42Z (first census read) → 03:44:45Z (windows
complete).

## R0 — preconditions: ALL PASS

- **Julie's GO** 6552369883 read firsthand from the board before
  any step (scope: exactly one retry; D0 exact-match census; halt
  flip → queue pause → envelope pin + ONE upload → byte
  verification → observability check/conditional repair → denied
  probes on both finalizer routes → read-backs with NO
  finalization → re-arm with containment pre-authorized).
- **Document anchors verified by hash:** `RETRY-PLAN.md`
  SHA-256 `c374b4257c27748a164c3ec5aaca22f52c4e52b257673db4fd71ab09f60a28ff`;
  `BASELINE.md` SHA-256
  `a3e1e2fc1f19aadb0b94d3bd9af41048ff0754e8710887e6216a8f4825d181ab`;
  `baseline-summary.json` SHA-256
  `0a8b3436131cb90f0ec15715e9192df9ccc6ba80586c39bbca45c92b51b8de21`.
- **ui1-review ref head** read immediately before the gate:
  `9284f5efee47cd87b2c5639e9dfe50e6fb7e908a` (unmoved).
- **Finalizer tree diff re-verified** (`diff -rq --no-dereference`,
  finalizer-build vs ch3-build): exactly the plan §3.7 surface —
  new `worker/generation/grant-finalizer.mjs`; modified
  `worker/worker-entry-prod-d6.js`; five new test files
  (`tests/grant-finalizer.test.mjs`,
  `tests/grant-finalizer-continuation.test.mjs`,
  `tests/grant-finalizer-routes.test.mjs`,
  `tests/grant-finalizer-sameday.test.mjs`,
  `tests/helpers/grant-finalizer-fixture.mjs`). Nothing else.
- **File hashes:** `grant-finalizer.mjs`
  `15dd575f77efb0d5159f3674162728662b102891cd95cd7b680bf4a8bd0794ee`;
  `worker-entry-prod-d6.js`
  `292ca83e892d5d675f1c107ea4adf1fed34cca6c054fcd068c51b403f79f8a31`;
  `gen-schema.mjs`
  `d7ae4936b11fe0d01c9ff8a6e1ccbb7364541ecad7d012b8fc3e712a453aacc5`
  in BOTH trees (byte-identical).

## D0 — census (capture `d0`, 2026-11-01T02:35:42Z → 02:35:58Z): ALL PASS (21/21)

Fresh complete census against the BASELINE values (plan §4), run
by a read-only leaf worker and verified firsthand by the executor
from the raw evidence (`compare-d0.txt`: **VERDICT: ALL PASS**):

- /health build `63d7260ef0c87c45cdcb88c7007643bb90e1631c`,
  generation enabled, coordinator armed; all 21 reads HTTP 200.
- **CONFLICTS RULE (§5): EXACT MATCH.** The complete live set is
  the baseline's enumerated 4 rows, field-for-field (ids 1/2/3/4;
  at 1793318054808 / 1793319854632 / 1793423664089 /
  1793495070364; occurrences seg/ch1/ch1/ch2 of plans
  3183ecbf/603ab416/b2dc2a3d/e377a555; all cache_key `lease`,
  expected 7, found `LIKE or GLOB pattern too complex:
  SQLITE_ERROR`, reason `schedule_dead`). No accretion, no
  missing row, no changed field.
- Live parts **29/29 byte-identical** to the Chapter 3 operative
  manifest, no extras; script etag
  `82053d4d75533056753c5ee6225e0de56e29ecb1de980aa543cdba613a59d6be`
  (1,383,556 B).
- Observability enabled + persisted on both reads; bindings 10,
  `GENERATION_HALT "0"`, phase policy `enforce`.
- Settings revision 1 (cap 50, lane standard). Phase accounting:
  settled **732,303**; estimatedUnverified **19,018**;
  reservedUnverified **5,648**; remaining **12,762,049** of
  13,500,000; inFlightUpper 0; unknownOpen 0.
- Plans: smoke complete; old Ch 2 retired; fresh Ch 2 complete;
  Ch 3 `plan:e377a5559961b294154276b6` **active 8/23** (eligible
  23 / done 8 / failed 0 / blocked 0 / prompts 0; entries 3
  bound_already / 23 eligible / 1 excluded_parked; 8 committed).
  Grant `grant:plan:e377a5559961b294154276b6:ch2:1:full` **issued
  rev 2**; job rows **8 ready / 15 pending**.
- Parked job `1832c21f…` `parked_policy` rev 1; fingerprint
  recomputed
  `b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`
  — exact.
- Eligibility (Ch 3): 15 eligible / 11 bound_already / 1 parked;
  20,864 chars; expected 294,137; digest
  `9453ab5dc7ee6ade7c650d14066054b965875f2ef1b65eb24bc633588d778e67`
  — exact.
- Watermarks: bindings **1826** / content **18**. Queue unpaused,
  sole consumer `f260f2188d80426bb0588685e9d084eb`. Batch unarmed
  (`batch_not_armed`), standard admitted.
- **Quota (§4.2, same-PT-day case):** census landed on PT day
  **2026-10-31** (before the 07:00Z rollover): dispatched **44** /
  reserved **52** / consumed **96** — exactly the baseline's
  figures; historical 2026-10-29 = 57/0/57, 2026-10-30 = 79/0/79;
  reconcile `ok: true`, armed, drift empty, censusComplete true,
  sole exception the straddler
  `att-37d63768-db4b-447d-8150-580b7c6ee257`. (Rollover note,
  restated per §4.2: the PT-day rollover does not close the issued
  grant and does not release its 52-slot reservation, which stays
  attributed to PT day 2026-10-31.)

## D1 — Halt flip (2026-11-01T02:37:03Z → 02:37:05Z): PASS — mutation 1 of 5

Settings-only multipart PATCH to
`/workers/scripts/opalreader-api-v2-prod/settings` (single
`settings` part, Content-Type `application/json`) carrying the
full 10-binding list read live at D0 with exactly one value
changed — `GENERATION_HALT` `"0"` → `"1"` — and the three secrets
carried as `{"type":"inherit"}`. Response: **HTTP 200,
success true**. Read-backs: `GENERATION_HALT "1"`; all 10 bindings
present with unchanged names/types (secrets intact as
`secret_text`); observability enabled + persisted on both reads;
script etag **UNCHANGED**
(`82053d4d75533056753c5ee6225e0de56e29ecb1de980aa543cdba613a59d6be`);
/health generation **`halted`**, build still `63d7260e…`.

## D2 — Queue pause (2026-11-01T02:37:16Z → 02:37:17Z): PASS — mutation 2 of 5

cf-api PUT queue `93b6a35fb8cf4788a91a2c90b748ae66` with
`{queue_name, settings.delivery_paused: true}` (positional argv
JSON): **HTTP 200, success true**. Read-back: `delivery_paused:
true`, retention 86,400 s, sole consumer
`f260f2188d80426bb0588685e9d084eb`, sole producer
`opalreader-api-v2-prod`. Containment proven on both sides (halt
ON + queue PAUSED) before the code PUT.

## D3 — Envelope assembly + pin: PASS (repo-only)

- Assembler (recipe-identical to the Chapter 3 mechanisms
  assembler; adapted checks): **PASS 9/9** — closure rooted at
  `v2/worker-entry-prod-d6.js` over the finalizer tree; part set
  == live 29 + `v2/generation/grant-finalizer.mjs`; class table
  **27 identical + 1 changed (`v2/worker-entry-prod-d6.js`) + 1
  new (`v2/generation/grant-finalizer.mjs`) + 1 stamped
  (`v2/host/build-identity.mjs`)**; metadata byte-identical to the
  live operative metadata (GENERATION_HALT `"1"`, 10 bindings, no
  migrations key); `d6_grant_finalizations` occurs only in the new
  part; GEN_SCHEMA byte-identical to live (8 CREATE TABLEs).
  Placeholder run deterministic (two runs, identical envelope
  SHA-256 `166e9311…`); the placeholder envelope was never
  uploaded.
- **Parts counted FROM the assembled manifest: 30.**
- **Envelope pin: `408f91497131a151a199b3f9ec4cbb283a8febd5`** —
  ONE single-parent child of `9284f5ef…` on `ui1-review`
  (`review/gate2d-retry/deploy/`: ENVELOPE-REPORT.md,
  envelope-manifest.json, the 30 tree-form parts, the assembler);
  33 paths verified at blob level after the ref update; commit
  message verified. The pin SHA is the build stamp.
- Operative re-assembly with `--pin 408f9149…`: PASS 9/9;
  **operative envelope 1,433,520 bytes, SHA-256
  `00f7db62a21e4a0b249fc68a07f9dabc048fa3bf5be62109015b17fb344f928b`**
  (hash re-verified on the file immediately before upload).

## D4 — ONE upload (2026-11-01T02:39:12Z → 02:39:13Z): PASS — mutation 3 of 5

Pre-upload reads confirmed halt `halted` + queue paused. Exactly
ONE multipart PUT of the operative envelope: **HTTP 200, success
true**, entry point `v2/worker-entry-prod-d6.js`. No second upload
was made or needed.

## D5 — Byte verification: PASS

Downloaded live script (1,430,356 B; new etag
`7b4081f6c50702774b20bb359443368fdc1af549171c5f4afdbcd8a0233202a2`)
parses and byte-compares against the operative manifest:
**30/30 parts byte-identical, no extras** (`parts-compare-d5.json`,
`all_identical: true`). /health: build
**`408f91497131a151a199b3f9ec4cbb283a8febd5`** (the pin),
generation `halted`, coordinator `armed`.

## D6 — Observability: SURVIVED — no PATCH

GET script-settings + settings after the upload: observability
**enabled + persisted** (logs enabled + persist + invocation_logs),
shape-identical to the pre-state. The conditional repair was **not**
triggered; **no settings PATCH was sent at D6**. (The upload did
not reset observability, as at every deploy in this chain.)

## D7 — Denied probes (2026-11-01T02:39:27Z → 02:39:28Z): BOTH REFUSED

Credential-less calls to the production Worker URL (no credential
of any kind; only the scope/instance headers — the absence of
operator admission is the test):

| Route | Result |
|---|---|
| `GET /v2/d6-grant-finalization-preview` | **HTTP 403** `{"error":"migration_operator_required"}` |
| `POST /v2/d6-finalize-grant` | **HTTP 403** `{"error":"migration_operator_required"}` |

Both refused at the operator fence. No credentialed call to either
route was made at any point in this gate; the finalizer was never
invoked.

## D8 — Full read-backs (capture `d8`, still halted + paused): ALL PASS (14/14)

/health = pin build, halted; **conflicts compared again
post-deploy: still exactly the baseline's 4 rows** (no change —
nothing to report under the §5/D8 duty); bindings 10 with halt
`"1"` and observability intact; parts 30/30 vs the operative
manifest; queue still paused, sole consumer; **grant STILL
`issued` rev 2**; job rows **8 ready / 15 pending**; plan still
**active 8/23** with unchanged entry composition; parked
fingerprint exact; phase figures byte-equal to the census
(732,303 / 19,018 / 5,648 / 12,762,049); eligibility digest
unchanged; watermarks 1826/18; settings revision 1; reconcile
still `ok: true` (44/52/96); capabilities show the halted state
with lanes/phases unchanged (`compare-d8.txt`).

## RE-ARM: PASS — mutations 4 and 5 of 5

- **Fresh reconcile precondition (02:40Z, 4-page census):**
  `ok: true`, armed true, `currentDayBlocked: false`, drift
  empty, censusComplete true on the offset-0 pages, sole
  exception the straddler; past-end probe empty with
  censusComplete false (the confirmed definitional shape).
- **Halt lift (2026-11-01T02:40:19Z → 02:40:20Z):** settings-only
  multipart PATCH to `/settings` (same construction as D1,
  `GENERATION_HALT` `"1"` → `"0"`, secrets inherit): **HTTP 200,
  success true**. Read-backs: halt `"0"`; 10 bindings; observability
  still enabled; **code etag byte-identical**
  (`7b4081f6c50702774b20bb359443368fdc1af549171c5f4afdbcd8a0233202a2`,
  1,430,356 B — the lift did not touch code); /health generation
  `enabled`, build still the pin.
- **Queue unpause LAST (2026-11-01T02:40:28Z → 02:40:29Z):**
  cf-api PUT `delivery_paused: false`: **HTTP 200, success true**.
  Read-back: `delivery_paused: false`, retention 86,400 s, sole
  consumer unchanged. No mutation followed the unpause except
  observation.

## Watched windows: BOTH PASS — zero movement

Seven full captures (`w0` 02:40:53Z, `w1a` 02:51:10Z, `w1b`
03:01:23Z, `w1end` 03:12:38Z, `w2a` 03:22:56Z, `w2b` 03:33:11Z,
`w2end` 03:44:29Z), each checked on 13 items (health build/state;
conflicts exact set; grant state/revision + row counts; plan
state/totals; plan list; parked fingerprint; phase figures;
eligibility digest; watermarks; settings revision; reconcile +
quota totals; client quota view; capabilities/Batch):

- **Window 1** (unpause 02:40:29Z → `w1end` 03:12:38Z = **32
  min 9 s**): ZERO MOVEMENT at every capture.
- **Window 2** (`w1end` 03:12:38Z → `w2end` 03:44:29Z = **31
  min 51 s**): ZERO MOVEMENT at every capture.

No new attempt, plan, grant, figure, watermark, eligibility, or
conflict movement of any kind; quota steady at PT 2026-10-31
44/52/96 throughout; conflicts steady at exactly the baseline's
4 rows. As the plan states, the windows are bounded observation,
not proof — the code fences that refuse stale work carry the
safety argument; the observation corroborates them. No anomaly
arose, so containment (re-pause → re-halt) was not invoked.
(`windows.log`.)

## Mutation ledger (exactly 5, as budgeted)

1. D1 halt flip (settings PATCH, GENERATION_HALT → "1").
2. D2 queue pause (PUT delivery_paused true).
3. D4 one code upload (operative envelope `00f7db62…`).
4. Re-arm halt lift (settings PATCH, GENERATION_HALT → "0").
5. Re-arm queue unpause (PUT delivery_paused false).

The D6 observability repair did **not** fire. The D3 envelope pin
is a repo-only write, not a production mutation. Total spend:
**$0**. Nothing generated, submitted, finalized, or exempted; the
grant remains `issued` rev 2; Batch remains unarmed.

## End state (final read-back, 2026-11-01T03:45Z)

**Live-but-idle.** Worker `opalreader-api-v2-prod` on build
**`408f91497131a151a199b3f9ec4cbb283a8febd5`** (script etag
`7b4081f6c50702774b20bb359443368fdc1af549171c5f4afdbcd8a0233202a2`,
1,430,356 B); `GENERATION_HALT "0"` — generation **enabled**,
coordinator **armed**; queue `opalreader-generation-v2`
**unpaused**, sole consumer; observability enabled + persisted;
10 bindings. The finalizer routes exist on the live build and
refuse credential-less calls; no valid operator call has been
made to them. The stalled grant remains **`issued` rev 2**, the
Ch 3 plan **active 8/23**, the parked job untouched, conflicts
exactly the baseline's 4 rows, phase settled 732,303, Batch
**unarmed**. Nothing generated, nothing spent. **Gate 3
(finalization) and Gate 4 (continuation) remain separate future
decisions — neither is authorized by this gate.**

Standing note for Julie (carried from the plan): the system is
re-armed, so the app's Generate button is live again.

## Evidence

`execution/evidence/` — captures `d0` / `d8` / `w0…w2end` (full
read sets), census pages for `d0` and `rearm`, `compare-d0.txt`
(21/21), `compare-d8.txt` (14/14), `windows.log`, parts
parse/compare files for `d0`/`d5`/`d8`, D1/D2/D4/lift/unpause
payloads, responses and windows, probe bodies, pin log
(`pin-envelope.log`), assembler logs. Tools in `execution/tools/`;
operative envelope + manifest in `execution/operative/`; the
pinned package sources in `execution/pin-package/`.

— Wren (execution coordinator)
