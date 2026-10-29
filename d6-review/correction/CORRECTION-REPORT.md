# D6 Correction Report — response to Rowan's SOURCE REVIEW BLOCK (issue #15, comment 6501450683)

Built under Julie's existing repo-only BUILD Go (comment 6500347462).
**No deployment, no production mutation, no secret read or set, no
spend, no board contact.** GENERATION_HALT remains `"1"` in the D6
deploy spec; no queue was created; the parked Forever Pucked Ch 3 job
is untouched (parked-inertness re-proven below). All work is in the
existing build tree, `~/workspace/d6-build/impl/`; new evidence in
`impl/logs/correction/`. This report supersedes BUILD-REPORT.md
§1/§7 item (i) (the DO-class open item), its §7 storage paragraph
(already superseded by the chapter-audio deletion), and its client
marker description.

## 1. What changed

### 1.1 The blocker: continuity-preserving coordinator (entry)

`worker/worker-entry-prod-d6.js` (SHA-256
`2e81e06a57c01a60096a17b8b3fd1611f642ebc9ed0be6cc3adf51d441c8744a`):

- The D6 class `OpalReaderCoordinatorProdD6` is **gone**. The entry
  now exports the coordinator under the **existing production class
  name**: `export class OpalReaderCoordinatorProd extends
  ProductionCoordinatorBase`, where the base is the production class
  imported (aliased) from `worker-entry-prod.js`. Same class name →
  same Durable Object namespace → the platform instantiates the
  successor over the **account instance's existing SQLite store**.
  D6 behavior arrives exactly where it already lived: the overrides
  on that class (internal intent/plan routes, D6 `_execute`, alarm
  continuation), the flag-gated 17-line coordinator diff (unchanged
  by this correction), and the generation modules.
- **In-place schema bootstrap**: the class constructor now runs
  `ensureGenSchema(this.coordinator.sql)` after `super(...)`. The
  generation schema therefore appears **inside the existing
  instance's SQLite** on first D6 wake — no class creation, no
  migration, no state carry. `worker/generation/gen-schema.mjs`
  (comment-only change) records the contract: the DDL is
  `CREATE TABLE IF NOT EXISTS` throughout, **DDL-only** (it performs
  no reads at all, so the production `.one()`-throws-on-empty hazard
  — the P8 bootstrap deadlock — cannot occur in it), and idempotent
  (every later wake re-runs it as a no-op). No pre-existing D6
  tables exist anywhere (D6 was never deployed), so no guarded
  column evolution is required; the schema module now states that
  any future column addition must land as a guarded ALTER beside
  this DDL, never a table rebuild.

### 1.2 Deploy spec

`worker/p8/deploy-spec-prod-d6.json` (SHA-256
`374261df82e73c5d4bddf86102e5490c3dd4280826549fdc97b5df2bd0d415a0`):

- COORDINATOR binding `class_name`: `OpalReaderCoordinatorProdD6` →
  **`OpalReaderCoordinatorProd`** (the existing class).
- `do_topology`: coordinator class = the existing class;
  `migration_tag` = **`v1`** — the existing production migration
  that created the class — with an explicit note that D6 has no
  migration tag; namespace = the production script's existing
  namespace; a `continuity` field records the correction and warns
  that pairing this spec with any `new_sqlite_classes` entry for a
  D6-named class would start from an EMPTY store (a data-loss
  defect, not an upgrade).
- `durable_object_migrations`: `{applied_for_d6: false,
  new_sqlite_classes: [], new_tag: null}` + note. **No new DO class,
  no new-class migration.**
- New **`arming_preconditions`** array (see §6).
- `d6_delta` change #1 rewritten to state the same-class continuity.
- Everything else is byte-for-byte the build's spec: same script
  name, same vars (GENERATION_HALT `"1"`), same queue binding
  (config only), same secret NAMES.

`impl/CONTRACTS.md` updated to match (the entry is no longer
described as a subclass; the spec note records the correction).

### 1.3 Client marker fix (cosmetic item)

Root cause (as suspected in the build report): `entry-gen1.js`
exported the gen1 marker for the shell, but `createCandidate` came
from `composition-ui3.js`, which reads `constants-ui3.js` — so the
Diagnostics "Build" row rendered `d5b-v2-playback-client-14` while
the shell reported `d5b-v2-generation-client-1`.

