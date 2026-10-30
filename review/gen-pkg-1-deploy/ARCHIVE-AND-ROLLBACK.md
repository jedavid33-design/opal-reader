# gen-pkg-1 — ARCHIVE AND ROLLBACK ASSESSMENT

**Status: review evidence — authorizes nothing.** Prepared for
Rowan's deploy-plan review under her EVIDENCE ACCESS HOLD (board
issue #15, comment 6523897639, points 2 and 3). It settles, as
far as documents can, (a) whether a hash-verified archive of the
live build exists, (b) what a rollback to that build would mean
after the gen-pkg-1 worker deploy and after the Gate-2 binding
write, and (c) the decision boundary for any rollback. The
deploy-day D0/D4 snapshot specification is in the companion
`DEPLOY-PLAN-ADDENDUM-D0D4.md`.

Rollback target throughout: the live build
`ac451df8b772ddc3f64d4c6418678ce78b243d58`, script
`opalreader-api-v2-prod`, script etag
`37b464ac1c2f1d7913da82e85e09638ad7e1b5c6021e3406c6cc4a5ddb9df675`.

---

## 1. Archived live package — a complete archive EXISTS

A complete assembled archive of the live `ac451df8` module
package exists on disk at
`~/workspace/d6-build/deploy-evidence/g9-continuation/pre-flip-archive/`
— the 26 module parts downloaded from the live script at the
G9 halt-flip F0 step (immediately before the metadata-only halt
flip), i.e. exactly the package the seed-fix deploy uploaded.

Cross-verification performed for this document (not just
inherited from the records):

- The 26 parts hash to the table in §1.1 (recomputed from the
  archive directory for this filing).
- They match, **26/26 with zero mismatches**, the part table of
  the seed-fix deploy's D1 envelope validation
  (`seedfix-deploy/d1-envelope-validation.json`) — the envelope
  that was actually uploaded — and the seed-fix D2 record
  separately compared the post-upload content read-back 26/26
  identical to that envelope.
- Total module bytes: **1,083,378**. Entry part
  `v2/worker-entry-prod-d6.js` SHA-256
  `a1241e325d5ed7e678a1000470ff1a6bacda850ee4ad01f1f3ed49062ccd5fec`;
  stamped build-identity part carries `ac451df8…` (SHA-256
  `f7583ebd2623b051f6e5323827e7ce1e967a692faa71e9e44b2c137dc8f23471`).
- Upload metadata for the archive is the recorded D1 metadata
  object in the same D1 validation file: main_module
  `v2/worker-entry-prod-d6.js`; compatibility 2026-08-29 +
  `nodejs_compat`; the seven non-secret bindings (incl.
  GENERATION_HALT `"1"` **as uploaded** and the v2 queue
  producer); three secrets as `{"type":"inherit"}` by name
  only; **no `migrations` key**; observability enabled +
  persisted. A machine-readable copy of the part manifest is
  filed alongside this document as `live-archive-manifest.json`.

**Do not confuse the two archives.** The seed-fix deploy's own
`pre-deploy-archive/` is the *previous* G4 package (build
`414d8354…`, etag `7c09c194…`) — it was the rollback base for
that deploy, and it is **not** the rollback base for gen-pkg-1
Gate 1. The gen-pkg-1 rollback base is the `ac451df8` package
above.

**Current-metadata warning.** The archive's module bytes are
what is live today, but the live *metadata* has since changed
in exactly one authorized place: GENERATION_HALT is now `"0"`
(the G9 halt flip; the flip record proves the parsed-metadata
diff was exactly that one value, and the etag did not change
because it is content-derived). Queue delivery was later
enabled — that is queue-side state, not script metadata. A
rollback must therefore **not** "restore current settings":
it uploads the archive parts with the D1 metadata shape and
GENERATION_HALT deliberately set to `"1"`, with queue delivery
paused first and left paused (see §3).

### 1.1 Archive manifest (SHA-256, recomputed for this filing)

