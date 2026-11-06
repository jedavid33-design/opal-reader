freeze-manifest.mjs
886c8ea6d79dd6d2014976c50e23fe6553fd3d0ff81dd1f5f2337bf109b0fe41  v2/p8/migration-chunk-limits.mjs
2bb0608b589a084ca275428c3236c24680f4a4692afe2245dfcb2880257983c1  v2/worker-entry-prod-d6.js
1d2f333a75a3ffff3d4e7c9454f218ba8a8042fab179fcd4f50031c6d80a27c5  v2/worker-entry-prod.js
91daefdd4778599db83024b074a5c4e78ef4d396a5d815712b381d40f72bd6e5  v2/worker-entry.js
```

### 1.4 The build-stamp rule (one mechanical substitution, disclosed)

`v2/host/build-identity.mjs` carries `BUILD_COMMIT`, which the deterministic artifact builder replaces with the exact source (review) commit of the tree being deployed — the file's own header states this, and it is never hand-edited. The composed source file carries the older stamp `86ad06ab…` while the live `/health` reads build `fdb02395…` (the Grant 1 tree's pin): the stamp substitution is how every build in this chain got its marker. For this gate's deploy, the builder stamps the candidate's pin, `ef69b8f9…`, and the post-deploy `/health` read-back must show build `ef69b8f9…` (§2.4). The stamp substitution is a builder act on the identity part alone, its entire content change being the pin string; it is therefore NOT a second differing source part under §1.3's comparison, which is a comparison of source trees. The deploy verification (§2.4) checks the deployed part set against the candidate manifest with exactly this one mechanical exception, named in advance here — any other difference is a STOP.

### 1.5 Binding clause

This package is bound to the candidate exactly as pinned at `ef69b8f9…`. **Any change to the candidate — any part, any test, any manifest value — voids this package**: the changed candidate is a new candidate, requiring its own battery run, pin, and Rowan review before any execution package can name it. There is no silent substitution, no in-gate rebuild, and no composition with any other candidate (WS2's included).

---

## 2. The gate sequence, end to end

Owner key: **Julie** (authorization, the smoke submission, playback acceptance, dispositions), **Wren** (executor: census, deploy, probe, lifts, observation, records), **Rowan** (reviewer: the execution record and the declaration are pronounced only on her acceptance). Read-only reads are never counted acts. The counted production acts are enumerated at §4.2: deploy (1), probe (1), halt lift (1), queue unpause (1), and — only if a failure path runs — the re-hold pair (2). Every act below names its verification; an act whose verification fails stops the gate at that point, in the state then standing, and the deviation is reported to Julie and Rowan before anything else is contemplated (the executor STOP law: a stopped gate is never restarted on the executor's interpretation; one GO covers one attempt).

### 2.1 Act 0 — the GO of record (P-15's ordering)

Julie's GO for THIS gate, adopting §3's text and naming this package's pin (`<FINAL-PIN>`), is recorded on the board **before** the census runs (the established ordering, kept from the resume gate). No census, deploy, or other act precedes it. If Julie's GO names a different smoke chapter than Chapter 4, that chapter is the smoke target and P-13 is evaluated against it (§2.2).

### 2.2 Act 1 — the pre-flight census and the A1 predicates

Wren runs the full census read set (the design §2 surfaces, in full) against production, read-only, and records every predicate's observed value with its surface and timestamp in the execution record. **All fifteen predicates must pass.** Any predicate failure, or any unexplained movement on any surface, stops the gate before any act: the state is preserved, the deviation and its proposed explanation are reported to Julie and Rowan, and proceeding requires a fresh GO or a Rowan ruling for that deviation — the executor's own tracing never clears its own stop.

#### 2.2.1 The predicates (design §8.1, as corrected; expected values are the standing record)

| # | Predicate — expected value | Surface(s) | Drift rule |
|---|---|---|---|
| P-1 | Live build `fdb02395b3775dc945baa395591a73060ab146c4`; script etag `bb90f182…` CAPTURED AND SAVED as an evidence artifact before any act (Rowan R4) | Deployments list + script GET (etag from response headers, saved artifact) | Exact. Any difference = an intervening deploy: STOP and re-baseline the paperwork |
| P-2 | BOTH holds standing: `GENERATION_HALT` `"1"` (script settings) and queue `opalreader-generation-v2` `delivery_paused: true`, sole consumer `f260f2188d80426bb0588685e9d084eb` | `GET /workers/scripts/{name}/settings`; cf-api queue read | Exact. Either already lifted = unexplained state: STOP |
| P-3 | Containment NORMAL on BOTH surfaces: state NORMAL, known true, absent false, verified true; `stopConfidence: not_applicable`; `updatedAt` 1793933356719; closed-episode summary prevEpisodeId 3, prevEpisodeAttempts 1, prevEpisodeExhausted false, prevEpisodeClosedAt 1793933356719 | `GET /v2/d6-containment` (operator) + `GET /v2/d6-diagnostics?drive=1` projection | Exact. Any new episode or transition = STOP |
| P-4 | Conflicts = exactly the four baseline `schedule_dead` rows: id 1 `grant:plan:3183ecbf2ac4bf50bbc6166e:seg:1:full` (2026-10-29T23:54:14.808Z); id 2 `grant:plan:603ab416bd67ab1b25de97be:ch1:1:full` (2026-10-30T00:24:14.632Z); id 3 `grant:plan:b2dc2a3d1cd367a0245b9102:ch1:1:full` (2026-10-31T05:14:24.089Z); id 4 `grant:plan:e377a5559961b294154276b6:ch2:1:full` (2026-11-01T01:04:30.364Z) — all cache_key `lease`, expected `7`, reason `schedule_dead` | `GET /v2/conflicts` | Exact set. Any addition or change = STOP (Q6: the rows are preserved; no conflicts row is cleared under this gate) |
| P-5 | Plans inventory = exactly the five baseline plans, ALL terminal, totals as censused: Phase B `plan:19cad189fab54b9c804a74a6` complete (1/1); Ch 3 `plan:e377a5559961b294154276b6` complete (23/23); Ch 2 `plan:b2dc2a3d1cd367a0245b9102` complete (18/18); smoke `plan:3183ecbf2ac4bf50bbc6166e` complete; old Ch 2 `plan:603ab416bd67ab1b25de97be` retired (38 entries preserved). ZERO non-terminal plans. Per-subject quarantine reads show no hold on any of the five; the Phase B plan's quarantine reads `held: false` | `GET /v2/d6-plans[/<id>]`; `GET /v2/d6-diagnostics?planId=…` | Exact. Any non-terminal or held plan would be live at turn-on and needs its own disposition first: STOP |
| P-6 | Parked Ch 3 job `1832c21fcf0425454227c4736048a8a632f422abca4a2685ddb775bb1681406a` = `parked_policy`, revision 1, grants [] | `GET /v2/jobs/<id>` | Exact (Q3 PASS — preserved unchanged; any change = STOP). Its stored fingerprint is not exposed on the read surfaces and is not claimed as compared |
| P-7 | Settings revision 1 (lane standard, monthly cap $50); the record otherwise as censused | Settings read via diagnostics/health surfaces | Exact. A revision change = a settings write outside the gate: STOP |
| P-8 | Quota reconcile `ok: true`, drift [], sole exception the adjudicated straddler `att-37d63768-db4b-447d-8150-580b7c6ee257` (`estimated_unverified`) | `GET /v2/d6-quota-reconcile` (operator, complete paginated walk) | Exact. New drift or a new exception = STOP |
| P-9 | Phase accounting (forever-pucked): settled 1,037,880; estimatedUnverified 19,018; reservedUnverified 5,648; unknownOpen 0; remaining 12,456,472 of 13,500,000 | `GET /v2/d6-diagnostics?planId=…` (`plan.phaseAccounting`) + the plan surface (both surfaces; shared fields compared) | Explained-movement-only — and no act since the design census is authorized to move it, so in practice: any movement = STOP |
| P-10 | Sync watermarks: content 18, bindings 1842 | `GET /v2/sync/changes?family=content\|bindings` | Exact. Movement = activity outside the gate: STOP |
| P-11 | Day counters consistent with no generation since the resume close: `providerDispatchesToday` 0; `attemptsToday` explicable solely by the ledger's grant-counter bookkeeping (the standing explanation: the counter increments on a grant reservation, as the resume's seg:88 reservation demonstrated and Rowan accepted) | `GET /v2/quota` | Shape-judged against the PT day (rolls 07:00Z); anything unexplained = STOP |
| P-12 | Recorder healthy and current: latest pass stage `complete`, `recordingFailures` 0, `lastRecordedAt` within ~2 pass cadences of census time; `armedAt` non-null (the standing registration stands) | `GET /v2/d6-diagnostics?drive=1` | Shape-judged. A null registration or a recorder failure = STOP — the chain that must advance the smoke cannot be shown alive |
| P-13 | The smoke chapter's fresh eligibility quote reproduces: book digest `7d76a053…`; for Chapter 4 (chapterIndex 3): 20 eligible, 26,638 chars, expected 375,535 units; exclusions bound_already 1, voice_prompt 0, parked 0 (or Julie's GO-named chapter, quoted fresh the same way) | `GET /v2/d6-eligibility?bookId=5c589095-f812-48a2-8ab2-03ba2791f2b2&scope=chapter&chapterIndex=<n>` | A moved quote = re-quote in the record; if the smoke target's numbers ma