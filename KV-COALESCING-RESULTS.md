# KV Write Coalescing — Implementation Results

Branch: `kv-write-coalescing` (based on deployed main `1ad64946`). Pushed to GitHub as a review branch at Rowan's request (2026-10-19) — nothing deployed.
Design contract: `KV-COALESCING-DESIGN.md` (v2.1, approved by Rowan).
Release identifiers unchanged: Worker `1.4.42`, Reader UI `1.4.116`, release id `1.4.42/1.4.116`.

## Summary

- Generation-status KV writes went from **one per save** (1,580–17,460 per workload) to **critical transitions only** (60–242 per workload), via a serialized, fenced mirror writer with all bookkeeping in R2.
- The Gemini quota counters no longer write KV at all: attempts are R2 ledger markers, last-success is an R2 pointer object maintained inside `recordTtsUsage`.
- Benchmark, Finding-Home-shaped day: **1,742 → 252 KV writes** (target band 150–300; free-plan cap 1,000/day; Oct 19 measured actual 1,403).
- Behavior is provably unchanged in the harness: identical R2 status-save counts and identical Google API call counts before/after, per workload.
- Tests: **137 total, 128 pass, 9 fail — the 9 failures are exactly the pre-existing baseline set** (see below). 20 new tests, all passing.

## Accounting matrix — Gemini counters vs R2 ledger

Rows are provider paths; "KV before" is what the pre-patch code wrote; "ledger before" is what already existed; "after" is this patch. The report (`geminiQuotaReport`) counts **attempts** for `used_24h` / `used_today` and the **last-success pointer** for `last_success_ms`; usage events never feed the attempt counters.

| Path | KV counters before | R2 ledger event before | After this patch |
|---|---|---|---|
| Standard success | attempt key +1; last-success put (book_generation only) | `provider_call` succeeded event | attempt marker +1 (R2); pointer updated inside `recordTtsUsage` (same gating); event unchanged |
| Standard API failure (5xx / no audio / timeout / R2 store fail) | attempt key +1 (written pre-dispatch); no success put | `provider_call` failed event | marker +1; failed event unchanged; no pointer update |
| Standard quota rejection (429) | attempt key +1; no success put | `provider_call` failed event | marker +1; failed event unchanged; no pointer update |
| Standard content block (400 policy) | attempt key +1; no success put | `provider_call` failed event | marker +1; failed event unchanged |
| Standard cache hit | nothing (attempt write sits after the cache early-return) | `provider_call:false` cache_hit event | nothing counted; event unchanged |
| Pre-dispatch reject (missing voice/text, oversize, unknown provider) | nothing | nothing | unchanged |
| Missing `GEMINI_API_KEY` | no attempt (throws before the attempt site) | failed event from the caller's catch (pre-existing asymmetry, preserved) | unchanged — marker still not written; event still written |
| Batch submit / poll (in progress) | nothing | nothing | unchanged |
| Batch per-segment success | no attempt; last-success KV put (segment payloads carry `usage_type:"book_generation"`) | succeeded event, `generation_mode:"batch"` | no marker; pointer updated inside `recordTtsUsage` from that event; event unchanged |
| Batch failure (op error / malformed results / row error / no audio / invalid WAV / submission rejected) | nothing | **nothing — genuine gap** | **gap closed:** failed event written at each failure site (`generation_mode:"batch"`); counters unaffected (no marker; pointer is success-only) |
| Batch submission network throw ("unknown outcome" fence) | nothing | nothing | deliberately still nothing — the outcome is genuinely unknown; recording a failure would misstate it |

Window semantics preserved exactly: Pacific calendar day via the existing `geminiPacificDayBounds`/`zoneOffsetMs` helpers plus rolling 24h; response shape unchanged (`used_24h`, `used_today`, `used_calendar_day`, `tracking_available`, `last_request_ms`, `limit`, `next_expiry_ms`, `last_success_ms`, `resets_at_ms`, `reset_timezone:"America/Los_Angeles"`, `tracking_mode`, `approximate:true`). `tracking_available` now keys off R2 storage presence instead of KV.

**Deploy continuity (deliberate, documented):** pre-patch attempts exist only as legacy KV keys (48h TTL). The patched report counts markers **plus** legacy KV attempt keys read-only, and takes the newer of the R2 pointer / legacy KV last-success. The two attempt sources are disjoint by construction (pre-patch wrote only KV keys; post-patch writes only markers), so the union is exact — no double counting, no under-read across the deploy boundary. The legacy read side disappears on its own within 48 hours. This is a read, not a write; the "no KV cache" rule for counters is about writes and holds.

