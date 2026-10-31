# EXECUTION RECORD — Gate (a): the combined halted deploy (cache fix + quota budget + operator routes)

Executed 2026-10-31, 17:33–17:49Z, under Julie's recorded approval
(issue #15 comment **6546772878**, button tap — "GO — execute gate (a)
exactly as scoped (one attempt, STOP gates binding)") of the proposal
pinned **`945875bc26b0e2ca965d5c0f710f11c0164025f8`** on `ui1-review`
(`jedavid33-design/opal-reader`), which carries Rowan's CONDITIONAL
OPERATIONAL READINESS PASS (comment 6546757371). Operative envelope:
28 parts, 1,339,824 bytes, SHA-256
`38ebec8e380f5035f1d6e30670f42e489131e1b0771b3540eb49b2f7e57ed0de`,
assembled with stamp pin `945875bc…`.

**Outcome: GATE (a) COMPLETE — all steps PASS. End state: new build
`945875bc…` LIVE, generation HALTED, queue PAUSED, quota UNARMED.**
No STOP gate was hit. Exactly three mutations were performed, all of
them plan steps: the P1 halt-flip mechanism upload, the P2 queue-pause
PUT, and the D2 code PUT. The conditional D3 observability PATCH was
not needed. No bootstrap call, no disposition, no generation intent,
no provider call, no client publication, no second code PUT.

Labels: **CONFIRMED** = read back from production or byte-verified in
this run. **INFERRED** = deduced from cited evidence. **OPEN** =
unresolved and carried forward.

## P0 — fresh pre-hold census: PASS, with one explained deviation (17:33:54Z; evidence/p0/)

Full read-only census of every surface named in the proposal, compared
against the recorded pre-state under the strict rule:

- **CONFIRMED** `/health`: build `6a73d9622e1b4eac00c58e289de1c674ed6b3d6b`,
  generation "enabled", coordinator "armed". Script etag
  `a9a4c0c40ceefa6138c1cc8ebb3f0ab5b2205e7b7a057b865c8c312cbb13c39e`.
  Bindings: exactly the 10 expected names, `GENERATION_HALT "0"`,
  `OPALREADER_PHASE_POLICY "enforce"`. Observability enabled + logs +
  persist. Queue `opalreader-generation-v2`: `delivery_paused == false`,
  sole consumer `f260f2188d80426bb0588685e9d084eb`, retention 86,400 s.
- **CONFIRMED** Settings revision 1 (lane standard, cap $50). Quota
  view: dayKey `2026-10-31` — exactly the current PT day — with
  attemptsToday **0** and the cumulative counters unchanged
  (spentMicroCents 725,221 / ledgerSeq 37). The day-roll explanation
  condition in the approval scope is satisfied exactly: prior-day
  counters (18 attempts on day 2026-10-30) rolled, zero attempts on
  the new day, cumulative ledger untouched.
- **CONFIRMED** Phase `forever-pucked` (capabilities + operator
  diagnostics, two surfaces): settled **579,339**,
  estimatedUnverified **19,018**, reservedUnverified **5,648**,
  unknownOpen **0**, inFlightUpper **0**, remaining **12,915,013** of
  13,500,000, `provider_unverified`. Phase binding unchanged.
- **CONFIRMED** Plans (list exhaustive, nextCursor null): smoke
  `complete`; old Ch 2 `plan:603ab416bd67ab1b25de97be` `retired` /
  `retired_unknown_billing`; fresh Ch 2 `plan:b2dc2a3d1cd367a0245b9102`
  `complete` (18/18 done). No active plan. Chapter 3 job
  `1832c21f…` `parked_policy` rev 1, 27 rows (3 ready / 24 pending),
  grants [], fingerprint recomputed by the G8 recipe =
  **`b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`**
  (exact). Batch unarmed (capabilities `batch_not_armed`).
- **CONFIRMED** Attempt inventory (operator diagnostics): all **137**
  attempts across the three plans in phase `confirmed` — zero in
  `reserved`/`dispatching`, so zero in-flight provider calls. The two
  stale jobs (`generating` rev 2, one `issued` grant each, smoke +
  old Ch 2) are the recorded non-executable provenance, unchanged.
- **CONFIRMED** Watermarks: content **18** (7 entities), bindings
  **1818** (1,818 entities) — snapshot digests recorded in
  `evidence/p0/assess-p0.json`; zero bindings drift, so the
  per-entity provenance clause was not triggered.
- **Explained deviation — conflicts count.** `/v2/conflicts` carries
  **three** `schedule_dead` lease rows, not the two recorded in
  proposal §2.5. Row id 3 (`at` 2026-10-31T05:14:24Z) names the fresh
  Chapter 2 plan's grant `grant:plan:b2dc2a3d1cd367a0245b9102:ch1:1:full`,
  cache_key `lease`, expected `"7"`, found
  `LIKE or GLOB pattern too complex: SQLITE_ERROR` — byte-identical
  failure signature to recorded rows 1 (smoke grant) and 2 (old Ch 2
  grant). **INFERRED, with source-level provenance:** the writing
  mechanism is visible in the live build's own code (coordinator
  `alarm()`: a schedule row that exhausts `SCHEDULE_MAX_ATTEMPTS`
  retries against the lease pattern is parked `dead` and logged to
  `binding_conflicts` with reason `schedule_dead`); each executed
  plan's grant produces exactly one such row as its lease-maintenance
  row dies on the backoff ladder, and row 3's timestamp sits on that
  ladder after the approved Gate-8 run (Julie's GO 6538633362,
  executed 03:52–04:16Z, record PASS 6544061295). It is a
  bookkeeping artifact of approved work — not generation activity:
  every generation counter at P0 proves zero movement (attemptsToday
  0 on the new day, all attempts confirmed, inFlightUpper 0, settled
  figures and watermarks exact). The §2.5 count of two predates the
  Gate-8 run's row reaching its retry ceiling. Recorded here in full
  for Rowan's review; the run proceeded on the strength of the
  provenance, per the same standard the plan applies to explained
  drift.
