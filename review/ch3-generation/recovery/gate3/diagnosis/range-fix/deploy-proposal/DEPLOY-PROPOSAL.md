# DEPLOYMENT PROPOSAL — Range-fix envelope (Option B prefix RANGE scans), HALTED deploy ending HELD

**Status:** PROPOSAL ONLY — prepared under Rowan's **SOURCE
REVIEW PASS** on the range-fix candidate (recorded on board
issue #15 as comment **6560249061**). **Nothing in this document
is authorized by its filing.** Deployment requires Rowan's
review of this proposal and Julie's explicit GO, recorded on
the board before any step. No production access of any kind was
made in preparing it: assembly, counting, and hashing are all
local, from the pinned candidate tree and the Gate 2D operative
record.

**What this gate would do, in one paragraph:** replace the live
worker's code with the range-fix envelope — the identical system
plus the five LIKE→range-scan swaps and the one new helper
module — while the system is already halted and paused, verify
every deployed byte against the pinned manifest, and **end in
exactly the held state it started in**. No halt lift, no queue
unpause, no preview, no finalizer call, no generation, no
spend. The finalizer stays dormant on the new build exactly as
it is on the old.

---

## 1. Candidate identity (immutable)

| Item | Value |
|---|---|
| Candidate source pin | `d01c15ed732436223f0207e4d126a588150187af` (repo `jedavid33-design/opal-reader`, branch `ui1-review`) |
| **Envelope pin = candidate build stamp** | **`1c2d1d0fa7ebb769f68cfb327fb9fde7d4d30867`** (single-parent child of the source pin, same repo/branch) |
| Operative envelope | 1,438,980 bytes, SHA-256 `3508d1bf722a426f7332afbdadcc2012cbd8271d35e5b8a4e1758b5eb850ac8c` |
| Operative part count | **31 module parts** — counted from the assembled manifest produced by the pinned assembler, never from memory |
| Metadata part | Byte-identical to the live operative metadata (assembler check C6): `GENERATION_HALT "1"`, 10 bindings, inherit secrets by name, no migrations |
| Live build being replaced | `408f91497131a151a199b3f9ec4cbb283a8febd5` — 30 parts, envelope 1,433,520 B, SHA-256 `00f7db62a21e4a0b249fc68a07f9dabc048fa3bf5be62109015b17fb344f928b` |
| Assembler | `tools/assemble-rangefix-envelope.mjs`, pinned inside the envelope package; recipe-identical to the Gate 2D retry assembler; validation **10/10 PASS**, deterministic across runs |

The `/health` build stamp of the operative envelope is the
envelope pin `1c2d1d0f…` (stamped part-only into
`v2/host/build-identity.mjs` at operative assembly, per the
standing build-marker rule; the tree itself is never stamped).

### 1.1 Delta vs the live `408f9149` envelope (exhaustive)

- **27 parts byte-identical** to live (SHA-256 and size equal).
- **2 parts changed**:
  - `v2/coordinator.mjs` — 274,953 B /
    `5d0727638b24e497c7b7ca73d6deead411a5ebc8e475163f78aa0b01d72a3de5`
    → 276,256 B /
    `bca88fe92bfd316c727866f7f69817e290fc8167006d32362577010c2037e20a`
  - `v2/generation/grant-finalizer.mjs` — 39,842 B /
    `15dd575f77efb0d5159f3674162728662b102891cd95cd7b680bf4a8bd0794ee`
    → 40,172 B /
    `0da45d8e6d156d1fc7441ce97e3338aa2a9e143a5560d640ee909c5727f8c076`
- **1 part new**: `v2/generation/prefix-range.mjs` — 3,628 B /
  `a6546b3e94247adcd4215aa1ed4ab691a2595520a2783dd67849056a498da514`
- **1 part stamped**: `v2/host/build-identity.mjs` — operative
  stamped form 411 B /
  `953dbcb40a21e570f705e10ebce4774c16b05f792cd22712765361fb21764f84`
  (tree form `UNBUILT`, 378 B; stamped length equals the live
  stamped length, 411 B — assembler check C5).

No schema change (GEN_SCHEMA byte-identical to live, exactly 8
tables — check C9). No write-path change. The finalizer's lazy
audit table name still occurs only in grant-finalizer.mjs
(check C8).

### 1.2 Operative per-part manifest (SHA-256 of the exact bytes to be uploaded)

| Part | Class | Bytes | SHA-256 (operative) | Live SHA-256 (prefix) |
|---|---|---:|---|---|
| `v2/api.mjs` | identical | 13632 | `9b1d0eba128c972b5329020018fefc10b0db9250f3134393de190d54e4e3237d` | 9b1d0eba128c… |
| `v2/audio-route.mjs` | identical | 15965 | `b6383d21be32f119271e1d39f3894bd7f84b15ac1be4c38655601d1dee20d616` | b6383d21be32… |
| `v2/coordinator.mjs` | changed | 276256 | `bca88fe92bfd316c727866f7f69817e290fc8167006d32362577010c2037e20a` | 5d0727638b24… |
| `v2/executor.mjs` | identical | 13974 | `5c6db175e68abdf727bf2e1d1a23626be0651db3c6eb48dd4af9e7f7d4ee14c9` | 5c6db175e68a… |
| `v2/generation/binding-projection.mjs` | identical | 12818 | `d100f02ce199bbcd6935569c8daabadbd6783d79b0bf1abd41f811e5763d8654` | d100f02ce199… |
| `v2/generation/content-plane-adapter.mjs` | identical | 8150 | `d8db2cbab33f16a5909fae0e74af672eed93b77b4f917f63d332cd3a221ba9c7` | d8db2cbab33f… |
| `v2/generation/d6-executor.mjs` | identical | 46660 | `c3613a818f598a2fc9f0f975312ad76879edab6bdffcdd06fe3fb2e3b123984c` | c3613a818f59… |
| `v2/generation/d6-work-source.mjs` | identical | 5981 | `8fa929b2d283084542d9dc76c1e75278d9f5ea4ed7a8d94540e55bef45e05006` | 8fa929b2d283… |
| `v2/generation/eligible-set.mjs` | identical | 7284 | `a9932a82ab3a81eeca38a80d3a555b56951a1d4dcef02fcf686bd9a9a264d1f7` | a9932a82ab3a… |
| `v2/generation/flush-store.mjs` | identical | 8497 | `e8f622bf4ed8745dd342cdbdd8d66f2a59a586ce034e8e1b1e21d68a2460f325` | e8f622bf4ed8… |
| `v2/generation/gen-constants.mjs` | identical | 4936 | `9af664fafc61dff1c16de8f94d06c0097271313bae7327d2a9a9d16efe14c77d` | 9af664fafc61… |
| `v2/generation/gen-schema.mjs` | identical | 5307 | `d7ae4936b11fe0d01c9ff8a6e1ccbb7364541ecad7d012b8fc3e712a453aacc5` | d7ae4936b11f… |
| `v2/generation/genstore.mjs` | identical | 48703 | `811b6b15b790097ad0010be3c71881c5024331143b4b0e2031392287bb839c2a` | 811b6b15b790… |
| `v2/generation/grant-finalizer.mjs` | changed | 40172 | `0da45d8e6d156d1fc7441ce97e3338aa2a9e143a5560d640ee909c5727f8c076` | 15dd575f77ef… |
| `v2/generation/grant-guards.mjs` | identical | 12936 | `9249539fb867fb086338c72840539dcd130062772631a523e2b4373fc5487629` | 9249539fb867… |
| `v2/generation/park-release.mjs` | identical | 29126 | `ba2952af66ee64f81491b003b7e8f225af7ccbafb15adeedeff34e41ac87f6bd` | ba2952af66ee… |
| `v2/generation/phase-policy.mjs` | identical | 7299 | `09883c40e365815f48cc9cb9d3bfdf1908f994b809c73ba27535638c7607f37f` | 09883c40e365… |
| `v2/generation/policy-split.mjs` | identical | 15074 | `61dc00148c803cb7f6b2eead2ca12caf707a3653bb3d0f7f5c97c9d8fa997876` | 61dc00148c80… |
| `v2/generation/prefix-range.mjs` | new | 3628 | `a6546b3e94247adcd4215aa1ed4ab691a2595520a2783dd67849056a498da514` | — |
| `v2/generation/quarantine.mjs` | identical | 15752 | `64a491f3b1345219cb8816b80252908df9aaaadbd67e910547658aa9ade0fe62` | 64a491f3b134… |
| `v2/generation/quota-budget.mjs` | identical | 42048 | `2b39924579e5af2d5d20eea01122d2323ccedac9fe9ff9f7026c49af14770820` | 2b39924579e5… |
| `v2/generation/service.mjs` | identical | 77995 | `aeeee06c8af9789426ae8135bd020be77e8ef3ea350de744472743e3dd14bd1d` | aeeee06c8af9… |
| `v2/host/adapters.mjs` | identical | 39224 | `f8ac357e3ca4d23bb9edd46dab1843257d26c6fafe6a52b3fffaff676a749368` | f8ac357e3ca4… |
| `v2/host/build-identity.mjs` | stamped | 411 | `953dbcb40a21e570f705e10ebce4774c16b05f792cd22712765361fb21764f84` | 9e80bb3301fa… |
| `v2/p8/approved-freeze-carry.mjs` | identical | 57703 | `24ddc8ee428e6e161fc2114af9a572f348db5959977402090539163cacb5bb46` | 24ddc8ee428e… |
| `v2/p8/approved-freeze-chunks.mjs` | identical | 6101 | `b49cfcfcaf656d957f0c828566d390d6b2bc4b25238885fa60c3e3293563f06a` | b49cfcfcaf65… |
| `v2/p8/approved-freeze-manifest.mjs` | identical | 467075 | `e59ab3d37245cc049d23215e0538933d633621ceb3fd29e48afdcda07e519edd` | e59ab3d37245… |
| `v2/p8/migration-chunk-limits.mjs` | identical | 4733 | `886c8ea6d79dd6d2014976c50e23fe6553fd3d0ff81dd1f5f2337bf109b0fe41` | 886c8ea6d79d… |
| `v2/worker-entry-prod-d6.js` | identical | 108022 | `292ca83e892d5d675f1c107ea4adf1fed34cca6c054fcd068c51b403f79f8a31` | 292ca83e892d… |
| `v2/worker-entry-prod.js` | identical | 14480 | `1d2f333a75a3ffff3d4e7c9454f218ba8a8042fab179fcd4f50031c6d80a27c5` | 1d2f333a75a3… |
| `v2/worker-entry.js` | identical | 21520 | `91daefdd4778599db83024b074a5c4e78ef4d396a5d815712b381d40f72bd6e5` | 91daefdd4778… |

Full machine-readable manifest (with unstamped tree hashes and
live sizes/hashes per part): `operative/parts-manifest.json`,
pinned as a child of the envelope pin alongside this proposal.

## 2. Starting state (from the verified record; NO fresh production reads were made for this proposal)

The system has been HELD since the Gate 3 STOP (Nov 1, 2026),
and Stage 1 of the diagnosis re-verified this state passively
afterward (record pin `b0446f79…`):

- Worker `opalreader-api-v2-prod`, live build
  `408f91497131a151a199b3f9ec4cbb283a8febd5`; `GENERATION_HALT`
  is **"1"** — generation halted; coordinator reports `armed`;
  `OPALREADER_PHASE_POLICY "enforce"`; 10 bindings;
  observability enabled + persisted.
- Queue `opalreader-generation-v2` (id
  `93b6a35fb8cf4788a91a2c90b748ae66`): delivery **PAUSED**
  (`delivery_paused: true`, cf-api read-back at the STOP).
- The stalled grant
  `grant:plan:e377a5559961b294154276b6:ch2:1:full` is still
  `issued` rev 2, its 8 reservations still open (52 residual
  slots attributed to PT 2026-10-31: 44/52/96); plan
  `plan:e377a5559961b294154276b6` still `active` at 8/23, 0
  failed; the parked Chapter 3 job is untouched.
- Conflicts: exactly the four baseline `schedule_dead` lease
  rows (§4.1 below) — exact-matched at the Gate 3 census, at
  the STOP read-backs, and at both Stage 1 conflict reads.
- Phase accounting (forever-pucked) unchanged: settled
  **732,303**; estimatedUnverified **19,018**;
  reservedUnverified **5,648**; unknownOpen **0**; remaining
  **12,762,049** of 13,500,000; settings revision **1**.
- Sync watermarks: bindings **1826**, content **18** (Stage 1
  D5: zero bindings movement since seq 1826).
- The finalizer has never been actioned: the only valid
  operator calls ever made are the Phase A park release and
  the single Gate 3 preview call (which returned HTTP 500).
  Zero exemption writes ever. Batch remains unarmed.

Anything in §2 that the fresh census (§4) finds different is a
census deviation under §4.3 — the starting state is a claim to
be re-proven at execution time, not assumed.

## 3. Authorization shape

- Julie's GO for **this deployment, exactly one attempt**, is
  recorded on the board before any step; the executing agent
  quotes that comment ID in its record. Rowan's review of this
  proposal precedes the GO request; her review authorizes
  nothing by itself.
- The GO covers only the bounded sequence in §5. Anything
  outside it — a second upload, a retry after a failed step, a
  halt lift, an unpause, a preview, a finalizer call — needs a
  new GO.
- Executor STOP law (standing since Gate (a), hardened by the
  Gate 2D deviation ruling): if any pre-flight census item
  differs from its expectation — **even by one item, even if it
  looks like harmless known bookkeeping** — STOP before any
  mutation, preserve the held state, report the exact deviation
  and the proposed explanation to Julie and Rowan, and proceed
  only on a fresh explicit GO or a Rowan ruling for that
  deviation. The executor's own tracing never clears its own
  stop.

## 4. Fresh preflight census (executed at deploy time, BEFORE any mutation)

All reads; no mutation is permitted until every item passes.
The census re-proves the starting state on the live system:

1. **Health** — `GET /health`: build ==
   `408f91497131a151a199b3f9ec4cbb283a8febd5`, generation
   reported halted.
2. **Held-state bindings** — cf-api
   `GET /workers/scripts/opalreader-api-v2-prod/settings`:
   `GENERATION_HALT` binding text == `"1"`; exactly 10
   bindings; capture the script etag from
   `GET /workers/scripts/opalreader-api-v2-prod` response
   headers (normalized).
3. **Queue** — cf-api `GET /accounts/{acct}/queues/93b6a35fb8cf4788a91a2c90b748ae66`:
   `delivery_paused == true`; sole consumer
   `f260f2188d80426bb0588685e9d084eb`; retention 86,400 s.
4. **Conflicts** — `GET /v2/conflicts`: **EXACT-MATCH** against
   the four individually enumerated baseline rows in §4.1 —
   same ids, timestamps, occurrence ids, and every field.
5. **Plan** — `GET /v2/d6-plans/plan:e377a5559961b294154276b6`:
   state `active`, done 8, failed 0; the parked Chapter 3 job
   still `parked_policy` rev 1.
6. **Quota reconcile** — `GET /v2/d6-quota-reconcile`
   (operator, paginated per the established completeness rule:
   disjoint pages + union == totals + totals stable):
   `ok: true`, drift empty, sole exception the known
   adjudicated straddler
   (`att-37d63768-db4b-447d-8150-580b7c6ee257`,
   `estimated_unverified`); PT totals 2026-10-29 = 57,
   2026-10-30 = 79, 2026-10-31 = 44/52/96; census-day totals
   recorded as observed.
7. **Phase accounting** — forever-pucked figures exactly as
   §2 (settled 732,303 / estimatedUnverified 19,018 /
   reservedUnverified 5,648 / unknownOpen 0 / remaining
   12,762,049 of 13,500,000); grant still `issued` rev 2 with
   exactly its 8 open reservations.
8. **Bindings check** — for each of the 8 production bindings
   committed in Phase A, confirm **revision_key == cache_key**
   (structural metadata only; never segment text).
9. **Settings + watermarks** — settings revision **1** (lane
   standard, cap $50); sync watermarks bindings **1826**,
   content **18** (no movement since Stage 1).
10. **Observability pre-check** — cf-api
    `GET /workers/scripts/opalreader-api-v2-prod/script-settings`:
    observability enabled + persisted (this is the baseline
    the post-upload check in §5 compares against).

### 4.1 The approved conflict baseline — the four rows, verbatim

Reproduced from the Gate 3 proposal §4.4.1, verified against
`BASELINE.md` (pin `9284f5efee47cd87b2c5639e9dfe50e6fb7e908a`).
All four rows carry `cache_key` `lease`, `expected` `7`,
`found` "LIKE or GLOB pattern too complex: SQLITE_ERROR",
`reason` `schedule_dead`:

| id | at (ISO, UTC) | occurrence_id |
|---:|---|---|
| 1 | 2026-10-29T23:54:14.808Z | `grant:plan:3183ecbf2ac4bf50bbc6166e:seg:1:full` |
| 2 | 2026-10-30T00:24:14.632Z | `grant:plan:603ab416bd67ab1b25de97be:ch1:1:full` |
| 3 | 2026-10-31T05:14:24.089Z | `grant:plan:b2dc2a3d1cd367a0245b9102:ch1:1:full` |
| 4 | 2026-11-01T01:04:30.364Z | `grant:plan:e377a5559961b294154276b6:ch2:1:full` |

The census passes **only** on an exact match. **Any addition,
deletion, or field change — in count, id, timestamp,
occurrence, or any field — is a STOP before any mutation.**
On such a STOP the complete new census is pinned and returned
to Rowan for a specific baseline ruling; only a separately
reviewed replacement baseline may be used for a later attempt.
No signature-match exemption exists.

### 4.2 Census evidence

Every census response is captured verbatim to the execution
record's evidence directory, with a census digest computed and
named in the record, distinguished from any later read-back
digests (Gate 3 §7.14 discipline).

### 4.3 Deviation rule

Any census item failing its expectation — including the queue
found unpaused or the halt found lifted (the system is
supposed to already be held; "fixing" either silently is
forbidden — a not-held finding is a deviation to report, not a
step to take) — ends the gate before mutation, held, with the
deviation filed for Julie and Rowan.

## 5. Bounded action sequence (mutation budget: 1, plus at most 1 conditional)

- **D0 — Census.** §4 in full. Any deviation: STOP (§4.3).
  Zero mutations.
- **D1 — Verify-held reads.** Confirm, by read-back, that
  `GENERATION_HALT` is `"1"` and the queue's
  `delivery_paused` is `true` **already**. This gate performs
  **zero** hold mutations: unlike Gate 2D there is no halt flip
  and no queue pause in the sequence, because the Gate 3 STOP
  left both in place. If either is found not held: STOP
  (§4.3).
- **D2 — Re-assembly identity check (local).** Re-run the
  pinned assembler with `--pin 1c2d1d0fa7ebb769f68cfb327fb9fde7d4d30867`
  against the range-fix tree; the run must reproduce the
  operative envelope byte-for-byte (SHA-256
  `3508d1bf722a426f7332afbdadcc2012cbd8271d35e5b8a4e1758b5eb850ac8c`,
  31 parts, 10/10 checks). Any mismatch: STOP before upload.
- **D3 — ONE worker upload (mutation 1 of 1).** Multipart PUT
  of the operative envelope to
  `opalreader-api-v2-prod`, metadata as assembled
  (`main_module` set, module MIME + `filename` per part,
  existing secrets as `{"type":"inherit"}`, compatibility
  preserved). Exactly one upload attempt; a failed upload is
  reported, never retried inside this GO.
- **D4 — Post-upload byte verification.** Fetch the deployed
  script via cf-api and verify **every one of the 31 parts**
  byte-for-byte against §1.2 (SHA-256 per part), and the
  deployed metadata against the assembled metadata. Any
  mismatch: STOP, stay held, file the mismatch (§7).
- **D5 — Observability check (+ conditional repair).** GET
  script-settings: if observability survived (expected, per
  every deploy in this chain), no action. **Only if** the
  upload reset it to null: one settings-only multipart PATCH
  to `/workers/scripts/opalreader-api-v2-prod/settings`
  (single `settings` part, observability object only — the
  write path is `/settings`, **not** `/script-settings`), then
  verify observability restored **and the script etag
  unchanged** by the PATCH. This conditional PATCH is the only
  second mutation the GO covers.
- **D6 — Denied probes (read-only refusals).** Credential-less
  calls to all six operator routes must refuse HTTP 403
  `migration_operator_required`: `/v2/d6-release-park`,
  `/v2/d6-revoke-park-release`,
  `/v2/d6-exempt-chapter-occurrence`,
  `/v2/d6-revoke-chapter-exemption`,
  `GET /v2/d6-grant-finalization-preview`,
  `POST /v2/d6-finalize-grant`. Probes only — **no valid
  operator call of any kind is made in this gate.** Any route
  not refusing: STOP-report (no remediation inside this GO).
- **D7 — Read-back set.** `/health` shows build
  `1c2d1d0fa7ebb769f68cfb327fb9fde7d4d30867` and generation
  still halted; queue still `delivery_paused: true`;
  conflicts still exact-match §4.1; grant still `issued` rev 2;
  plan still active 8/23; phase figures unchanged; watermarks
  still 1826/18; settings revision still 1.
- **D8 — Record.** Execution record + verbatim evidence
  pinned and filed for Rowan's execution review, stating the
  exact mutation count actually spent (expected: 1; at most 2
  with the conditional D5 PATCH) and $0 spent.

**The gate ENDS HELD**: halt still `"1"`, queue still paused,
Generate button NOT live. There is no re-arm step in this
proposal, and none may be improvised.

## 6. Explicit non-actions

No preview call (the finalization preview is not invoked, even
read-only). No finalizer action call. No park release, no
exemption write, no quarantine release. No halt lift, no queue
unpause, no settings change beyond the conditional D5
observability repair. No job submission, no generation, no
provider call, no spend. No client publication. No conflicts
row is cleared or modified. The rollback floor is not
approached (§7).

## 7. Rollback and containment

- **Containment is not rollback.** Ending this gate held on
  the new build — the designed outcome — needs no rollback at
  all. A failed step likewise ends held; the response is a
  report, not a compensating action inside the same GO.
- **Rollback (separate Julie authorization only):** redeploy
  the Gate 2D operative envelope — build
  `408f91497131a151a199b3f9ec4cbb283a8febd5`, 30 parts,
  envelope SHA-256
  `00f7db62a21e4a0b249fc68a07f9dabc048fa3bf5be62109015b17fb344f928b`
  — executed halted + paused (the state this gate preserves),
  with the same per-part byte verification and read-backs as
  §5. Rollback is build-for-build: the range-fix patch changes
  no schema and no write path, and this gate writes no data,
  so the two builds are fully data-compatible in both
  directions; nothing the new build could have written needs
  reconciliation (it writes nothing in this gate).
- **Floor law respected:** the rollback target `408f9149…`
  sits above the permanent floor build
  `6a73d9622e1b4eac00c58e289de1c674ed6b3d6b`; no step in this
  proposal or its rollback goes below the floor. Rollback
  below the finalizer build while its lazy audit-table
  considerations apply remains subject to its own
  compatibility ruling — not invoked here, since the rollback
  target IS the finalizer build.
- **Before/after finalization:** no finalization occurs in
  this gate, so the rollback case is the simple one — the
  stalled grant, reservations, plan, and phase figures are
  exactly as §2 states under either build.

## 8. STOP law and the Gate 3 lesson

Gate 3's attempt stopped at its preview step with two of three
mutations spent and everything else intact, because its
proposal named hard stops and the executor honored them. This
proposal carries the same discipline, narrowed: the mutation
budget is smaller (1, +1 conditional), the system begins held
rather than being held by the gate, and **every** failed check
— census deviation, re-assembly mismatch, upload failure,
byte-verification mismatch, observability surprise, a probe
that does not refuse, a read-back that differs — ends the gate
held with a filed report. Nothing is retried inside the GO;
a retry is a new proposal or a new GO, decided by Julie with
Rowan's ruling where the STOP law requires one.

## 9. What this gate does NOT decide

- **Any Gate 3 retry.** After a successful deploy, finalizing
  the stalled grant needs a fresh Gate 3 proposal (fresh
  census against the §4.1 baseline or a Rowan-ruled
  replacement, preview, E3.5 re-check, one finalizer call,
  §7-style read-backs) + Rowan review + Julie's fresh GO.
  Nothing here pre-approves it.
- **Re-arm.** Lifting the halt or unpausing the queue is a
  separate gate with its own proposal; any such decision must
  state up front that it makes the Generate button live again.
- **Gate 4** (resume the 15 remaining Chapter 3 segments,
  ≈ $0.294 modeled), **Phase B** (the idx-26 exemption), and
  **Batch** work — each its own gate, in Julie's stated order.
- **The lease quirk's other face.** The patch removes the LIKE
  construction at all five sites, including the lease path
  whose throws wrote the four conflict rows; whether conflict
  rows can still accrete for other reasons is a question for
  future censuses, not a claim of this proposal.

## 10. Residual honesty

- **H1 remains unproven.** The leading hypothesis — that the
  Gate 3 preview threw at its §4.3.5 LIKE — is supported, not
  established; why the production engine rejected the pattern
  is unknown, and the null hypothesis (a throw outside the
  derivation) is not excluded. This deploy is
  construction-family removal, not a proven root-cause fix.
- A successful deploy proves exactly two things: the new code
  is live byte-for-byte as pinned, and the held state and all
  protected figures survived the swap. It does **not** prove
  the preview succeeds on the new build — that is established
  only by a future gated Gate 3 attempt, whose own STOP law
  catches a repeat failure with the system held and nothing
  spent.
- Rowan's SOURCE REVIEW PASS (6560249061) is a candidate-only,
  documentary verdict on Wren's recorded test evidence, not an
  independent production attestation; this proposal inherits
  that limit.

— Wren
