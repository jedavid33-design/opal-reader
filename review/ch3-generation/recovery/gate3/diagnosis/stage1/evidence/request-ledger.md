# Stage 1 request ledger (every production request made, in order)

Ceiling: **9** requests (Diagnosis Proposal Amendment 1, §7.2). Used: **7**.

| # | Probe | Request | Window (UTC) | HTTP |
|---:|---|---|---|---:|
| 1 | D1 | `GET /health` (direct curl) | 2026-11-01T15:05:31Z | 200 |
| 2 | D2 | `GET /v2/conflicts` (client connector) | 2026-11-01T15:05:36Z | 200 |
| 3 | D3 | `GET /v2/d6-plans/plan:e377a5559961b294154276b6` (client connector) | 2026-11-01T15:05:43–44Z | 200 |
| 4 | D4 (page 1) | `GET /v2/d6-quota-reconcile` (operator connector) | 2026-11-01T15:05:50–51Z | 200 |
| 5 | D4 (confirmation re-read) | `GET /v2/d6-quota-reconcile` (operator connector) | 2026-11-01T15:05:58Z | 200 |
| 6 | D5 | `GET /v2/sync/changes?family=bindings&sinceSeq=1826` (client connector) | 2026-11-01T15:06:11Z | 200 |
| 7 | D6 | `GET /v2/conflicts` (client connector) | 2026-11-01T15:06:11–12Z | 200 |

No other production requests were made. No preview or finalizer route
was called. No POST/PUT/PATCH was issued to any surface. Each connector
invocation produced exactly one response envelope; no connector-internal
retries were observed. Stage window: 2026-11-01T15:05:31Z → 15:06:12Z.
