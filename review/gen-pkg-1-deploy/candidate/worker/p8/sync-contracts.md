# Opal Reader v2 — sync HTTP contracts (Part 1, B3)

The transport the P4/P5 client store presumes, made concrete. All
routes are served by `v2/worker-entry.js` → the coordinator Durable
Object → `v2/api.mjs`. The client implementation is
`v2/client/http-transport.mjs`.

## Access (every `/v2/*` route)

Deny by default, enforced in the worker entry before any DO contact:

| Condition | Result |
|---|---|
| Worker scope binding is not exactly `staging-smoke` | `403 {"error":"staging_scope_required"}` |
| Request lacks header `X-OpalReader-Scope: staging-smoke` | `403 {"error":"staging_scope_required"}` |
| Token secret not configured on the script | `503 {"error":"staging_token_not_configured"}` |
| Header `X-OpalReader-Token` missing or not equal to the configured staging token | `401 {"error":"The personal access token is missing or incorrect."}` (the shipped v1 body, verbatim) |
| Header `X-OpalReader-Instance` present but not `account` or `smoke-p8` | `400 {"error":"invalid_instance"}` |
| Any path outside `/health` and `/v2/*` | `404 {"error":"route_not_found"}` — no v1-shaped route exists |

`X-OpalReader-Instance` defaults to `account`; the Part 2 smoke and the
preview client use `smoke-p8`. Instance selection chooses a Durable
Object instance inside the v2 namespace only — it can never address v1
storage (the v2 script has no KV binding and no v1 read/write code).

`GET /health` (and `/health/`) is public and returns identity only:
`{"ok":true,"app":"OpalReader API v2","version":"2.0.0","build":"<source commit>","coordinator":"armed"|"unbound","scope":"staging-smoke"|null,"generation":"halted"|"enabled"}`.

## Existing command/read surface (unchanged from P2)

- `POST /v2/commands` — body: a durable command
  `{command_id, type, payload}`. `200` with the coordinator receipt
  (`{command_id, outcome, ...}`, replays return the original receipt
  with `replayed: true`).
- `POST /v2/reports` — body: an executor report. `200` with the report
  result.
- `GET /v2/commands/:id` — `200` receipt or `404 {"error":"command_not_found"}`.
- `GET /v2/jobs/:id` — `200` job view or `404 {"error":"job_not_found"}`.
- `GET /v2/quota` — `200` quota view (basis-labeled, F8).
- `GET /v2/settings` — `200` settings view.
- `GET /v2/conflicts` — `200 {"conflicts":[...]}`.
- `GET /v2/chapter-state?job=<id>` — `200 {"state":<F7 state>}` or `404`.

All GETs are pure (invariant I2): they run against a read-only SQL
facade that rejects non-SELECT statements.

## New sync routes (Part 1)

### `GET /v2/sync/snapshot?family=<family>`

Families: `content | bindings | position | settings`.

`200` — for content/bindings/settings:
`{"family","watermark":<seq>,"entities":[{"entityKey","bookId","revision","tombstone":bool,"data":<entity payload or null>}]}`.
For position: `{"family":"position","watermark":<seq>,"positions":[<positionView>, ...]}`.
`400 {"error":"unknown_family","family":<value>}` for any other family.

### `GET /v2/sync/changes?family=<family>&sinceSeq=<n>&limit=<n>[&cursor=<json>]`

`sinceSeq` is exclusive. `limit` defaults to 200 and is clamped to
1..500 by the coordinator. `cursor`, when present, is the URL-encoded
JSON of the coordinator's pinned-watermark cursor
`{"family","seq","watermark"}` and takes precedence over `sinceSeq`.

`200` page:
`{"family","changes":[{"seq","entityKey","bookId","revision","op","payload"}],"nextSeq","highWatermark","hasMore":bool,"cursor":{"family","seq","watermark"}}`.
When the cursor fell below the retained floor:
`200 {"resyncRequired":true,"family","floorSeq"}` — the client answers
with a snapshot, per the store's `applyPullPage`.
`400` with `{"error":"unknown_family"|"invalid_cursor", ...}` for a bad
family or a malformed/mismatched/ahead cursor.

### `POST /v2/sync/position`

Body: `{"commandId","deviceId","bookId","events":[{"eventId","deviceId","localSeq","kind":"play|pause|seek|checkpoint","occurrenceId","offsetSec","baseSeq"}]}`.
This is a durable `PushPositionEvents` command: `commandId` is the
idempotency key, and a replay returns the original outcomes.

`200`:
`{"receipt":<command receipt>,"receipts":[{"eventId","receiptSeq","superseded":bool}],"rejected":[{"eventId","reason"}],"tip":<asOfReceiptSeq>,"journalGaps":[{"deviceId","missing":[<localSeq>]}]}`.
Accepted and replayed events land in `receipts`; rejected and
conflicting events land in `rejected` with their reason — both are
surfaced to the caller, never hidden.
`409 {"error":"position_push_rejected","receipt":...}` when the
command itself is rejected (e.g. unknown book). `422
{"error":"invalid_position_push"}` when `commandId`, `bookId`, or
`events[]` is missing.

### `GET /v2/sync/position/:bookId`

`200` position view:
`{"bookId","canonical":{"occurrenceId","offsetSec","playing":bool}|null,"asOfReceiptSeq","supersededCount","journalGaps":[...]}`.

### `GET /v2/sync/byte-check/:cacheKey`

`:cacheKey` must be 64 lowercase hex chars, else `400
{"error":"invalid_cache_key"}`. `200 {"cacheKey","exists":bool}` —
existence of the audio object in the v2 R2 cache namespace
(`audio/<cacheKey>.mp3|wav`), answered from the request-scoped R2
snapshot in the DO host. `503 {"error":"byte_check_unavailable"}` when
no byte source is wired.

## What is deliberately absent

- No route reads or writes v1 KV book records, the v1 library index, or
  any `book:<id>` key. There is no dual-read.
- No route resolves a Batch never-accepted claim: the coordinator's
  `resolveBatchNeverAccepted` is not exposed over HTTP in Part 1 (see
  the evidence-source residual in part1-decisions.md).
- No route triggers generation. Commands that would generate are
  accepted/rejected by the coordinator under the freeze/halt rules, and
  dispatch is blocked at three further layers (no consumer, no delivery
  function while halted, provider-seam refusal).
