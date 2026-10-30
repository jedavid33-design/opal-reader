# gen-pkg-1 DEPLOY PLAN — DRAFT for Rowan's review

**Status: DRAFT — authorizes nothing. FILED COPY** for Rowan's
evidence review — this review-only evidence package
(`review/gen-pkg-1-deploy/` on `ui1-review`, parent = the signed
pin `5ae38942e493a4b53f541b5e1f589060d58d158d`; see `README.md`
in this directory). Prepared by Wren under
Rowan's round-6 SOURCE SIGN-OFF (board issue #15, comment
6523652449), condition B: no live deploy without an approved,
pinned operational plan, and no blanket approval — each step
below is its own Julie decision. The candidate is the signed
pin `ui1-review` **`5ae38942e493a4b53f541b5e1f589060d58d158d`**
(parent `ac9558f4…`). The actual-D6-envelope proof required by
condition A is complete and filed alongside this plan
(`logs/deploy-plan/ENVELOPE-PROOF-REPORT.md`: 18/18 PASS,
three negative proofs FAIL as required, candidate tree
byte-identical).

## The decisions Julie will be asked, in order

1. **Deploy the new worker.** It lands *paused*: listening and
   playback keep working exactly as now, but generation stops
   (it is currently switched on) and stays stopped until a
   later, separate decision by you. Nothing is generated and
   nothing is spent by the deploy itself.
2. **Write the Forever Pucked budget binding** — one
   operator-only record that ties the "forever-pucked" budget
   to Forever Pucked, checked by read-back. Until this is
   written, the new worker refuses *all* new generation
   requests (that refusal is the safety feature working).
3. **Publish the new app version** — the update that adds the
   in-app Generate controls and the Generation view. Your
   books, audio, and settings do not move.

**Not in this plan — each is a later, separate decision:**
turning generation back on (the re-arm: halt flip + queue
delivery), anything about Chapter 2 (reconciling its one
unconfirmed billing record, retiring its halted plan, or
retrying it), Chapter 3's parked job, and Batch arming.

---

## Gate 1 — Worker deploy of pin 5ae38942 (Julie's decision 1)

Follows the proven G4 / seed-fix D0–D4 procedure with the
gen-pkg-1 tree substituted.

### D0 — Pre-state capture (read-only; all values recorded to the gate's evidence dir)

Expected values are the last verified state (Oct 29, 2026);
**any difference is recorded and assessed before proceeding —
a moved value is a STOP until explained.**

| Check | Surface / command | Expected (Oct 29 record) |
|---|---|---|
| Live worker build + etag | `cf-api GET /client/v4/accounts/b35ff435ff24d134ff640e0099dd13fc/workers/scripts/opalreader-api-v2-prod` (etag from response **headers**) + `v2prod-api GET /health` | build `ac451df8b772ddc3f64d4c6418678ce78b243d58`; etag `37b464ac1c2f1d7913da82e85e09638ad7e1b5c6021e3406c6cc4a5ddb9df675`; /health generation `"enabled"` |
| Deployed bindings | `cf-api GET …/workers/scripts/opalreader-api-v2-prod/settings` (names/types only; bindings are **not** at `/script-settings`) | 9 names: COORDINATOR → `OpalReaderCoordinatorProd`, OPALREADER_STORAGE, ALLOWED_ORIGIN, OPALREADER_V2_SCOPE = production, GENERATION_HALT `"0"` (armed), OPALREADER_GENERATION_V2 (queue) + 3 secret names (OPALREADER_ACCESS_TOKEN, OPALREADER_MIGRATION_OPERATOR_TOKEN, GEMINI_API_KEY) |
| Observability | `cf-api GET …/workers/scripts/opalreader-api-v2-prod/script-settings` | enabled, head_sampling_rate 1, logs enabled + persisted |
| Settings / quota | `v2prod-api GET /v2/settings`, `GET /v2/quota` | settings revision **1**, lane standard, cap $50; quota figures as recorded at G10/Ch-2 time (grant-time *estimates* — recorded as read, never presented as provider spend) |
| Plan states | `v2prod-api GET /v2/d6-plans/plan:603ab416bd67ab1b25de97be`; `GET /v2/jobs/1832c21fcf0425454227c4736048a8a632f422abca4a2685ddb775bb1681406a` | Ch 2 plan `halted_unknown` / `phase_halted_unknown_billing` (8 failed / 1 unknown / 9 unattempted, 0 committed); Ch 3 job `parked_policy`, fingerprint prefix `b991f18a…` |
| Sync watermarks / counts | `v2prod-api GET /v2/sync/snapshot?family=content` and `?family=bindings` (headers/summary only) | content 18, bindings **1800**; 7 books / 2,610 segments / 1,799 binding rows |
| Queue state | `cf-api GET /client/v4/accounts/{acct}/queues/93b6a35fb8cf4788a91a2c90b748ae66` + `GET …/queues/{id}/consumers` | queue `opalreader-generation-v2`, delivery ENABLED, sole consumer `f260f2188d80426bb0588685e9d084eb` on `opalreader-api-v2-prod` (batch 10 / retries 3) |
| Neighbors | `cf-api GET` script etags for v1 + staging; v1 queue read | v1 etag `ea6f8196…`, v1 queue `e2706b79473d4ece90f37bd784c83386` paused, sole consumer = v1 worker; staging etag `61553a07…` |
| Prepay | Julie's AI Studio screenshot (her step — no agent surface exists) | $17.83 as of Oct 29; recorded as reported. The deploy spends nothing, so this is record-only. |
| Rollback base | Download the live script's 26 parts to the gate evidence dir (the seed-fix `pre-deploy-archive/` pattern) and hash them | Parts match the `ac451df8` package hashes on record |

