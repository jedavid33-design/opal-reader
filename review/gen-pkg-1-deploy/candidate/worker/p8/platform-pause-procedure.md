# P8 — Platform pause procedure for the freeze deploy

Status: **documented, not executed.** This procedure is preparation evidence for
Roundtable Case #10 (issue #15). Nothing in it has been run against production.
Executing it requires, in order: Rowan's freeze-build sign-off (granted,
comment 6330908280, preparation scope) **and Julie's separate deployment
approval**. A sign-off never substitutes for Julie's approval.

All Cloudflare operations below are described for the `cf-api` helper
(`custom.legacy-cloudflare`) unless a dashboard or wrangler route is named.
Free tier only; every operation named here is free.

---

## Verified live queue facts (read-only inspection, 2026-10-21 ~22:05 ET)

Read via `cf-api` GETs only. No writes of any kind were made.

- **Account:** `b35ff435ff24d134ff640e0099dd13fc` (the account's only account;
  `opalreader-api` runs here, per the `*.4d8v7jw78c.workers.dev` subdomain).
- **Queues in the account: exactly one.**
  - Queue name: **`opalreader-generation`**
  - Queue id: `e2706b79473d4ece90f37bd784c83386`
  - Producer: `opalreader-api` (worker) — the only producer.
  - Queue settings: `delivery_delay: 0`, `message_retention_period: 86400`
    (24 hours).
  - Delivery state at inspection: **not paused.** The GET response did not
    include `settings.delivery_paused` (the schema field that reports pause
    state; documented examples show it present and `true` when paused), and
    no other field indicated a pause. Delivery is active.
  - Metrics at inspection (`GET .../queues/{id}/metrics`): `backlog_count: 0`,
    `backlog_bytes: 0`, `oldest_message_timestamp_ms: 0` — the queue was empty.
- **Consumer** (from `GET .../queues/{id}/consumers`; exactly one consumer;
  it is the `opalreader-api` worker):
  - Consumer id: `b278d659fa2147da9e80ebe1aa0a5548`, type `worker`,
    script `opalreader-api`.
  - `batch_size: 1`, `max_concurrency: 1`, `max_wait_time_ms: 5000`.
  - **`max_retries: 3`** (retries after the initial delivery attempt).
  - `retry_delay: 0` (consumer-level default; the frozen build's explicit
    per-message `retry({ delaySeconds: 900 })` overrides it for frozen
    deliveries).
  - **`dead_letter_queue`: not configured.** The consumer record returned by
    the API contains no `dead_letter_queue` field (schema: the DLQ queue name,
    or empty when not configured), and the account contains no second queue
    that could serve as one. Per Cloudflare's Queues configuration docs, a
    message that exhausts its retries with no DLQ configured **is discarded**.

### What those numbers mean for a freeze

- **While platform delivery is paused, messages are never delivered at all.**
  They consume no retry attempts and are not touched by the retry budget;
  they simply wait in the queue. The only clock running on a held message is
  the 24-hour `message_retention_period`, so **the freeze window must stay
  well under 24 hours** for queued work to survive intact.
- **The retry budget only matters for the in-flight edge**: a message
  delivered in the moments before the pause takes effect, answered by the
  frozen consumer with `retry({ delaySeconds: 900 })`. Such a message gets
  its initial delivery + 3 retries = 4 attempts spaced 15 minutes apart —
  **45 minutes of redelivery cover**. If it is still undeliverable at the
  last retry it is **discarded** (no DLQ to catch it).
- Conclusion: the residual Rowan named is closed by **sequencing**, not by
  configuration — verify the pause is in effect *before* the frozen worker
  goes live (step 3 below), and the retry budget is never spent on held
  messages. The 45-minute figure is the exposure only for the in-flight
  edge, and the queue read empty at inspection.

---

## The pause operation — confirmation status (read before deploy day)

