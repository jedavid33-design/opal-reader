# D6 — wrangler-style queue configuration (WS-1)

Mirrors `worker/p8/deploy-spec-prod-d6.json` (the deploy spec is the
source of record; this block is the same topology in wrangler.toml
shape for the deploy gate's convenience). Repo-only: creating the
queue and attaching the consumer are separately authorized deploy /
arming steps — nothing here has been applied to the account.

```toml
# Producer: opalreader-api-v2-prod's coordinator outbox drain
# (d6HostEnv sendGrant in worker-entry-prod-d6.js), wired ONLY when
# GENERATION_HALT = "0". Messages are small ID-bearing grant
# payloads; 3 operations per message (1 write + 1 read + 1 delete).
[[queues.producers]]
binding = "OPALREADER_GENERATION_V2"
queue = "opalreader-generation-v2"

# Consumer: opalreader-api-v2-prod itself (its queue handler posts
# each message to the coordinator's /internal/execute). Delivery is
# enabled LAST in the arming sequence, after the settings
# reconciliation, the consumer attach verification, and the halt
# flip — each read-back-verified (proposal §8 step 5).
[[queues.consumers]]
queue = "opalreader-generation-v2"
max_batch_size = 10
max_batch_timeout = 30
max_retries = 3
```

Pins (PINS.md §4, verified Oct 29, 2026):

- Queue name `opalreader-generation-v2`; binding
  `OPALREADER_GENERATION_V2` (constants: `QUEUE_NAME` /
  `QUEUE_BINDING` in `gen-constants.mjs`).
- Workers Free allowance: 10,000 queue operations/day; per-operation
  cost $0 within the allowance (no metered overage on Free).
  Projected peak ≈300 operations/day at the 100-attempts/day quota
  pace (≈3% of the allowance) — the queue is not a binding
  constraint. Message retention on Free is 24 hours; safe because
  the durable work plan lives in the coordinator and queue messages
  are re-derivable from it, never the record.
- The v1 queue `opalreader-generation` is untouched: it is not
  produced to, consumed, resumed, or shared by this configuration —
  its sole consumer stays the frozen v1 worker and its delivery
  stays paused.