### In-flight assessment — QUIESCENT deploy required

This plan deploys only into a quiescent system, which is the
current state and must be **re-verified immediately before the
upload**: (a) two reads of the D6 plan list + `/v2/quota`,
minutes apart, show **no active plan** and **no change** in
attempts/spent; (b) Ch 2 still `halted_unknown`, Ch 3 still
`parked_policy` with the recorded fingerprint; (c) no SyncPush
or settings command in flight (settings revision still 1).
If anything is active or moving, the deploy waits — there is
no "explicitly justified in-flight" variant of this plan.

### D1 — Envelope re-verification (no production contact)

Re-run `logs/deploy-plan/proof-d6-envelope.mjs` against the
candidate tree at gate time. The assembled envelope must be
byte-identical to the proof artifact (SHA-256
`2f5ce34ee47b822de9829890ae9878447c361d5f89abbe5440852d0a4f39e5f1`
/ metadata `e08b06bc…`), the tree digest must still be
`2d16fe29…`, and the `ui1-review` ref must still read
`5ae38942…`. **Any mismatch = STOP** (Rowan, condition A).

### D2 — Halt-first sequencing, then the upload

1. **Pause queue delivery first**: `cf-api PUT …/queues/93b6a35f…`
   with `{"queue_name":"opalreader-generation-v2","settings":{"delivery_paused":true}}`
   (cf-api bodies are a positional argv JSON string — a `--data`
   flag is silently ignored; **read back** and confirm
   `delivery_paused == true`). From this moment no queue message
   can be consumed, by either build, across the swap.
2. **Upload** the validated envelope: multipart PUT to
   `…/workers/scripts/opalreader-api-v2-prod` — ES-module form:
   metadata part with `"main_module": "v2/worker-entry-prod-d6.js"`,
   each module part named with a `filename` attribute and
   content type `application/javascript+module`; existing
   secrets sent as `{"type":"inherit","name":"..."}` (never
   values); `compatibility_date` 2026-08-29 + `nodejs_compat`
   preserved from the spec. Consumer declarations in upload
   metadata are silently ignored by the API — the consumer is
   **not** (re)attached here; it is verified by read-back at D4.
3. Record the PUT response (new etag, deployment_id,
   entry_point, handlers [fetch, queue]).

**Why nothing can dispatch across the swap.** Three independent
stops, in order of when they bite:
- Queue delivery is paused *before* the upload and stays paused
  — no queued grant can be delivered to either build.
- The uploaded metadata carries **GENERATION_HALT `"1"`** (the
  pinned spec value; the live `"0"` is deliberately not carried
  over). From the first request the new build serves: the
  queue producer (`sendGrant`) is not wired, internal execute
  refuses, and the alarm's drive cycle cannot issue grants.
  The halted Ch 2 plan is additionally excluded from the new
  driver's selection outright (R4-1), and the parked Ch 3 job
  is not a plan-driver target at all.
