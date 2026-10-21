# Shelf bridge — golden fixtures

The Reader→Shelf wire contract, harvested from the shipped client
(`app-256.js`, Reader 1.4.117) on 2026-10-21 for the v2 Option C program
(requirement F12: the bridge is FROZEN — the v2 adapter must reproduce this
contract exactly; no Shelf Worker/DB/API changes are authorized).

These fixtures are the contract. `tests/shelf-bridge-contract.test.mjs`
drives the *actual shipped functions* (extracted from `app-256.js`, not
reimplemented) and asserts their behavior matches these files. If a future
client changes any byte of this behavior, the test goes red and the change
is a contract change — deliberate or not.

## The contract (from source)

- **Outbox**: `localStorage["opalreader.shelfOutbox.v1"]`, a JSON array,
  capped to the last 300 items. Item shape:
  `{queueId, clientSessionId, readId, startedAt, duration_seconds, attempts}`
  (`lastStatus`/`lastError` are added transiently after a failed flush).
- **Queue id**: `shelf_<readId, sanitized to [a-zA-Z0-9_-], last 48 chars>_
  <startedAt epoch ms>_<crypto.randomUUID()>`. `clientSessionId` === queueId.
- **Session timing** (what reaches the queue): wall-clock from listen start;
  checkpoints every 30s; a pause starts a 4s timer — resume inside 4s keeps
  the session, otherwise the session ends backdated to the pause moment;
  `duration_seconds` is whole wall-clock seconds, never audio-file length.
- **Merge rule** (`shelfQueue`): if the newest queued item has the same
  readId, `attempts===0`, is not the item currently being flushed, and the
  new session starts within **90,000 ms** of that item's end, the new
  duration is *added* to it instead of creating an item.
- **Flush** (`shelfFlush`): strictly FIFO. `attempts` is incremented and
  persisted *before* the POST (crash-safe idempotency). POST
  `{shelfApiBase}/api/sessions` with the payload in
  `session-payload.simple.json`. On 2xx the item is removed. On a 409 whose
  message matches `overlaps an existing session (<start> – <end>)`, the
  item is replaced by the *uncovered* intervals only — each with a fresh
  queue id and whole-second **floored** durations (<1s parts dropped);
  fully covered counts as `covered`, not `sent`. On 404
  "read-through not found" the flush flags `relinkNeeded`. Any other
  failure records `lastStatus`/`lastError` on the head item and stops
  (head-of-line blocking — later items are never sent past a failed one).

## Files

- `session-payload.simple.json` — the exact POST body for one session.
- `outbox-item.simple.json` — the stored outbox item for the same session.
- `queue-merge.case.json` — merge-window cases (inside 90s merges, outside doesn't).
- `overlap-carve.case.json` — a 409 overlap and the exact replacement parts.
