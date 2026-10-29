# D6 — Generation resumption proposal: Standard-only build case for the v2 production worker

Drafted Oct 29, 2026, under Julie's recorded D6 Go (board issue #15, comment 6482364967, Oct 28, 2026: "Let's do generation") and her Oct 29 direction to proceed. For Rowan's review on issue #15. Paper only: this proposal authorizes nothing; every step below is separately gated.

Primary source: the D6 preflight report (`~/workspace/your_files/opal-reader-v2-d6-preflight-report.md`, Handoff RT-H-20261028-2d851b; live reads Oct 28, 2026). Structural census facts are derived from the frozen migration census (`~/workspace/opal-reader-p8-data/`, digest `1c73c56c8005660788a93d7283faae24abcd979ce110264c5da462ea82f2dc18`). Book text is treated as technical data throughout: books and segments are referred to structurally only (IDs, counts, positions) — no content, summaries, or spoilers anywhere in this document.

## 1. Purpose

Generation was never wired into the v2 production worker — by design, not by omission. The production worker `opalreader-api-v2-prod` ships with no queue binding, no queue handler, and no provider secrets, so there is no switch to flip: setting `GENERATION_HALT` to "0" alone would change nothing observable (grants would have no delivery path; synthesis would fail at `provider_not_configured`) (preflight, "Bottom line"). D6 is therefore a **build project**: add the missing plumbing to the production worker and the accepted client, lift the two production-activation blockers (§4, §5), and arm the result through a separately-gated sequence. The end state: Julie can generate the missing Forever Pucked segments — 357 of its 407 segments have no audio yet (census) — and later the other books' unbound segments, from the accepted UI, on the Standard lane, hands-off (the designed "keep going until today's quota runs out" behaviour from the accepted UI design), with the safeguards in this proposal holding at every step.

## 2. Prescribed shape (non-negotiable)

From the accepted cutover plan's D6 row, verified verbatim in the preflight: "**Standard-only with Batch demonstrably disabled is the permissible proposal shape** (Rowan's roadmap ruling); Batch-live needs its own operational decision; **the D10 redesign and the migrated-text plane gate *all* generation regardless. Forever Pucked's parked Ch 3 job resumes only on Julie's explicit word, ever.**"

Accordingly:

- **Standard-only.** Every generation path in this case — client, coordinator, executor — handles the Standard lane only. Batch is demonstrably disabled at both layers (§6.5) and proven disabled by tests (§7).
- **The parked job stays parked.** The one live-state job — Forever Pucked Ch 3, job `1832c21fcf0425454227c4736048a8a632f422abca4a2685ddb775bb1681406a`, state `parked_policy`, lane standard, grants [], 26 occurrences (23 pending + 3 ready) (preflight, "Leftover work") — remains parked through build, deploy, arming, and smoke. Its resumption is a named, separate micro-gate requiring Julie's explicit word, and it is not part of the follow-on proposal either (§8, step 6).
- **Both blockers are lifted before any generation** (§4, §5). No smoke, no arming order, and no schedule pressure overrides this.

## 3. Verified current state (preflight, Oct 28, 2026)

