- A provider refusal (`contentBlocked`) is confirmed in the attempt log
  as `policy_block` at cost 0 and enters recursive splitting
  (policy-split.mjs): same cast voice, original text preserved exactly
  across splits (concatenation is identity), depth ≤ 4, floor 50 chars,
  shared 12-call segment budget. A part still blocked at the floor is
  `TerminalBlock` → execution `policy_block`, occurrence
  `report_blocked` → `blocked_policy` (terminal), plan ends `partial`.
  That is a STOP (E3/E3b): resolving a terminally blocked segment is a
  separate gated program, and — for (b) — the chapter is not "finished"
  while it stands. **Never** voice substitution, **never** text edits
  to slip the filter (feature law F3).
- Segments over 1,200 chars are pre-split before dispatch (incidence
  reduction for the 120 s fetch ceiling; the ceiling remains a
  fail-closed backstop, not a guarantee). All 23 (a) segments
  pre-split; idx 26 (569 chars) does not.
- A non-HTTP provider throw confirms the attempt `unknown` at cost
  NULL → `markUnknownBilling` (d6-executor.mjs:594) halts the phase and
  stops the whole message; later occurrences are untouched. Unwinding
  (reconciliation / estimated_unverified adjudication) is the separate,
  already-precedented gated program — never part of this gate, for
  either phase.
- Retryable HTTP failures ride the server-owned repair chain (F6);
  flush/commit failures ride intent-recovery, as Chapter 2's 18/18
  demonstrated on this machinery's predecessor build.

## 9. Fingerprint exposure — DP-3: preflight procedure (preferred) or disclosure (fallback)

**The exposure.** Whether an R2 object already sits at any of the
dispatch keys for the 24 generatable occurrences (23 in (a) + idx 26)
is not knowable from any Worker read surface. Chapter 2's precedent on
the pre-fix build: 8 `winner_digest_mismatch` collisions (pre-existing
objects at fingerprint keys, cross-era artifacts), 167,922 units
(≈ $0.168) of recorded defect waste, and all 18 segments still
completed via repair. On the CURRENT build the cache defect behind
half those failures is fixed (`refreshKey`); a digest-matching
pre-existing object is adopted, a mismatch fails `failed_known` and
the repair chain retries — a bookkeeping cost, never a billing
unknown. Rowan's ruling: disclosure must be explicit at decision time,
and a preflight is preferable if it can be checked safely with
separate authorization. It can. The procedure below is **read-only
end to end** — no production writes, no provider contact, no
generation — and is executed ONLY under Julie's separate DP-3
authorization at decision time. It was NOT taken during proposal prep.

**Key derivation (CONFIRMED from source).**
- The dispatch fingerprint is `fingerprintFor(payload)`
  (worker/executor.mjs:36): SHA-256 hex of `String(payload.text)`
  concatenated with `JSON.stringify({provider (default "gemini"),
  voice, model (default "gemini-3.8-flash-tts"), rate: 1,
  style: styleDirection || ""})`. The work source assembles exactly
  this payload per dispatch (d6-work-source.mjs:117 returns
  `fingerprintFor(payload)` alongside it).
- The R2 object key is `objectKeyFor(cacheKey, format)` =
  `` `${keyPrefix}audio/${cacheKey}.${format}` ``
  (host/adapters.mjs:512), with production `keyPrefix = ""`
  (worker-entry-prod-d6.js:1152) and formats from `AUDIO_EXTENSIONS =
  ["mp3", "wav"]` (adapters.mjs:502). So every first-pass dispatch key
  is `audio/<fingerprint>.wav` or `audio/<fingerprint>.mp3` in bucket
  `opalreader-storage`.
- Dispatch payloads are per-CHUNK for pre-split segments: all 23 (a)
  segments exceed the 1,200-char ceiling and dispatch as 2 chunks
  each, so the first-pass key set is **47 keys** ((a) 46 chunk keys +
  (b) 1 whole-segment key) — not 24. Runtime POLICY_BLOCK sub-splits
  create further keys that are NOT enumerable in advance; the
  preflight covers first-pass keys only, and says so.

**Procedure (P1–P5), executable as written.**
- **P1 — Live text basis.** Fetch the content snapshot read-only via
  the client connector (`GET /v2/sync/snapshot?family=content`, the
  same surface used in gates (a)/(c)); record its digest in the
  preflight report. Payloads are computed from the LIVE plane text —
  this eliminates the census text-basis caveat (§4) entirely. Book
  text is processed locally only; no text, and no fingerprint of any
  bound segment beyond the P3 check values, is posted anywhere.