| Part | Bytes | SHA-256 |
|---|---|---|
| `v2/api.mjs` | 13632 | `9b1d0eba128c972b5329020018fefc10b0db9250f3134393de190d54e4e3237d` |
| `v2/audio-route.mjs` | 15965 | `b6383d21be32f119271e1d39f3894bd7f84b15ac1be4c38655601d1dee20d616` |
| `v2/coordinator.mjs` | 268522 | `c31359ae87cf0271c2186a579e6540461089e0ffaa181e00c732ceed649d8eb3` |
| `v2/executor.mjs` | 13974 | `5c6db175e68abdf727bf2e1d1a23626be0651db3c6eb48dd4af9e7f7d4ee14c9` |
| `v2/generation/content-plane-adapter.mjs` | 7577 | `51c177dd8d2c4c85dbd1ce19180f60f70b3d037c53081be17c9762f93e7b8f38` |
| `v2/generation/d6-executor.mjs` | 30525 | `3bdea5452667856771e5370396bac5a16306ddbae6f95d40e63273869b4ed61d` |
| `v2/generation/d6-work-source.mjs` | 5981 | `8fa929b2d283084542d9dc76c1e75278d9f5ea4ed7a8d94540e55bef45e05006` |
| `v2/generation/eligible-set.mjs` | 5978 | `87b4b09ad08a23160a8b473bd0ecb88cf2f7b1d5fcf1ec0d52dbb96920e51a7c` |
| `v2/generation/flush-store.mjs` | 8497 | `e8f622bf4ed8745dd342cdbdd8d66f2a59a586ce034e8e1b1e21d68a2460f325` |
| `v2/generation/gen-constants.mjs` | 3944 | `6922ad7402bcc369bbd48b12d859ccdf93964dbd94ab593ce126aa7af0a2e4ee` |
| `v2/generation/gen-schema.mjs` | 5307 | `d7ae4936b11fe0d01c9ff8a6e1ccbb7364541ecad7d012b8fc3e712a453aacc5` |
| `v2/generation/genstore.mjs` | 22164 | `2e1eb5bd2b53fce4b58eb1b06f737326c385f1d49ba612e91a24f3ab43f311bb` |
| `v2/generation/grant-guards.mjs` | 4188 | `98a71d8a5b9ac4eba20f3ed48cbe6fcc2bd3a55f037c7dc7191a41650d95ea6a` |
| `v2/generation/policy-split.mjs` | 9735 | `cc54ad7631ba51c834abfa33660cf5094ea06650f3c015a80077d230ad29662c` |
| `v2/generation/proofs.mjs` | 15096 | `e7571e1181a5e0e558ff2d7b524f620c260a601289eb66bcf73c43bce2910d38` |
| `v2/generation/service.mjs` | 22512 | `f9d32053724aba0845b46adcd79ba19d42f5ef73fa44c6b6389646510722492c` |
| `v2/generation/settings-reconcile.mjs` | 1138 | `6ba4ec330adf5a34c535233d15528bb1e20cc28d30db641a5cc477b443974d61` |
| `v2/host/adapters.mjs` | 34359 | `22557b5993de13d20831eec0761a0c448cafd42d5698ace0f468352fbf825258` |
| `v2/host/build-identity.mjs` | 411 | `f7583ebd2623b051f6e5323827e7ce1e967a692faa71e9e44b2c137dc8f23471` |
| `v2/p8/approved-freeze-carry.mjs` | 57703 | `24ddc8ee428e6e161fc2114af9a572f348db5959977402090539163cacb5bb46` |
| `v2/p8/approved-freeze-chunks.mjs` | 6101 | `b49cfcfcaf656d957f0c828566d390d6b2bc4b25238885fa60c3e3293563f06a` |
| `v2/p8/approved-freeze-manifest.mjs` | 467075 | `e59ab3d37245cc049d23215e0538933d633621ceb3fd29e48afdcda07e519edd` |
| `v2/p8/migration-chunk-limits.mjs` | 4733 | `886c8ea6d79dd6d2014976c50e23fe6553fd3d0ff81dd1f5f2337bf109b0fe41` |
| `v2/worker-entry-prod-d6.js` | 22261 | `a1241e325d5ed7e678a1000470ff1a6bacda850ee4ad01f1f3ed49062ccd5fec` |
| `v2/worker-entry-prod.js` | 14480 | `1d2f333a75a3ffff3d4e7c9454f218ba8a8042fab179fcd4f50031c6d80a27c5` |
| `v2/worker-entry.js` | 21520 | `91daefdd4778599db83024b074a5c4e78ef4d396a5d815712b381d40f72bd6e5` |

**Total: 26 parts, 1,083,378 bytes.**

### 1.2 Integrity re-verification at any future rollback decision

1. Re-hash every file under the archive directory; require an
   exact match against §1.1 / `live-archive-manifest.json`
   (count 26, total 1,083,378, entry and build-identity hashes
   as above). Any mismatch = **STOP** — the archive is not
   hash-verified and no rollback proposal may rely on it.
2. Re-confirm the archive is the deployed build: `/health`
   build and script etag in the Gate-1 D0 record must be
   `ac451df8…` / `37b464ac…` (they are the values the archive
   was captured under).
3. Fallback if the archive ever fails verification: reassemble
   the package from the pinned `ac451df8` source tree using
   the proven D1 assembly and validate the result against the
   §1.1 part table *before* any upload — that reassembly is
   itself an evidence-producing step, not an improvisation,
   and it must complete and be recorded before a rollback
   proposal goes to Julie.