Pause/resume delivery is a first-class Cloudflare Queues operation
(documentation: "Pause and Purge", developers.cloudflare.com/queues;
changelog 2025-03-25: available via Wrangler, the REST API, and the
dashboard). Confirmed by reading:

- **Wrangler (canonical commands):**
  `wrangler queues pause-delivery opalreader-generation` /
  `wrangler queues resume-delivery opalreader-generation`.
  (There is no wrangler on the deploy VM; these are named for completeness.)
- **State field:** `settings.delivery_paused` (boolean) on the queue
  resource. The **Update Queue** API documents `delivery_paused` among the
  updatable queue settings, so the `cf-api` write path to the same state is:
  `PATCH /client/v4/accounts/{acct}/queues/{queue_id}` with body
  `{"settings": {"delivery_paused": true}}` (and `false` to resume).
- **Dashboard fallback (confirmed route):** Cloudflare dashboard →
  Workers & Pages → **Queues** → **opalreader-generation** → pause delivery
  (resume from the same page).

**Not confirmed by reading:** a dedicated `POST .../queues/{queue_id}/pause`
action path. It is believed to be the operation wrangler calls, but GET
probes through `cf-api` returned the plain queue object for *every* sub-path
— including a nonsense control path — so this read route cannot distinguish
real sub-paths, and the action path is recorded as **unverified**. The probes
changed nothing: the queue's `modified_on` was byte-identical before and
after (a GET cannot pause a queue in any case). On deploy day, use the
PATCH-settings path or the dashboard, both confirmed above; do not rely on
the unverified action path without first confirming it in the dashboard's
network view or the API reference.

**Proof a pause/resume took effect:** re-GET the queue and check
`settings.delivery_paused` (`true` after pause; `false` or absent after
resume) and that `modified_on` advanced.

---

## Procedure

Account: `b35ff435ff24d134ff640e0099dd13fc`.
Queue: `opalreader-generation` (`e2706b79473d4ece90f37bd784c83386`).
Worker: `opalreader-api`. Frozen build: branch `v2/p8-freeze-build`,
commit `933bc678`, tree `32351633` (suite 525/525). Shipped build being
frozen in place of: Worker 1.4.43 / Reader 1.4.117 (repo `main`).

### 1. Pre-checks (all must pass before touching anything)

- [ ] Freeze build commit/tree match the sign-off (`933bc678` / `32351633`);
      suite green at 525/525 on that tree.
- [ ] Rowan's freeze-build sign-off is on the board (comment 6330908280).
- [ ] **Julie's explicit deployment approval is recorded** (chat + board).
      Nothing before this line authorizes any step after it.
- [ ] Read current queue state: `GET .../queues/{queue_id}` and
      `GET .../queues/{queue_id}/metrics`. Record `delivery_paused`
      (expect not paused), backlog count/bytes, and `modified_on`.
- [ ] Read the live worker's script-settings now (baseline for step 4's
      comparison): `GET /workers/scripts/opalreader-api/script-settings`.