- `/health`: generation "halted", build `1bee2490…`, coordinator armed, scope production.
- `/v2/settings`: `{"monthlyCap":50,"geminiLane":"batch","revision":0}` — the sealed baseline; the lane value is in tension with the Standard-only shape (§6.6).
- `/v2/quota`: attempts today 0, spent 0, ledger seq 0, no quota park. Nothing has ever been attempted or spent on v2 production.
- Worker bindings (names only): vars `ALLOWED_ORIGIN`, `GENERATION_HALT = "1"` (plain-text var), `OPALREADER_V2_SCOPE`; DO namespace `COORDINATOR`; R2 `OPALREADER_STORAGE`; secrets `OPALREADER_ACCESS_TOKEN` + `OPALREADER_MIGRATION_OPERATOR_TOKEN`. **No queue binding; no `GEMINI_API_KEY` or any provider secret** (absent by design; v1's key is per-script and cannot be borrowed).
- The account's only queue, `opalreader-generation`, has the frozen v1 worker as its only consumer, delivery paused (§6.1).
- Trigger path (source-verified in the preflight): client submits `SubmitJob`/`RequestRepair` commands → coordinator grants against quota/cap → outbox drain (runs only when halt is "0" AND a queue binding exists) → queue consumer calls `/internal/execute` → executor synthesizes via the provider adapter → audio to R2 → bindings committed, ledger settled. Three independent halt layers exist today: the halt var, the absent queue binding, and the absent provider secret.
- The live client (ui-pkg-3, accepted Oct 29) is playback-only; its generation controls are rendered but inert. No generation-capable client build has ever been published.

## 4. Blocker A — D10 flush-before-commit (design)

Rowan's requirement (`v2/p8/part1-decisions.md`, via preflight): the executor must flush *and verify* durable audio bytes in R2 before any binding/report commit, with failure-injection tests. The current executor is not accepted as production durability today. The build redesigns the executor's commit order as follows:

**Commit order (per occurrence):**
1. Synthesize via the provider adapter (Standard lane; §6.4).
2. **Flush**: write the audio object to R2 under its binding cache key.
3. **Verify**: re-read the object's durable state from R2 and confirm (a) the object exists at the expected key, (b) its byte size equals the synthesis result's byte size, and (c) its ETag matches the flush response's ETag. All three must hold; a HEAD/metadata read is sufficient — the design does not re-download the audio body. (Whether the R2 binding's head response exposes both values in the deployed runtime is TO BE PINNED IN BUILD; the invariant — existence + size + ETag equality — is what is specified here.)
4. **Only then commit**: write the binding row and the job/report record, and settle the ledger, as one coordinator-side step. No binding, report, or "ready" state may exist for an occurrence whose step 3 has not passed in this execution or a verified prior one (see FI-4).

**Failure semantics:**
- Any failure at steps 2–3 → **no commit of any kind** for that occurrence: no binding row, no report entry, the occurrence remains unbound and eligible.
- The synthesis attempt is recorded honestly in the ledger even when no binding results: the provider attempt happened and may have been billed, and the quota counts *attempts* (preflight: `/v2/quota` exposes attempts today / spent). A failed flush never erases the attempt record.
- The occurrence returns to pending/eligible. It is retried only under the server-owned repair-chain rules (§6.4) with a bounded attempt count (the exact bound is TO BE PINNED IN BUILD), never in a hot loop within a single execution.
- A flushed-but-unverifiable object is treated as an orphan: preserved in place, flagged in the job report by key, never silently deleted — consistent with the migration's standing preservation dispositions.
- A failure is surfaced in the job's report with its stage (flush / verify / commit) named, so a stuck book reports *where* it stopped, in the same spirit as the client's truthful sync states.

**Failure-injection tests (build battery, §7):**
- **FI-1** — kill after synthesis, before flush: no R2 object, no commit, attempt recorded once.
- **FI-2** — kill after flush, before verify: object present, no commit; recovery path re-verifies or orphan-flags — and never re-synthesizes without a new grant.
- **FI-3** — verify returns a mismatch (size or ETag differs): no commit, failure surfaced with stage = verify.
- **FI-4** — kill after verify, before commit: on recovery, the executor re-verifies the already-flushed object and commits **without re-synthesizing** (commit is idempotent against a verified flushed object; no double spend).
- **FI-5** — R2 write error mid-flush: no commit, no partial object treated as valid, attempt recorded.

## 5. Blocker B — Migrated-text plane (design)

Rowan's requirement: the actual text source of every migrated segment must be named and verified, with stable ID/POV mapping and a no-silent-skips proof.

**The named source.** The text source for generation is the **coordinator content plane** — the migrated segment text held by the v2 production coordinator. That the plane holds migrated segment text is established: Find Text works against it in the accepted client (preflight, blocker note). The executor builds every synthesis request from this plane at execute time; there is no second copy of book text anywhere in the generation path.

**The generation-eligible set** (frozen census; occurrences with no binding): **811 unbound preserved occurrences** — Forever Pucked 357 (of which 18 are POLICY_BLOCK-flagged, §6.4), Pucked 347, The Goal 99, Pucked Up 8; Finding Home, IHOL, and Pucked Over are complete. Per-book structure for Forever Pucked (census book record): Ch 1 fully bound (27/27); Ch 2 has 18 unbound, and all 18 carry a v1 POLICY_BLOCK failure record; Ch 3 has 24 unbound (parked-job territory, §2); Ch 4–21 have 315 unbound with no block history.

