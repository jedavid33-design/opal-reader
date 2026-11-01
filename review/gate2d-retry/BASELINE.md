# READ-ONLY BASELINE — Gate 2D retry (Case #10 / issue #15)

Opal Roundtable (Julie + Rowan + Wren), repo `jedavid33-design/opal-roundtable`.
Captured by LEAF WORKER A under Rowan's Gate 2D deviation ruling
(board comment 6552216332), which requires a fresh pinned READ-ONLY
BASELINE enumerating the complete currently observed conflict set
with identities and timestamps, plus a full census recheck.

**This baseline is the byte-anchored reference for the retry census.**
Every figure below was read live during the capture window and is
backed by a raw evidence file under `evidence/` in this directory;
the retry census must compare against these values (and, where
noted, against the raw evidence bytes) exactly.

## Capture window

- **Start:** 2026-11-01T02:21:52Z
- **End:** 2026-11-01T02:22:12Z
- Quota-reconcile census read at 2026-11-01T02:22:10Z (inside the window).
- All reads returned HTTP 200. Read-only surfaces only (GETs; the
  operator quota reconcile is read-only). **Zero production
  mutations. Zero spend.**
- Methods reused exactly from the stopped Gate 2D attempt
  (`~/workspace/ch2-program/ch3-recovery/gate2d/`): same connector
  surfaces, same 4-page quota-census pattern, same sync-snapshot
  watermark reads, same parked-fingerprint recompute (assess.py
  canon method), same live-parts method (cf script download →
  multipart parse → byte-compare against the Ch 3 operative
  manifest at
  `~/workspace/ch2-program/ch3-deploy/execution/operative/parts-manifest.json`,
  pin `63d7260ef0c87c45cdcb88c7007643bb90e1631c`).

## Complete conflict set — THE CENTERPIECE (GET /v2/conflicts)