- **CONFIRMED** Neighbors unchanged: v1 etag `ea6f8196…`, v1 queue
  paused; staging etag `61553a07…`.

## Rollback prerequisites: PASS (before any PUT; evidence/floor/)

- **CONFIRMED** Floor package archived under `evidence/floor/`: the
  P0 live script download (`live-script-download.bin`, 1,259,873 B)
  parsed to exactly the 27 disposition-envelope parts, **27/27
  byte-identical** to the pinned parts-manifest of the floor build
  (`compare-vs-disposition-manifest.json`), plus the floor metadata
  (`floor-metadata.json`) and the download's etag record.
- **CONFIRMED** Floor compatibility identity: build `6a73d962…` +
  etag `a9a4c0c4…`, the §6 minimum build. Gate (a) creates no quota
  schema/data (proven at D4), so the clean pre-bootstrap rollback
  window condition holds.

## Step P — create and prove the hold: PASS

### P1 — halt flip via the gate-7 A4 mechanism, reversed (PUT 17:35:32–17:35:34Z; evidence/stepP/)

- Assembler validation first: live parts + the rearm record's
  halt-"0" flip metadata reproduced the gate-7 artifact
  byte-for-byte (1,263,057 B, SHA-256 `4f7c6466…` — exact match with
  `rearm/execution/flip-envelope.bin`), proving the local assembler
  is byte-exact against the proven mechanism.
- The P1 envelope = live parts + the floor metadata with
  `GENERATION_HALT "1"`: **1,263,057 B, SHA-256
  `7d82eccf80b1f8fd5d38f9dd7deafb1f2b41a72829f14dc1b4e962acc394ee32`**
  — byte-identical to the disposition deploy's own assembled
  envelope. Parsed-JSON metadata diff vs the live metadata: **exactly
  one leaf**, `.bindings[4].text` (`GENERATION_HALT "0"→"1"`).