## What changed

### `cloudflare-worker.js` (only file modified)

- **`saveGenerationStatus` restructured:** bumps an additive monotonic `_statusVersion` on the status object, awaits the R2 status put FIRST (its failure throws, exactly as before), then invokes the mirror writer (fully error-swallowing). No direct KV put remains.
- **Serialized mirror writer** (`mirrorGenerationStatus`/`runMirrorAttempt`, after `readGenerationStatus`): takes only a jobId. Per-job R2 lock (`generation/mirror-lock/<jobId>.json`) via conditional puts — create-if-absent (`If-None-Match: *`), steal after 20s via etag-matched replace, monotonic epoch fencing re-validated immediately before the KV put and again before stamp persistence, ≤2 acquisition attempts. Inside the lock: CAS claim of the attempt stamp, fresh R2 status load, re-evaluation, version guard, KV put (14-day TTL preserved), then confirmed stamps persisted **only after** KV confirms.
- **Mirror metadata** lives in its own R2 object (`generation/mirror-meta/<jobId>.json`: attempt stamps, lock epoch, confirmed summary) — never inside the status object, so stamp persistence cannot clobber generation progress. All meta writes go through `persistMirrorMeta`: merge onto the freshest read, yield to a newer epoch, compare-and-swap via etag-matched conditional put (see "Deviations/hardening" below).
- **Throttle classification** (confirmed summary = state, completed, total, segment count, continue_started, error presence, sorted Batch op names, split count): mirror only on critical transitions — creation/staged, first activation (`continue_started` flip), parked→queued chain handoff and other non-routine state jumps (incl. all pause states), terminal states, error set/clear, **new** Batch op name assigned (clearing names as segments complete is routine and does not mirror), adaptive split (segment state `"split"` / total change) — plus volume catch-up at ≥25 completed segments since the confirmed mirror, terminal saves, KV-behind-confirmed convergence, and read-path lazy catch-up from the status GET endpoint. Floors: 60s per-job attempt floor for catch-up (yields to lock-steal when the previous lock has expired); after a failed mirror, non-terminal mirrors wait 60s; terminal mirrors stay eligible.
- **Gemini counters off KV:** `recordGeminiQuotaAttempt` and `recordGeminiGenerationSuccess` deleted. Attempts are R2 markers (`usage/gemini-attempts/<ts13>-<uuid>.json`) written at the exact old pre-dispatch call site in `synthesizeAudio` (after the API-key check and cache early-return, so semantics — including audition counting and crash survival — are preserved). Last-success is the R2 object `usage/gemini-last-success.json`, updated inside `recordTtsUsage` under the old gating (gemini + provider_call + not failed + `usage_type==="book_generation"`), which covers both old call sites (Standard success, Batch per-segment success) with one write path.
- **`geminiQuotaReport` rewritten** to derive from R2 (markers by key timestamp; pointer object) plus the read-only legacy-KV union described above.
- **`usageReport`:** the report-path KV backfill put is deleted (the pointer is maintained at event time now); the report is read-only.
- **Batch failure ledger events** (`recordBatchFailure` in `stepGeminiBatch`): op-level failure, malformed results, row error, no audio, invalid WAV, and submission rejection now write failed `recordTtsUsage` events. The unknown-outcome fence records nothing (deliberate).

### New files

- `tests/support/mock-env.mjs` — shared harness: in-memory KV/R2/Queue with conditional puts + etags, list pagination, virtual clock, fault injection, async gates, Google API fetch stub, queue driver.
- `tests/kv-coalescing.test.mjs` — 17 tests (below).
- `bench/kv-write-benchmark.mjs` — before/after benchmark (below); extracts the pre-patch worker from git into a temp file outside the repo tree at runtime.

## KV write audit — surviving writes

Every `OPALREADER_KV.put/delete` left in the worker, with justification:

| Site | Write | Why it stays |
|---|---|---|
| `saveBook` | `book:<id>` put | The sync feature itself; user-driven, low frequency |
| library index | `library:index` put | Slim (~1KB), accompanies book saves |
| book-delete cleanup | generation-status KV delete | Cleanup correctness on delete |
| mirror writer | `generation:<jobId>` put | The throttled mirror — the subject of this patch |
| book delete | `book:<id>` delete + 2 tombstone puts | Delete propagation across devices |
| settings | settings put | User-driven, rare |
| audio export | token put (TTL 300s) + delete | Short-lived download tokens, user-driven |

