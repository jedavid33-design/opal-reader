# gen-pkg-1 DEPLOY PLAN — DRAFT for Rowan's review

**Status: DRAFT — authorizes nothing. FILED COPY** for Rowan's
evidence review — this review-only evidence package
(`review/gen-pkg-1-deploy/` on `ui1-review`; see `README.md`
in this directory). **D9-E reconciliation (2026-10-30):** the
operative candidate throughout this plan is now the FINAL
signed pin **`f3b6e6e9fd7a44532ceef86e484a79e466b36d4d`**
(D7-2 quarantine + D8 corrections; Rowan code-level PASS,
comment 6526547700), and the operative envelope proof is the
27-module proof in this package (envelope SHA-256
`9cb9d0da0d0790e2a5a0e558c6ff50d6958c83ab2942e487830e6132c15cd9ce`).
Every earlier reference to pin `5ae38942…` or the 26-module
proof is HISTORICAL (the round-5 candidate and its proof) and
is marked as such where it remains. Prepared by Wren under
Rowan's round-6 SOURCE SIGN-OFF (board issue #15, comment
6523652449), condition B: no live deploy without an approved,
pinned operational plan, and no blanket approval — each step
below is its own Julie decision. The candidate is the signed
pin `ui1-review` **`f3b6e6e9fd7a44532ceef86e484a79e466b36d4d`**
(parent `83375188…`, the D7-2 quarantine pin; lineage:
round-5 sign-off `5ae38942…` → D7 evidence `a6288de5…` /
`739fe3ad…` / `1c7f0530…` → D7-2 `83375188…` → D8
`f3b6e6e9…`). The actual-D6-envelope proof required by
condition A is complete for THIS candidate and filed in this
package (`ENVELOPE-PROOF-REPORT.md`: 27 modules, 18/18 PASS,
three negative proofs FAIL as required, candidate tree
byte-identical, clean-checkout replay record in `replay/`).
**D9-P corrections (2026-10-30; Rowan, comment 6526887322):**
D1's branch-head check rewritten (D9-P1 — the immutable
source pin, the pinned evidence/replay record, and branch
ancestry are now verified as three separate checks; the pin
is an ancestor of the branch, never its moving tip), and
D0's in-flight assessment corrected to the addendum's
closed-inventory method (D9-P2 — the live build has no
plan-list surface; plan-list/diagnostics verification is
reserved for D4 on the candidate).

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

## Gate 1 — Worker deploy of pin f3b6e6e9 (Julie's decision 1)

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
upload** by the method `DEPLOY-PLAN-ADDENDUM-D0D4.md` §A–§C
specifies. The live build (`ac451df8`) has **no plan-list
surface and no diagnostics surface** — both arrive only with
the candidate — so the pre-upload assessment does NOT read a
plan list. It enumerates the **closed production inventory**
(addendum §A: every D6 plan and job ever created in
production, from the deploy/arming/smoke/follow-on records)
and proves quiescence from: (a) per-plan reads of both
inventoried plans and per-job reads of all three inventoried
jobs, each matching its §A expected state exactly, with
**every grant in a terminal state** and no non-terminal
execution beyond the one named Ch 2 `unknown_billing`
artifact; (b) two `/v2/settings` + `/v2/quota` samples taken
**at least one full watchdog cycle (≥10 minutes) apart**,
identical across both samples — no inventoried plan active,
and **no change** in quota attempts/spent; (c) Ch 2 still
`halted_unknown`, Ch 3 still `parked_policy` with the
recorded fingerprint; (d) no SyncPush or settings command in
flight (settings revision still 1). **Any plan, job, or grant
discovered that is not in the closed inventory is a STOP**:
the inventory is incomplete, quiescence cannot be certified,
and the discrepancy is investigated and explained before the
gate proceeds. If anything is active or moving, the deploy
waits — there is no "explicitly justified in-flight" variant
of this plan. Exhaustive plan-list and diagnostics
verification is reserved for D4, where those surfaces exist
on the candidate (addendum §D).

### D1 — Envelope re-verification (no production contact)

Re-run the proof harness against the candidate tree at gate
time (the pinned replay harness
`replay/proof-d6-envelope-replay.mjs` in this package, run
from a clean checkout of the evidence commit, per
`replay/README-replay.md` — the explicit
`--candidate-worker-dir "$PWD/candidate/worker"` invocation
is mandatory). **What deploys is the immutable source pin's
tree — never the moving `ui1-review` branch tip.** The pin
`f3b6e6e9…` is an *ancestor* of the branch, not its tip: the
review-only evidence commits (the D9-E package, its replay
record, the D9-P corrections, and any later reviewed evidence
commits) legitimately advance the tip beyond it, so a
branch-tip equality check against the pin can never pass and
is not the check. D1 verifies three distinct things, each
separately:

(a) **The immutable source pin.** Commit
`f3b6e6e9fd7a44532ceef86e484a79e466b36d4d` exists, and its
signed subtree `review/gen-pkg-1/**` is byte-identical to
the signed record (106 blobs; subtree SHA
`a6c057dc4d705bfd1ae0b86cfbff1563bfcc280c`). The candidate
worker tree taken from the pinned evidence copy
(`candidate/worker/`, 57 files) matches
`candidate/candidate-worker-manifest.txt` per-file
(manifest hash
`de43523e5e912b1809d79147c23b5b90d1a66cb9fdb8508b6b9a7f5b6ecb3d0d`),
and the candidate tree digest still reads `30a954c4…`
(D8 pin-record method; full local tree, 378 files). This
source-integrity check is unchanged in strength from every
prior round.

(b) **The pinned evidence/replay record.** The evidence
commits `f21238df2b92361e7d93395556b3cafae8972502` (D9-E
package) and `0ebc53a4861414978fb52b596bc58646e3bbaf2d`
(replay record) sit in the branch's ancestry with the
recorded parents, and the envelope assembled by the gate-time
replay is byte-identical to the proof artifact: envelope
SHA-256
`9cb9d0da0d0790e2a5a0e558c6ff50d6958c83ab2942e487830e6132c15cd9ce`
/ metadata `e08b06bc…`.

(c) **Branch ancestry / expected reviewed head.** The
`ui1-review` ref reads the expected reviewed head — the head
recorded in the D9-P corrections board filing, or a later
head whose every intervening commit Rowan has reviewed —
and `f3b6e6e9…` is an ancestor of that head. Any unexpected
change to the branch (an unreviewed commit, rewritten
history, or a head that does not descend from the pin)
requires a fresh review and is a **STOP** until Rowan clears
it.

**Any mismatch in (a), (b), or (c) = STOP** (Rowan,
condition A, as corrected by D9-P1, comment 6526887322).
D1 also carries Rowan's D9-E operational note (comment
6526547700): an adversarial replay test must check that a
message-carried planId cannot conceal a held plan when the
authoritative job linkage says otherwise (the executor's
planId resolution accepts the message-carried planId first;
grant creation is centrally held today, but D1 verifies the
concealment case explicitly).

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
- The **quarantine fence** (D7-2 + D8, the addendum's subject):
  any plan born while halted is birth-marked and refused at
  the grant guard independent of the halt flag's later value;
  hold reads at every spending/execute fence fail closed
  (D8-1); legacy staging commands (plain `SubmitJob`,
  `RequestRepair`, `RequestSynthesis`, `RequestResume`) are
  refused at admission while halted (D8-2), and plan-less jobs
  born inside a recorded halt epoch are epoch-fenced at the
  guard. A later generic re-arm therefore grants nothing that
  was staged while halted; per-plan release is a separate
  gate class (see the addendum), never an effect of this
  deploy, the Gate 2 binding write, publication, or re-arm.

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

- /health build == `f3b6e6e9fd7a44532ceef86e484a79e466b36d4d`;
  generation `"halted"`.
- Deployed bindings via `GET …/settings`: exactly **10 names** —
  the seven specced (incl. OPALREADER_PHASE_POLICY) + the three
  secret names — with GENERATION_HALT `"1"`.
- Script etag == the D2 PUT response etag; downloaded parts
  **27/27 byte-identical** to the validated envelope.
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
  (publish digest `97e280948341e0d993975f46ebf089c10e9a2dfdc74487783ff80dd2069cc398`,
  build marker `d5b-v2-generation-client-2`; the round-5-era
  tree digest `365ecbdd…` is historical — the operative client
  publication digest is `97e28094…`, unchanged by D7-2/D8,
  which are worker-only) to the Pages repo
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

- Envelope proof: THIS package (`review/gen-pkg-1-deploy/`:
  report, harnesses, pass + three negative logs, parts
  manifest, assembled envelope, `candidate/worker/` complete
  final tree + manifests, `replay/` clean-checkout record).
  The round-5/D7-1-era local proof directory
  (`logs/deploy-plan/`) and the 26-module proof it contains
  are HISTORICAL.
- Build records: `BUILD-REPORT.md` (rounds 0–5 + D7-2 + D8
  sections); batteries: `logs/round5/`, `logs/d8/`.
- Procedure precedent: `~/workspace/d6-build/deploy-evidence/g4/`
  and `…/seedfix-deploy/` (D0–D4 records this plan mirrors).
- Rowan's conditions: board issue #15, comment 6523652449
  (round-6 sign-off), 6514899384 (R4-2 ruling), 6524426826
  (D7-2 design + D7-1 PASS), 6525035570 (D8 blockers),
  6526547700 (D8 code-level PASS; D9-E evidence request);
  Julie's approvals: comment 6522602149 (R4-2), 6524562842
  (D7-2/D8 quarantine build).