- Precondition read-back immediately before the PUT (17:35:27Z):
  build `6a73d962…`, generation "enabled", halt "0", etag `a9a4c0c4…`
  — state unchanged since P0.
- **The one PUT: HTTP 200**, success, no errors; deployment
  **`f02979ab6d084131a20b28bd1a6e463e`**; entry point + handlers
  preserved.
- Read-backs: `/health` build still `6a73d962…`, generation now
  **"halted"**; bindings diff vs P0 = **exactly one entry**
  (GENERATION_HALT `"0"→"1"`); **script etag UNCHANGED
  `a9a4c0c40ceefa6138c1cc8ebb3f0ab5b2205e7b7a057b865c8c312cbb13c39e`**;
  observability survived (enabled + logs + persist).

### P2 — queue pause (PUT 17:35:49Z)

- **CONFIRMED** PUT `{queue_name, settings.delivery_paused: true}` →
  HTTP 200; read-back `delivery_paused == true`, delivery_delay 0,
  retention 86,400 s, sole consumer unchanged, producer unchanged.

### P3 — halted-idle verification (capture 17:35:55Z; evidence/stepP/)

- **CONFIRMED** Full census re-read: every generation-plane surface
  byte-identical to P0 (quota view, all three diagnostics, all plans,
  jobs, conflicts, watermarks, phase accounting, settings, neighbor
  etags). The only differences anywhere are the intended Step P
  readouts: `/health` generation "halted", capabilities
  `generationState "halted"` (its phases block byte-identical),
  `GENERATION_HALT "1"`, queue `delivery_paused true`. Zero
  in-flight: diag surfaces identical to P0, where all 137 attempts
  were `confirmed`.

## D0 — quiescence under the hold: PASS (evidence/d0/)

- **CONFIRMED** Three complete samples — s1 17:36:23Z, s2 17:37:49Z,
  s3 17:47:21Z — **strictly identical across every compared surface**
  (s1→s3 spans 10m58s, in the class of the disposition run's
  two-sample 10m09s proof). Both s1 and s2 script downloads parse to
  27/27 parts byte-identical to the floor manifest; s3 etag
  `a9a4c0c4…` (content-derived) unchanged. No drift of any kind under
  the hold; the §3 STOP rule never engaged.

## D1 — operative artifact validation: PASS (evidence/d1/)

- **CONFIRMED** Lineage: `2c8076ed` (D1 operative run) ← `945875bc`
  (envelope package) ← `fbedab3f` (combined SOURCE PASS head) —
  the pins named in the readiness PASS, per the pinned artifacts.
- **CONFIRMED** Harness re-run against the candidate tree with
  `--pin 945875bc26b0e2ca965d5c0f710f11c0164025f8`:
  **PASS 23/23 assertions** (`harness-d1-run.log`,
  `proof-result.json`: passed 23, failed []).
- **CONFIRMED** Assembled bytes hash to the operative identity
  **exactly**: 1,339,824 B, SHA-256
  `38ebec8e380f5035f1d6e30670f42e489131e1b0771b3540eb49b2f7e57ed0de`
  (`assembled-envelope.bin`, copied from the D1 run). Metadata spec
  exact: top-level keys {main_module, compatibility_date,
  compatibility_flags, bindings, observability}; 10 bindings
  including the three inherit secret names; `GENERATION_HALT "1"`;
  **no `migrations` key**.
