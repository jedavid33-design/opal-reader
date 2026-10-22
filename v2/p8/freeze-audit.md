# P8 Freeze Mutation Audit — shipped Opal Reader v1 (Worker 1.4.43 / Reader 1.4.117)

**Status: PREPARATION ONLY.** This audit is a read-only analysis of the shipped
source in this repository. No freeze build exists yet, nothing has been deployed,
and production was not contacted in any way. This document specifies exactly
what a future freeze build must fence; building or deploying that build is a
separate gate (Roundtable Case #10, issue #15; Rowan's design review,
comment 6330084609, requires this audit before any freeze deployment can be
proposed).

## Plain English

Before the old Reader can be frozen for the move, we have to be able to prove
that *every* way it can change data is accounted for — not just the obvious
buttons. This audit lists every single route the old Reader's server answers,
all the background machinery behind it, and marks each one: safe read, a write
that must be fenced, or — the sneaky category — a supposed "read" that quietly
writes something behind the scenes. Three of those sneaky ones exist, including
the status check the app polls while generating: on the shipped code, merely
*asking* about a job can save statuses, wake the job up, and queue more work.
The freeze plan fences every write path named in the project's Correction-C
list and every additional one this census found, while leaving listening and
reading completely untouched. Four judgment calls are listed at the end for
Rowan; everything else is mechanical fact, re-verified by a test that
re-extracts the route list from the source and fails if the two ever disagree.

## Audited artifacts (identity)

| Artifact | Identity | Proof |
|---|---|---|
| Worker | `cloudflare-worker.js`, `VERSION = "1.4.43"` (line 95) | Byte-identical to `origin/main` (2b7088f); the v2 branch line carries the same file unchanged |
| Client | `app-256.js` (the bundle `index.html` on origin/main loads), carries the `1.4.117` marker | P0 baseline pinned these as the production constants |
| Entry points | `export default { async fetch (L3745), async queue (L4629) }` | **No `scheduled` handler exists** — no cron/background entry point in the shipped Worker |

State stores in scope: `env.OPALREADER_KV` (KV), `env.OPALREADER_STORAGE` (R2),
`env.OPALREADER_GENERATION` (queue producer). No D1. 46 write call sites exist
across these bindings in the file; every one is accounted for below, by route
or by non-route path.

## Method — and its limits

1. The route table was extracted mechanically from the dispatch conditions in
   the fetch handler (every `if` testing `url.pathname`, with its
   `request.method` literals). 33 dispatch blocks yield 35 (method × path)
   keys and 34 routes (`/health` answers two spellings; the
   `/api/sync/epub/` block serves two methods). Dispatch-level non-routes —
   the `OPTIONS` preflight, the access-token gate, and the 404 fallthrough —
   write nothing and are not counted as routes.
2. Each handler was traced through its helpers to the write primitives
   (`.put` / `.delete` / `.send` on the three bindings).
3. **Known limit, handled explicitly:** a naive call-graph closure
   over-approximates where helper names collide (it falsely linked
   `saveBook` to an R2 delete, and the provider voices GETs to
   quota-ledger writes). Every route whose closure flagged any write was
   therefore verified by *reading* the handler and the specific helpers;
   the classifications below are the read-verified ones. The companion
   census test (`tests/freeze-route-census.test.mjs`) pins the route
   *set* mechanically — extraction vs. classification must agree exactly,
   in both directions — and pins the counts in this document.

## Census summary

| Class | Keys | Meaning |
|---|---|---|
| READ-ONLY | 15 | No state change anywhere downstream |
| SIDE-EFFECTING GET | 3 | A GET that writes — the category Rowan's review singles out |
| MUTATING | 17 | Non-GET routes that write |
| **Total** | **35 keys / 34 routes** | |

## Route census

### READ-ONLY — no writes anywhere downstream

| Route | Handler | Evidence |
|---|---|---|
| `GET /health` and `GET /health/` | L3750 (pre-auth) | Returns version JSON only |
| `GET /api/usage/report` | `usageReport` (L785–883) | Aggregates R2 `usage/` objects; full-body scan: no put/delete/send |
| `GET /api/quota/gemini` | `geminiQuotaReport` (L689–784) | Reads the attempt ledger + park records; no writes |
| `GET /api/providers/status` | L3826 | Booleans from env flags only |
| `GET /api/sync/manifest` | `libraryManifest` | KV/R2 reads |
| `GET /api/sync/book/*` | L3847 | KV get + tombstone read |
| `GET /api/sync/library` | L3860 | `libraryIndex` + `listTombstones` reads |
| `GET /api/sync/settings` | L4004 | KV get |
| `GET /api/sync/epub/*` | L4048 block, GET branch | R2 get/stream |
| `GET /api/sync/audio/*` | L4119 | `cachedAudio` R2 get/stream |
| `GET /api/providers/azure/voices` | L4417 | Proxies the provider's list via fetch; no local writes |
| `GET /api/providers/fish/voices` | L4463 | Proxies the provider's list via fetch; no local writes |
| `GET /api/providers/openai/voices` | L4520 | Static list |
| `GET /api/providers/gemini/voices` | L4543 | Static list |