Deleted: per-attempt quota keys, per-success last-success put, usageReport backfill put, and the per-save status put (replaced by the throttled mirror).

## Test results

Run per file with `node --test tests/<file>` (the repo's harness pattern; running the whole directory at once hits stale files that fail to load, on baseline too).

### New suite — `tests/kv-coalescing.test.mjs`: 17/17 pass

1. Standard generation coalesces KV writes (30-segment job: creation + one ≥25 volume catch-up + terminal; final KV byte-identical to R2 status)
2. Interrupted generation resumes from R2 state and completes
3. Duplicate Queue deliveries synthesize each segment once
4. Batch recovery: op assigned → restart → completes, exactly one submission per segment, assignment mirrored
5. Adaptive splits activate children, mirror the split, and complete
6. KV quota exhaustion: generation completes on R2; mirror catches up after recovery
7. R2 write failure surfaces (5xx), zero KV writes, API reports `staging_incomplete` — no ghost progress
8. Catch-up safety (a): KV down + 100 polls in a minute → exactly 1 bounded mirror attempt; reads stay 200; recovery converges
9. Catch-up safety (b)+(c): writer stalled inside its KV put past lock expiry → successor steals and mirrors terminal → stalled writer's late write never confirms (stamps stay the successor's) → next eligible catch-up converges KV to the newest version byte-for-byte
10. Catch-up safety (c): writer stalled before its fence check (on the claim) → successor steals + mirrors → resumed writer writes nothing to KV; successor's stamps survive (CAS meta)
11. Catch-up safety (d): stamp persistence racing a concurrent watchdog save → both survive (progress in the status object, stamps in the separate meta object; no bookkeeping fields inside the status object)
12. Quota: standard success — 1 attempt, last-success from ledger, usage report read-only
13. Quota: standard 429 (daily-quota shape) — attempt counted, failed event recorded, no success
14. Quota: cache hit — no attempt, no provider call, no provider_call event
15. Quota: Batch success — no attempt, last-success set; Batch failure — failed ledger event written (gap closure), no success
16. Quota: Pacific-day + rolling-24h windows over seeded markers + legacy KV union; `last_request_ms`/`next_expiry_ms` exact; report performs zero KV writes
17. Quota: tracking reports unavailable (nulls, `tracking_available:false`) when R2 storage is missing

### Existing suite — unchanged: 117 tests, 108 pass, 9 fail (identical to the unmodified-main baseline)

The 9 pre-existing failures, by name (all in stale sliced-harness suites; verified identical before and after the patch):

- `adaptive-background-repair.test.mjs`: "durable Worker queue finishes a nested blocked passage without browser callbacks"
- `composite-cache-isolation.test.mjs`: file-level failure (stale suite)
- `continue-to-quota.test.mjs`: "Gemini 429 pauses permanently until a manual action; late deliveries cannot spend"; "Continue stage is sequential and idempotent; manual resume enqueues exactly once"; "Temporary Gemini minute-rate 429 backs off but does not require morning tap"
- `generation-manual-queue-reuse.test.mjs`: "saved matching manual audio avoids a new Gemini request"; "mismatched fingerprint, stale audio and missing R2 never skip synthesis"; "intentional forced regeneration bypasses manual reuse"
- `split-first-update-stop.test.mjs`: file-level failure (stale suite)

