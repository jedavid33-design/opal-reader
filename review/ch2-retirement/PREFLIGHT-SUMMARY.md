# Gate 6 retirement proposal — PREFLIGHT SUMMARY (fresh, read-only)

Capture: **2026-10-31T01:32:47Z**, read-only inventory by the
gate-5 capture method (client connector reads, operator
diagnostics read, Cloudflare GETs). Canonical assessment:
`evidence/preflight-assessment.json`. Raw captures retained
locally under `preflight/` (not pinned). No mutation of any
kind was made. All values below are as read at capture time.

## Identity / containment

- `/health`: build `6a73d9622e1b4eac00c58e289de1c674ed6b3d6b`,
  generation `halted`, coordinator `armed`, scope `production`.
- Script etag (prod):
  `a9a4c0c40ceefa6138c1cc8ebb3f0ab5b2205e7b7a057b865c8c312cbb13c39e`
  — the gate-5 rollback-floor pair (build + etag).
- Bindings: 10; `GENERATION_HALT "1"`;
  `OPALREADER_PHASE_POLICY "enforce"`; observability enabled,
  logs enabled + persisted.
- Settings: revision 1, lane standard, monthly cap $50.
- Quota view: attemptsToday 0, `spentMicroCents 371485`,
  `ledgerSeq 19` (grant-time ledger estimates — not provider
  spend).
- Queue `opalreader-generation-v2` (93b6a35f…ae66):
  `delivery_paused = true`; sole consumer
  `f260f2188d80426bb0588685e9d084eb` (`opalreader-api-v2-prod`).
- Sync watermarks: content 18, bindings 1800.
- Conflicts: exactly the two known `schedule_dead` lease rows
  (Ch 2 grant, smoke grant).

## The disposed attempt

- `att-37d63768-db4b-447d-8150-580b7c6ee257`, seq 7, execution
  `exec-6a9c4e14-2223-4806-9694-90cd140cbd8e`, occurrence
  `59acff00-d6a4-4e2b-9734-34d50f4f59f0`.
- `phase confirmed`, `outcome estimated_unverified`,
  **`costMicroCents null`**, `upperMicroCents 5648`;
  `estimatedCostMicroCents 19018`, `reservedCostMicroCents
  5648`, `estimatedUnverifiedStatus provider_unverified`.
- Execution record state: `unknown_billing` (provenance;
  design §9.2).
- Plan attempt census: 51 confirmed attempts — success 29,
  policy_block 21, estimated_unverified 1, **unknown 0** (the
  retire guard's counted population is zero).

## The plan

- `plan:603ab416bd67ab1b25de97be`: state `halted_unknown`,
  stopReason `phase_halted_unknown_billing`; scope chapter,
  chapterIndex 1, lane standard, phase `forever-pucked`, book
  `5c589095-f812-48a2-8ab2-03ba2791f2b2`.
- Totals: eligible 18, done 0, failed 8, blocked 0.
- Plan settled **179,991**; plan summary
  `estimatedUnverifiedMicroCents 19018`,
  `estimatedUnverifiedStatus provider_unverified`;
  quarantine `held false`.
- Entries: **38** = 20 `bound_already` (9,997 chars) + 18
  `eligible` (**25,091 chars**). The 18 eligible (position,
  occurrenceId, chars, execution state):

| pos | occurrenceId | chars | exec state |
|----:|--------------|------:|------------|
| 45 | 4b2b3699-db42-4af1-9f27-3caad67f58e6 | 1448 | failed |
| 46 | 117ef377-8df1-4189-bc85-4670bb034940 | 1294 | failed |
| 48 | 6b7ea94c-6631-4e66-8330-e3d3152b0c74 | 1352 | — |
| 49 | c4475eda-a6b1-4c92-9f71-f2f69643608f | 1498 | — |
| 50 | 59acff00-d6a4-4e2b-9734-34d50f4f59f0 | 1349 | unknown_billing |
| 51 | 26a37980-ddbb-4f41-8f14-b99e541c582e | 1352 | failed |
| 52 | be263419-cd45-4d29-b31b-e5352f4c8b59 | 1493 | — |
| 53 | de0436f4-89f5-4a99-b38a-d32823ce72cd | 1456 | — |
| 54 | 4f35bc00-7120-45e5-b251-2068ccb4452a | 1475 | failed |
| 55 | 3929c8a1-e5a3-4ba3-be1f-e1bb72dccb6b | 1367 | failed |
| 56 | 0343a3a1-9957-4431-8663-dce0b329171f | 1389 | failed |
| 57 | bfabaa59-e720-4ec6-9346-d196f0f80582 | 1399 | — |
| 58 | b42a64ab-8bac-4706-85f3-adf7cc96bcdd | 1341 | — |
| 59 | 84ff25f0-dc56-4c9e-980d-0af74e9fef7f | 1184 | — |
| 60 | 2997a9b4-0ff6-4254-8022-4c6c9b986159 | 1477 | failed |
| 61 | 67d4b319-d696-4c08-90d7-100d5c9e240c | 1367 | — |
| 62 | abae8a3e-127d-4979-a883-df072be33784 | 1437 | — |
| 63 | 3095422d-17c5-4f48-8660-ce94930fb605 | 1413 | failed |

- Job `plan:603ab416bd67ab1b25de97be:ch1`: state `generating`,
  revision 2; 18 occurrence rows all `granted`; one grant
  `grant:plan:603ab416bd67ab1b25de97be:ch1:1:full`, state
  `issued`, revision 2.

## Phase accounting (forever-pucked)

| figure | value |
|---|---:|
| budget | 13,500,000 |
| settled (recorded_known_existing_ledger) | 199,665 |
| estimated unverified | 19,018 |
| reserved unverified | 5,648 |
| in-flight upper | 0 |
| unknownOpen | 0 |
| remaining | 13,294,687 |
| unverifiedStatus | provider_unverified |

## Neighbors

- Smoke plan `plan:3183ecbf2ac4bf50bbc6166e`: `complete`,
  plan settled 19,674, estimated 0 — unchanged.
- Chapter 3 job
  `1832c21fcf0425454227c4736048a8a632f422abca4a2685ddb775bb1681406a`:
  `parked_policy`, revision 1, 27 rows (3 ready / 24 pending),
  no grants, fingerprint
  `b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`
  — exact.
- v1 worker etag `ea6f8196…` and staging etag `61553a07…`
  unchanged (from the same capture).

— Wren
