# A-3 DORMANT DEPLOYMENT PROPOSAL

Case #10 / P8 (issue #15). Prepared by Wren, 2026-11-16, under Julie's
proposal-preparation GO (board 6926120483) and Rowan's FINAL
IMPLEMENTATION ACCEPTANCE (IMPLEMENTATION PASS; verbatim board
6926057000), whose §4 requirements this proposal answers item by item.
Handoff: RT-H-20261116-c2f0e5
Review pin: PIN-SLOT (repo `jedavid33-design/opal-reader`, branch `ui1-review`;
the Dropbox copy carries the filled pin — the only difference between copies).

**What this proposes:** ONE attended deployment of the accepted A-3
candidate to the production worker, with the scheduler INACTIVE and
NO Cron Trigger created — a dormant deployment. Generation remains
LIVE under the standing release throughout (no halt change, no queue
change). Activation, trigger creation, and platform verification are
later, separately gated steps and are NOT part of this proposal.

## 1. Identities

- **Candidate:** the accepted A-3 implementation, pin
  `7f8b98d4a82f2fb41a88caf0e7a03be5e9a0148b` (path
  `review/ch3-generation/a3-implementation/r4-closure/candidate-tree/`).
  Three parts changed vs the live build; 28 files byte-identical.
  Part hashes (candidate): entry `c5853a70…` (+1730/−77);
  coordinator `ce90852a…` (+145/−10); service `e9f99bd2…` (+34/−0).
  Full manifest: CANDIDATE-MANIFEST.md at that pin.
- **Deployed build identity:** `7f8b98d4a82f2fb41a88caf0e7a03be5e9a0148b`.
  Before the window, the stamped tree is prepared OFFLINE (candidate
  tree + the build-identity substitution in `v2/host/build-identity.mjs`
  only, per the standing build-marker mechanism) and verified: its
  manifest must differ from the candidate manifest in exactly that one
  file. The stamped-tree manifest is filed with the execution record.
- **Rollback candidate:** the pinned recorder-compatible rollback tree
  at the same pin (`rollback-tree/` + ROLLBACK-MANIFEST.md): entry
  `faae80af…` (recorder-only, +245/−22); coordinator/service identical
  to the candidate. **The original A-1 build (`8a16def4…`) is NOT a
  permitted rollback target after A-3 recorder migration** (Rowan,
  acceptance §3).
- **Current live build:** `8a16def42e941790ef2eeb460366bb19ef977801`,
  script ETag `611a23c8aa326160441a33a4b83c0c1a32f6cf2b81c6ad0a53978e9bf29131fb`
  (re-read at census time, unchanged).

## 2. Deploy configuration

Multipart upload of the stamped tree, mirroring the proven A-1
deployment mechanics exactly:
- Metadata: `main_module` = `v2/worker-entry-prod-d6.js`;
  `compatibility_date` `2026-08-29` and `compatibility_flags`
  [`nodejs_compat`] carried from the live settings; bindings carried
  from the live settings GET with secrets as `{"type":"inherit"}`;
  **the live `observability` object carried verbatim in the metadata**
  (the mechanism that prevented the post-upload observability reset in
  all three Nov 14 flips).
- **No schedules in the deploy configuration.** The worker's Cron
  Trigger set is EMPTY today (census §3) and this deployment creates
  none. The scheduler ships inactive: no activation record exists, and
  none is written by the deployment.
- GENERATION_HALT remains `"0"` (the standing release is untouched);
  no settings, queue, containment, or binding changes of any kind.

## 3. Pre-deployment census (taken 2026-11-16 ~14:05 ET, reads only)

1. /health: build `8a16def4…`, generationState **enabled**.
2. Capabilities: Standard admitted; Batch `admitted: false`
   (`batch_not_armed`).
3. Script settings: 10 bindings; GENERATION_HALT `"0"`;
   observability enabled + persisted (logs enabled, persist true);
   compatibility_date 2026-08-29; ETag `611a23c8…` (above).
4. **Schedules (Cron Triggers): [] — empty.**
5. Queue `opalreader-generation-v2`: delivery_paused **false**; sole
   consumer `f260f2188d80426bb0588685e9d084eb`.
6. Containment: NORMAL, known, verified; `updatedAt` 1793933356719
   (unchanged since before the Nov 14 gates).
7. Recorder / S-3 classification: latest pass **505** at
   1794689756514 (complete; `armedAfter` 1794690056225);
   `armedAt` **null**; pendingSchedule 3; pendingWatchdog 1;
   recordingFailures 0. **S-3 stands classified P-ABSENT** — the
   previously recorded registration is no longer observable and no
   handler execution has been recorded since pass 505.