- **P2 — Payload + key enumeration.** Locally, against the pinned
  source tree: assemble each first-pass dispatch payload exactly as
  the work source does (segment speechText, cast voice/provider/model,
  style direction from the snapshot), run the shipped pre-split
  (policy-split.mjs) for >1,200-char segments, and compute
  `fingerprintFor` per payload by importing the shipped
  `worker/executor.mjs`. Output: the 47-key list (key, occurrence idx,
  chunk #, chars).
- **P3 — Replication self-check (STOP gate).** Before trusting the
  computed keys, reproduce the three BOUND Chapter 3 segments' recorded
  revision keys from their snapshot payloads by the same pipeline (the
  binding's revision key IS the payload fingerprint —
  d6-executor.mjs:346 comment and the adapter's `revisionKeyOf`
  convention; the check values are the pin's recorded ready-row
  revision keys for idx 0–2, §13). **If any of the three fails to
  reproduce, STOP: the replication is wrong somewhere, the preflight
  is inconclusive, and the gate falls back to the disclosure route
  below.** A self-check that cannot fail is not a check; this one can.
- **P4 — Occupancy reads.** For each of the 47 keys, one read-only R2
  list call via the Cloudflare connector
  (`GET /client/v4/accounts/{acct}/r2/buckets/opalreader-storage/objects?prefix=audio/<fingerprint>`)
  — list responses are metadata-only (name, size, etag); no object
  body is ever downloaded, nothing is written, and the 20-per-page
  list cap is immaterial (≤ 2 objects can share a fingerprint prefix:
  the `.wav` and `.mp3` forms). Record per key: occupied or empty,
  and for occupied keys the object's size + etag.
- **P5 — Report.** A preflight report (key table from P2/P4, snapshot
  digest from P1, self-check result from P3, timestamp) is filed with
  the gate's execution record before E1. Occupied keys do NOT block
  the gate: they predict adoption-or-repair work, quantified per
  Chapter 2's precedent, and E3/E3b monitoring watches for exactly
  those occurrences.

**What the preflight proves, and what it does not.**
- PROVES (at check time): for each enumerated first-pass key, whether
  an object exists at that exact key in `opalreader-storage`, with its
  size and etag.
- DOES NOT prove adoptability: the executor adopts a pre-existing
  object only on digest match at its verify step; an occupied key may
  still yield `winner_digest_mismatch` → `failed_known` + repair
  (Chapter 2's shape — recorded cost, never a billing unknown).
- DOES NOT prove the converse at dispatch time: an empty key at check
  time is empty *then*. INFERRED practical reading: nothing else
  writes `audio/` keys absent a generation run, and no other
  generation is authorized in the window — so the check-time picture
  is the dispatch-time picture unless Julie authorizes other work in
  between.
- DOES NOT resolve winner provenance (which era/process wrote an
  occupying object, or why) — that remains the separately-gated
  provenance question, untouched by this preflight.
- An occupied key whose object is another occurrence's binding is not
  automatically a collision: identical payload (same text + voice +
  style) yields the identical fingerprint BY CONSTRUCTION, and
  adoption is then legitimate deduplication. The collision case is
  precisely an occupying object whose recorded digest ≠ the payload's
  expected digest — which only the executor's verify step can finally
  determine (see adoptability, above).
- Coverage limit: first-pass keys only (47). A POLICY_BLOCK sub-split
  at runtime dispatches under keys the preflight cannot enumerate;
  those keys' occupancy is simply unexamined, as it was in Chapter 2.

**Fallback — disclosure-only route.** If Julie declines the preflight
authorization (or P3 fails), the gate proceeds on this disclosure,
stated explicitly at decision time: collision exposure for the 24
occurrences is UNVERIFIED; collisions, if any, surface in diagnostics
during E3/E3b as `failed_known` bookkeeping (Chapter 2 precedent:
8 collisions, ≈ $0.168 recorded waste, 18/18 completed via repair) and
are reported with the record. The disclosure route changes no other
part of the gate.

## 10. Completion criteria

### 10A. Part (a) completion (all required)
1. (a) plan `complete` with totals: eligible 23, done 23, failed 0,
   blocked 0; bindings published 23 (bindings watermark advances by
   exactly 23; content watermark unchanged).
2. Chapter eligibility re-quote: chapterIndex 2 shows bound_already
   26, parked 1 (idx 26), eligible 0.
3. Phase read-back: settled increased by the (a) plan's recorded
   settlements only; unknownOpen still 0; `reconcileQuota` still
   `ok: true` with no new exceptions.
4. Parked job state, conflicts set (3 rows), settings revision, and
   queue state all identical to the preconditions; the release record
   reads live and names exactly the 23.
5. Julie's playback check of the newly generated Chapter 3 audio
   (the released set): PASS. (Part (a) is not called complete on
   server evidence alone.)

### 10B. Part (b) completion (all required)
1. (b) plan `complete` with totals: eligible 1, done 1, failed 0,
   blocked 0; bindings published 1 (bindings watermark advances by
   exactly 1 more).
2. Binding read-back for idx 26 specifically: a bindings-table row for
   `2a85f74f…` exists and the chapter quote delta from §10A.2 is
   exactly that one occurrence moving parked → bound.
3. Phase read-back: settled increased by the (b) plan's recorded
   settlement only; unknownOpen still 0; `reconcileQuota` still
   `ok: true` with no new exceptions.
4. Parked job state, conflicts set, settings revision, queue state
   identical to preconditions; the exemption record reads live and
   names exactly idx 26; the release record is unchanged by Phase B.

### 10C. Combined final chapter verification — "Chapter 3 is finished"
1. Post-completion chapter quote: chapterIndex 2 shows
   **bound_already 27, parked 0, eligible 0** — every segment of the
   chapter as it exists live has audio.
2. Bindings watermark advanced by exactly 24 across the whole gate
   (23 + 1); content watermark unchanged; phase and quota read-backs
   per §10A.3/§10B.3 hold at the final read.
3. **Julie's final playback check covering the whole chapter,
   including its end**: the chapter plays in sequence through idx 26,
   whose audio is present and audible as the chapter's final segment:
   PASS. Only when §10A + §10B + §10C all hold is Chapter 3 called
   finished — (a) alone leaves the chapter one segment short, which
   is exactly the gap Rowan's ruling closed.

## 11. NOT authorized by this gate

Batch arming or any Batch lane use; any other chapter or book
(rest-of-Forever-Pucked remains its own later gate, and idx 26 does not
ride along with it — it is handled here, in (b), or not at all); any
change to the parked job's state or rows; quarantine releases of any
other subject; settings changes; any rollback; any second intent,
second release, second exemption, or retry beyond §6's convergence
rules; legacy snapshot retirement; Issue #16. **Design invariants that
are part of this gate's scope, not options:** the release route refuses
any occurrence outside the parked job's definition set
(`park_release_outside_definition`, §5A.2 — idx 26 by name); the
exemption route refuses every definition member
(`chapter_exemption_inside_definition`, §5B.2); the two records and
routes are never merged into one mechanism that could name both sets.
The R2 provenance read (winner provenance) is not authorized here —
§9's preflight is an occupancy check under its own separate
authorization, not a provenance investigation.

## 12. Decision points

- **DP-1 — REMOVED.** v1 asked whether idx 26 is in or out. Rowan
  ruled the outcome (ruling `6548543534`): idx 26 is IN — via the
  separately scoped part (b), never by broadening the release. There
  is no remaining choice here; §0, §1, §6, and §10 are written to that
  ruling.
- **DP-2 — one GO or two for (a)'s E1+E2.** Rowan: acceptable in
  principle. **Lean (retained): ONE GO** covering the release and the
  chapter submission as a single named sequence with the E1 read-back
  as a hard checkpoint between them (mismatch = STOP, §6) — the
  gate-(c) pattern. A separate release-only GO is available if Rowan
  or Julie prefers the seam. **Scope note:** DP-2's GO covers part (a)
  only. It does not extend to (b) under any reading.
- **DP-3 — fingerprint preflight or disclosure.** Restated per the
  ruling: **preflight PREFERRED** (procedure §9, executable as
  written), taken only under Julie's separate authorization at
  decision time (it reads the storage bucket directly); **disclosure
  is the fallback** if she declines, with the exposure stated
  explicitly in the decision text itself. Julie's choice, made at
  (a)'s decision time; the chosen route is recorded in the GO comment.
- **Approval requirement (not a DP) — (b)'s fresh GO.** Before any
  paid generation in Phase B, Julie gives a fresh GO naming idx 26 and
  (b)'s own quote (§7), after (a) has completed and been verified.
  This is Rowan's requirement, recorded here so it cannot be mistaken
  for covered by DP-2.

## 13. Source index (build 945875bc tree; all hash-verified per §2)

- `worker/coordinator.mjs` — JOB_STATES/parked comment :36–41;
  JOB_TRANSITIONS `parked_policy: {}` :80; `applyJobEvent` :432;
  `_resume` :1565; `_deriveJobCompletion` (funnels through the
  applier); `_migrateImportJobs` :4489 (job INSERT with
  `data_json = canonicalJson(pinAgg.definition)`; occurrence INSERTs
  :4554ff); `_approvedFreeze()` / `_carryBook(bookId)` (the pin access
  §5A.2 relies on); §3A.5 carry verification (recomputes stored rows
  against the pin).
- `worker/generation/eligible-set.mjs` — disposition precedence
  :18–23; `parkedApplies` derivation :65; entry fence :76; chapter
  rule :82; parked reason string :76–85.
- `worker/generation/content-plane-adapter.mjs` — `parkedJobOf`
  :111–128 (state-only selection `WHERE state = 'parked_policy'`;
  entries map over ALL of the job's rows); `charCountOf` /
  `blockHistoryOf` / `revisionKeyOf` conventions (bound →
  `generationFingerprint`).
- `worker/generation/service.mjs` — parked-job fence comment
  :701–706; `submitIntent` (full-set build then scope filter
  :748–757; segment first-entry :859; convergence, overlap fence,
  `nothing_eligible` :855); `createJobForEntries` :150 (fresh job +
  fresh occurrence rows); `eligibilityQuote` (eligible-only char sums;
  identical scoping :1271–1275); `driveOnce` :888 (plans only).
- `worker/generation/d6-executor.mjs` — attempt wrap + `policy_block`
  confirm :522; TerminalBlock → `policy_block_terminal` :553;
  quota-refusal shape; `markUnknownBilling` :594; binding revision key
  = payload fingerprint (comment :346).
- `worker/generation/d6-work-source.mjs` — dispatch payload assembly;
  `fingerprint: fingerprintFor(payload)` :117.
- `worker/executor.mjs` — `fingerprintFor(payload)` :36 (SHA-256 of
  text + canonical config JSON: provider, voice, model, rate 1,
  style).
- `worker/host/adapters.mjs` — `AUDIO_EXTENSIONS = ["mp3", "wav"]`
  :502; `objectKeyFor` = `` `${keyPrefix}audio/${cacheKey}.${format}` ``
  :512; `hydrateKey` / `refreshKey` (the fixed cache defect).
- `worker/worker-entry-prod-d6.js` — full route inventory (no
  job-state surface); operator fence classes; production flush store
  `keyPrefix: ""` :1152.
- `worker/generation/policy-split.mjs` — F3 law + pins (depth 4,
  floor 50, budget 12); `PRE_SPLIT_MAX_CHARS = 1200` :222;
  `synthesizeLongSegment` (exact-concat pre-split).
- `worker/generation/gen-constants.mjs` — `PHASE_BUDGET_MICRO_CENTS`
  (forever-pucked 13,500,000); `expectedCostMicro` :81;
  `upperBoundAttemptMicro` :88; `upperBoundOccurrenceMicro` :94.
- `worker/generation/grant-guards.mjs` — phase projection formula
  (`d6PhaseBudgetCheck` :108–117); quarantine hold writes :176,213.
- `worker/generation/quota-budget.mjs` — provider-attempt ledger +
  armed dispatch refusal (provably-never-dispatched semantics).
- `worker/p8/approved-freeze-carry.mjs` — the Ch 3 aggregate: jobId
  `1832c21f…`, chapterIndex 2, `v2State: "parked_policy"`;
  `definition.total: 26`, definitionDigest `b90c3cb3…`; canonical
  occurrence list of 27 ids with `occurrenceSetSha256` `03bb07b8…`
  (idx 0 `6bd358a7…`, idx 1 `16e860aa…`, idx 2 `467174dd…` as the
  ready rows with recorded revision keys `e240adac…`, `8963058e…`,
  `987636ed…` — §9 P3's check values; idx 26 `2a85f74f…` last, beyond
  the definition).
- Records: D6 BUILD-REPORT §7 + ARMING-REPORT (Ch 3 reconciliation:
  27 rows, anchor `6bd358a7…`, idx 26 absent-from-definition);
  gate-(a)/(b)/(c) execution records (pins `68776e41…`, `26b5b5ee…`,
  `5d6fd25a…`); v1 of this proposal (pin `a8fed3d0…`); Rowan's
  REVISE BEFORE PASS ruling (board comment `6548543534`).