**Verification the build must produce (proofs over the eligible set):**
1. **Completeness**: every eligible occurrence resolves to a text payload in the content plane — count equality per book against the census, zero unresolved, reported by book.
2. **ID stability**: the set of occurrence IDs in the content plane equals the census set exactly (set equality against the frozen census, digest `1c73c56c…`). Any ID present in one and not the other is named, not smoothed over.
3. **POV mapping stability**: every eligible occurrence's POV resolves to a cast entry for its book (the cast census: 16 entries across 7 books; Forever Pucked: Violet, Alex). Unresolvable POVs are reported by occurrence ID.
4. **No silent skips**: the job builder enumerates the eligible set deterministically in reading order; any occurrence it cannot build a request for is reported by ID with the reason, in the job report — never skipped silently.
5. **Ch 3 boundary reconciliation**: the parked job holds 26 occurrences (23 pending + 3 ready) while Ch 3 structurally has 27 segments (3 bound + 24 unbound). The proof must account for **all 27** Ch 3 occurrences by ID and disposition (bound / parked-pending / parked-ready / other-with-reason), so the parked job's boundary is exact before anything is armed. (One Ch 3 occurrence carries a POLICY_BLOCK failure record made under the parked job's own run — the reconciliation names it.)

**What remains Rowan's ruling:** whether the coordinator content plane as migrated satisfies her "named, verified source" requirement. This proposal names the source and specifies the verification; it does not presume her ruling (preflight: "whether that satisfies the 'named, verified source' requirement is Rowan's call, not established fact").

## 6. Build scope (repo-only, gated)

### 6.1 Queue topology — decision required

The shared-queue question, head-on: the account's only queue, `opalreader-generation`, has the frozen v1 worker as its only consumer. **Unpausing it is not an option** — it would feed frozen v1, not v2 (preflight). Options:

- **Option 1 (recommended): a new v2-dedicated queue** (name TO BE PINNED IN BUILD, e.g. an `opalreader-generation-v2` form), produced by the v2 worker's outbox drain and consumed by the v2 worker itself. v1's queue, consumer, and paused delivery are never touched; the frozen rollback keeps its exact shape; each worker's traffic is independently pausable; arming and re-halting (§8) act on v2's queue only.
- **Option 2: share `opalreader-generation` with a second (v2) consumer.** Rejected: queue messages are delivered to consumers without lane/version routing guarantees this design can rely on; v1 could receive v2 dispatches while frozen (its mutating routes return 423, but relying on a frozen worker to refuse misdelivered work is not a design), and unpausing delivery for v2 would simultaneously resume delivery toward v1. The failure modes are exactly the ones the freeze exists to prevent.
- **Option 3: no queue — synchronous execution inside the command request.** Rejected: generation is long-running and hands-off by design (feature law); the accepted trigger path is queue-based (preflight), and synchronous execution would break quota-ordered granting and the repair-chain model.

Recommendation: **Option 1**, for Rowan's ruling (§11, Q1).

### 6.2 Worker production entry

Per the preflight's recommended build shape: a production entry variant of the v2 worker adding the queue producer (outbox drain → the new queue), the queue consumer handler (consumer → `/internal/execute`, the source-verified path), and provider-secret support (the code reads `GEMINI_API_KEY` from the worker's own env; the build references the secret **by name only** — setting it is Julie's step, §6.3). The frozen Shelf bridge is untouched (byte-identical, hash-pinned as in every prior round). Playback, sync, and diagnostics behaviour is unchanged; the existing batteries must stay green against the new entry.

### 6.3 Provider secret — Julie's hands only

The build never touches the secret value. Setting `GEMINI_API_KEY` on `opalreader-api-v2-prod` is a **Julie-hands-on step** (the D2 token pattern), sequenced as gate step 3 (§8). The deploy (step 4) is verified with the secret present-by-name only; no agent reads, prints, or transmits the value at any point.

### 6.4 Executor: repair chains, POLICY_BLOCK splitting, voice law