- **CONFIRMED** Rowan's changed-file blob comparison, 8/8: the eight
  changed/new parts fetched as Git blobs from the pinned lineage
  (`jedavid33-design/opal-reader`, branch `ui1-review`) are
  byte-identical to the envelope parts and to proposal §1.3
  (`blob-comparison.json`). Parts (tree bytes / SHA-256 prefix /
  source blob): `v2/coordinator.mjs` 274,953 / `5d072763…` /
  `0153adaf…` (quota-fix2 pin); `v2/generation/d6-executor.mjs`
  46,660 / `c3613a81…` / `c2d4b78d…`;
  `v2/generation/gen-constants.mjs` 4,936 / `9af664fa…` /
  `7d6bb7d6…`; `v2/generation/genstore.mjs` 48,703 / `811b6b15…` /
  `156a727f…`; `v2/generation/quota-budget.mjs` 42,048 /
  `2b39924579e5af2d5d20eea01122d2323ccedac9fe9ff9f7026c49af14770820`
  (full) / `3e44123c…` (quota-fix2 pin); `v2/generation/service.mjs`
  77,995 / `aeeee06c…` / `fcf88f90…`; `v2/host/adapters.mjs` 39,224 /
  `f8ac357e…` / `1c16ec6f…`; `v2/worker-entry-prod-d6.js` 85,577 /
  `410dfa410abfdb4bfeb81ac1a9c102b89ec6ce68c352b6b6fe3360d7dfe0b017`
  (full) / `1f1313e9…` (quota-routes-fix2 pin).

## Step R — pre-upload recheck: PASS (capture 17:47:46Z; evidence/r/)

- **CONFIRMED** Full inventory immediately before upload: identical
  to D0 sample 3 on every compared value; queue still PAUSED; halt
  still "1"; live build still `6a73d962…`. This capture also served
  as the D2 precondition read-back. Envelope SHA-256 re-verified
  immediately before upload: `38ebec8e…` exact
  (`evidence/d2/envelope-sha-preupload.txt`).

## D2 — the one code upload: PASS (PUT window 17:48:08–17:48:11Z; evidence/d2/)

- **The one PUT** of the exact D1-validated bytes
  (`evidence/d1/assembled-envelope.bin`): **HTTP 200, success, no
  errors**. New deployment
  **`f70aa8121c7a429784c2781b7924d164`**; new script etag
  **`d63b61c349a3518998d29d318ec465af24a63468df6cdf4876e4ba8862849039`**;
  entry point `v2/worker-entry-prod-d6.js`; handlers [fetch, queue];
  compatibility_date 2026-08-29 + nodejs_compat preserved; secrets
  inherit-by-name.
- Read-backs: `/health` build ==
  **`945875bc26b0e2ca965d5c0f710f11c0164025f8`** (exact), generation
  "halted", coordinator "armed"; `/settings` bindings exactly the 10
  expected names with `GENERATION_HALT "1"` and
  `OPALREADER_PHASE_POLICY "enforce"`.

## D3 — observability: PASS, no PATCH (evidence/d3/)

- **CONFIRMED** Observability **survived** the upload (as at G4, the
  seed-fix deploy, Gate 1, the combined deploy, the disposition
  deploy, and the gate-7 flip): GET script-settings shows enabled +
  logs enabled + persist, byte-identical to the pre-deploy shape.
  **The conditional observability-only settings PATCH was therefore
  not performed.** Script etag on download == `d63b61c3…`, identical
  to the D2 PUT response etag.

## D4 — post-state verification: PASS (capture 17:48:27Z; evidence/d4/)

- **CONFIRMED** Deployed-script download: **28/28 module parts
  byte-identical** to the operative envelope parts
  (`parts-verification.json`). Representation note, stated plainly:
  the GET script response carries the 28 module parts only — no
  `metadata` part is returned in that representation; the metadata's
  operative content is proven by the D2 PUT response (entry point,
  compatibility, handlers) and the GET /settings bindings read-back
  (exactly the 10 expected bindings, halt "1", policy "enforce").
  Download etag == `d63b61c3…`.
- **CONFIRMED** `/health` build == `945875bc…`, generation "halted".
  Queue read-back: still **paused**, consumer/producer unchanged.
- **CONFIRMED — the D4.3 floor-shape proof.** `GET
  /v2/d6-quota-reconcile` (operator connector, READ ONLY) on the new
  build returns exactly the pre-bootstrap floor shape:
  **`{armed: false, ok: false, reason: "not_armed"}`** (HTTP 200;
  `reconcile-floor.json`). Per the approved interpretation this
  proves gate (a) created **no** quota bootstrap record, quota
  tables, or attempt history; the first real-schema evidence comes
  at gate (b). The `/v2/quota` view on the new build is
  value-identical to the D0 baseline (dayKey 2026-10-31,
  attemptsToday 0, spentMicroCents 725,221, ledgerSeq 37,
  settingsRevision 1; no additive keys appeared).