- The **bootstrap gate**: the production phase registry is
  empty (the binding is Gate 2, not yet written), so the new
  build refuses **every** new generation intent — budgeted,
  invented, and null-phase — with `phase_binding_required`,
  and the intent route returns 503
  `phase_policy_not_configured` if the phase-policy binding
  were somehow wrong. No caller — old client, new client, or
  API — can create a plan in the deploy window.

### D3 — Observability (read-back first; PATCH only if reset)

`cf-api GET …/script-settings`: uploads can silently reset
observability to null. If it survived via the upload metadata
(as at G4 and the seed-fix deploy), record and move on. If it
is null: re-apply with a **multipart PATCH to
`…/workers/scripts/opalreader-api-v2-prod/settings`** (NOT
`/script-settings` — the write path is `/settings`; single
`settings` part, Content-Type application/json, observability
object only), then verify observability enabled + persisted
**and** the script etag unchanged (the settings PATCH must
not touch code).

### D4 — Post-state verification (all read-only; every line must match)

- /health build == `5ae38942e493a4b53f541b5e1f589060d58d158d`;
  generation `"halted"`.
- Deployed bindings via `GET …/settings`: exactly **10 names** —
  the seven specced (incl. OPALREADER_PHASE_POLICY) + the three
  secret names — with GENERATION_HALT `"1"`.
- Script etag == the D2 PUT response etag; downloaded parts
  **26/26 byte-identical** to the validated envelope.
- Settings revision still **1** (data unchanged); `/v2/quota`
  unchanged from D0; counts 7 / 2,610 / 1,799; watermarks
  content 18 / bindings 1800.
- Ch 2 plan still `halted_unknown` with identical outcome
  counts; Ch 3 job still `parked_policy`, fingerprint
  unchanged.
- Queue: delivery still **paused**; consumer list still exactly
  the one consumer on `opalreader-api-v2-prod`; producers
  unchanged. Neighbors (v1, staging, v1 queue) unchanged.
- **Playback/sync smoke — Julie-attended (her step):** open
  Reader on one device, confirm an existing book plays (the
  G10 smoke segment is a good pick), confirm sync completes
  with no error. Agent-side reads above already prove the sync
  plane is byte-identical; her listen is the human proof.

**Gate 1 STOP conditions:** envelope/tree/ref mismatch at D1;
any D0 value moved and unexplained; queue pause read-back
fails; PUT response etag/entry_point unexpected; post-upload
parts not byte-identical; bindings read-back ≠ the specced
ten; /health build ≠ pin; Ch 2 / Ch 3 state differs from D0;
observability null and the settings PATCH fails or changes
the etag. On any STOP: halt the gate, preserve evidence, and
take the rollback question to Julie (see Rollback).

---

## Gate 2 — Production phase-binding write (Julie's decision 2)

Runs only after Gate 1's D4 is fully green. **Never combined
with Gate 1's approval.**

- Surface: operator-only `POST /v2/d6-phase-binding` via the
  operator connector (`custom.opalreader-v2-prod-operator`) —
  the migration-operator credential alone; the client token is
  refused on this route, and no client build has a path to it.
- Body: `{"phase": "forever-pucked", "bookId": "5c589095-f812-48a2-8ab2-03ba2791f2b2"}`.
- **Read-back verification (required):** the response carries
  the recorded binding (`getPhaseBinding` read-back on every
  response) — verify phase and bookId match the request
  exactly; then one idempotent repeat of the same POST must
  return the identical binding (insert-if-absent; a conflict
  would surface as `phase_binding_conflict` = STOP).
- Confirm the surrounding state did not move: /health still
  halted, settings revision still 1, queue still paused,
  Ch 2 / Ch 3 states unchanged.
- Effect, stated plainly: the bootstrap gate lifts. From this
  moment the registry governs admission — Forever Pucked may
  be submitted only under its phase, no other book can claim
  that budget, unbudgeted books run unbudgeted. Generation
  itself remains HALTED (GENERATION_HALT `"1"`, delivery
  paused): this gate changes what *would* be admitted, and
  dispatches nothing.