(That is 14 routes / 15 keys — `/health` carries both spellings.)

### SIDE-EFFECTING GET — reads that write

| Route | What it writes | Evidence |
|---|---|---|
| `GET /api/export/audio/*` | **Deletes the one-time export token in KV** (`audio-export:<token>`) before streaming the audio | `OPALREADER_KV.delete` L3761, inside the handler; the route sits *above* the token gate by design (the link token is the credential) |
| `GET /api/generation/books/*/jobs` | **Job-registry maintenance in R2**: legacy backfill + pending-marker reconciliation on a discovery read | Handler L4283 → `discoverBookJobs` (L572–649) → `backfillJobRegistryLegacy` (put L559), `reconcileJobRegistryPending` (deletes L515/L521), marker puts L454/L473 |
| `GET /api/generation/jobs/*` | **The mutating status GET.** A single status poll can: create the job's registry marker (create-if-absent PUT), reconcile/pause jobs (`pauseLegacyQuotaJob`, `pauseGenerationForUpdate` → status saves), mark a fully-cached job ready (`saveGenerationStatus`), activate the next Continue job (**queue send**), run the poll-time watchdog (status save + **direct queue send**, L4396), and schedule a KV-mirror catch-up on `ctx.waitUntil` (L4413) | Handler L4309–4416, read in full |

### MUTATING — non-GET routes that write

| Route | Stores written | Evidence |
|---|---|---|
| `PUT /api/sync/book/*` | KV: book record + library-index row | `saveBook` puts L977/L993 |
| `DELETE /api/sync/book/*` | KV: book delete + tombstone/index puts; R2: EPUB object delete | Handler writes L3947/L3952/L3960/L3972 |
| `DELETE /api/sync/deleted/*` | KV: tombstone purge | KV delete L4000 |
| `PUT /api/sync/settings` | KV: settings record | KV put L4042 |
| `PUT /api/sync/epub/*` | R2: EPUB object | R2 put L4063 (PUT branch of the L4048 block) |
| `POST /api/export/audio-url` | KV: creates the `audio-export:<token>` record the GET above consumes | KV put L4085 |
| `DELETE /api/audio/purge` | R2: the book's audio objects; KV: book record delete | `purgeBookAudio` (L1213–1238) |
| `POST /api/playback/chapter` | R2: chapter-composite cache object — **only on a cache miss**; a hit is served read-only | `chapterCompositeAudio` put L1335; `X-OpalReader-Cache` header distinguishes hit/miss |
| `POST /api/generation/jobs` | R2: job payload + status + registry markers; queue: dispatch sends | Handler L4156–4282; sends L4216/L4277, put L4249, `saveGenerationPayload` L2344, `saveGenerationStatus` L1800 |
| `POST /api/generation/jobs/*/resume` | R2: status saves (+ lease puts/deletes); queue: dispatch send | `resumeQuotaJob` (L3626–3665), send L3662 |
| `POST /api/generation/continue` | R2: continue-session + job payload/status writes; queue: dispatch send | `stageContinueSession` (L3306–3365), send L3349 |
| `POST /api/generation/continue/stage` | R2: staged payload + status + registry marker | `stageOneContinueJob` put L3387 |
| `POST /api/generation/continue/finalize` | R2: session manifest + status saves; queue: dispatch send | `finalizeContinueSession` (L3553–3623), manifest L3431, send L3609 |
| `POST /api/providers/azure/speech` | R2: synthesized audio into the content-addressed cache + a usage event | `synthesizeAudio` (L1460–1766) → `storeAudio` put L1139, `recordTtsUsage` put L189 |
| `POST /api/providers/fish/speech` | Same write set (shared `synthesizeAudio`) | Handler L4510 |
| `POST /api/providers/openai/speech` | Same write set (shared `synthesizeAudio`) | Handler L4533 |
| `POST /api/providers/gemini/speech` | Same write set, **plus** the Gemini quota machinery on 429 paths: attempt-ledger and park records | `recordGeminiQuotaAttemptLedger` put L316, `recordGeminiQuotaPark` put L396 |

## Non-route write paths

Routes are not the whole write surface. The following paths write without a
client HTTP request naming them, and the freeze must fence each one.