- **CONFIRMED** Playback sanity (READ): the full D4 capture's sync
  snapshot heads (content + bindings families) read successfully on
  the new build and are digest-identical to the D0 baseline —
  the client read path serves the unchanged plane.
- **CONFIRMED** Everything else strictly identical to the D0
  baseline: phase accounting (settled 579,339 / estimated 19,018 /
  reserved 5,648 / unknownOpen 0 / remaining 12,915,013,
  `provider_unverified`), Chapter 3 fingerprint `b991f18a…`,
  watermarks content 18 / bindings 1818, all plans and jobs, the
  three explained `schedule_dead` conflict rows (no new row),
  settings revision 1, neighbors (v1 etag `ea6f8196…` + queue
  paused; staging etag `61553a07…`).

## End state (CONFIRMED at D4)

- Worker `opalreader-api-v2-prod`: build
  `945875bc26b0e2ca965d5c0f710f11c0164025f8`, etag
  `d63b61c349a3518998d29d318ec465af24a63468df6cdf4876e4ba8862849039`,
  latest deployment `f70aa8121c7a429784c2781b7924d164`,
  `GENERATION_HALT "1"`, observability enabled + persisted.
- Queue `opalreader-generation-v2`: delivery **PAUSED**.
- Quota: **UNARMED** — no bootstrap record exists; reconcile returns
  the `not_armed` floor shape. Settings revision still 1.
- Generation plane untouched: no plan, job, attempt, phase figure,
  watermark, or Chapter 3 state moved at any step.
- **The system rests halted + paused + UNARMED on the combined
  build.** Gate (b) — bootstrap, full reconcile census, named
  dispositions — and any re-arm or generation remain separately
  gated on Julie's fresh approvals, with re-arm additionally
  requiring `reconcileQuota.ok === true` at that moment under the
  §5.3 rule. Gate (a)'s unused rollback window stays clean only
  while no bootstrap record exists.

## Mutations performed (complete list)

1. P1 mechanism upload (metadata-only halt flip, live parts
   byte-identical) — deployment `f02979ab6d084131a20b28bd1a6e463e`,
   script etag unchanged.
2. P2 queue pause PUT — `delivery_paused: true`.
3. D2 code PUT (the operative envelope) — deployment
   `f70aa8121c7a429784c2781b7924d164`, etag `d63b61c3…`.

Nothing else was mutated. No provider was called; nothing was spent;
no client files were published.

## Evidence map (execution/)

- `evidence/p0/` — P0 census + `assess-p0.json` canonical comparison.
- `evidence/floor/` — archived floor parts, metadata, manifest
  comparison (rollback package).
- `evidence/stepP/` — P1 envelope, PUT response, precondition +
  read-backs, P2 response + read-back, P3 capture + assessment.
- `evidence/d0/` — three quiescence samples + assessments + parts
  comparisons.
- `evidence/d1/` — harness re-run log, proof-result, assembled
  envelope + metadata + parts manifest, GitHub tree fetch, 8-blob
  comparison.
- `evidence/r/` — Step R capture + assessment.
- `evidence/d2/` — envelope SHA pre-upload, PUT window, PUT response
  (+ headers), health + bindings read-backs.
- `evidence/d3/` — script-settings after D2, etag check.
- `evidence/d4/` — deployed-script download + 28-part verification,
  full capture + assessment, reconcile floor-shape read.
- Snapshot bodies (content/bindings families) are represented by
  digest stubs (`*.digest.json`: SHA-256 + bytes + watermark +
  entity count) — production book text is never archived in
  evidence; the P0 bindings snapshot body is retained (metadata
  only). Redundant intermediate script downloads were likewise
  reduced to their `.meta.json` etag records (the etag is
  content-derived; byte-level part comparisons for D0 s1/s2 are
  saved). `tools/` holds the exact scripts used.
