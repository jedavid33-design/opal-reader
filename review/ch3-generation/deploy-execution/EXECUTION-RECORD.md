# EXECUTION RECORD — Chapter 3 mechanisms HALTED deployment

**Result: ALL PASS — exactly the approved mutations, zero unexpected
movement, system ends on the candidate build with generation HALTED
and the queue PAUSED.**

**Authorization:** Julie's GO recorded on the board (comment
6549163542, "GO — deploy, include the denied probe") — one attempt,
proposal `DEPLOY-PROPOSAL.md` §§2/3/5/7/8, deploy pin
`63d7260ef0c87c45cdcb88c7007643bb90e1631c` (repo
`jedavid33-design/opal-reader`, branch `ui1-review`).

**Window:** 2026-10-31 21:11:42Z (first precondition read) →
21:15:07Z (final census read). All evidence in `evidence/`
alongside this record; comparison summaries produced by the
gate-(c) `assess.py` tooling (copied into `tools/`), captures by
`capture.sh` / `census.sh` (this gate's adaptations of the gate-(c)
tools).

---

## Preconditions (§2 P1–P6) — ALL PASS (capture `pre`, 21:11:42Z; census 21:11:58Z)

- **P1 census:** four operator `GET /v2/d6-quota-reconcile` reads,
  all HTTP 200 (`census-page-000…003-pre.json`): `armed: true`,
  `ok: true`, `currentDayBlocked: false`, drift EMPTY
  (driftCount 0), exceptionCount **1** — exactly the known
  adjudicated straddler `att-37d63768-db4b-447d-8150-580b7c6ee257`
  (`estimated_unverified`, interval PT 2026-10-29 → 2026-10-30);
  day totals PT 2026-10-29 = 57, PT 2026-10-30 = 79, PT 2026-10-31
  = 0 dispatched/reserved/consumed. `censusComplete: true` on the
  offset-0 pages; the exceptionOffset=1 past-end probe returns an
  empty slice with `censusComplete: false` (the confirmed
  definitional semantics, as at gates (b)/(c)).
- **P2 conflicts:** exactly **3** rows, ids 3/2/1, all
  `schedule_dead`, all with the known
  `LIKE or GLOB pattern too complex: SQLITE_ERROR` lease
  signature. Untouched by this gate, per §9.
- **P3 queue:** `delivery_paused: false` (pre-gate state), sole
  consumer `f260f2188d80426bb0588685e9d084eb`
  (`opalreader-api-v2-prod`), producer `opalreader-api-v2-prod`,
  retention **86,400 s**.
- **P4 Chapter 3 pre-state:** job
  `1832c21fcf0425454227c4736048a8a632f422abca4a2685ddb775bb1681406a`
  `parked_policy` **revision 1**, 27 rows (3 ready / 24 pending),
  occurrence fingerprint
  `b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`.
- **P5 phase + plans + watermarks:** phase `forever-pucked`
  settled **579,339** / estimatedUnverified **19,018** /
  reservedUnverified **5,648** / inFlightUpper 0 / remaining
  **12,915,013** of 13,500,000 (the capabilities surface carries no
  separate unknownOpen quantity; nothing open is in flight and the
  figures equal the recorded pre-state exactly); settings
  revision **1** (cap $50, lane standard); plans exactly 3 —
  smoke `complete`, old Chapter 2 `retired`
  (`retired_unknown_billing`), fresh Chapter 2 `complete`, no
  active plan; sync watermarks content **18** / bindings **1818**;
  `/health` build `945875bc26b0e2ca965d5c0f710f11c0164025f8`,
  generation `"enabled"`, coordinator `"armed"`; live script etag
  `d63b61c349a3518998d29d318ec465af24a63468df6cdf4876e4ba8862849039`;
  client quota view attemptsToday 0 / providerDispatchesToday 0 /
  ledgerSeq 37 / spent 725,221.
- **Live parts:** the downloaded live script parses to parts
  byte-identical to the gate-(a) D1 operative manifest, **28/28**,
  no extras (`parts-compare-pre.json`, `all_identical: true`).
- **Metadata keyed comparison:** operative upload metadata vs live
  `/settings` bindings — names equal (10); the only diffs are the
  three secrets' `inherit`-vs-`secret_text` normalization and
  `GENERATION_HALT` text `"1"` (operative) vs `"0"` (live) — the
  single value S1 changes. `main_module`
  `v2/worker-entry-prod-d6.js`, compatibility `2026-08-29` +
  `nodejs_compat`, **no `migrations` key**.
- **Flip restore check:** live parts + operative metadata +
  operative boundary reassemble **byte-for-byte** to the gate-(a)
  operative envelope (1,339,824 B, SHA-256
  `38ebec8e380f5035f1d6e30670f42e489131e1b0771b3540eb49b2f7e57ed0de`)
  — so the S1 envelope differs from the exact bytes that produced
  the live build only in the metadata halt value.