- **N1 — Queue consumer → job processor.** `async queue` (L4629–4651) is the
  shipped Worker's only background entry point. It calls
  `processGenerationJob` → `processGenerationJobLocked` (L2833), whose write
  tree includes: status saves (`saveGenerationStatus`, which also drives the
  mirror — N2), payload saves, processing-lease puts/deletes
  (L1167/L1176/L1185), registry markers, `synthesizeAudio` (audio cache +
  usage events), the Gemini quota ledger/park records,
  `reserveGeminiQueuePace` (L2288), inline split machinery
  (`tryInlineGenerationSplit` — rewrites chapter segment structure through
  `saveBook`), adaptive-repair child jobs, Continue activation sends, and the
  next-segment **self-send** (L3702) that keeps a job moving.
- **N2 — Mirror writes.** `mirrorGenerationStatus` (L1980) →
  `runMirrorAttempt`: writes the R2 `generation/` mirror JSON
  (`writeMirrorJson` L1841, `persistMirrorMeta` L1878, lock put/release
  L2040/L2094) and KV mirror records (put L2149). Exactly two entry points:
  `saveGenerationStatus` (i.e. every status save, from routes *and* the job
  processor) and the status GET's catch-up (N4).
- **N3 — Batch submission.** Inside N1, `stepGeminiBatch` (L2636) submits
  Gemini Batch jobs to Google and records their provider references
  (`batch_job_name`) in status/payload + mirror summaries; failures route
  through `recordBatchFailure` → `recordTtsUsage`. A submitted batch is
  *provider-side* state our freeze cannot recall — which is why the P8
  freeze gate requires zero live batch references (verified in P7), and why
  fencing the producers + pausing the queue is the complete local fence.
- **N4 — `ctx.waitUntil` catch-up.** The status GET (above) schedules
  `mirrorGenerationStatus(env, jobId, "catchup")` on `waitUntil` (L4413) —
  a fire-and-forget write that survives the response. Fenced by neutralizing
  that route's write paths and by N2's writer being off.
- **N5 — Client → Shelf worker (different service, NOT fenced by this
  freeze).** The shipped client also calls the separate Opal Shelf worker:
  `POST /api/sessions` (the listening-session outbox flush), plus reads
  `GET /api/reads` and `GET /api/bootstrap`. These are not routes of the
  Reader Worker; the freeze neither can nor should fence them. They are
  governed by the P8 device-inspection step (live outbox import,
  duplicate-import prevention) under the frozen F12 bridge contract.
- **N6 — Client device-local state.** IndexedDB book copies and
  localStorage (including the Shelf outbox `opalreader.shelfOutbox.v1`) are
  device-local, not server state; they are adjudicated at the P8 device
  inspection, not by the freeze.

**Verified non-paths** (checked so nobody has to wonder): `logSyncFailure`
(the sync error logger, L3717) receives no `env` and only `console.error`s —
the error path writes nothing. The `OPTIONS` preflight, the token gate, and
the 404 fallthrough write nothing. There is no WebSocket/upgrade route.

## Client write map (shipped client `app-256.js`)

Literal/template scan of the bundle: every `/api/...` path the client
builds lands either on a censused Reader route above or on the Shelf worker
(N5): `generation/jobs` (+ `/${id}` template), `generation/books/`,
`generation/continue/stage`, `generation/continue/finalize`,
`providers/${provider}/speech`, `providers/${provider}/voices`,
`sync/book/${id}`, `sync/epub/${id}`, `sync/audio/${key}` (built on the API
base), `sync/settings`, `sync/deleted/`, `sync/library`, `sync/manifest`,
`audio/purge`, `playback/chapter`, `providers/status`, `quota/gemini`,
`usage/report?from=…`. No literal call site was found for
`POST /api/export/audio-url`, `GET /api/export/audio/*`, or the bare
`POST /api/generation/continue` (the client assembles some URLs through its
request helper, so a missing literal is not proof of a missing call) —
all three are censused and fenced regardless, because the freeze fences
the Worker, not the client. The bundle contains POST×9 / PUT×3 / DELETE×4
method literals; every one targets a path in the census or the Shelf API.

## Freeze dispositions

The freeze build (a future, separately gated artifact) fences as follows.
"423" means the freeze build returns HTTP 423 for that route before the
shipped handler body runs; shipped read behavior is otherwise unmodified.