Additionally, Gate 1's D0 step (see the addendum) downloads the
live script's parts again on deploy day and hashes them
against this same table — so the archive is re-verified
against the live bytes at the last possible moment, before
anything is overwritten.

---

## 2. Compatibility assessment — candidate vs live build

**D9-E note (2026-10-30):** this section was verified
against the round-5 candidate, signed pin `5ae38942…`
(HISTORICAL). The FINAL candidate is
`f3b6e6e9fd7a44532ceef86e484a79e466b36d4d` (D7-2 quarantine +
D8 corrections; Rowan code-level PASS, comment 6526547700).
Its state additions beyond the table below follow the same
pattern — additive, DDL-only, lazily ensured, beside the
owning module: `d6_quarantine_holds`, `d6_halt_epochs`, and
`d6_quarantine_meta` (all in
`generation/quarantine.mjs`). The rollback base in §1 — the
live `ac451df8` 26-part archive — and every rollback rule in
this document are unchanged and apply to the final
candidate.

Verified against the actual candidate source
(`gen-pkg-1/worker-build/worker/`, signed pin `5ae38942…`) and
the live build's source (`d6-build/seedfix-build/`), not just
the build report.

**No Durable Object migration; same class.** The candidate
keeps the existing class `OpalReaderCoordinatorProd`, applies
no DO migration, and its constructor runs the same
`ensureGenSchema` D6 bootstrap the live build already runs —
the `d6_*` tables in `gen-schema.mjs` (plans, plan_jobs,
plan_entries, execution_records, attempt_log, phase_state,
storage_state, voice_prompts) already exist in production.

**Everything the candidate adds is additive, DDL-only, and
lazily ensured** — `CREATE TABLE IF NOT EXISTS` /
`CREATE INDEX IF NOT EXISTS`, beside the module that owns the
data (deliberately not in `GEN_SCHEMA`), no `ALTER` of any
existing table, no rewrite of existing rows:

| New state | Owning module | When ensured | Contents |
|---|---|---|---|
| `d6_phase_bindings` | `generation/phase-policy.mjs` | On registry reads/writes (admission checks, the operator binding route) | One row per budgeted phase → its one authorized book. Empty until Gate 2. |
| `d6_binding_projections` (+ state index) | `generation/binding-projection.mjs` | On projection note/sweep paths; the watchdog `driveOnce` sweep calls the reconciler each cycle | Per-occurrence publication markers (pending/published/conflict) for committed D6 executions. |
| `d6_plan_retirements` | `generation/service.mjs` | **Only** inside a `retireHaltedPlan` transaction | Audit rows for operator retirements. A store that never retires a plan never grows this table. |

**Diagnostics are read-only**: `attemptDiagnostics` issues
SELECTs over the pre-existing `d6_execution_records` and
`d6_attempt_log` tables with a scalar whitelist — no schema or
data change. The remaining candidate deltas are code-only:
unconditional enforcement + the intent-route 503 in the entry,
admission/driver changes in `service.mjs`, the
commit-then-project hook in `d6-executor.mjs`, and a
documentation line in the deploy spec.

**The live build contains no reference to any of the three new
tables** (verified by searching the live source for
`d6_phase_bindings`, `d6_plan_retirements`,
`d6_binding_projections` — zero hits). SQLite ignores tables
no code queries.

### 2(a) Rollback after the worker deploy only (Gate 1, before Gate 2)

- Storage compatibility: **complete.** The old build runs
  against the same store; the new tables are at most empty
  shells (the phase registry may have been *read* during
  admission checks; the projections table may exist because
  the watchdog sweep ensures it) plus, at most, projection
  marker rows.
- One data-plane nuance, stated plainly: while the new build
  serves, its binding-projection sweep can publish a sync
  bindings entity for a previously committed execution that
  had never been projected (in the current inventory the only
  committed D6 execution is the G10 smoke segment, whose
  binding Julie already published by the approved one-off
  SyncPush at seq 1800 — the sweep would find it already
  published and no-op). A rollback of the *worker* does not
  roll back sync entities, and none needs rolling back: a
  published binding is valid data under both builds.
- There is no migration to un-run, and deleting the new tables
  is **not** part of a rollback — it would be its own gated
  act and is unnecessary.

### 2(b) Rollback after the Gate-2 binding write

- Storage compatibility: **still complete.** Gate 2 adds
  exactly one row to `d6_phase_bindings`
  (`forever-pucked` ↔ `5c589095-f812-48a2-8ab2-03ba2791f2b2`).
  The old build never reads the table; the row is inert under
  it and is **left in place** — it becomes authoritative again
  the moment any fix-forward candidate (which contains the
  registry code) serves.