- [ ] Confirm the planned freeze window is well under the queue's 24-hour
      message retention period, and note the expected enqueue rate during
      the window (generation is under Julie's standing halt, so ~zero).

*Abort here: nothing has changed; stop freely at any point.*

### 2. Pause message delivery on `opalreader-generation`

- `cf-api PATCH /client/v4/accounts/{acct}/queues/{queue_id}` with
  `{"settings": {"delivery_paused": true}}` — or the dashboard route above.
- This stops all deliveries to the consumer. Producers may still enqueue;
  messages wait in the queue. **Never purge the queue at any step.**

*Rollback from here: resume delivery (step 7's operation). State returns to
exactly the pre-freeze steady state; no code has changed yet.*

### 3. Verify the pause took effect (hard gate)

- Re-GET the queue: `settings.delivery_paused == true` and `modified_on`
  advanced past the step-1 reading.
- Re-GET metrics: backlog is whatever was recorded at step 1 plus any
  arrivals since; no deliveries are occurring.
- **Do not proceed to step 4 unless this verifies.** This ordering is what
  keeps held messages out of the retry budget entirely (see "What those
  numbers mean", above).

*Rollback from here: resume delivery (step 7).*

### 4. Deploy the frozen worker

- Upload `v2/p8/freeze-worker.js` from the signed-off tree using the
  standing deploy practice for this worker (multipart API upload;
  `main_module` set; existing secret bindings sent as
  `{"type":"inherit"}`; `compatibility_date` preserved from the current
  script settings — see AGENTS.md).
- **Observability re-check (standing rule, every code upload):** a code
  upload resets script-settings observability to null. GET
  `/workers/scripts/opalreader-api/script-settings`; if observability is
  null, re-apply it with the settings-only **multipart** PATCH
  (observability `enabled` + logs `persisted`, matching the pre-check
  baseline), then verify the script etag is unchanged — the settings PATCH
  does not touch code.

*Rollback from here: redeploy shipped 1.4.43 from repo `main` (same upload
practice + same observability re-check), then resume delivery (step 7).*

### 5. Smoke checks while frozen and paused

- [ ] `GET /health` → shipped 200 response.
- [ ] A listening read (authenticated) → byte-identical to the shipped
      worker's response for the same stored state.
- [ ] An authenticated mutating request → **423**, and zero state change
      (re-read the target state; it must be untouched).
- [ ] An unauthenticated mutating request → the **shipped 401** (auth runs
      ahead of the freeze refusal — Rowan's revision requirement).
- [ ] If an export link is handy: a valid one-time export link → 423 with
      the token left unconsumed (it must still work after the freeze).

*Any failure: roll back per step 4 (redeploy shipped, then resume). Do not
debug against production beyond these reads.*

### 6. Hold state during the freeze window

What stays true for the whole window:

- Delivery remains paused (`settings.delivery_paused == true`) — held
  messages are never delivered, so no retry attempts are consumed.
- The frozen build is live: reads and listening work exactly as shipped;
  every write path throws behind the binding guard; mutating routes answer
  423 after auth; the queue consumer, if somehow invoked, retries with a
  900-second delay instead of acking (the safety net under the pause).
- The 24-hour retention clock is the window's hard bound; the migration
  steps that follow the freeze are scheduled inside it with wide margin.
- Periodically re-GET queue metrics: a growing backlog is expected and
  harmless within retention; investigate only if it grows far beyond the
  step-1 baseline plus known arrivals.

### 7. Resume delivery

- `cf-api PATCH /client/v4/accounts/{acct}/queues/{queue_id}` with
  `{"settings": {"delivery_paused": false}}` — or the dashboard resume.
- **Ordering rule:** resume only when the live worker is the one you intend
  to process the backlog. Normal end-of-freeze: the v2 cutover has its own
  gates and this resume happens as part of that plan, not here. Rollback
  resume (steps 2–4): only *after* shipped 1.4.43 is redeployed and
  verified — never resume into the frozen build as a "rollback", except
  deliberately and knowing frozen deliveries will be retried at 900 s.
- Verify: re-GET the queue — `delivery_paused` false or absent,
  `modified_on` advanced.

### 8. Post-resume watch

- Watch the first deliveries: queue metrics backlog drains toward zero;
  worker logs (observability is on) show normal job processing with no
  error spike.
- If any message was in flight when the pause engaged, confirm it completed
  exactly once in effect (the job's own checkpoints/cache make redelivery
  idempotent; the freeze revision tests proved this arc).
- Report the outcome on issue #15: pause/resume timestamps, backlog before
  and after, smoke results, any anomalies — named, not smoothed over.

*Rollback after resume: re-pause delivery (step 2) and, if needed, redeploy
the frozen build (step 4) — that returns the system to the step-6 hold
state.*

---

## What this document does not authorize

Executing any step above. Pause, deploy, and resume each happen only under
Julie's explicit deployment approval for P8, recorded before step 2 begins.