- **Server-owned repair chains for all generation** (feature law, confirmed Oct 20): retry/repair decisions live in the executor, not the client. The client submits intent; the chain owns attempts, splits, and terminal states.
- **Recursive POLICY_BLOCK splitting without voice substitution** (feature law): when the provider refuses a segment with POLICY_BLOCK, the executor splits the segment text and retries the parts recursively, keeping the same cast voice throughout — never substituting a different voice to get past a block. This path is load-bearing, not edge-case: all 18 unbound Forever Pucked Ch 2 segments carry a v1 POLICY_BLOCK failure record (census), and several bound segments elsewhere in the book succeeded in v1 only after splits. A segment that still fails at the recursion floor reaches a terminal blocked state, is reported by ID in the job report, and does not halt the rest of the job.
- **Removed-provider voices — prompt, never silent substitution** (feature law): when a segment's cast voice belongs to a removed provider (Azure / Fish / Speechify / ElevenLabs), generation for that segment stops at a **voice-mapping prompt** naming the character and the recorded mapping where one exists (recorded only: Emmett → Gemini Charon; Reese → Gemini Kore; Tucker → Gemini Puck (match unverified); Sabrina → Gemini Aoede). Nothing is generated for that segment until Julie resolves the prompt; no voice is ever swapped silently. (Forever Pucked's cast — Violet (Gemini Zephyr) and Alex — are Gemini voices, so the FP phase is not expected to hit this path; the mechanism must still exist and be tested before arming, §7.)

### 6.5 Generation-capable client

Base: the accepted ui-pkg-3 client (commit `bf4e5ba2…`). The build wires the already-rendered generation controls to real commands:

- Per-chapter Generate, per-segment generate on "No audio yet" rows, and book-level Generate all submit `SubmitJob` / `RequestRepair` to `POST /v2/commands` (the source-verified trigger path). Exact client identities (entry / SW / stylesheet successors, build and packaging markers) are TO BE PINNED IN BUILD, following the established versioned-successor pattern; shared modules and the store are changed only under the same preservation rules as UI1–UI3, and the frozen bridge stays byte-identical.
- **Standard-only, enforced at both layers.** Client: the confirm sheet's Standard | Batch switch renders Batch **disabled with the reason shown** ("Batch isn't enabled yet — it needs its own decision"), defaulting to Standard. Server: the coordinator refuses to grant, and the executor refuses to execute, any command carrying a batch lane — a crafted batch-lane command is rejected, not honoured (§7, Batch-disabled proofs). Defence in depth is deliberate: neither layer trusts the other.
- **Hands-off chaining.** The designed "Keep going until today's quota runs out" toggle: with it on, the client chains per-chapter submissions for the book until the coordinator reports the day quota (100 attempts) or the monthly cap ($50) reached; the stopping point is reported in plain words in the UI (where it stopped, what remains), and remaining chapters simply stay unsubmitted — a normal terminal-for-now state, never an error loop. With it off, each Generate is a single explicit submission.
- Quota/cap display: the existing Settings quota counter (attempts today, spent of cap) becomes live data once generation exists; its rendering is unchanged.

### 6.6 Settings reconciliation — the geminiLane tension

`/v2/settings` currently reads `{"monthlyCap":50,"geminiLane":"batch","revision":0}`. A Standard-only case cannot arm against a settings record that names batch. Reconciliation, executed at the **arming step** (§8, step 5) — not in the halted deploy, so the sealed baseline stays sealed until the case is actually being armed:

- Before: `{"monthlyCap":50,"geminiLane":"batch","revision":0}`
- After: `{"monthlyCap":50,"geminiLane":"standard","revision":1}` — a single revisioned settings write changing exactly the lane; the cap is untouched.
- The write is verified by read-back (`/v2/settings` and `/v2/quota`) before the halt flip proceeds.
- Independent of settings, the executor's lane allowlist under this case is exactly `["standard"]` (representation TO BE PINNED IN BUILD): even a settings record that somehow named batch could not produce a batch execution while D6's shape is in force.

### 6.7 What the build does not change

No Shelf change (bridge frozen); no voice-mapping changes (mappings are recorded only, §6.4); no change to the v1 worker, its queue, or its paused delivery; no change to playback/sync behaviour or to any accepted client's data.

## 7. Test plan