- **P6 operative assembly:** assembler re-run with
  `--pin 63d7260ef0c87c45cdcb88c7007643bb90e1631c` against the
  candidate tree — **validation PASS 9/9** (C1–C9;
  `assemble-operative.log`). Stamped build-identity part reads
  `BUILD_COMMIT = "63d7260ef0c87c45cdcb88c7007643bb90e1631c"`
  (411 B, the live stamped length). **Operative envelope:
  1,386,657 bytes, SHA-256
  `a371621d0d22bcfdf7f7e137966bf2f301bf0970d5898a25e65968ee93bfeaa7`**
  (byte count identical to the placeholder run, as designed).
  Class table reconfirmed: 24 identical + 3 changed + 1 new
  (`v2/generation/park-release.mjs`) + 1 stamped; metadata
  byte-identical to the gate-(a) operative metadata.

No mismatch anywhere → proceeded. (Assembly is local-only; it was
run as precondition P6 per the proposal's §2 ordering, before S1.)

## S1 — Halt flip (metadata-only PUT, 21:12:48–21:12:50Z): PASS

PUT the restore-checked flip envelope (the operative bytes with
`GENERATION_HALT "1"` in metadata; code parts byte-identical to
live). **HTTP 200, success**; deployment id
**`d4cbc7f158fc4756ac6a10735609835f`**; entry point
`v2/worker-entry-prod-d6.js`. Read-backs (capture `s1`,
21:12:54Z):

- `/health` generation **`"halted"`**, build still `945875bc…`.
- Script etag **`d63b61c3…` — UNCHANGED** (code provably untouched).
- Stored binding `GENERATION_HALT` now `"1"`; name-keyed bindings
  diff vs `pre` = exactly that one entry.
- Observability **survived** (enabled; logs enabled + persist +
  invocation_logs): no settings PATCH needed or sent.
- Full assess diff `pre` → `s1`: exactly 3 leaf diffs — the
  `GENERATION_HALT` text and the two derived generation-state
  readouts (`health.generation`, `capabilities.generationState`).
  Nothing else moved. Queue still unpaused at this point (S2 next).

## S2 — Queue pause (PUT 21:13:22Z): PASS

cf-api `PUT /queues/93b6a35fb8cf4788a91a2c90b748ae66` with
`{queue_name, settings.delivery_paused: true}` (positional argv
JSON body) → HTTP 200 success. **Read-back:** `delivery_paused:
true`, retention 86,400, sole consumer
`f260f2188d80426bb0588685e9d084eb` unchanged. Containment now
proven on both sides (halt ON + queue PAUSED) before the code PUT.

## S3 — Zero-movement capture (21:13:28Z): PASS

Full assess comparison `pre` → `s3`: exactly the 4 expected leaf
diffs (the S1 halt value + two derived readouts + S2
`queue.delivery_paused`); **zero unexpected diffs**. Conflicts,
plans, job + fingerprint, phase figures, watermarks 18/1818,
settings rev 1, quota counters — all identical to the §2
pre-state.

## S4 — ONE code PUT (21:13:55–21:13:56Z): PASS

PUT the operative envelope (SHA-256 `a371621d…`, 1,386,657 B;
hash re-verified on the file immediately before upload).
**HTTP 200, success**; deployment id
**`a1d72fae6b7b4e3dbb437d175dfbc09a`**; entry point
`v2/worker-entry-prod-d6.js`; `modified_on`
2026-10-31T21:13:57.164021Z. Exactly one PUT was made.

## S5 — Observability check: SURVIVED — no PATCH

GET `/workers/scripts/opalreader-api-v2-prod/script-settings`:
observability **enabled**, `head_sampling_rate 1`, logs
**enabled + persist + invocation_logs**, shape-identical to the
pre-state. The §3 S5 contingency was **not** triggered; **no
settings PATCH was sent.** New script etag (from GET script):
**`82053d4d75533056753c5ee6225e0de56e29ecb1de980aa543cdba613a59d6be`**.

## S6 — Read-backs (capture `s6`, 21:14:14Z): ALL PASS

- Downloaded script parses and byte-compares against the
  operative parts manifest: **29/29 parts identical, no extras**
  (`parts-compare-s6.json`, `all_identical: true`).
- `/health`: build **`63d7260ef0c87c45cdcb88c7007643bb90e1631c`**,
  generation **`"halted"`**, coordinator `"armed"`.
- GET `/settings`: the **10 bindings** (names + types), with
  `GENERATION_HALT "1"` and `OPALREADER_PHASE_POLICY "enforce"`;
  observability enabled + persisted.
- Queue read-back: `delivery_paused: true`, consumer unchanged.
- Full assess comparison `s3` → `s6`: exactly 3 leaf diffs, all
  build identity (`health.build`, script etag, script bytes).
  **Zero unexpected diffs** — conflicts still exactly the 3 known
  rows; plans unchanged; Chapter 3 job + fingerprint unchanged;
  phase figures unchanged; watermarks 18/1818; settings rev 1;
  quota counters unchanged.

## §5 Denied probe (21:14:40–21:14:41Z) — included per Julie's GO: ALL REFUSED

Form chosen and recorded: one POST per route to the production
Worker URL with **no credential of any kind** (no Authorization
header; only the `X-OpalReader-Scope: production` and
`X-OpalReader-Instance: account` headers and a minimal `{}`
JSON body) — the absence of operator admission is the test.

| Route | Result |
|---|---|
| `POST /v2/d6-release-park` | **HTTP 403** `{"error":"migration_operator_required"}` |
| `POST /v2/d6-revoke-park-release` | **HTTP 403** `{"error":"migration_operator_required"}` |
| `POST /v2/d6-exempt-chapter-occurrence` | **HTTP 403** `{"error":"migration_operator_required"}` |
| `POST /v2/d6-revoke-chapter-exemption` | **HTTP 403** `{"error":"migration_operator_required"}` |

All four refused at the operator fence, before any store contact.
Bodies archived (`probe-*.json`). No valid operator call was made
in this gate; the fence's positive function remains unexercised
against production, to be proven at Phase A's first audited use
(§5, as designed).

## Post-probe verification (capture `final`, 21:14:47Z; census 21:15:07Z): PASS

- Full assess comparison `s6` → `final`: **zero diffs** — the
  probes wrote nothing; no inventory surface moved.
- **Deployed-but-unused equivalence, live:** Chapter 3 chapter
  eligibility on the new build — eligible **0**, exclusions
  `{bound_already: 3, voice_prompt: 0, parked: 24, other: 0}`,
  digest
  **`12930307b7bda4cb438e2f981a62e052f40ede5dd5533be1a3b5c3fc67b4e71d`**
  — identical to the pre-deploy quote. (Any release or exemption
  row would change the parked count; none exists.) Book-scope
  eligibility also unchanged (314 eligible; bound 69, parked 24).
- Final census: `armed: true`, `ok: true`, drift 0, exceptions 1
  (the known straddler), today 0 dispatched.
- Conflicts: exactly ids 3/2/1, `schedule_dead`.

## S7 — End state

- **Build:** `63d7260ef0c87c45cdcb88c7007643bb90e1631c` (script
  etag `82053d4d75533056753c5ee6225e0de56e29ecb1de980aa543cdba613a59d6be`).
- **Generation: HALTED** (`GENERATION_HALT "1"`; `/health`
  `"halted"`). **Queue: PAUSED** (read-back proven). Quota guard
  armed, census `ok: true`.
- **Observability:** enabled + persisted; never reset; no PATCH.
- **Mutations made (exactly 3):** (1) S1 metadata-only halt-flip
  PUT (deployment `d4cbc7f158fc4756ac6a10735609835f`, etag
  unchanged); (2) S2 queue-pause PUT; (3) S4 one code PUT
  (deployment `a1d72fae6b7b4e3dbb437d175dfbc09a`). The conditional
  observability PATCH was **not** needed. The 4 denied-probe POSTs
  mutated nothing (all refused; post-probe inventory
  byte-identical in every compared value).
- **Non-actions honored (§9):** no release/exemption/revoke call
  (valid or otherwise) beyond the denied probe; no SubmitJob; no
  provider contact; no spend; no quota bootstrap/dispose; no
  quarantine release; no Batch arming; no client change; the 3
  `schedule_dead` rows untouched; **no re-arm** — halt stays ON,
  queue stays PAUSED.
- The three new tables were not created (lazy DDL; no operator
  write occurred), so rollback of this unused build remains the
  clean case under §6 — noted for the record; no rollback was
  performed or is proposed here.

**What follows (separately decided, §10):** re-arm decision →
Phase A GO → Phase B GO. None is authorized by this gate.

## Evidence index (`evidence/`)

Captures `pre` / `s1` / `s3` / `s6` / `final` (full read sets +
`assess-*.json` canonical summaries); census pages for `pre` and
`final`; `parts-compare-pre.json` (28/28 vs live operative
manifest), `parts-compare-s6.json` (29/29 vs operative manifest);
`assemble-operative.log` (P6, 9/9 PASS);
`s1-put-response.json` / `s1-put-headers.txt` / `s1-window.txt`;
`s2-put-response.json` / `s2-queue-readback.json` / `s2-window.txt`;
`s4-put-response.json` / `s4-put-headers.txt` / `s4-window.txt`;
`s5-script-settings.json` / `s5-script.meta.json`;
`probe-window.txt` + `probe-*.json` (4 refusal bodies). The
operative envelope and parts are in `operative/`; the flip
envelope in `flip/`.
