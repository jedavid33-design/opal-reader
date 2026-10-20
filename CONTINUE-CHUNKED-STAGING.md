# Chunked Continue staging — design + implementation report

Branch: `continue-chunked-staging` (from the deployed tree, main @ 1227975).
Status: **implemented + tested; NOT deployed.** Awaiting Julie's and
Rowan's approval. Nothing in this branch changes production behavior
until it is deployed, and deployment is a separate decision.

## The incident this fixes (2026-10-19 evening)

Forever Pucked's Batch setup failed twice with the Reader reporting
"Setup not confirmed (no HTTP response): Load failed." Read-only
forensics found **zero** server-side effects: no payloads, no statuses,
no mirrors, no queue messages, no generation attempts (the only Gemini
calls were three voice auditions). The one-shot
`POST /api/generation/continue` carries the entire plan — up to 30 jobs,
each embedding its chapter's full payload — as one multi-megabyte JSON
body, which the Worker must fully parse before staging anything. Both
requests died at intake, before the staging loop's first write, and the
client's only recourse was resending the whole plan. The iPad still
holds the `staging_unconfirmed` session with the original session ID
and job IDs; this fix makes *that exact session* recoverable.

## Protocol

Two additive endpoints; the legacy endpoint is untouched.

### `POST /api/generation/continue/stage`
Body: `{session_id, book_id, job_ids, jobs}` where `job_ids` is the
plan's full ordered ID list (≤30 × 64 chars — a couple of KB) and `jobs`
is a slice of **1–10** full job payloads.

- Every payload passes the same `describeContinuePayloadIssue`
  validation the one-shot path uses, plus membership in `job_ids` and
  plan order within the request.
- A session **manifest** (`generation/sessions/<sessionId>.json`, R2)
  records `{session_id, book_id, job_ids, state}` on first sight. Later
  slices must present the identical plan, or the request is rejected —
  a plan can never change mid-staging.
- Each job is staged through the same per-job core the one-shot path
  uses (`stageOneContinueJob`, extracted verbatim), except **always in
  state `parked`** — including plan position 0. A job the Worker
  already holds for this session is acknowledged and *not rewritten*
  (idempotent resume; a job owned by a different session is a hard
  error, as in the legacy path). Payload-only partial jobs (the
  `staging_incomplete` case) are re-staged in full.
- The response reports progress counted from **live statuses**, never
  from bookkeeping: `{accepted, staged_total, plan_total, complete}`.

### `POST /api/generation/continue/finalize`
Body: `{session_id, book_id}`.

- Loads the manifest and verifies the **complete** plan from live
  statuses: every job present, owned by this session, chapter indices
  non-decreasing across the plan (the one-shot path's global checks,
  applied at completion). Any gap → 400 with the exact count
  ("Continue setup is incomplete: X of Y jobs staged…") and **nothing
  is activated**.
- Activation mirrors the one-shot path's first-start sequence under the
  same processing lease: job 1 transitions parked → queued (with the
  release check + `continue_activated` trace used by
  `activateNextContinueJob`), the first queue message is sent *before*
  the `continue_started` acknowledgement is recorded, and only then is
  the manifest marked `active`.
- Duplicate finalize is a no-op read: once `active`, it returns the
  current per-job summary without sending anything. A finalize that
  finds the activation lease held fails with a retryable error instead
  of guessing.

### Client (`app-256.js`, index.html repointed)
- New `submitContinuePlan(sessionId, bookId, requests, onProgress)`:
  slices the plan **3 jobs per request** to `/continue/stage`, then one
  `/continue/finalize`. Used by **both** the initial submit and the
  `staging_unconfirmed` retry — the retry passes `session.requests`
  verbatim, so the saved Forever Pucked session (same session ID, same
  job IDs, same payloads) resumes as-is. Per-slice progress text
  ("Submitting jobs 4–6 of 24…") reuses the existing preparation UI.
- Any slice failure throws into the existing error path: the session
  stays `staging_unconfirmed` with its requests intact and shows
  "Check same setup" — checking again simply re-runs the slices, and
  the Worker skips what it already holds.