- **Policy-semantics caveat (the important one):** under the
  old build, phase admission derives from caller/history rules
  (the round-1 behavior) — the registry does **not** protect
  the Forever Pucked budget while the old code serves. So a
  rolled-back system must never be re-armed on the assumption
  that Gate 2's binding is still being enforced. Any re-arm
  after a rollback is a fresh Julie decision, informed by this
  caveat, and the default rolled-back landing is halted +
  delivery paused (see §3), under which no admission occurs at
  all.

---

## 3. Rollback decision boundary

Rollback is **not automatic and not a safe fallback by
default** (Rowan's terms, adopted). It is a production write
with its own evidence, and it happens only as follows:

1. **Julie's explicit approval of the rollback itself**,
   given the failure evidence — a Gate-1 or Gate-2 approval
   never implies rollback approval, and a STOP at any gate
   produces a *proposal* to Julie, not an executed rollback.
2. **Current-state snapshot first** (D4-style reads, preserved
   as evidence): /health build + generation state, script
   etag, deployed bindings via `GET /settings`, settings
   revision, quota view, plan/job states for the full recorded
   inventory, sync watermarks/counts, queue delivery state +
   consumer list. No rollback upload begins until the snapshot
   is recorded and any movement in it is explained.
3. **Archive integrity re-verified** per §1.2 at decision
   time.
4. **Compatibility re-check** per §2, explicitly recording
   whether Gate 2 has run (registry row present) and whether
   any projection/sweep writes occurred while the new build
   served.
5. **Halted landing, always:** queue delivery is paused
   (cf-api PUT + read-back) *before* the rollback upload; the
   upload uses the archive parts with the D1 metadata shape
   and GENERATION_HALT `"1"`; delivery stays paused after.
   **No automatic re-arm and no queue-delivery enable at any
   point** — restoring the armed state is a separate Julie
   decision under the §2(b) caveat.
6. **Post-upload read-backs:** downloaded parts 26/26
   byte-identical to §1.1; /health build `ac451df8…` and
   generation `"halted"`; script etag `37b464ac…` (expected —
   it is content-derived and the G9 flip proved a metadata-only
   change leaves it unchanged; a *different* etag = STOP and
   investigate); bindings read-back matches the D1 shape with
   HALT `"1"`; settings/quota/watermarks unchanged from the
   snapshot; observability still enabled + persisted (the
   multipart settings PATCH to `/settings` — never
   `/script-settings` — only if the upload reset it, with the
   etag verified unchanged afterwards).

**Fix-forward is the default** when the data/playback plane is
provably intact: if the failure is confined to the new
surfaces while playback, sync, and data reads verify intact,
the proposal to Julie is a corrected candidate through
Rowan's review, with the system left in the halted + paused
state the deploy plan lands in — that safe state is what makes
fix-forward possible without time pressure.

**Rollback STOP conditions:** archive hash mismatch (§1.2);
snapshot movement unexplained; Gate-2/Gate-3 state not fully
accounted for in the proposal; queue-pause read-back fails;
post-upload parts/etag/build mismatch; observability reset
that the settings PATCH does not cleanly restore; any attempt
to combine the rollback with a re-arm, a binding write or
deletion, a plan retirement, or a client change (each is a
separate gate — refuse and split).

**Client (Gate 3) is outside worker rollback entirely:** per
the established asymmetry, post-publication client recovery is
fix-forward only, and legacy snapshots are never deleted under
this plan.

---

## Sources

- Archive + deploy records:
  `~/workspace/d6-build/deploy-evidence/g9-continuation/`
  (`pre-flip-archive/`, `HALT-FLIP-RECORD.md`, F0–F4 records);
  `~/workspace/d6-build/deploy-evidence/seedfix-deploy/`
  (`DEPLOY-RECORD.md`, `d1-envelope-validation.json`,
  `d2-upload.json`).
- Candidate source: `~/workspace/gen-pkg-1/worker-build/worker/`
  at signed pin `5ae38942e493a4b53f541b5e1f589060d58d158d`
  (round-5 verification basis, historical); the FINAL
  candidate is `f3b6e6e9fd7a44532ceef86e484a79e466b36d4d`
  (see the D9-E note at §2).
  (`generation/phase-policy.mjs`,
  `generation/binding-projection.mjs`,
  `generation/service.mjs`, `worker-entry-prod-d6.js`).
- Live source: `~/workspace/d6-build/seedfix-build/`.
- Rowan: board issue #15 comments 6523652449 (round-6
  sign-off, condition B), 6523897639 (evidence access hold).