Branch totals: **137 tests, 128 pass, 9 fail — zero new failures** (grew 134/125 → 135/126 with the check-4 test → 137/128 with Rowan's two fix tests; the 9 named failures are unchanged).

## Benchmark

`node bench/kv-write-benchmark.mjs` — both workers against identical mock stores and identical traffic. Behavioral identity check: R2 status saves and Google API calls are **identical** before/after in every workload; only KV puts change.

| Workload | KV puts before | KV puts after | Notes |
|---|---|---|---|
| A — Batch session, Finding-Home-shaped (30 jobs, 152 segs, chain, ops complete on 2nd poll) | 1,732 (1,580 status + 152 last-success) | **242** | 30 creations + 1 first-start flip + 29 chain activations + 152 op assignments + 30 terminals |
| B — Standard book as a Continue session (30 jobs, 300 segs) | 1,618 (1,018 status + 600 quota) | **90** | 30 creations + 30 activations + 30 terminals; every pace-wait and per-segment save is routine |
| B-stress — same book as 30 simultaneous independent jobs (not a real usage pattern; jobs convoy on the global pace stamp → 17,460 saves) | 18,060 | **60** | creation + terminal per job |

Projected days (+ ~10 ordinary sync/settings writes; free-plan cap 1,000/day; target band 150–300):

| Day shape | Before | After | vs band |
|---|---|---|---|
| Finding-Home day (A) | 1,742 | **252** | inside |
| Standard-book day (B) | 1,628 | **100** | lighter than band (band describes heavy generation days) |
| Both books in one day (A+B) | 3,360 | **342** | 14% over the band top; still 2.9× under the cap |
| Stacked stress day (A + B-stress) | — | **312** | just over the band top |

**On the two-books stack (342):** the overage is driven by workload A's 152 op-assignment mirrors — a transition the design explicitly classifies as critical (the op name is the recovery handle after a crash between Google's acceptance and the next poll). The 25-segment catch-up constant contributes **zero** mirrors in both workloads (jobs are 5–10 segments), so tuning it cannot move this number; it was left at 25 as designed. No design-mandated transition was re-scoped to hit the band. A single-book generation day — the shape that actually exhausted the quota on Oct 19 (1,403 measured) — lands at 252, inside the band with ~4× headroom under the cap.

Modeled-fidelity note: the mock Batch day (1,732 pre-patch) runs somewhat hotter than Oct 19's measured 1,403 because the harness polls every op exactly twice and generates all 152 segments fresh; treat absolute numbers as modeled, the before/after ratio as the result.

## Deviations / hardening beyond the letter of the design

1. **Legacy-KV read-only union in `geminiQuotaReport`** (documented in the matrix): preserves counter continuity across the deploy boundary; read-only, self-expiring in 48h. Flagged for Rowan's review — removing it is a two-block deletion if he prefers a hard cutover (counters would under-read for up to 48h).
2. **CAS meta writes:** the design requires confirmed-stamps correctness under reversed completion order; test orchestration showed a claim write computed from a pre-steal read could land after a successor's writes and regress the stamps. `persistMirrorMeta` therefore uses etag-matched conditional puts with merge-recompute/yield. The fence + lock design is unchanged; this hardens its bookkeeping layer.
3. **Catch-up floor yields to lock-steal:** the 60s catch-up attempt floor does not block a successor when the previous attempt's lock has expired (otherwise the design's own steal-at-20s scenario could not happen from the read path). The floor still bounds all fresh attempts, and the 100-poll test proves ≤1 attempt/minute under flood.
4. **Batch failure ledger events** were added at Rowan's "close the gaps explicitly or label partial" instruction — they are the one genuine accounting gap found (see matrix). Counters are unaffected by construction.
5. **Known residual (documented in design terms):** a writer stalled *inside* its KV put past lock expiry can land a transiently stale mirror after a successor confirms; its stamps never confirm, and the next save/poll trigger converges KV to the newest version (proven in test 9). Consistent with the design's confirmed-stamps stance.
6. Book deletion does not remove `generation/mirror-meta/` / `generation/mirror-lock/` objects for its jobs (tiny orphaned R2 objects, same posture as other per-job R2 residue). No KV impact.

## Deployment safety plan (for when Rowan approves — not executed)

