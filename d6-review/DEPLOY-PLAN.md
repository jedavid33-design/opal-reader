# D6 Deployment Plan — the provider-secret step and the halted deployment

Drafted Oct 29, 2026, under Julie's recorded D6 Go (board issue #15,
comment 6482364967) and her repo-only BUILD Go (comment 6500347462),
in response to Rowan's CORRECTED SOURCE PASS (comment 6502816606).
Sources: D6-PROPOSAL.md §8 (as amended), BUILD-REPORT.md,
CORRECTION-REPORT.md, and the corrected deploy spec
`impl/worker/p8/deploy-spec-prod-d6.json`. Paper only: this plan
authorizes nothing; every step below is executed only under Julie's
separate approvals (§9).

**Revised Oct 29, 2026 — Revision R-1 (§10)** after Step D attempt 1
rolled back at D4 check 6 (the upload metadata's consumer
declaration was silently not honored; the queue consumer never
attached). Attempt 1's approval covered one attempt; attempt 2
under this revision requires Rowan's review of R-1 and Julie's
**fresh** Step D approval. The affected sections are amended in
place below; everything not amended carries forward unchanged.

## 1. Scope — exactly two steps, nothing else

This plan covers exactly two Julie-approved steps, in this order:

- **Step D — the halted deployment**: the D6 worker code is uploaded
  as a successor version of the **same** production script
  (`opalreader-api-v2-prod`), with `GENERATION_HALT` still `"1"`, the
  new queue's delivery **paused** (attempt 1 already created it —
  Revision R-1 §10; D1 is now verify-only), the queue consumer
  attached via the dedicated Queues consumer endpoint (new step
  D2b — attempt 1 proved the upload-metadata consumer declaration
  is not honored), and full before/after identity verification.
- **Step S — Julie's secret step**: Julie herself sets
  `GEMINI_API_KEY` on the deployed worker, after Step D verifies
  (§3 gives the order and why).