| Path | Disposition | Why reads/playback survive |
|---|---|---|
| Every MUTATING route (17 keys) | **423 at the route** | They are write-only operations; no read depends on them |
| `GET /api/generation/jobs/*` | **Write paths neutralized, read served**: no marker ensure, no pause reconciliation, no watchdog wake, no Continue activation, no mirror catch-up — the handler returns the stored status | The client's status display stays truthful during the freeze; nothing it *plays* depends on this route's writes. (Decision D1) |
| `GET /api/generation/books/*/jobs` | **Write paths neutralized, read served**: discovery returns stored jobs with backfill/reconcile disabled | Chapter job lists keep rendering from stored state. (Decision D1) |
| `GET /api/export/audio/*` | **423** (recommended) | Its read *is* a destructive consume of a disposable token; freezing it blocks only not-yet-downloaded export links during the window. (Decision D2) |
| `POST /api/playback/chapter` | **Serve cache hits, 423 on a miss** (recommended) | The route's only write is a derived, content-addressed cache object; already-composited chapters keep playing, and per-segment playback (`GET /api/sync/audio/*`) is untouched either way. (Decision D3) |
| N1 queue consumer | **Queue paused** at the platform level, *and* every producer is fenced above, *and* the two GETs that can send are neutralized | Queued messages are not dropped — they wait, undelivered, until a later gate decides the queue's fate; nothing processes while paused |
| N2 mirror | **Mirror writes off**: the freeze build disables the mirror writer at its entry (`mirrorGenerationStatus`), in addition to every caller being fenced or paused | The mirror is v1 scaffolding (inventoried in P1/P7, not migrated); the authoritative R2 status records are unaffected |
| N3 Batch | No local fence needed beyond N1 + generation POSTs: no producer can run, and the freeze gate verifies zero live batch references first | — |
| READ-ONLY routes (15 keys) | **Untouched** | Playback, sync reads, library/settings reads, quota/usage reads all keep working — the frozen Reader stays fully listenable |

### Correction-C coverage

Every item on the package's Correction-C freeze list (§8/P8 row), accounted
for by name:

| Correction-C item | Where it lives in the shipped code | Disposition |
|---|---|---|
| sync PUT/DELETE | `PUT /api/sync/book/*`, `DELETE /api/sync/book/*`, `DELETE /api/sync/deleted/*` | 423 |
| settings PUT | `PUT /api/sync/settings` | 423 |
| generation POSTs | `POST /api/generation/jobs`, `POST /api/generation/jobs/*/resume` | 423 |
| the mutating status GET | `GET /api/generation/jobs/*` (plus its sibling `GET /api/generation/books/*/jobs`) | Neutralized writes, read served (D1) |
| continue stage/finalize | `POST /api/generation/continue`, `POST /api/generation/continue/stage`, `POST /api/generation/continue/finalize` | 423 |
| speech POSTs | `POST /api/providers/azure/speech`, `POST /api/providers/fish/speech`, `POST /api/providers/openai/speech`, `POST /api/providers/gemini/speech` | 423 |
| usage report | The route `GET /api/usage/report` is **READ-ONLY** (verified: `usageReport` writes nothing). The usage *write* path the list intends is `recordTtsUsage`, which runs inside the speech POSTs and the job processor | Route untouched; the write path is fenced with the speech POSTs + queue paused (interpretation flagged as D4) |
| audio purge | `DELETE /api/audio/purge` | 423 |
| epub/audio uploads | Epub: `PUT /api/sync/epub/*`. Audio: **no audio-upload route exists** — audio enters R2 only via the speech POSTs and the job processor (census proves the negative) | 423 on the epub PUT; audio entry points fenced with their producers |
| queue paused | The `async queue` consumer → `processGenerationJob` tree (N1) | Platform pause + producers fenced |
| mirror writes off | The `mirrorGenerationStatus` / `runMirrorAttempt` family (N2) | Writer disabled at entry + all callers fenced |
| reads preserved | All 15 READ-ONLY keys + the neutralized GET reads | Untouched |

## Decision points for Rowan (classification is settled; these are fence-design choices)

- **D1 — The two side-effecting job GETs.** Recommended: serve the read with
  write paths neutralized (keeps the frozen client's status screens truthful).
  Alternative: 423 both (simpler freeze build; the client shows stale/failed
  status during the window, playback unaffected). The audit's completeness
  claim holds under either; the choice is about the freeze window's UX.
- **D2 — Export download GET.** Recommended 423. Its only write is consuming
  a one-time token, so "serve it and let it delete" is also defensible; 423
  keeps the freeze's invariant absolute: *zero* writes while frozen.
- **D3 — Chapter-composite POST.** Recommended: serve cache hits, 423 on a
  miss. Alternative: flat 423 (composite playback pauses for
  not-yet-composited chapters; per-segment playback unaffected).
- **D4 — "Usage report" interpretation.** The Correction-C list names
  "usage report" among mutating paths; in the shipped code the *route* is
  read-only and the *recording* (`recordTtsUsage`) is the write path. The
  audit covers both under that reading — confirmation requested so the
  freeze build's spec rests on the same interpretation.

## What this audit does not do

It does not build the freeze build, propose its deployment, or touch any
live system. It does not authorize unfreezing decisions, the v2 merge, or
any cutover step. It is the evidence Rowan's P8 design review requires
*before* a freeze deployment may be proposed.