All suites run on the exact final build trees (worker + client), complete runs, logs and exit codes pinned in the review artifact — the standing rule from UI1–UI3. NO real book text in any test: synthesis fixtures are synthetic strings; book-derived fixtures are structural only (IDs, counts, char lengths).

- **Existing batteries stay green**: the v2 worker suites and the client batteries (unit, cast census, Chromium proof, phone-width proof) against the new builds.
- **D10 failure-injection suite**: FI-1…FI-5 (§4), each asserting the full post-condition set (R2 state, binding state, ledger/attempt record, job report stage).
- **Flush-before-commit ordering proof**: an instrumented run asserting no binding/report commit timestamp precedes its verify pass, across success and injected-failure paths.
- **Quota/cap enforcement**: attempts counter increments per attempt (including failed and split attempts, per the ledger semantics in §4); granting stops at 100 attempts/day; granting stops at the $50 monthly cap; the hands-off chain terminates cleanly at each limit and reports the stopping point; halt var at "1" ⇒ zero grants, zero drain, zero executions, at every layer independently.
- **Batch-disabled proofs**: (a) the client cannot select Batch (control disabled, state cannot be set programmatically through the UI layer); (b) a hand-crafted batch-lane command submitted directly to `/v2/commands` is rejected by the coordinator; (c) a batch-lane dispatch reaching the executor is refused. All three must pass.
- **Parked-job inertness**: with the full pipeline armed in the test environment and unrelated jobs executing, the parked Ch 3 job's state, grants, and occurrence dispositions are byte-identical before and after; the drain is shown to void/skip its dispatches; no code path in the build enumerates it as eligible.
- **Migrated-text proofs**: the §5 verification suite run as tests — completeness, ID set equality vs the frozen census, POV resolution, no-silent-skips enumeration, and the Ch 3 27-occurrence reconciliation report.
- **POLICY_BLOCK fixtures**: synthetic segments engineered (structurally) to trigger provider refusals in the stubbed adapter: single split, recursive multi-level split, recursion-floor terminal state reported by ID, and voice identity asserted constant across every split attempt (no substitution).
- **Repair-chain tests**: transient provider failure → server-owned retry with bounded attempts; terminal failure → clean terminal state, job continues with the next occurrence.
- **Removed-provider prompt test**: a fixture book whose cast voice is a removed-provider voice produces a mapping prompt and zero synthesis calls for its segments.
- **Smoke** (post-arming, attended — §8 step 6): (i) one synthetic Standard job end-to-end with byte verification and quota read-backs; (ii) one named real segment with Julie listening (§10).

## 8. Sequencing & gates