0. **Pre-deploy activity check (added at Rowan's request, 2026-10-19):** before replacing the Worker, verify read-only that no generation is in flight — scan the R2 `generation/` status objects and Continue-session records for any job or session in a non-terminal state (queued / generating / staged / paused_update with pending work, or a session with `continue_started` and unfinished jobs). If anything is active, wait for it to finish (or get Julie's explicit direction) — never deploy over live generation.
1. Deploy the exact branch bytes of `cloudflare-worker.js` via `python3 ~/workspace/ops/deploy-opal-reader-worker.py <file>` (multipart upload, `main_module`, compat date **2026-08-29** preserved, secrets as `{"type":"inherit"}`).
2. **Immediately re-check script-settings observability** (a code upload silently resets it to null): GET `/workers/scripts/opalreader-api/script-settings`; if observability is null, re-apply the settings-only PATCH (enabled, head_sampling_rate 1, logs enabled + invocation_logs + destinations ["cloudflare"] + persist true), then confirm the script etag is unchanged by the PATCH.
3. Verify: `/health` (or equivalent) responds; all 12 bindings present via live read; script etag matches the upload; `APP_VERSION` "1.4.42" / `READER_GENERATION_UI_VERSION` "1.4.116" / `GENERATION_RELEASE_ID` unchanged in the deployed bytes.
4. Smoke: one small Standard chapter generation + one status poll; watch KV write rate and confirm mirror objects (`generation/mirror-meta/`) appear in R2; confirm `/api/quota/gemini` returns sane counts (legacy union should show the day's pre-deploy attempts).
5. **Rollback:** redeploy the `1ad64946` bytes (`git show 1ad64946:cloudflare-worker.js`) through the same script, then repeat step 2 (observability re-check). Rollback is safe in both directions: the patch's R2 objects (attempt markers, last-success pointer, mirror meta/locks) are additive and ignored by the old code; `_statusVersion` is an additive status field the old code passes through untouched; the old code resumes its KV writes immediately.
6. Post-deploy watch: KV daily writes should track the benchmark (~250 on a Finding-Home day). If writes run hot, the mirror meta objects identify the job and transition class responsible.

## Post-review addendum — Rowan's decisions and check 4 (2026-10-19)

Rowan's preliminary verdict: **architecture approved; deployment pending final code inspection.** His rulings on the three flagged deviations:

1. **Keep** the 48-hour legacy-KV quota read (deploy continuity without new KV writes).
2. **Keep** the compare-and-swap mirror-meta fix.
3. **Accept** the 342-write two-book projection (the 150–300 band is a planning goal, not a hard limit; Batch recovery identifiers take precedence).

**Check 4 — `last_success_ms` monotonicity: Rowan's concern was correct.** As first implemented, the R2 last-success pointer was an unconditional put inside `recordTtsUsage`; two concurrent success events whose writes completed out of order could move the pointer backward. Reproduced before fixing, in the same reversed-completion-order style as the catch-up proofs: the older writer stalled inside its pointer put, the newer writer landed first (T0+7000), the older writer then overwrote it with its own stale value (T0) — the pointer regressed by the full gap.

**Fix:** `advanceGeminiLastSuccess` — a monotonic compare-and-swap using the codebase's proven pattern (etag-matched conditional put, `If-None-Match: "*"` on create; re-read and yield whenever the stored timestamp is already at or past the candidate; bounded 3 attempts). New regression test "quota: concurrent last-success updates never move the pointer backward (reversed completion order)" fails on the pre-fix code and passes with the fix. Suite after the fix: **135 tests, 126 pass, 9 fail (baseline set unchanged).**

**Check 2** is now step 0 of the deployment safety plan above (read-only verification that no generation jobs or Continue sessions are active before the Worker is replaced).

**Stale-KV recovery (check 4, second half)** was re-inspected in code and behaves as described: `readGenerationStatus` reads R2 first and uses KV only when no R2 object exists; confirmed stamps advance only after a KV put succeeds *and* the writer still holds its fence; on KV failure only `attempt_failed_at` is recorded, so stale KV content is never marked confirmed; `evaluateMirror` detects KV behind the confirmed version and re-mirrors on subsequent activity, so the mirror converges back to the R2 truth.

## Post-review addendum 2 — Rowan's two safety fixes (2026-10-19)

Rowan's verdict after inspecting the code on GitHub: architecture and results accepted; deployment held for two narrow corrections. Both are done, each reproduction-first.

**Fix 1 — lock release is now ownership-safe.** The release path was a read-then-delete: a writer confirmed it owned the lock, then deleted it as a separate unconditional operation. If the 20-second lease expired between the two, a successor could steal the lock and the stale writer's delete would remove the *successor's* lock. Release is now a single conditional step: swap the live lock for a released tombstone (`{owner, epoch, acquired_at, released: true, released_at}`) with an etag-matched put — if the object changed since the writer's ownership read, the put fails and the successor's lock survives. The acquire path treats a released tombstone as immediately stealable (etag-matched replace), so release never delays the next writer, and no mirror-lock object is ever deleted. New test "catch-up safety (e)" parks writer A *inside* its release (after ownership, before the release lands), expires its lease, has successor B steal and stall mid-mirror still holding, then lets A's release execute: on the old code B's lock was deleted (the test failed with exactly that assertion); on the fix it survives with owner and epoch intact, and B converges the mirror.

**Fix 2 — status polling no longer waits on KV.** The status GET awaited read-path mirror catch-up, so a slow or stalled KV write delayed the Reader's status response — contrary to the approved design. Catch-up is now scheduled on the execution context (`ctx.waitUntil`, fire-and-forget fallback when no context is present); the fetch handler takes `ctx` as its third parameter. New test "status polling never waits on a stalled KV catch-up write" parks the catch-up's KV put indefinitely and confirms the poll returns 200 with the current status, that the catch-up was genuinely scheduled (it is found parked at the stalled write), and that the mirror converges once KV recovers. Four existing catch-up tests were updated to observe background completion (flush/poll-for-effect) instead of assuming the poll awaited it.

**Suite after both fixes: 137 tests, 128 pass, 9 fail — the same pre-existing baseline set; all 20 coalescing tests pass. Benchmark re-run after the fixes: identical numbers (Batch 242, Standard 90, stress 60; Finding-Home day 252; two-book day 342)** — the tombstone release is an R2 put replacing an R2 delete, and backgrounding changes timing, not counts.

**Tracked follow-up for the next patch (Rowan, nonblocking):** `geminiQuotaReport` lists every historical R2 attempt marker under `usage/gemini-attempts/` with no retention or date partitioning. The scan grows with total lifetime attempts even though only the Pacific-day and rolling-24h windows are ever counted. Next patch should bound it — e.g., date-partitioned marker keys with listings restricted to the relevant dates, plus pruning of markers older than the rolling window. Not a correctness issue tonight; explicitly tracked here so it is not lost.

## Post-review addendum 3 — first deploy, smoke catch, rollback, etag fix (2026-10-19)

Rowan approved deployment (GO, with the activity check as precondition). Sequence as it actually ran:

1. **Activity check: clean.** 436 generation status objects scanned read-only — zero in queued/generating/staged; the only non-terminal records were user-parked (parked, paused_quota, paused_update) and partial/failed/ready terminal states. No active jobs, no in-flight Continue sessions.
2. **Deployed** the exact branch bytes (152,029 bytes; sha256 of the deployed script verified identical to the reviewed file). Compat date 2026-08-29 preserved, 12/12 bindings, /health 200 (1.4.42, sync_protocol 2). Observability was cleared by the upload as expected and re-applied + verified.
3. **Smoke test caught a real production-only defect.** The one-segment Standard generation completed (ready 1/1, audio written, quota report live: attempt counted, last-success set) — but the KV mirror never converged: minutes later the KV record still showed the creation state (queued, v1) while R2 was at v4 (ready), mirror-meta held only the creation claim `{attempt_at, lock_epoch}` with **no confirmed stamps**, and the mirror lock still held the original live lock with **no released tombstone**.
4. **Rolled back immediately** per the authorization's abort rule. Production is byte-identical to `1ad64946` again (verified by download + hash), observability re-applied, /health green. The patch's R2 residue is additive and ignored by the old code, as designed.
5. **Root cause, probe-proven.** A temporary probe worker against real R2 established the exact semantics: the binding's `etag` is unquoted hex; `httpEtag` is the quoted form. An `If-Match` header carrying the **raw etag throws `Invalid ETag in if-match header`** — it does not return null. `If-Match` with `httpEtag` lands; the object form `{etagMatches}` lands. Every etag-matched put in the patch used the raw etag inside a Headers conditional, so each one threw — and the patch's own catch-and-yield handlers (meta CAS returns false, release swallows, mirror wrapper logs-and-continues) silently absorbed every throw. Create-if-absent (`If-None-Match: "*"`) puts were unaffected, which is why each job's *first* mirror (creation) landed and nothing after it ever could: no confirmed stamps, no lock steals, no tombstone releases, no pointer advances past first creation. The mock compared raw etags, so the suite structurally could not see this — a mock-fidelity failure, not a logic failure.
6. **Fix (on the branch, NOT deployed):** a single `quotedEtag()` helper (`httpEtag`, falling back to a quoted raw etag) now feeds all four If-Match sites — `advanceGeminiLastSuccess`, `persistMirrorMeta`, the lock-steal, and the tombstone release. **The mock was made faithful**: R2 objects expose `httpEtag`, `head()` likewise, and MockR2 now throws on an unquoted If-Match and compares the quoted form. Against the faithful mock, the *pre-fix* worker fails 10 of 20 coalescing tests with the production signature; the fixed worker passes all 20. Full suite: 137 tests, 128 pass, 9 pre-existing baseline failures (unchanged). Benchmark re-run: identical (252 / 100 / 342).

**State:** production remains on `1ad64946` (safe, proven). The fixed branch awaits Rowan's re-approval before a second deployment attempt; the same sequence (activity check → exact bytes → observability → verification → smoke) will be re-run, and this time the smoke test's mirror-convergence assertions are the deploy's pass/fail gate.