### Deliberately unchanged
- **No version bumps anywhere** (`APP_VERSION 1.4.42`,
  `READER_GENERATION_UI_VERSION` / `APP_UI_VERSION 1.4.116`,
  `GENERATION_RELEASE_ID`): the saved session's payloads carry the
  current release and must stay valid; the app *file* rename
  (app-255 → app-256) is the cache-bust, as in this repo's history.
- The legacy `/api/generation/continue` keeps its exact semantics
  (first job staged `queued`, no manifest written) — one regression
  test pins this. Old clients keep working against a new Worker and
  vice versa.
- Sync, book, audio, quota, and generation behavior are untouched; the
  KV-write benchmark is unchanged (staging manifests live in R2, and
  per-job mirror behavior is identical to the one-shot path).

## Tests

New: `tests/continue-chunked-staging.test.mjs` — **11/11 pass**,
full-stack through the real fetch handler + mock stores, plus
client-source assertions:

1. Slices stage every job parked; zero queue messages before finalize;
   manifest records the ordered plan.
2. Finalize before completion → 400 with counts; nothing activates;
   the session still completes afterwards.
3. Finalize activates exactly job 1, exactly once (one queue message,
   `continue_started` set); **duplicate finalize sends nothing** and
   does not churn job 1's status version.
4. Interrupted setup resumes idempotently: re-staging an acknowledged
   slice does not rewrite its statuses (`_statusVersion` stable).
5. A job owned by another session cannot be claimed.
6. The plan cannot change mid-staging (manifest mismatch → 400).
7. Cross-slice chapter-order violation fails at finalize; all jobs
   remain parked; queue stays empty.
8. Oversize slices (>10) and oversize plans (>30 IDs) are rejected.
9. A payload-only partial job is re-staged, not skipped.
10. Legacy one-shot continue unchanged (queued/parked, one send, no
    manifest).
11. Client: helper slices at 3, posts stage→finalize with the full
    `job_ids` list; the retry path passes `session.requests`; no
    one-shot continue POST remains in the client; release pins intact.

Two existing release-pin assertions (index.html script tag in
`continue-preparation-progress` and `sync-diagnostics`) were updated
from app-255 to app-256 — the intended mechanics when the frontend
file legitimately changes; their version-constant assertions are
untouched.

**Full suite: 148 tests, 139 pass, 9 fail — the exact pre-existing
baseline set** (verified by running the base tree separately; the
baseline includes "Continue stage is sequential and idempotent", which
was already failing before this branch). KV benchmark unchanged:
252 / 100 / 342.

## Remaining risks / notes for review

- **Root cause of the original intake failure is still unproven**
  (Workers Logs were not readable with the API token). Chunked staging
  removes the multi-megabyte single request from the setup path
  entirely, so the fix does not depend on which intake limit was hit;
  but if the true cause was, e.g., an edge rule on large bodies, very
  large *individual chapter payloads* in a slice are bounded by the
  10-job slice cap and the 3-job client slice — worst-case slice ≈ one
  large chapter, comparable to a sync book save that succeeds daily.
- The manifest is advisory for progress; finalize always verifies
  against live statuses. A manifest write racing itself (two stage
  calls in flight from one client) is guarded client-side by
  `continueBusy`; the server-side consequence of a lost manifest
  update is bounded to a wrong `staged_total` in one response, and
  finalize re-derives truth from statuses.
- Client changes are verified by source assertions + `node --check`,
  not by a browser run — the app has no client test harness. A device
  smoke (open the saved session, tap "Check same setup") is the real
  end-to-end proof and can only happen after deployment.
- Deployment, when approved, should reuse the coalescing ritual:
  activity check → exact bytes → observability → /health + bindings →
  smoke. A protocol smoke can run entirely on a throwaway book id:
  stage a 2-job plan in two slices, finalize, confirm exactly one
  queue delivery and a completed tiny generation, exactly like the
  coalescing smoke but through the new endpoints.