The complete currently observed set is **FOUR** rows. No sampling,
no truncation; every row verbatim (evidence:
`evidence/conflicts-baseline.json`, whose envelope is byte-identical
to the stopped census's `conflicts-pre.json`).

| id | at (raw, ms epoch) | at (ISO, UTC) | occurrence_id | cache_key | expected | found | reason |
|---|---|---|---|---|---|---|---|
| 1 | 1793318054808 | 2026-10-29T23:54:14.808Z | `grant:plan:3183ecbf2ac4bf50bbc6166e:seg:1:full` | lease | 7 | LIKE or GLOB pattern too complex: SQLITE_ERROR | schedule_dead |
| 2 | 1793319854632 | 2026-10-30T00:24:14.632Z | `grant:plan:603ab416bd67ab1b25de97be:ch1:1:full` | lease | 7 | LIKE or GLOB pattern too complex: SQLITE_ERROR | schedule_dead |
| 3 | 1793423664089 | 2026-10-31T05:14:24.089Z | `grant:plan:b2dc2a3d1cd367a0245b9102:ch1:1:full` | lease | 7 | LIKE or GLOB pattern too complex: SQLITE_ERROR | schedule_dead |
| 4 | 1793495070364 | 2026-11-01T01:04:30.364Z | `grant:plan:e377a5559961b294154276b6:ch2:1:full` | lease | 7 | LIKE or GLOB pattern too complex: SQLITE_ERROR | schedule_dead |

**Accretion since the stopped census (2026-11-01T02:09:32Z): NONE.**
The set is still exactly ids 1–4, byte-identical to the stopped
census capture. No row 5 (or higher) exists at baseline time.

## Census figures

### (a) Health — GET /health via curl (public) + connector parity
- build `63d7260ef0c87c45cdcb88c7007643bb90e1631c`
- generation `enabled`; coordinator `armed`; scope `production`;
  version `2.0.0`; ok `true`
- Curl and connector bodies agree exactly.
  (Evidence: `health-curl-baseline.json`, `health-curl-headers-baseline.txt`,
  `health-baseline.json`.)

### (c) Worker settings / script-settings (Cloudflare GETs)
- Bindings: **10** (evidence: `bindings-baseline.json`):
  `ALLOWED_ORIGIN` (plain_text, `https://jedavid33-design.github.io`),
  `COORDINATOR` (durable_object_namespace),
  `GEMINI_API_KEY` (secret_text),
  `GENERATION_HALT` (plain_text, `"0"`),
  `OPALREADER_ACCESS_TOKEN` (secret_text),
  `OPALREADER_GENERATION_V2` (queue),
  `OPALREADER_MIGRATION_OPERATOR_TOKEN` (secret_text),
  `OPALREADER_PHASE_POLICY` (plain_text, `enforce`),
  `OPALREADER_STORAGE` (r2_bucket),
  `OPALREADER_V2_SCOPE` (plain_text, `production`).
- Observability (both `/settings` and `/script-settings` reads):
  enabled `true`; logs enabled `true`, persist `true`,
  invocation_logs `true`; head_sampling_rate 1.
  (Evidence: `bindings-baseline.json`, `script-settings-baseline.json`.)

### (d) Live parts byte-verification
- Live script download: status 200, **etag
  `82053d4d75533056753c5ee6225e0de56e29ecb1de980aa543cdba613a59d6be`**,
  1,383,556 bytes (evidence: `script-prod-baseline.bin`,
  `script-prod-baseline.meta.json`).
- Multipart parse: 29 parts. Byte-compare vs the Ch 3 operative
  manifest: **29/29 byte-identical, no extra parts, no differing
  part** (evidence: `parts-parse-baseline.json`,
  `parts-compare-baseline.json`, `liveparts-baseline/`).

### (e) Plans + stalled grant
- Plan list (GET /v2/d6-plans): 4 plans, `nextCursor: null`
  (exhaustive). States: `plan:e377a5559961b294154276b6` **active**;
  `plan:b2dc2a3d1cd367a0245b9102` complete;
  `plan:603ab416bd67ab1b25de97be` retired;
  `plan:3183ecbf2ac4bf50bbc6166e` complete.
  (Evidence: `plan-list-baseline.json`.)
- Ch 3 plan `plan:e377a5559961b294154276b6`: state `active`,
  stopReason `null`, totals eligible 23 / done 8 / failed 0 /
  blocked 0 / prompts 0; 27 entries (dispositions: 3 bound_already /
  23 eligible / 1 excluded_parked; execution states: 8 committed /
  19 null). (Evidence: `plan-ch3-baseline.json`.)
- Grant job `plan:e377a5559961b294154276b6:ch2` (GET /v2/jobs/…):
  state `generating`, revision 2; **grant
  `grant:plan:e377a5559961b294154276b6:ch2:1:full` state `issued`,
  revision 2**; 23 rows: **8 ready / 15 pending**.
  (Evidence: `job-ch3plan-baseline.json`.)

### (f) Phase accounting + settings
- Phase `forever-pucked` (book
  `5c589095-f812-48a2-8ab2-03ba2791f2b2`), read on BOTH surfaces the
  stopped census used — capabilities `phases` and operator
  diagnostics `plan.phaseAccounting` — and they agree exactly:
  budget 13,500,000; **settled 732,303**; inFlightUpper 0;
  **estimatedUnverified 19,018**; **reservedUnverified 5,648**;
  **remaining 12,762,049**. Diagnostics additionally: settledBasis
  `recorded_known_existing_ledger`, unknownOpen 0,
  unverifiedStatus `provider_unverified`.
  (Evidence: `capabilities-baseline.json`, `diag-ch3-baseline.json`.)
- Settings (GET /v2/settings): **revision 1**, monthlyCap 50,
  geminiLane `standard`. (Evidence: `settings-baseline.json`.)
- Capabilities: generationState `enabled`; lanes — standard
  admitted `true`; batch admitted `false` (`batch_not_armed`);
  configuredLane `null`.

### (g) Eligibility (Ch 3) + parked job
- GET /v2/d6-eligibility (book
  `5c589095-f812-48a2-8ab2-03ba2791f2b2`, scope=chapter,
  chapterIndex=2): **eligible 15**; exclusions bound_already 11 /
  parked 1 / voice_prompt 0 / other 0; **totalChars 20,864**;
  **expectedCostMicroCents 294,137**; **digest
  `9453ab5dc7ee6ade7c650d14066054b965875f2ef1b65eb24bc633588d778e67`**;
  advisory `true`. (Evidence: `elig-ch3-baseline.json`.)
- Book-scope eligibility (same digest): eligible 329, bound_already
  77, parked 1, totalChars 434,914, expectedCost 6,131,305.
  (Evidence: `elig-book-baseline.json`.)
- Parked job `1832c21fcf0425454227c4736048a8a632f422abca4a2685ddb775bb1681406a`:
  state `parked_policy`, revision 1, lane `standard`, chapterIndex 2;
  27 rows: 3 ready / 24 pending; grants `[]`.
  **Fingerprint recomputed by the stopped attempt's method:
  `b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`**
  — exact match to the stopped census value.
  (Evidence: `job-ch3-baseline.json`.)

### (h) Quota reconcile (operator, 4-page census pattern)
- **Current PT day: `2026-10-31`** — the capture (02:21–02:22Z)
  landed BEFORE the 07:00Z PT-day rollover, so the PT day has NOT
  yet rolled to 2026-11-01. Recorded exactly as the live reads show
  (both /v2/quota `dayKey` and reconcile `totals.dayKey` say
  `2026-10-31`).
- Reconcile: **ok `true`**, armed `true`, **drift `[]`
  (driftCount 0)**, censusComplete `true` on the default reads
  (pages 000/001/003; page 002 is the past-end probe:
  exceptions `[]`, censusComplete `false` — same shape as the
  stopped census; all four pages are byte-identical to the stopped
  census's four pages).
- **Sole exception (1):** straddler
  `att-37d63768-db4b-447d-8150-580b7c6ee257`
  (execution `exec-6a9c4e14-2223-4806-9694-90cd140cbd8e`,
  plan `plan:603ab416bd67ab1b25de97be`,
  occurrence `59acff00-d6a4-4e2b-9734-34d50f4f59f0`,
  phase `confirmed`, outcome `estimated_unverified`,
  intervalDays [`2026-10-29`, `2026-10-30`]) — never dispositionable.
- Per-day totals (every day reported):
  - 2026-10-29: dispatched 57 / reserved 0 / consumed 57
  - 2026-10-30: dispatched 79 / reserved 0 / consumed 79
  - **2026-10-31 (current): dispatched 44 / reserved 52 /
    consumed 96 of 100**
- currentDayBlocked `false`.
- Client quota (GET /v2/quota) agrees: dayKey `2026-10-31`,
  providerDispatchesToday 44, providerReservedToday 52,
  attemptsToday 8, spentMicroCents 882,165, monthKey `2026-10`,
  ledgerSeq 45, settingsRevision 1, parked `null`.
  (Evidence: `census-page-000..003-baseline.json`, `quota-baseline.json`.)

### (i) Queue (Cloudflare GET)
- Queue `opalreader-generation-v2`
  (`93b6a35fb8cf4788a91a2c90b748ae66`): **delivery_paused `false`**;
  sole consumer `f260f2188d80426bb0588685e9d084eb`
  (script `opalreader-api-v2-prod`); sole producer
  `opalreader-api-v2-prod`; modified_on
  `2026-10-31T23:05:33.696938Z`. (Evidence: `queue-baseline.json`.)

### (j) Sync watermarks (GET /v2/sync/snapshot)
- **bindings watermark 1826** (1,826 entities).
- **content watermark 18** (7 entities).
- Both snapshot envelopes are byte-identical to the stopped census.
  (Evidence: `snap-bindings-baseline.json`, `snap-content-baseline.json`.)

## Delta table vs the stopped census (2026-11-01T02:09:32Z, pin cf2b4e6f…)

| Item | Stopped census | This baseline | Delta |
|---|---|---|---|
| Conflicts | 4 rows (ids 1–4) | 4 rows (ids 1–4), envelope byte-identical | **NONE — no accretion** |
| /health build | `63d7260e…` | `63d7260e…` | none |
| /health generation / coordinator | enabled / armed | enabled / armed | none |
| Worker etag / bytes | `82053d4d…` / 1,383,556 | `82053d4d…` / 1,383,556 | none |
| Live parts vs Ch 3 operative manifest | 29/29 identical | 29/29 identical, no extras | none |
| Observability | enabled + persisted | enabled + persisted (both reads) | none |
| Bindings | 10; halt `"0"`; policy enforce | 10; halt `"0"`; policy enforce | none |
| Settings | rev 1, standard, cap $50 | rev 1, standard, cap $50 | none |
| Phase accounting | settled 732,303; estUnv 19,018; resUnv 5,648; remaining 12,762,049 / 13,500,000 | identical (both surfaces) | none |
| PT day | 2026-10-31 | 2026-10-31 (rollover at 07:00Z not yet reached) | none — rollover has NOT occurred yet |
| Quota (current PT day) | dispatched 44 / reserved 52 / consumed 96 | dispatched 44 / reserved 52 / consumed 96 | none |
| Quota historical | 10-29 = 57, 10-30 = 79 | 10-29 = 57, 10-30 = 79 | none |
| Reconcile | ok true, drift [], 1 exception (straddler), censusComplete true | identical; all 4 census pages byte-identical | none |
| Plans | Ch 3 active 8/23; others complete/retired/complete | identical; plan list byte-identical | none |
| Ch 3 grant | issued rev 2; job rows 8 ready / 15 pending | identical; job envelope byte-identical | none |
| Parked job | parked_policy rev 1; fingerprint `b991f18a…`; 27 rows (3 ready / 24 pending) | identical; fingerprint recomputed `b991f18a…` exact | none |
| Eligibility (Ch 3) | 15 / 11 / 1; digest `9453ab5d…`; 20,864 chars; expected 294,137 | identical values; digest exact | none (only `quotedAt` read timestamp differs) |
| Sync watermarks | bindings 1826 / content 18 | bindings 1826 / content 18; snapshots byte-identical | none |
| Queue | unpaused; consumer `f260f218…` | unpaused; consumer `f260f218…`; envelope byte-identical | none |
| Batch | unarmed (`batch_not_armed`) | unarmed (`batch_not_armed`) | none |
| Read timestamps | capabilities asOf 1793498979936; elig quotedAt 1793498991174 / 1793498991849 | capabilities asOf 1793499718138; elig quotedAt 1793499729801 / 1793499730288 | expected — per-read server timestamps only |

**Unexpected changes: NONE.** Of the 21 raw evidence envelopes
compared byte-for-byte against the stopped census, 18 are
byte-identical; the 3 that differ (capabilities, elig-ch3,
elig-book) differ ONLY in their per-read timestamp fields
(`asOf` / `quotedAt`), verified field-by-field. No money figure,
grant state/revision, plan state, bindings watermark, part byte,
settings revision, parked fingerprint, or eligibility digest moved.

One expectation note (not a production change): the task brief
anticipated the capture would likely land on PT day 2026-11-01.
It did not — at 02:21–02:22Z the PT day is still 2026-10-31
(rollover at 07:00Z), so no PT-day rollover delta exists in this
baseline. A retry census taken at/after 07:00Z on 2026-11-01 will
legitimately show the new PT day (2026-11-01) with fresh
dispatched/reserved/consumed figures; that rollover, when it
appears, is the expected legitimate change class.

## Anchoring statement

This baseline — `BASELINE.md` together with
`baseline-summary.json` and the raw evidence under `evidence/` —
is the byte-anchored reference for the Gate 2D retry census. The
retry must enumerate the conflict set completely and compare every
census figure against the values recorded here; any deviation,
including a single additional conflict row, is a STOP-class fact
to be reported, not smoothed over.

## Production-contact attestation

Reads only: public curl GET /health; connector GETs (client +
operator quota reconcile); Cloudflare GETs (settings,
script-settings, script content, queue). No halt flip, no queue
pause/unpause, no upload, no finalizer invocation, no generation,
no SQL writes, no Cloudflare mutations. **Production mutations: 0.
Spend: $0.** Nothing was pinned or posted to the board by this
worker; no contact with Julie or Rowan.