Fix, by the versioned-successor discipline (**no shared module
edited in place**), in BOTH client trees (`client/` and
`client-package/`, still byte-identical to each other):

- **NEW** `modules/composition-gen1.js` — byte copy of
  composition-ui3.js plus a 6-line identification header; the ONLY
  code difference is the constants import → `constants-gen1.js`.
- **NEW** `modules/runnable-gen1.js` — byte copy of runnable-ui3.js
  plus a 3-line header; the ONLY difference is composing
  composition-gen1.js.
- `modules/entry-gen1.js` (gen1's own entry, not a shared module):
  `createCandidate` now from composition-gen1, `createRunnableClient`
  from runnable-gen1.
- `sw-gen1.js` (gen1's own service worker): SHELL lists the two gen1
  successors in place of the ui3 composition/runnable.
- composition-ui3.js / runnable-ui3.js / constants-ui3.js are
  **untouched** (the ui-pkg-3 rollback candidate is unaffected).

**Delta statement, plainly:** the original build described the
gen-pkg-1 client delta as exactly 6 paths vs ui-pkg-3. The corrected
candidate's delta is those 6 paths **with two of them further
changed** (entry-gen1.js, sw-gen1.js) **plus 2 new paths**
(composition-gen1.js, runnable-gen1.js) — **8 paths** vs ui-pkg-3.
The "exactly 6" claim no longer holds for the corrected tree; this
is the minimal growth the marker consistency requires under the
no-in-place-edits rule. The Chromium proof's C4 assertion was
updated to require the consistent marker (it previously asserted
the split); C1 already required the gen1 identity on the window
handle.

Frozen Shelf bridge re-verified in the final trees:
`modules/vendor/client/shelf-bridge.js` SHA-256
`bc0a5879fbf4a6f455170ead8e0fbe1aa19d82126df4eb631bd0ebad9112ec8e`
in both `client/` and `client-package/` — byte-identical to the
frozen value.

## 2. Continuity proof (before/after) — correction suite C2

New suite: `tests/d6-correction.test.mjs` (SHA-256
`ea173dab0d66510f73851e307c50e8d4f57b36c239b815596d1e7cc9730d5b1f`),
5/5 PASS, exit 0, on the real `node:sqlite` storage with
production `.one()`-throws semantics. Log:
`impl/logs/correction/d6-correction.log`; rendered snapshots:
`impl/logs/correction/continuity-snapshots.txt`.

C2 fixture (production-shaped, synthetic): the **pre-D6** production
class (`worker-entry-prod.js`) instantiated over fresh durable
state; content entity for one book (3 chapters); one migration
binding; one ordinary standard job submitted and granted through
the real coordinator (commands/grants/outbox/ledger/schedule rows);
a parked-job-shaped job (`parked_policy`, Ch 3 shape: one `ready`
+ one `pending` occurrence); **settings at the revision-0 baseline —
no settings row**, exactly the sealed production state.

- **Before snapshot**: 30 tables (incl. `sqlite_sequence`),
  SHA-256 digest over the canonical row dump.
- The D6-corrected class is then constructed over the **same**
  state (its constructor runs the in-place bootstrap).
- **After snapshot**: the digest over the same 30 tables is
  **identical** — every pre-existing table and row byte-identical,
  nothing dropped, nothing rewritten. (Digests are per-run values
  because the fixture carries wall-clock timestamps; the proven
  property is the within-run equality, asserted by the suite and
  rendered in the saved dump.)
- The only additions: the **8 generation tables**
  (`d6_plans`, `d6_plan_jobs`, `d6_plan_entries`,
  `d6_execution_records`, `d6_attempt_log`, `d6_phase_state`,
  `d6_storage_state`, `d6_voice_prompts`), **all empty**.
- **Settings untouched**: still no settings row;
  `_settings()` = `{monthlyCap: 50, geminiLane: "batch",
  revision: 0}` before AND after — the CAS arming write is NOT
  performed by construction, intent, or drive.
- **D6 operates on the carried state**: an intent submitted through
  the corrected class's internal route creates a plan over the
  fixture book (bound segment recognized as bound, parked chapter
  excluded by the adapter's parked dispositions); the class alarm
  grants the plan job and dispatches it exactly once; afterwards
  the seeded rows (bindings, content entity, the granted job, the
  parked job + its occurrences) are still byte-identical —
  D6's writes are additions under new ids only.

## 3. Route/handler preservation — audit + behavioral proof (C3, C4)

Static audit (code-verified against the corrected tree):

| Surface | Gate chain (in order) | Halt behavior | Grant identity |
|---|---|---|---|
| Public intent `POST /v2/commands` (D6 forward) | Entry `productionGate`: scope config → scope header (`production_scope_required`) → client token (503 unconfigured / 401 production token body) → instance header (`production_instance_required`) → entry sets internal headers itself (client cannot) → class `fetch`: internal header (`internal_only`) → scope → service lane allowlist (standard only) | GENERATION_HALT does not gate intent admission (same separation as production SubmitJob today): the intent persists plan/job state only — **zero grants, zero outbox rows, zero executions** while halted (C3) | No execution path exists on this route at all |
| Plan status `GET /v2/d6-plans/<id>` | Same full entry gate chain → same class gate | Read-only; available while halted | n/a |
| Internal execute `/internal/execute` | NOT routable from the public entry (only `/v2/*` paths forward) → class `fetch`: internal header → scope → `_execute` asserts GENERATION_HALT **first** | Halted ⇒ **423 `generation_halted`** — byte-for-byte production's current refusal (C3) | Executor `claimGrant` against the coordinator's grant ledger: unknown/completed/closed grants dropped; the commit gate remains the coordinator's `validateAndBind` fingerprint identity check (the build's integration defect fix is untouched) (C4) |
| Queue handler | `assertGenerationEnabled` **before** the coordinator namespace is touched → namespace stub (account instance) → `/internal/execute` with internal + scope headers → ack only on `response.ok`, else retry | Halted ⇒ throws `GenerationHaltedError` with **zero namespace calls** (C3) | Forwards the stored grant message unchanged; the execute path above is the only consumer (C4) |
| Class alarm | Base coordinator alarm (schedule/leases/watchdog) → service `recover()` + `driveOnce()`; the host env wires `sendGrant` **only** when GENERATION_HALT = "0" and the queue binding exists | Halted ⇒ the service cannot dispatch (no send seam); durable alarm still arms from the base coordinator | Dispatch flows only through coordinator-issued grants (outbox drain); grant guard (phase budget incl. in-flight bounds, quota, storage, lane) runs inside `_issueGrant` (C5) |

Behavioral results (C3, halted world, real host entry + real class):
health reports `generation: "halted"`; missing token → **401** with
the exact production token-error body; wrong scope → **403
`production_scope_required`**; wrong instance → **403
`production_instance_required`**; valid intent → 200, plan created,
and grants = 0, outbox = 0, execution records = 0; direct class
execute without internal header → **403 `internal_only`**, wrong
scope → 403, valid headers while halted → **423
`generation_halted`**; queue handler rejects with
`GenerationHaltedError` and the namespace stub records **zero**
calls.

Behavioral results (C4, enabled world): a **crafted grant** (no
coordinator grant behind it) posted to the real internal route →
`{dropped: "unknown_grant"}`, zero execution records, zero
bindings; the same crafted message through the **real queue
handler** → acked on the drop verdict, never retried, never
executed. A **real grant for a batch-lane job** → `{refused:
"lane_not_allowed"}` with zero execution records — the lane
refusal fires before any synthesis, and no alternate path skips
the coordinator's grant checks.

## 4. Alarm wake/restart + quota rollover with the real host entry (C5)

Driven end-to-end through the REAL D6 entry module (public
`fetchHandler` for intent + plan status; the exported class's
`alarm()`; the same durable state throughout):

1. Plan A submitted via the public route; `alarm()` → dispatched
   **exactly once** (one queue send, both occurrences); a durable
   alarm remains armed after the drive (`storage.getAlarm()` ≠
   null).
2. A settled through the coordinator's own report path → 2
   bindings under the fingerprint identity.
3. Plan B submitted; the day's ledger filled to **exactly 100**
   attempts; `alarm()` → A completes with **no new sends**, B
   parks as `parked_quota` with **zero dispatches**.
4. **Worker restart**: a FRESH instance of the corrected class over
   the same durable state reads B's `parked_quota` state back
   through the real entry's plan-status route — carried state,
   same class identity.
5. Clock advanced 2 days; `alarm()` → B resumes with **exactly one**
   dispatch; A's settled occurrences appear in **no** later queue
   payload; A's bindings unchanged (no re-synthesis);
   `quotaView().attemptsToday` = 1 (B's resumed grant is the new
   day's only attempt).

## 5. Retest results (final corrected trees)

### Worker suites — `impl/logs/correction/`

- **D6 suites: 77/77 tests PASS, all exit 0** — the 10 build suites
  (72 tests: genstore 9, service 5, grant-guards 7, settings-CAS 2,
  policy-split 11, executor FI 21, eligible-set 8, proofs 5,
  parked-inertness 1, integration 3) **plus the new correction
  suite (5)**. Parked-inertness re-proven on the corrected tree:
  the parked Ch 3 job stays byte-identical and unenumerated.
- **All 106 test files rerun individually** (per-file logs +
  exit codes in `impl/logs/correction/worker-suites/` and
  `worker-suites-summary.txt`): **84 files exit 0; 22 exit 1 —
  every one an environment/fixture failure, zero assertion
  failures**: 20 × `ENOENT` for legacy v1 client entry fixtures
  (`app-227.js`…`app-255.js`) that were never copied into this
  tree (it holds only `app-256.js`; the suites predate the D6
  tree layout and none of them loads any file this correction
  touched), and 2 × git-required tooling suites
  (`p8-d3-prod-envelope`, `p8-upload-envelope` — both shell out to
  `git`; the impl tree is not a git checkout; the latter is the
  same known artifact the build report recorded). All 11
  coordinator suites and `p8-d3-production-surface` PASS.

### Client batteries — `impl/logs/correction/client-*.log`

All six, on the corrected `client-package` tree, **all exit 0**:

- unit battery **13/13** · cast census **PASS** · Chromium
  **14/14** (incl. C1: gen1 cache == SHELL set, markers
  `d5b-v2-generation-client-1` / `gen-pkg-1`; C4: the Diagnostics
  build-marker row now reports **`d5b-v2-generation-client-1`**,
  consistent with the shell) · phone-width **11/11** · W-4 proof
  **7/7** · gen-client proof **6/6** (Batch still unselectable,
  exactly one correctly-shaped SubmitJob, Ch 3 excluded).

## 6. Arming precondition (Rowan requirement 3) — stated, not performed

The corrected spec carries `arming_preconditions`, the first of
which is the storage reconciliation: **before arming, reconcile
the storage guard's base against FRESH actual R2 usage and seed
`d6_storage_state` from that fresh figure.** The PINS-era base
(9,482,777,460 bytes) is superseded: Julie authorized deletion of
the legacy `chapter-audio/` namespace (257 objects,
3,746,296,158 bytes — executed and verified Oct 29, 2026), and the
post-deletion recount confirmed the bucket at **5,736,481,302
bytes / 5,942 objects (57.4% of the 10 GB free tier)**, at which
Forever Pucked projects to ~7.16 GB — inside the tier. Arming
against the stale base would refuse FP for a reason that no
longer exists; arming against any unverified base is forbidden.
**No arming step was performed by this correction** — no recount
was needed for the correction package itself, no storage base was
seeded (`d6_storage_state` starts empty, §2), settings remain at
revision 0, GENERATION_HALT remains `"1"`, and the queue remains
uncreated. The remaining preconditions (S5 proofs on
deployment-bound data as arming sub-step 0; revision-checked
settings CAS — stale revision stops, never overwrites; Julie sets
GEMINI_API_KEY herself; arming order settings → consumer attach →
halt flip → delivery LAST, each step read-back-verified) are
carried in the spec verbatim.

## 7. What did not change

The coordinator's 17-line gated D6 diff; every generation module's
logic (gen-schema.mjs changed by comment only); the executor,
grant guards, eligible-set, and proofs; the client beyond §1.3;
the parked Ch 3 job; production (nothing deployed, nothing
mutated, no secret touched, nothing spent). The same-class
approach hit **no platform obstacle** — no migration design was
needed or improvised.