## Addendum — Rowan review round 2 (2026-10-19, later)

1. **Current main merged in.** GitHub main had advanced two commits
   (eccb797 + 4486114: 300-character Gemini Flash-Lite voice auditions,
   app-255.js in place + an index.html cache-bust). The merge brings
   both in; `app-256.js` was rebuilt on top of main's app-255 so the
   audition changes are preserved verbatim in the new client, and
   index.html resolves to app-256. Generation release IDs are exactly
   main's (the Worker was untouched by those commits, and no constant
   changed anywhere in this branch).
2. **Lost finalize acknowledgement now reconciles.** If finalize
   succeeded but its response never reached Reader, the session is
   active server-side while the iPad still shows it unconfirmed.
   Previously the retry died on the stage endpoint's "already active"
   error. Now: stage verifies the plan against the manifest as usual,
   then answers `{already_active: true}` without staging or writing
   anything; the client's `submitContinuePlan` stops slicing on that
   answer and takes the (idempotent) finalize summary as truth,
   mapping the original job IDs to their live states. A *different*
   plan under the same session ID is still refused before the active
   check. Full-stack regression test: after a successful finalize, a
   re-stage returns already_active, every job's `_statusVersion` is
   unchanged, the queue still holds exactly one message, and finalize
   returns the original IDs.
3. **Plan immutability now authenticates contents.** The first stage
   request must carry `job_fingerprints`: a SHA-256 per job over a
   canonical JSON recipe (keys sorted at every depth, array order
   preserved, undefined object fields dropped — implemented identically
   in the Worker, the Reader, and the tests, with a byte-for-byte
   agreement test on a hostile object). The manifest pins the map;
   every staged job is hashed and compared before it is written, and a
   later slice carrying a different map is rejected. Tests: altered
   narration text under an unchanged ID and unchanged ID list → 400,
   the job is never staged, finalize reports the exact incomplete
   count, and the genuine job still stages afterwards; missing pins →
   400; re-pinning mid-staging → 400.
4. **Complete 30-job path validated.** A 30-job plan staged in
   client-sized slices of 3 (ten acknowledged requests, progress
   counted 3→30 from live statuses, queue empty throughout), manifest
   holding 30 pins, finalize activating exactly job 1 with the other
   29 parked.

Updated totals: chunked-staging suite **16/16**; full suite **153
tests, 144 pass, 9 fail — the same baseline set as current main**
(137/128/9 on the merged main snapshot, verified separately). KV
benchmark unchanged.

## Addendum — Rowan final gates (2026-10-19, later still)

1. **Manifest reads fail closed.** `readContinueSessionManifest` no
   longer swallows errors: null now means only a confirmed-missing
   object. Storage failures and unparseable contents propagate, so a
   transient R2 read failure stops staging instead of letting a retry
   repin the plan over an existing session, rewrite its jobs, or
   strand an active session. New regression test: with manifest reads
   forced to throw, a forged-plan stage is refused, the honest next
   slice is refused with the storage error surfaced, finalize cannot
   activate, and afterwards the manifest bytes, job status versions,
   and queue are provably untouched — and the same session completes
   once reads recover. The test fails against the previous
   swallow-and-null implementation (16/17) and passes now (17/17).
2. **Git ancestry reconciled.** The branch history was rebuilt on top
   of actual current main (`4486114`) in three layer commits (Worker /
   client / tests+report); the final tree is byte-identical to the
   pre-rebuild branch tree, so nothing about the release contents
   changed — only the lineage. The release delta against main is
   exactly seven files: `cloudflare-worker.js`, `app-256.js` (new),
   `index.html`, `tests/continue-chunked-staging.test.mjs` (new),
   `tests/continue-preparation-progress.test.mjs` (release pin),
   `tests/sync-diagnostics.test.mjs` (release pin),
   `CONTINUE-CHUNKED-STAGING.md` (new). `app-255.js` is main's own,
   untouched; release identifiers remain 1.4.42 / 1.4.116 throughout.