**Gate 2 STOP conditions:** non-200 response; read-back
binding differs from the request; the idempotent repeat
conflicts; any surrounding state moved.

---

## Gate 3 — Client publication (Julie's decision 3)

Runs only after Gate 2 is green. **Never combined with
Gate 1 or 2 approvals.**

- Publish the gen-pkg-1 client from the signed client trees
  (publish tree `365ecbddf0bc17066c1eed5a6349735a290070482a50cddccda96c7a1e31dbd8`,
  build marker `d5b-v2-generation-client-2`) to the Pages repo
  by the ui-pkg-4 pattern: compute the exact file delta against
  the live client at gate time, publish only that delta,
  verify **every published file byte-identical as served**.
- The Shelf bridge must remain
  `bc0a5879fbf4a6f455170ead8e0fbe1aa19d82126df4eb631bd0ebad9112ec8e`
  in the published tree (frozen byte-for-byte).
- **Device checks — Julie-attended (her steps), one device at
  a time:** open Reader; confirm the new build marker;
  confirm the Generation view and Generate controls are
  present; play an existing segment (playback unchanged);
  confirm sync completes and the Shelf guard reads unchanged
  at first Connect. Repeat on the second device. Submitting
  an actual generation intent is **not** part of this gate —
  generation is still halted, and the controls' refusals
  (`phase_binding_required` is now lifted, but the halt still
  governs dispatch) are expected behavior until the separate
  re-arm decision.

**Gate 3 STOP conditions:** published bytes differ from the
signed tree; bridge hash differs; a device check fails —
publication halts and the failure is diagnosed before any
second-device step.

---

## Rollback

- **Worker (Gates 1–2):** the rollback base is the D0 archive
  of the live `ac451df8` package (etag `37b464ac…`). A rollback
  is a re-upload of those 26 parts — proposed to Julie with
  the D4 evidence, **never silent**. Proposed when: post-upload
  verification fails on the worker plane (wrong build/etag,
  bindings mismatch, parts not byte-identical, read surfaces
  erroring, DO errors) — i.e., when the new worker is not
  provably the signed candidate serving intact data. The
  rollback upload's GENERATION_HALT value is part of the
  proposal; the default proposal is `"1"` with delivery left
  paused (a halted rollback), because restoring the armed
  `"0"` state is itself a generation decision. If Gate 2 has
  already run, the registry row it wrote is inert under the
  old build (that build has no registry code) and is **left in
  place** — deleting it is not required for rollback and would
  be its own gated act.
- **Fix-forward vs rollback:** if the failure is confined to
  the *new* surfaces (e.g., a generation-surface defect) while
  playback, sync, and data reads are provably intact, the
  proposal to Julie may be fix-forward (a corrected candidate
  through Rowan's review) with the system left halted and
  paused in the meantime — the safe state this plan lands in
  is precisely what makes fix-forward possible without time
  pressure.
- **Client (Gate 3):** the established asymmetry holds —
  post-publication recovery is **fix-forward**, never a silent
  rollback to the prior client (ui-pkg-4 precedent: after
  cutover, a prior client cannot read migrated state).
  Legacy snapshots are never deleted under this plan.

## Explicitly out of scope (each its own later Julie gate)

Re-arming generation (GENERATION_HALT flip + queue delivery
enable, in the G9 order); reconciliation or retirement of the
halted Ch 2 plan; any Chapter 2 retry or new plan; the Ch 2
billing reconciliation against provider records (the $0.3537
figure remains an internal estimate, not verified spend);
Chapter 3 parked-job resume; Batch arming; the rest-of-
Forever-Pucked follow-on; any spending or top-up.

## Evidence map

- Envelope proof: `logs/deploy-plan/` (report, harness, pass +
  three negative logs, parts manifest, assembled envelope).
- Round-5 build record: `BUILD-REPORT.md` ("Round-5
  corrections (R4-2)"); batteries: `logs/round5/`.
- Procedure precedent: `~/workspace/d6-build/deploy-evidence/g4/`
  and `…/seedfix-deploy/` (D0–D4 records this plan mirrors).
- Rowan's conditions: board issue #15, comment 6523652449
  (sign-off), 6514899384 (R4-2 ruling); Julie's R4-2 approval:
  comment 6522602149.