1. **Paper** — this proposal → Rowan's review. (Julie's D6 Go and the preflight are already on record.)
2. **Build** — Julie's build Go → repo-only build (worker entry + executor redesign + client) → full battery (§7) → review artifact pinned → Rowan source review.
3. **Julie's steps** — Julie sets `GEMINI_API_KEY` on v2-prod herself (§6.3). Top-up: **likely not needed for the Forever Pucked phase** — the verified prepay balance is **$17.83 (Julie-verified Oct 29, 2026**; a $20.00 top-up was added Oct 17, 2026; auto-reload OFF; Paid tier 1) — see §9. Any future top-up remains a separate Julie decision under her $20-at-a-time-from-fun rule.
4. **Halted deploy** — separately authorized: the new worker build is uploaded with `GENERATION_HALT` still "1"; identity, bindings, and observability verified (after every code upload, observability is re-applied via the multipart PATCH to `/workers/scripts/{name}/settings` and the script etag verified unchanged — the standing Cloudflare lesson). The generation-capable client is published in this step or its own, per the build's packaging gates, with generation still halted server-side.
5. **Arming** — separately authorized, in this exact order, each step verified by read-back before the next: (a) settings reconciliation (§6.6: revision 0 → 1, lane → standard, read-back verified); (b) consumer attach (the v2 worker consumes the new queue; delivery still paused); (c) halt flip (`GENERATION_HALT` "1" → "0", `/health` read-back shows generation no longer halted, `/v2/quota` still zeroed); (d) **queue delivery enabled LAST**. Any failed verification stops the sequence where it stands — a half-armed state is reported, never pushed through.
6. **Smoke, then follow-on** — synthetic job, then the one named real segment (§10) with Julie listening. Only after smoke passes: a **follow-on proposal** for the unbound segments, Forever Pucked first (Julie's current listen) — and even there, the parked Ch 3 job resumes only on Julie's explicit word, and Ch 2's POLICY_BLOCK set goes through the §6.4 splitting path as designed.

**Re-halt path** (stated honestly, from the preflight): re-set `GENERATION_HALT` to "1" and re-pause the v2 queue's delivery. In-flight grants settle and cannot be un-spent; a re-halt stops new work, it does not refund attempts already made.

## 9. Cost & quota framing (Julie's verified model only)

- **Model / pricing**: `gemini-3.8-flash-tts`; intro pricing ≈ **$0.81 per audio hour through Dec 31, 2026**, ≈ $1.62 from Jan 1, 2027. $55 paid toward the $100 Tier 2 threshold to date. Listening is free; only generating costs.
- **Verified balance**: AI Studio prepay **$17.83 (Julie-verified Oct 29, 2026**; $20.00 top-up added Oct 17, 2026; auto-reload OFF; Paid tier 1, $250 billing-account tier cap). This supersedes the preflight's $0.33 figure, which was the pre-top-up balance. At ~$0.81/audio hour, $17.83 ≈ **22 audio hours** (estimate, basis: balance ÷ intro rate).
- **Forever Pucked estimate (labelled estimate, with basis)**: the 50 bound FP segments total 0.50 measured audio hours for 28,736 characters of segment text — a realized rate of ≈16.0 chars/sec (durations from the census audio-results records, wav-header method). The 357 unbound segments carry 472,974 characters → **≈ 8.2 audio hours → ≈ $6.67 at intro pricing (≈ $13.33 at the post-Jan-1 rate)**. On this estimate the current $17.83 balance covers the entire Forever Pucked phase at intro pricing with room to spare; the smoke (§10) measures one real segment's actual cost and the follow-on proposal re-bases the estimate on measured v2 numbers before any book-scale run.
- **Attempts math**: 357 segments need at minimum ~357 attempts; splits, repairs, and retries add more (the 18 POLICY_BLOCK segments will consume multiple attempts each by design). Against the **100 attempts/day** quota, Forever Pucked alone is a **multi-day** generation at quota pace — at least ~4 days if run flat-out, realistically more. The hands-off chain (§6.5) is designed for exactly this: it stops at the day quota and reports where it stopped.
- **Monthly cap**: $50 in settings (§6.6) — at the estimate above, the cap does not bind for Forever Pucked; it remains the hard backstop for all generation.
- **All seven books**: the remaining 454 unbound segments (Pucked 347, Goal 99, PU 8) are the same order of magnitude again; no estimate is offered for them here — the follow-on proposals carry measured numbers.

## 10. Smoke segment (named)

The real-segment smoke uses a segment chosen to be the *clean* case — no block history, a live Gemini cast voice, outside the parked job's chapter:

- **Book**: Forever Pucked (`5c589095-f812-48a2-8ab2-03ba2791f2b2`)
- **Chapter 4** (chapter index 3; chapterId `1d355ccc-b633-422c-a7d1-c4bd42b69e8b`), **Segment 1** (1-based position 1)
- **Segment/occurrence ID**: `bc3c9357-3b28-4a1f-ba52-c0ff6af0b822`
- **POV**: Violet — cast voice Gemini Zephyr (a live Gemini voice; no mapping prompt involved)

Derivation (census book record): Ch 2's first unbound segment (Ch 2 Seg 19, `4b2b3699…`) was rejected as the smoke candidate because it carries a v1 POLICY_BLOCK failure record — it belongs to the splitting-path test set, not the clean smoke. Ch 3 is excluded entirely (parked job). Ch 4 Seg 1 is the first unbound segment in reading order with no block history. **Confirmation condition**: the §5 eligible-set proof must confirm this segment's membership in the verified eligible set before the smoke; if it does not, the smoke segment is re-picked by the same rule (first eligible, clean-history, non-Ch 3, in reading order) from the verified set — TO BE PINNED IN BUILD.

## 11. Risks & open questions for Rowan

1. **Q1 — Queue topology**: Option 1 (new v2-dedicated queue) recommended (§6.1). Your ruling?
2. **Q2 — Settings reconciliation**: the revisioned lane change at arming time (revision 0 → 1, `geminiLane` batch → standard, cap untouched), plus the executor-side `["standard"]` allowlist (§6.6). Sufficient to resolve the tension you flagged?
3. **Q3 — Blocker B ruling**: does the coordinator content plane, verified per §5, satisfy "named, verified source"?
4. **Q4 — Arming order**: settings → consumer attach → halt flip → delivery last (§8 step 5), each read-back-verified. Agreed, or should consumer attach precede the settings write?
5. **Q5 — Attempt accounting on flush failure**: §4 records the attempt (and any provider spend) even when no binding commits, because the quota counts attempts. Agreed as the honest ledger semantics?
6. **Q6 — Ch 3 reconciliation**: the parked job's 26 occurrences vs Ch 3's 27 structural segments (§5, proof 5) — the build accounts for all 27 by ID before arming. Anything further you require at that boundary?
7. **Risk — R2 free-tier headroom** (§12): the migrated audio already occupies ≈5.35 GB of the 10 GB free R2 tier; Forever Pucked's missing audio at the current format adds ≈1.4 GB (estimate, §12). The executor's output format is a build decision with free-tier consequences — flagged here, before anything is built, per Julie's standing rule.
8. **Risk — estimate variance**: the §9 cost/hours figures rest on v1's realized chars/sec; v2's executor (format, splitting behaviour) may differ. The smoke measures before any scale commitment.

## 12. Free-tier check (flagged before building, per Julie's standing rule)

Free GitHub + Cloudflare tiers only; anything that could cost money is flagged here, in advance:

- **Workers requests**: generation traffic is Julie-paced (commands, grants, executions per attempt) — orders of magnitude below the free tier's 100k requests/day. No concern.
- **Queues**: the design issues roughly one message per granted job/attempt batch plus consumer invocations. The exact free-tier operations allowance and the design's projected operations/day at full quota pace (100 attempts/day) are **TO BE PINNED IN BUILD** against the account's free-tier limits (the weekly free-tier watch tracks this boundary); if the projection approaches the limit, the build must say so before arming, not after.
- **R2 storage — the binding constraint**: the 1,798 migrated audio objects already total ≈ **5.35 GB of the 10 GB free tier** (census audio-results byte counts). Forever Pucked's missing ≈8.2 audio hours at the current stored format (≈173 MB per audio hour, measured from the bound FP objects) adds ≈ **1.42 GB → ≈6.8 GB total**, close to the 70% notify threshold of the standing free-tier watch — and the remaining books would add a similar amount again, which **would** pressure the cap. The executor's output audio format is therefore a named build decision (TO BE PINNED IN BUILD) with this math in front of it; if the build cannot keep the all-books projection inside the free tier, that is a stop-and-report finding for Julie, not a detail.
- **Durable Objects (coordinator)**: already in production use on the free tier; generation adds request volume at Julie's pace. No new paid surface.
- **Gemini spend**: the only real-money surface; governed by §9 (prepay balance, $50 monthly cap in settings, 100 attempts/day quota, auto-reload OFF).

## 13. Out of scope

- **Batch lane live** — separate later operational decision; this case disables it demonstrably instead.
- **The parked Ch 3 job's resumption** — separate micro-gate on Julie's explicit word; not in this case, not in the follow-on by default.
- **Generating the unbound segments beyond the single smoke segment** — follow-on proposal after smoke (§8 step 6).
- **Any Shelf change** — the bridge is frozen byte-for-byte.
- **Any voice-mapping change** — mappings are recorded only; the build implements the prompt behaviour (§6.4), it does not decide mappings.
- **The other open client items** — G-1 (book-wide style-note field) and G-2 (backup/restore implementation) remain separate future decisions.
- **v1 anything** — the v1 worker, its queue, and its paused delivery are untouched.

## Gates summary

Proposal (this document) → Rowan review → Julie's build Go → repo-only build + full battery → Rowan source review → Julie's secret step (+ any separate top-up decision) → separately-authorized halted deploy → separately-authorized arming (ordered, verified) → smoke (synthetic, then the §10 segment with Julie listening) → follow-on proposal for the unbound segments. No gate implies the next; each is Julie's explicit decision.