8. Plans: 8 total. Chapter 6 plan `plan:305078b1fba2c5119a86e142`
   **active {14 eligible, 10 done, 0 failed, 0 blocked}**, settled
   188,064, bindingsPublished 10. All other plans unchanged
   (6 complete, 1 retired).
9. Phase accounting (forever-pucked): settled **2,036,610** (verified
   as the exact sum of the eight plans' settled figures); remaining
   11,463,390 of 13,500,000.
10. Quota: PT day 2026-11-16 — attempts 0, dispatches 0, reserved 0;
    ledgerSeq 405; reconcile **ok, drift []**, censusComplete.
    Settings revision 1, monthly cap $50.
11. Repair surface: derivation effectiveStrikes **0**,
    dischargedIntentIds [1], recorderVerified true; cached projection
    strikes 1 (documented; the derivation governs). No repair
    evaluation or acknowledgment is proposed or permitted.
12. Conflicts: exactly **4** rows (ids 1–4), the preserved baseline.
13. Fresh whole-book remainder quote: **263 eligible, 345,561 chars,
    expected 4,871,627 units (≈ $4.87)**, bound_already 144, digest
    `44a63d290df8c39684c3a77e4c7586062e2f8c998c9b15726d0c5771109f36b0`
    (consistent with the release quote minus Chapter 6's 10 commits).
14. Sync watermarks: bindings highWatermark **1893** (1883 + Chapter
    6's 10 published bindings); content 18.

At the execution window this census is REPEATED in full before any
counted act. The executor STOP law applies: any deviation from the
paperwork expectation — even one item, even apparently benign —
stops the gate before mutation, preserves state, and is reported to
Julie and Rowan; only Julie's fresh GO for that deviation proceeds.

## 4. ⚠️ Dormant native-assurance disclosure (Julie's decision item)

Deploying this build is NOT behavior-neutral even before activation,
and this proposal does not describe it as such (acceptance §2):

- The candidate's native pass exit carries the new **exit assurance**:
  when a native pass ends and its exit `getAlarm()` read returns null
  while pending schedule rows exist, it makes ONE arming attempt
  through the coordinator's own containment-gated `_armAlarm()`, and
  classifies the outcome from a read-back (`verified` / `suppressed` /
  `failed` / `read_failed`, recorded on the pass row). The pre-A-3
  build recovers nothing in that shape.
- Consequence for the CURRENT stall: S-3 has pending rows and no
  observable registration — but no native pass is running to exit, so
  the assurance does not fire by itself at deployment. It fires only
  if a native pass subsequently runs (e.g., after any future stimulus
  or spontaneous platform delivery). **If it fires and re-arms, the
  native chain may resume and Chapter 6 may move — under the standing
  release's authority, with no A-3 activation involved.** §6 governs
  that case.
- A numeric read-back is evidence a registration was OBSERVED, not
  proof of native delivery or of correct registration identity.
- The dormant shapes are demonstrated offline (T-A3-28/51/52): healthy
  numeric registration → no act, no change; null + pending → the
  bounded assurance above; failed pass → assurance runs identically,
  original exception preserved.

Julie's execution GO for this proposal constitutes acceptance of this
dormant delta as disclosed.

## 5. Counted acts and ambiguity rules

The deployment window (attended, Julie present) has a strict ceiling
of **TWO counted acts**:

- **Act 1 — the upload.** ONE multipart PUT attempt of the stamped
  tree. It is consumed by the attempt itself: a proven non-landing,
  an ambiguous outcome, or a failure consumes it exactly as a success
  does. There is no second upload attempt under this gate for any
  reason. Outcome is established by read-back only (deployments list
  + script ETag + /health build), never by the PUT response alone.
- **Act 2 — conditional observability restore.** ONLY if the
  post-upload script-settings read shows observability null: ONE
  multipart PATCH to `/workers/scripts/{name}/settings` carrying the
  observability object only, followed by an ETag read-back proving
  the code was untouched. If observability survives the upload (as in
  all three Nov 14 flips), Act 2 is not used and the gate closes at
  one counted act.

No other mutation is authorized in the window: no trigger creation,
no activation write, no halt or queue change, no containment
transition, no repair evaluation, no settings write. **WAIT law
governs throughout:** on a 1101-class fault signature at any point,
all action stops; counted acts already consumed stay consumed; the
gate resumes only on Julie's fresh instruction after the fault
clears, and never by re-attempting an ambiguous upload.

## 6. Spontaneous native recovery / Chapter 6 movement

Separate from A-3 activation, and classified as follows whenever
observed (by the standing watches or any read):

- Any new native pass, registration change, or Chapter 6 plan
  movement after deployment is **native activity under the standing
  release**, reported to Julie immediately (the standing rule:
  spontaneous recovery is reported if observed). It is NOT an A-3
  activation, NOT a deployment defect, and NOT a milestone by itself.
- If the chain resumes and lease adjudication runs, the expected
  branch is the standing one: plan → **10 ready + 1 outcome_unknown +
  3 pending**, zero new generation spend in that step. The unknown
  occurrence's disposition then returns to Julie (her separate
  `ResolveOutcomeUnknown` authorization; nothing in this proposal
  pre-authorizes it). The 3 pending occurrences become grantable only
  after that disposition.
- Milestone classification remains Julie's: completion (14/14) is
  verified by the standing procedure (per-occurrence bindings,
  bindings watermark 1893 → 1897 as corroboration, phase delta,
  reconcile) and closes only on her playback acceptance.
- The pre-existing adoption limitation stands: automatic cache
  adoption through reconciliation is unavailable (`keyFor()` = null,
  separately tracked defect); no outcome may be described as adopted.

## 7. Read-back and post-deployment verification

Immediately after the counted acts, and repeated as a closing census:

1. Deployments list shows the new deployment; script ETag changed
   from `611a23c8…`; /health reports build
   `7f8b98d4a82f2fb41a88caf0e7a03be5e9a0148b`, generationState enabled.
2. Script settings: 10 bindings, GENERATION_HALT `"0"`, observability
   enabled + persisted (or restored under Act 2 with ETag proof).
3. **Scheduler status surface** (`GET /v2/d6-scheduler-status`):
   activation INACTIVE, epoch 0, no activation events, admitted
   watermark null, WAIT hold inactive — the dormant state proven from
   the new build's own surface.
4. **Schedules read-back: still [].** No Cron Trigger exists.
5. Recorder diagnostics: pass 505 still latest (or any change
   classified under §6); registration state as at census or explained
   under §6; recordingFailures 0.
6. Containment NORMAL, `updatedAt` unchanged; quota ledgerSeq 405,
   reconcile ok; plans inventory unchanged (8; Chapter 6 10/14);
   phase settled 2,036,610; conflicts 4.
7. Client sanity: capabilities unchanged (Standard admitted, Batch
   not armed).

Any verification failure is a gate deviation: state is preserved,
nothing further is attempted, and Julie and Rowan are informed with
the rollback criteria in §8 evaluated against the observed facts.

## 8. Rollback — criteria and authorization boundary

- **Target:** ONLY the pinned rollback candidate (§1). Rollback to
  the original A-1 build is prohibited after recorder migration.
- **Criteria (any one suffices to bring the question to Julie):**
  health or capabilities regression attributable to the new build;
  recorder writes malformed or failing (recordingFailures > 0);
  scheduler state other than proven-inactive; containment or
  accounting deviation; any §7 verification failure that does not
  resolve by read-back.
- **Ordering:** (1) confirm no activation exists (there is none by
  construction) and record the in-flight disposition of any active
  pass from the status surface; (2) confirm schedules [] (no trigger
  to remove); (3) upload the rollback candidate under its OWN
  separately counted gate (same two-act ceiling and ambiguity rules);
  (4) post-rollback read-backs mirroring §7, including derivation
  continuity (intent 1's discharge must still derive) and the
  recorder's post-rollback rows remaining well-formed evidence.
- **Authorization:** rollback is NEVER automatic. It requires Julie's
  separate explicit authorization against the observed facts, except
  that the standing foreign-generation re-hold authority (halt first,
  then queue pause) remains in force independently and is not a
  rollback.

## 9. Separately gated follow-ons (not in this proposal)

- **Staging / platform verification:** before any activation proposal,
  the platform behaviors offline tests cannot prove (cron delivery
  and `retry: {maxRetries: 0}` honoring on the real toolchain,
  instance-replacement timing, alarm delivery after re-arm) are
  measured in a separately gated step, staging first where the
  behavior is staging-measurable.
- **Measured infrastructure usage:** the A-3 design's cost accounting
  (incremental DO requests/rows, invocations) is reported with the
  activation proposal from the weekly free-tier check plus the
  scheduler status surface; account-wide free-tier exposure is shared
  with native operations and is stated as such.
- **Activation proposal:** separately drafted and gated after the
  above; it must address the failed-or-ambiguous WAIT-hold
  installation contingency (a hold write that fails while the
  coordinator is unreachable does not establish an active hold, and
  the interval before a hold can be verified must be an explicit
  operational rule). Julie's hold-enabled decision remains binding.
- **Chapter 6 milestone:** open, governed by §6; unaffected by this
  deployment except as §4/§6 describe.

## 10. Authorization requested

Julie's execution GO for exactly: the §3 census repeat, Act 1, and
conditional Act 2, inside one attended window, under §§5–8. Nothing
else. The proposal itself authorizes nothing.

Turn: Rowan's (proposal review).