**Not in this plan** (each remains its own later gate): arming (§8
step 5 — the production proofs, the settings CAS write, the halt
flip, delivery enablement), the smoke, any generation, the follow-on
Forever Pucked proposal, The Goal's voice-mapping prompts, and any
action on the parked Ch 3 job (Julie's explicit word, ever).

**The client is not part of this deploy.** The worker deploy is
server-only. The generation-capable client (gen-pkg-1, corrected
delta 8 paths vs ui-pkg-3) is published **after** the halted deploy
verifies, as its own Julie-approved publication following the
established client publish pattern (single commit, served-byte
verification, attended device pass). It is not bundled into Step D:
publishing it earlier buys nothing (its generation controls submit
intents the halted server admits as inert state only), and bundling
would couple a server rollback to a client rollback for no benefit.
Throughout this plan the **live UI3 client keeps working unchanged**
against the deployed worker, because every generation path stays
halted server-side and all pre-existing routes keep their exact
production behavior (proven in the correction suite, C3/C4).

## 2. Fixed points (verified at plan time; re-verified in D0)

- **Script**: `opalreader-api-v2-prod`; current deployed pin
  `1bee2490a35aae971855214b2ce0e6cd43526116`; current script etag
  `d0bf5fefaa8674eac489a04e60f801a5d8c25a3cb9fafdf9f8b9e8cefd443dad`;
  observability enabled + persisted (Workers Logs).
- **Coordinator**: binding `COORDINATOR` → class
  `OpalReaderCoordinatorProd` (the existing class), namespace = the
  script's existing Durable Object namespace, instance = `account`,
  migration tag `v1` (the existing production migration). The D6
  successor binds the **same** class/namespace/instance and applies
  **no** new DO migration (`durable_object_migrations:
  {applied_for_d6: false, new_sqlite_classes: [], new_tag: null}`).
  The generation schema bootstraps in place at coordinator
  construction (DDL-only `CREATE TABLE IF NOT EXISTS`; no reads, so
  the `.one()`-throws hazard cannot occur). Continuity was proven
  before/after on the real SQLite harness (CORRECTION-REPORT §2:
  the digest over all 30 pre-existing tables is identical after
  bootstrap; the only additions are the 8 `d6_*` tables, all empty;
  settings remain at the sealed revision-0 baseline).
- **Settings baseline**: `/v2/settings` =
  `{"monthlyCap":50,"geminiLane":"batch","revision":0}`. This deploy
  does **not** change it; the revision-checked CAS write is an
  arming step, not a deploy step.
- **R2**: bucket `opalreader-storage`, unprefixed `audio/<key>`
  shape (fail-closed in code). Post-deletion verified base:
  **5,736,481,302 bytes / 5,942 objects** (57.4% of the 10 GB free
  tier) after Julie's authorized `chapter-audio/` deletion
  (257 objects, 3,746,296,158 bytes, Oct 29, 2026).
- **Queues**: the v1 queue `opalreader-generation`
  (`e2706b79473d4ece90f37bd784c83386`) keeps exactly one consumer
  (the frozen v1 worker) and stays paused — untouched by every step
  in this plan. The new queue `opalreader-generation-v2` **exists**
  (created in attempt 1, queue_id
  `93b6a35fb8cf4788a91a2c90b748ae66`), delivery **paused**, empty,
  with **no consumer attached**; D1 is verify-only in attempt 2
  (Revision R-1 §10).
- **Source trees**: rollback/deploy basis of record =
  `~/workspace/d5-worker-work/` (git HEAD `1bee2490…`, clean tree).
  D6 code of record = `~/workspace/d6-build/impl/worker/` (corrected
  tree; entry `worker-entry-prod-d6.js`, SHA-256 per
  CORRECTION-REPORT §1.1; spec SHA-256 per §1.2).
- **Secrets**: the two existing production secrets
  (`OPALREADER_ACCESS_TOKEN`, `OPALREADER_MIGRATION_OPERATOR_TOKEN`)
  are Julie-set, unreadable by tooling, and are never re-entered,
  copied, or printed by any step here. `GEMINI_API_KEY` does not
  exist on the script yet; Step S creates it (Julie's hands only).
  No secret **value** appears in this plan, the repo, any log, or
  chat — existence is verified by binding-**name** presence only.

## 3. Step S — Julie's secret step (runs AFTER Step D verifies)

**Order decision: S after D.** Julie sets the secret only once the
halted deploy has passed D4 verification. Reasons: (i) the secret
then never exists on a worker whose deploy is being rolled back —
a rollback re-upload (§7) carries bindings by name, and a secret
set before the upload would have to be listed as an
`{"type":"inherit"}` entry in the upload metadata or be dropped by
it; setting it after removes that failure mode entirely; (ii) the
executor cannot run in the interim regardless — `GENERATION_HALT`
is `"1"` and the queue's delivery is paused, so a not-yet-set
secret blocks nothing; (iii) it matches the D2 token pattern
(Julie sets production secrets herself, after the surface exists).

Mechanics:

1. Julie opens the Cloudflare dashboard for
   `opalreader-api-v2-prod` and adds the secret `GEMINI_API_KEY`,
   pasting the value herself. Wren never sees, receives, logs, or
   transmits the value; no agent tooling is involved in this step.
2. **Existence-only verification** (Wren, read-only): the script's
   bindings/settings listing shows a `secret_text` binding named
   `GEMINI_API_KEY`. The value is never read back (it is not
   readable). The same read confirms the two pre-existing secret
   names are still present and observability is still enabled
   (a dashboard secret addition must not disturb either; if it
   has, stop and report — do not repair in passing).
3. No other change accompanies S: no code upload, no settings
   write, no halt change. `/health` still reports generation
   halted after S; that read-back is taken and filed.

**No top-up is part of this plan.** The Gemini prepay balance is
$17.83 (Julie-verified Oct 29, 2026; auto-reload OFF), and the
Forever Pucked phase budget is $13.50 (Julie's decision). Any
future top-up is a separate Julie decision under her
$20-at-a-time-from-fun rule.

## 4. Step D — halted deployment sequence

Every step lists its verification and its failure handling. On any
failure: **stop the sequence**, leave the system in the last
verified state, report, and take no further step without Julie's
word. Nothing in Step D arms anything: at every moment, the halt
is `"1"`, the new queue's delivery is paused, and the new queue is
empty (nothing can enqueue while halted — the producer seam
`sendGrant` is wired only when the halt is `"0"`; and the consumer,
while halted, throws `GenerationHaltedError` before touching the
coordinator namespace — CORRECTION-REPORT §3).

### D0 — Preflight: read-only identity capture (Rowan gate 1, before)

All read-only; nothing is created or changed.

1. **Script identity**: GET the script's settings + content
   metadata for `opalreader-api-v2-prod`. Record: etag (expect
   `d0bf5fef…`), `compatibility_date` `2026-08-29`, bindings list
   (expect exactly the five specced bindings of
   `deploy-spec-prod.json` plus the two secret names), observability
   enabled + logs persisted. Any mismatch vs §2 → stop.
2. **Coordinator identity/state**: `/health` (expect generation
   `"halted"`); `/v2/settings` (expect the sealed baseline,
   revision **0**); `/v2/quota` (expect attempts 0, spent 0);
   library/binding counts via the existing read surfaces (the
   values the live client reports on Connect: 7 books; per-book
   segment/audio counts as accepted at UI3 — FP 50, FH 152, Goal
   110, IHOL 203, Pucked 307, PU 467, PO 510; bindings 1799/1799).
   This snapshot is the **before** half of the gate-1
   before/after comparison; D4 produces the after half against
   the same surfaces.
3. **Queue inventory** (attempt-2 form — Revision R-1 §10): list
   the account's queues. Expect: `opalreader-generation` present,
   delivery paused, sole consumer the v1 worker;
   `opalreader-generation-v2` **present** with queue_id
   `93b6a35fb8cf4788a91a2c90b748ae66`, delivery **paused**, message
   backlog **0**, producers **[]**, consumers **[]** — the exact
   state attempt 1's rollback left (execution record). Any
   deviation — the queue deleted, renamed, unpaused, non-empty,
   or carrying a producer/consumer — → stop and report; attempt 2
   starts from the known state or not at all.
4. **Fresh R2 recount** (Rowan gate 2, deploy-time baseline):
   full paginated recount of `opalreader-storage` (the repaired
   pagination — 20-object pages via `result_info.cursor`; a bare
   first page is never the bucket). Expect ≈5,736,481,302 bytes /
   5,942 objects; any drift is reported with its size, and a
   drift that would change the storage picture (>1% of the tier)
   stops the sequence for Rowan/Julie visibility. **This recount
   is evidence, not the seed** — the `d6_storage_state` seed is
   taken from a *fresh recount at arming* (§6), never from a
   deploy-time figure that will have aged.
5. **Rollback payload check**: confirm the source-of-record tree
   is still at `1bee2490…` with a clean git status, and confirm
   the D6 tree's entry/spec hashes match CORRECTION-REPORT §1.
   Also re-run the rollback-safety grep (§7) and record its
   result in the evidence pack.
6. **Attempt-2 baselines** (Revision R-1 §10): confirm the script
   etag is still `d0bf5fef…` — attempt 1's rollback restored it
   exactly, so the pre-deploy baseline for attempt 2 **is** the
   rolled-back state, and D0 item 1's expectation is unchanged.
   Confirm the pristine source-of-record tree is still at
   `1bee2490…` with a clean git status — the freshness condition
   on which the carried-forward D5 evidence (§5, R-1) rests;
   attempt 2 does not re-run D5. (No check on the `d6_*` tables
   is specified here: no read-only surface reads inside the
   coordinator store, and none is invented; settings revision 0
   and the D0 counts are the identity checks, as in attempt 1.)

### D1 — Verify the v2 queue state (attempt 2; Rowan gate 4)

(Attempt 1 created the queue — `opalreader-generation-v2`,
queue_id `93b6a35fb8cf4788a91a2c90b748ae66`, delivery paused via
the queue update — and §7 left it in place at rollback. Attempt 2
creates nothing; the original D1 creation text is superseded by
this verify-only form. Revision R-1 §10.)

1. GET the queue by ID. Expect: name `opalreader-generation-v2`,
   `settings.delivery_paused` **true**, backlog/message count 0,
   producers **[]**, consumers **[]**.
2. Failure handling: any deviation from that state (missing,
   renamed, unpaused, non-empty, or carrying a producer/consumer)
   → stop and report, exactly as D0 item 3. Attempt 2 does not
   repair queue state in passing; a changed queue is a changed
   premise, not an execution detail.
3. The verified state is recorded in the evidence pack as the
   attempt-2 D1 read-back. The queue ID recorded in attempt 1's
   evidence is re-confirmed here, not re-derived.

### D2 — Upload the D6 worker code (halted)

1. **Assemble the upload envelope** from the corrected tree per
   `deploy-spec-prod-d6.json`: ES-module multipart upload with
   metadata `main_module` set to the spec's module
   (`worker-entry-prod-d6.js` in the upload's module layout) and
   the file part named exactly that, content type
   `application/javascript+module`. Metadata carries:
   `compatibility_date` `2026-08-29` + `nodejs_compat` (per spec);
   the six specced bindings (COORDINATOR → existing class
   `OpalReaderCoordinatorProd`; R2 `opalreader-storage`;
   `ALLOWED_ORIGIN`; `OPALREADER_V2_SCOPE` = `production`;
   `GENERATION_HALT` = **`"1"`**; queue producer binding
   `OPALREADER_GENERATION_V2` → `opalreader-generation-v2`);
   the queue **consumer** declaration for the same queue on this
   script (max_batch_size 10, max_retries 3, per spec) — retained
   exactly as specced, but **inert**: attempt 1 proved the upload
   metadata's consumer declaration is silently not honored (the
   producer binding from the same metadata materialized; the
   consumers list stayed empty on every read-back). Attachment
   is performed by step D2b, not by this envelope; the two existing
   secrets as `{"type":"inherit","name":…}` entries so their
   bindings carry forward untouched; **no** `GEMINI_API_KEY`
   binding (it does not exist yet — Step S adds it afterward);
   **no** new DO migration — the migrations metadata names the
   existing `v1` migration only, with **no** `new_sqlite_classes`
   and no new tag (pairing this upload with any new-class entry
   would start an empty store: a data-loss defect, per the spec's
   continuity warning). The workers.dev subdomain is already
   enabled for this existing script — no action.
2. **Validate before transmitting**: build the exact multipart
   envelope in memory and assert it with a D6-adapted envelope
   check derived from `tools/validate-prod-envelope.mjs`. (The
   existing validator asserts the *pre-D6* topology — no queue
   binding, exactly five bindings — so it is **not** run
   unchanged; the D6 check asserts the corrected invariant set:
   DO class name == the class the entry exports ==
   `OpalReaderCoordinatorProd`; `new_sqlite_classes` absent;
   queue producer+consumer exactly as specced; `GENERATION_HALT`
   `"1"`; scope `production`; no `R2_KEY_PREFIX`; no `secret_text`
   values anywhere in the payload — inherit entries only.)
   Validation failure → stop; nothing is transmitted. (The check
   still asserts the consumer declaration is present as specced;
   D2b, not the validator, is what makes the attachment real.)
3. **Upload** (single PUT). Record the response etag — the script
   etag is expected to **change** here (new code); the new value
   is filed as the deployed-D6 etag.
4. Failure handling: a rejected upload (4xx/5xx) leaves the live
   script untouched — verify `/health` still answers and stop.
   A upload whose outcome is *unknown* (timeout/disconnect) is
   resolved by read-back (script etag + `/health`) before any
   next step; never re-upload blind.

### D3 — Re-apply observability (standing Cloudflare lesson)

A code upload resets script-settings observability to null —
Workers Logs silently turn OFF. Immediately after D2:

1. GET `/workers/scripts/opalreader-api-v2-prod/script-settings`;
   if observability is null (expected), re-apply it with the
   settings-only **multipart PATCH to
   `/workers/scripts/opalreader-api-v2-prod/settings`** (NOT
   `/script-settings`, which rejects writes): a single part named
   `settings` (application/json) carrying observability enabled +
   logs persisted, matching the spec.
2. **Verify**: read back script-settings — observability enabled +
   persisted; **and** confirm the script **etag is unchanged**
   by the settings PATCH (the PATCH must not touch code). An etag
   change here → stop and report (it would mean the code of
   record is no longer what D2 uploaded).

(Attempt-1 note: observability **survived** the upload — the
upload metadata carried the spec's observability object — so D3
was satisfied by read-back and no PATCH was sent. The check +
conditional re-apply stands; the null-reset case is uploads whose
metadata omits or resets observability. Attempt 2's upload
metadata again carries the object.)

### D2b — Attach the queue consumer (the attempt-1 mechanism fix)

Runs after D3, before D4. Attempt 1's root cause (execution
record): the D2 upload metadata's `queues.consumers` entry did
not create a consumer — attaching a consumer requires the
dedicated Queues consumer endpoint, a step the original plan did
not write. This step writes it.

1. **Attach**: `POST /client/v4/accounts/{account_id}/queues/93b6a35fb8cf4788a91a2c90b748ae66/consumers`
   with JSON body:

   ```json
   {
     "type": "worker",
     "script_name": "opalreader-api-v2-prod",
     "settings": { "batch_size": 10, "max_retries": 3 }
   }
   ```

   (`script_name` is the documented top-level field identifying
   the consumer Worker; `settings.batch_size` / `max_retries`
   carry the spec's batch 10 / retries 3. No dead-letter queue
   is configured — none is specced.) The documented consumer
   schema carries **no environment field** — the consumer
   targets the named script. Which deployment of that script the
   attachment resolves to is **TO BE CONFIRMED BY READ-ONLY
   PROBE**: the item-2 read-backs below must show the consumer
   on `opalreader-api-v2-prod` with the specced settings, and
   arming step (b) re-verifies the routing against the live
   handler while delivery is still paused (§6). If the
   read-backs cannot establish that, it is a stop, not a shrug.
2. **Read back, three ways** (all filed):
   a. `GET …/queues/{queue_id}/consumers` — exactly one consumer:
      `type` `worker`, `script_name` `opalreader-api-v2-prod`,
      `settings.batch_size` 10, `settings.max_retries` 3. Record
      the assigned `consumer_id` in the evidence pack (§7's
      rollback needs it).
   b. `GET …/queues/{queue_id}` — `settings.delivery_paused`
      still **true**; backlog still 0; producers now list
      `opalreader-api-v2-prod` (from D2's binding).
   c. If (a) or (b) disagrees with any expectation → stop;
      §7 governs.
3. **Delivery stays paused — a hard stop condition.** Attaching
   a consumer must not enable delivery, and this step performs
   no unpause. If any read-back in D2b shows `delivery_paused`
   false, stop immediately and re-pause via the queue update
   (PUT the queue with `queue_name` +
   `settings.delivery_paused: true` — the mechanism attempt 1
   used) before anything else; if the re-pause cannot be
   verified, §7 rollback. Delivery is enabled only at arming
   step (d), under its own authorization — never here.
4. **Failure handling**: a rejected POST (4xx/5xx) leaves the
   queue exactly as D1 verified (paused, empty, unattached) —
   stop and report; do not retry with improvised payload
   variants (a variant is a plan change, not an execution
   detail). An unknown-outcome POST is resolved by read-back
   (item 2a) before any next step; never re-POST blind.

### D4 — Post-deploy read-only verification (Rowan gates 1, 5 — after)

All read-only. No intent is submitted, no command is sent, no
proof is run against production data in this step (the proofs are
arming preconditions, §6). Attempt-2 ordering: D2b's consumer
read-backs precede this step, and check 6 re-reads the same
surfaces here before the D4 verdict is reported.

1. `/health` → generation still **`"halted"`** (gate 5).
2. `/v2/settings` → still the sealed baseline, **revision 0**,
   lane still `batch` — the CAS arming write has NOT happened.
3. `/v2/quota` → attempts 0, spent 0, parked null.
4. **Identity/data comparison vs D0** (gate 1, after): same
   library/binding counts on the same read surfaces (7 books;
   per-book counts as in D0; bindings 1799/1799). Any difference
   → stop; treat as a failed deploy and go to §7. (The
   coordinator's first wake under the new code runs the additive
   schema bootstrap; the comparison surfaces are the pre-existing
   tables' contents, which the correction proof showed
   byte-identical across that bootstrap.)
5. **Client check (attended)**: Julie opens the live UI3 client,
   Connects, and plays an already-bound segment. Expect: Connect
   succeeds against the deployed worker, library counts match
   D0, playback works. This is attended because only Julie's
   devices can prove the real client path; the read-only API
   checks above cannot substitute for it. A Connect or playback
   failure → §7.
6. **Queue state** (the check that failed in attempt 1):
   `opalreader-generation-v2` still delivery-**paused**, message
   count 0, and — per D2b's attachment, re-read here — **exactly
   one consumer**: `script_name` `opalreader-api-v2-prod`, batch
   10, retries 3, with the `consumer_id` recorded at D2b. This
   read-back is the deploy-time half of arming step (b): arming
   will re-verify the routing while delivery is still paused;
   nothing about D4 enables flow.
7. **Untouched neighbors**: the v1 worker `opalreader-api` still
   serves its frozen surface; the v1 queue
   `opalreader-generation` still paused with its sole v1
   consumer; the staging script untouched. Read-only confirmation
   of each, filed.

### D5 — Deploy evidence pack

Assembled and pinned for Rowan's review before Step S is
considered complete (S's own existence check is appended when it
happens):

- D0 and D4 snapshots side by side (script etags before/after,
  bindings, settings, quota, counts, queue states, R2 recounts).
- The D2 upload record: envelope validation output, the new
  script etag, the D3 settings read-backs (observability restored,
  etag unchanged by the PATCH).
- **Attempt-2 additions**: the D1 verify-only read-back, the D2b
  attachment record (POST result, the assigned `consumer_id`,
  and the three read-backs), and the D5 suite evidence **carried
  forward from attempt 1** (§5/R-1: filed under
  `deploy-evidence/pristine-suites/`, cited, not re-run).
- The battery state of the deployed tree (the correction
  package's final runs) **plus the disposition of the 22
  environment/fixture failures** from the correction retest
  (§5) — Rowan requires each resolved or justified in the final
  deploy evidence; this plan resolves them by re-running them in
  their proper context, below.

## 5. Disposition of the 22 environment/fixture failures

The correction retest ran all 106 worker test files individually
in the impl tree: 84 exit 0; 22 exit 1, **every one an
environment/fixture failure with zero assertion failures**
(CORRECTION-REPORT §5). They fall in exactly two classes, and the
deploy evidence resolves both by **running the suites where they
belong** — the pristine source-of-record checkout
(`~/workspace/d5-worker-work/`, git HEAD `1bee2490…`, clean tree),
which contains every legacy fixture and is a real git checkout —
rather than by arguing them away:

- **Class A — 20 legacy-fixture `ENOENT` suites.** Each loads a
  legacy v1 client entry (`app-227.js`…`app-255.js`) that was
  never copied into the impl tree (the tree holds only
  `app-256.js`); the failure is a missing file at load time,
  before any assertion runs. Suites: `adaptive-background-repair`,
  `audio-chunk-playback`, `chapter-quota-banner`,
  `continue-preparation-progress`, `continue-setup-recovery`,
  `continue-to-quota`, `cross-device-chapter-handoff`,
  `dormant-playback-start`, `first-chapter-segment-joining`,
  `gemini-400-hydration`, `gemini-batch-lane`,
  `gemini-quota-diagnostics`, `generation-manual-queue-reuse`,
  `generation-playback-concurrency`,
  `generation-session-sync-guard`, `playback-bookmarks`,
  `restore-sound-rewind`, `silent-audio-recovery`,
  `split-first-update-stop`, `sync-diagnostics`.
  **Resolution**: at D5, run all 20 in the pristine checkout
  (where the fixtures exist) and file their full logs + exit
  codes in the evidence pack. Expected: pass — they exercise the
  pre-D6 code, which is unchanged, in its native layout. Any
  suite that still fails in its proper context is **not**
  waved through: it is reported in the evidence pack with its
  log, and the deploy does not proceed to Step S until Rowan
  dispositions it. (These suites cannot regress this deploy in
  the other direction either: none of them loads any file the
  D6 correction touched, and the D6-relevant suites — all 11
  coordinator suites, `p8-d3-production-surface`, and the 77 D6
  tests — already pass on the corrected tree.)
- **Class B — 2 git-required tooling suites.**
  `p8-d3-prod-envelope` and `p8-upload-envelope` shell out to
  `git` and pin artifacts to the repo's HEAD; the impl tree is
  not a git checkout, so they cannot run there at all.
  **Resolution**: run both in the pristine checkout at D5 and
  file the logs. A control already exists for one:
  `p8-upload-envelope` passes **14/14 on the pristine source**
  (BUILD-REPORT §6) — the D5 run re-confirms it on the day
  rather than citing a stale control. `p8-d3-prod-envelope`
  validates the *pre-D6* production envelope in that context;
  the D6 envelope itself is validated at D2 by the adapted check
  (§4 D2.2), whose output is also filed. If either suite fails
  in the pristine checkout, same rule as Class A: reported, not
  justified away, and Step S waits for Rowan's disposition.

After the D5 runs, the deploy evidence accounts for **106/106**
worker suites with a passing run in a stated context, plus the
client batteries (all exit 0 on the corrected tree) — no suite is
left carrying an unexplained exit 1.

**Carried forward (Revision R-1)**: this disposition is **done**.
All 22 suites were run in the pristine checkout at attempt 1's
D5 — **22/22 suites, 136 tests, 0 failures** — and the evidence
is filed (`deploy-evidence/pristine-suites/`: SUMMARY.md,
results.tsv, 22 logs). Attempt 2 does **not** re-run D5; the
evidence carries forward under one freshness condition, checked
read-only at D0 (item 6): the pristine tree is still at HEAD
`1bee2490…` with a clean git status. If that check fails, the
carried-forward evidence is void and the D5 runs are re-done
before Step S is considered.

## 6. What this deploy sets up for arming (without performing it)

Arming remains §8 step 5, separately authorized, in its exact
order with per-step rollback (restore halt `"1"`, pause delivery,
void pending dispatches). This plan only positions its
preconditions:

- **(Rowan gate 3) The five production content-plane proofs** —
  completeness, ID-set equality, POV resolution, no-silent-skips,
  and the **exact parked Ch 3 27-ID reconciliation** (27 rows:
  idx 0–2 bound + parked-ready; idx 3–25 unbound +
  parked-pending (23); idx 26 unbound + absent from the parked
  job; the Ch 3 POLICY_BLOCK-record occurrence named) — run
  against deployment-bound (production) data as **arming
  sub-step 0**, results filed, before the arming sequence starts.
  They are **not** run at deploy: D4 is read-only health/identity
  verification, and a proof failure at arming means arming does
  not start (nothing to roll back). The build proved the same
  suite against fixtures and the frozen census (BUILD-REPORT
  §7); the production run is the confirmation, not a first
  attempt.
- **(Rowan gate 2) The storage seed**: at arming sub-step 0,
  alongside the proofs, a **fresh** full R2 recount is taken and
  `d6_storage_state` is seeded from that figure (the guard then
  enforces base + committed D6 bytes + projected remainder
  against the 10 GB boundary, fail-closed). Neither the PINS-era
  base (9,482,777,460 B — superseded) nor the D0 deploy recount
  is used as the seed; both are evidence only.
- **Consumer routing**: attached by the Queues consumer endpoint
  at D2b (attempt 1 proved the upload metadata does not attach
  it); arming step (b) re-verifies the attached consumer is
  correctly routed while delivery is still paused.
- **Settings CAS**: arming step (a) — revision-checked
  (exactly 0 → 1, lane → standard, cap untouched); a stale
  revision stops arming, never overwritten.
- **Halt flip** (c) and **delivery enabled LAST** (d), each
  read-back-verified, per §8.

## 7. Rollback (any time before arming)

**Triggers**: any D4 check fails; D2b fails to attach or verify
the consumer (or delivery is found unpaused at any point in the
sequence); the D5 pristine-context runs surface a real failure
Rowan does not disposition; Julie says stop at any point.

**Procedure** (the mirror of D2–D3):

1. Re-upload the **current deployed code** — the pre-D6 worker
   from the source-of-record tree at pin `1bee2490…` — as the
   script's next version, with the **pre-D6 bindings** exactly as
   `deploy-spec-prod.json` (the five specced bindings + the two
   inherit secret entries; **no** queue producer/consumer
   bindings), envelope-validated the same way as D2.
2. Re-apply observability per D3 (the rollback upload resets it
   too — the standing lesson applies to *every* upload) and
   verify the etag is unchanged by that settings PATCH.
3. **Verify the rollback** on the D4 surfaces: `/health`
   (generation halted), `/v2/settings` revision 0, `/v2/quota`
   zeroed, library/binding counts identical to D0, and Julie's
   attended client Connect + playback check. The deployed
   payload is byte-compared against the source-of-record tree
   as part of the upload record.
4. **The queue and its consumer** (attempt-2 form): on rollback,
   **remove the consumer attachment first** —
   `DELETE /client/v4/accounts/{account_id}/queues/93b6a35fb8cf4788a91a2c90b748ae66/consumers/{consumer_id}`
   with the `consumer_id` recorded at D2b — then verify by
   read-back (`GET …/consumers` → empty; GET the queue →
   `delivery_paused` true, backlog 0, producers []). The queue
   itself is then left in place — created, empty, delivery
   paused, unattached — exactly the state attempt 1's rollback
   left and verified.
   Why removal is explicit rather than left to the re-upload:
   consumers are **queue-side state**, managed through the
   consumer endpoint. Attempt 1's evidence is that the upload
   flow governed the queue's *producer* listing (it appeared
   with the D6 upload and cleared with the rollback upload) but
   never created a *consumer* at all; whether a re-upload would
   remove an attached consumer is not evidenced either way, and
   the rollback does not rest on unevidenced behavior — it
   removes the attachment itself and reads the result back.
   The end state is safe on every path regardless: delivery is
   paused and the queue is empty, and the rolled-back worker
   **cannot consume even if delivery were later enabled** —
   verified, not assumed: the pre-D6 entry exports no queue
   handler (`export default { fetch: fetchHandler }` is its
   entire default export; `worker-entry-prod.js` states the
   absence outright), so there is no handler for the platform
   to invoke. Deleting the queue itself gains nothing, costs a
   separate Julie-gated cleanup decision, and a paused empty
   queue is inert; if the D6 case later resumes, it is reused.
   (If Julie prefers queue deletion, that is her separate word,
   executed as its own step — never folded into a rollback
   under time pressure.)

**No data reversal is needed — verified, not assumed.** The D6
schema bootstrap is additive-only (8 new `d6_*` tables;
CORRECTION-REPORT §2 proves every pre-existing table byte-
identical across it). The pre-D6 code never references those
tables: a full-tree grep for `d6_` over the entire pre-D6 worker
source (`~/workspace/d5-worker-work/v2/` — coordinator, API,
executor, entries, host, migration; performed at plan time)
returns **zero** matches, so the rolled-back worker simply
ignores the new tables, which sit empty (no intent can have
created plans while halted — and D4 verified grants/outbox/
executions at zero through the deploy's own read surfaces).
Settings were never written (revision still 0), the halt was
never flipped, and no audio object was created. Rollback
therefore restores the exact pre-deploy worker behavior with
nothing to unwind. After arming, this section no longer applies
— the §8 re-halt path governs instead.

## 8. Costs

**Zero.** Workers, Durable Objects (SQLite), R2, and Queues all
stay inside the account's free-tier allowances: queue creation
is free and queue operations cost $0 within the 10,000 ops/day
free allowance (projected peak ≈300 ops/day at full quota pace,
and zero while halted/paused); the deploy adds no storage (the
schema bootstrap is eight empty tables in the existing
coordinator store); no paid tier, no per-request charge, no
Gemini spend (the executor never runs under this plan). The
standing free-tier watch continues to track the boundaries.

## 9. Decisions for Julie

**Approving this plan authorizes exactly:**

1. **Step D (attempt 2, Revision R-1)** — under Julie's **fresh**
   Step D approval (attempt 1's covered one attempt): D0's
   read-only captures incl. the queue-state and pristine-tree
   freshness checks; verifying the existing queue's
   paused/empty/unattached state (D1 — verify-only, no
   creation; the queue exists from attempt 1); uploading the
   corrected D6 worker code to `opalreader-api-v2-prod` with
   `GENERATION_HALT` `"1"` and the specced bindings (D2);
   re-applying observability if needed (D3); attaching the
   queue consumer via the Queues consumer endpoint, with
   read-backs (D2b); the D4 read-only verifications incl. her
   attended client check; assembling the D5 evidence pack (the
   22 pristine-context suite runs carried forward from
   attempt 1 — §5/R-1, not re-run) — and, if a trigger fires,
   the §7 rollback incl. consumer removal.
2. **Step S** — Julie setting `GEMINI_API_KEY` herself on the
   deployed worker after D4 verifies, with existence-only
   (binding-name) verification afterward.

**Approving this plan does NOT authorize:** arming in any part
(the production proofs, the settings CAS write, the halt flip,
delivery enablement); publishing the gen-pkg-1 client (its own
step, §1); the smoke (synthetic or real-segment); any generation
or Gemini spend; any Gemini top-up; resuming or touching the
parked Ch 3 job; any change to the v1 worker or its queue; or
deleting the new queue. Each of those remains Julie's separate,
explicit decision.

## 10. Revision R-1 (Oct 29, 2026) — Step D attempt 2

### 10.1 What happened in attempt 1

Step D attempt 1 ran under Julie's Step D approval and this
plan's original text. **D0 passed on every value. D1 created**
`opalreader-generation-v2` (queue_id
`93b6a35fb8cf4788a91a2c90b748ae66`) with delivery paused. **D2's
upload succeeded** through the D6-adapted envelope validation
(18/18 checks), and the deployed bytes verified 26/26 against
the validated envelope. **D3 was satisfied by read-back**:
observability survived the upload (the upload metadata carried
the spec's observability object), so no settings PATCH was
needed — the plan's D3 check + conditional re-apply stands,
scoped by this experience: the null-reset case is uploads whose
metadata omits or resets observability.

**The failure — D4 check 6.** The queue read-back showed
`delivery_paused: true`, backlog 0, producers
[`opalreader-api-v2-prod`] — and **consumers: []**. The D2
upload metadata's `queues.consumers` declaration was silently
not honored: the producer binding from the same metadata
materialized, but no consumer was ever created. Attaching a
consumer requires the dedicated **Queues consumer endpoint** —
`POST /client/v4/accounts/{account_id}/queues/{queue_id}/consumers`,
with the consumer Worker identified in the body
(`script_name`) — a step the original plan did not write: it
specified the consumer as upload metadata. Per the plan's own
stop rule, the sequence did **not** improvise the unwritten
step mid-flight; §7 rollback executed instead.

**Rollback, verified** (§7 as written): the pre-D6 code was
re-uploaded from the source-of-record tree and production was
restored exactly — script etag
`d0bf5fefaa8674eac489a04e60f801a5d8c25a3cb9fafdf9f8b9e8cefd443dad`
(the etag is a content/config hash: bit-for-bit the pre-deploy
deployment), build `1bee2490…`, generation halted, settings
revision 0, counts identical to D0, observability enabled. The
queue remains per §7: empty, paused, producers [] and consumers
[] (unattached). The 8 `d6_*` tables created by the
deploy-window bootstrap remain in the coordinator store, empty,
ignored by the restored code (zero `d6_` references in the
pre-D6 source, re-verified at attempt 1's D0). Step S was not
performed; nothing was armed; no secret was set or read; no
generation ran; nothing was spent. Full record:
`deploy-evidence/D1-D4-and-rollback-record.md` and
`deploy-evidence/D0-snapshot.md`.

### 10.2 What R-1 changes (step by step)

1. **D0** gains attempt-2 baselines (new item 6): the script
   etag is still `d0bf5fef…` (the rolled-back state **is** the
   attempt-2 baseline); the queue inventory (item 3) now expects
   the v2 queue **present / paused / empty / unattached** and
   stops on any deviation; the pristine source-of-record tree
   is still at `1bee2490…` with a clean git status (the
   freshness condition for the carried-forward D5). No `d6_*`
   tables check is specified — no read-only surface reads
   inside the coordinator store, and none is invented; settings
   revision 0 + the D0 counts carry the identity argument, as
   in attempt 1.
2. **D1 is verify-only.** The queue exists; attempt 2 creates
   nothing and repairs nothing. Any deviation from
   paused/empty/unattached is a stop, as in D0.
3. **D2** is unchanged except the consumer declaration's status:
   retained in the envelope for parity with the passed spec,
   and documented as **inert** on attempt 1's evidence. Envelope
   validation, the upload itself, and the unknown-outcome rule
   (resolve by read-back, never re-upload blind) are as written.
4. **D3** is unchanged (check + conditional re-apply), with the
   attempt-1 scoping note added: the PATCH fires when the
   upload metadata omits/resets observability; attempt 2's
   metadata again carries the object, so read-back satisfaction
   is the expected path.
5. **New step D2b** (after D3, before D4): attach the consumer
   via `POST …/queues/93b6a35fb8cf4788a91a2c90b748ae66/consumers`
   with body
   `{"type":"worker","script_name":"opalreader-api-v2-prod","settings":{"batch_size":10,"max_retries":3}}`;
   record the assigned `consumer_id`; read back the consumer
   list, the paused state, and the backlog. **Delivery stays
   paused — a hard stop condition**: if attaching or any
   read-back shows delivery enabled, stop and re-pause (queue
   update PUT) before anything else; if the re-pause cannot be
   verified, §7. The documented consumer schema has no
   environment field; which deployment of the named script the
   attachment resolves to is **TO BE CONFIRMED BY READ-ONLY
   PROBE** — the D2b/D4 read-backs must show the consumer on
   `opalreader-api-v2-prod` with the specced settings, and
   arming step (b) re-verifies the routing against the live
   handler while delivery is still paused (§6). A payload
   variant is a plan change, never an execution improvisation.
6. **D4 check 6** now passes or fails on D2b's attachment,
   re-read in D4: exactly one consumer on the correct script,
   batch 10 / retries 3, the recorded `consumer_id`; queue
   still paused and empty. Checks 1–4 and 7 are unchanged, and
   Julie's attended Connect/playback check (check 5) remains in
   D4 as before (it was not reached in attempt 1).
7. **§7 rollback** gains the consumer. Triggers now include a
   D2b attach/verify failure or delivery found unpaused. The
   procedure removes the consumer attachment **first** (DELETE
   on the consumer endpoint with the recorded `consumer_id`,
   verified by read-back), so the end state is the one
   attempt 1 verified — queue empty, paused, unattached. The
   reasoning is stated in §7.4: consumers are queue-side state;
   the rollback upload's effect on an attached consumer is
   unevidenced either way, so removal is not left to it; and
   the rolled-back worker exports no queue handler, so it
   could not consume even if delivery were later enabled.
8. **D5 carries forward** (§5 note): 22/22 suites, 136 tests,
   0 failures, evidence filed under
   `deploy-evidence/pristine-suites/`. Attempt 2 does not
   re-run D5; its only condition is the D0 freshness check on
   the pristine tree. Rowan's deploy-evidence requirement is
   satisfied for attempt 2 exactly as for attempt 1.

### 10.3 What does not change

Step S still runs after Step D verifies, Julie's hands only,
unchanged (§3). Arming is untouched and separately gated (§6):
the five production proofs incl. the exact parked Ch 3 27-ID
reconciliation, the storage seed from a fresh arming-time
recount, the settings CAS write, the halt flip, delivery
enabled LAST — each with §8-of-the-proposal rollback. The
rollback basis is unchanged (pin `1bee2490…` code from the
source-of-record tree). Costs remain zero (§8). Rowan's six
execution conditions from the source pass still apply; the ones
this revision touches are restated where they now live: queue
delivery paused until arming step (d) (D1, D2b, D4.6 verify it
at every read-back), consumer attach + routing verification
(D2b, D4.6, and arming step (b)), and rollback only to the
pinned worker with observability restored (§7, now incl.
consumer removal).

### 10.4 Approvals attempt 2 needs

- **Rowan's review of this revision** — the mechanism change
  (D2b, D1 verify-only, §7 consumer removal) is a plan change,
  and plan changes are reviewed before execution.
- **Julie's fresh Step D approval** — attempt 1's approval
  covered one attempt, and that attempt is complete (rolled
  back). Nothing in attempt 1's approval, the BUILD Go, or the
  source pass carries into attempt 2.

**Attempt-2 step list**: D0 (with the new baselines) → D1
(verify-only) → D2 → D3 → **D2b (new)** → D4 (check 6 on D2b's
read-backs) → D5 (carried-forward suite evidence + the
attempt-2 pack) → Step S (§3, after D verifies). On any
failure at any step: stop, and §7.
