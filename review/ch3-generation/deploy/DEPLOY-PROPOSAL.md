# DEPLOY PROPOSAL — Chapter 3 mechanisms build, HALTED deployment (for Rowan operational review, then Julie's decision)

**Scope of this gate, in one sentence:** deploy the already-reviewed
Chapter 3 mechanisms build to production **while generation is halted
and the queue is paused**, prove the deployed bytes are exactly the
reviewed bytes, and stop there — no switch is flipped, nothing is
released, exempted, submitted, generated, or spent in this gate.

**Authority chain:** design — proposal v2 (pin `8f522593…`), Rowan
DESIGN PASS 6548728089. Build — pin `540f6a06…`, Rowan CONDITIONAL
PASS 6548945443 (calls 1–4 accepted; call 5 required the audit
journal). Revision — pin `623e8cd9…` (append-only exemption event
journal), filed 6549025831 for Rowan's re-review. Julie's build GO:
6548743249. **This proposal is the deployment gate: it needs Rowan's
operational readiness review and then Julie's own explicit GO. A
reviewer PASS does not authorize it.**

---

## §0 Identity

**Live (to be replaced):**
- Worker `opalreader-api-v2-prod`, build
  `945875bc26b0e2ca965d5c0f710f11c0164025f8`, script etag
  `d63b61c349a3518998d29d318ec465af24a63468df6cdf4876e4ba8862849039`.
- Envelope: **28 parts**, 1,332,909 module bytes, operative envelope
  1,339,824 bytes / SHA-256
  `38ebec8e380f5035f1d6e30670f42e489131e1b0771b3540eb49b2f7e57ed0de`
  (the gate-(a) D1 operative run — the deployed parts, recorded in
  `final-envelope/d1-operative/parts-manifest.json`).
- Posture at proposal time (last recorded, re-verified at §2):
  generation **enabled** (gate (c) re-arm), queue **unpaused**,
  quota guard armed, system live-but-idle.

**Candidate (this gate):**
- Source tree: `~/workspace/ch2-program/ch3-build/worker-build`
  (808 files, fixed byte-for-byte by `ch3-build/manifest.json`;
  review lineage `540f6a06…` → `623e8cd9…`). Battery on this tree:
  1,136 tests / 1,114 pass / 22 fail — the failing set is exactly the
  known baseline; the 37 Chapter 3 tests pass.
- Envelope: **29 parts**, 1,379,543 module bytes. Class table vs the
  live 28 (every hash in `envelope-manifest.json`):

| Class | Count | Parts |
|---|---|---|
| Identical to live | 24 | all others |
| Changed | 3 | `v2/worker-entry-prod-d6.js` (85,577 → 101,206 B), `v2/generation/eligible-set.mjs` (5,978 → 7,284 B), `v2/generation/content-plane-adapter.mjs` (7,577 → 8,150 B) |
| New | 1 | `v2/generation/park-release.mjs` (29,126 B — both stores, the exemption event journal, definition derivation, the four routes' domain logic) |
| Stamped | 1 | `v2/host/build-identity.mjs` (411 B stamped; the stamp names this package's pin — §1) |

- Metadata: **byte-identical to the live operative metadata**
  (derived from the candidate tree's own deploy spec, which is
  byte-identical to the gate-(a) tree's): main_module
  `v2/worker-entry-prod-d6.js`, compatibility `2026-08-29` +
  `nodejs_compat`, 10 bindings (incl. `GENERATION_HALT "1"` in the
  upload envelope and the 3 secrets by `inherit` name only),
  observability enabled + persisted, **no `migrations` key**, DO
  topology unchanged.

## §1 Build stamp — the gate-(a) precedent, followed exactly

The candidate tree's `build-identity.mjs` carries
`BUILD_COMMIT = "UNBUILT"` (378 B, byte-identical in the live and
candidate trees). Following the gate-(a) final-envelope precedent:

1. **This package is pinned first.** The pin commit (single-parent
   child of `623e8cd9…` on `ui1-review`, containing this package under
   `review/ch3-generation/deploy/`) is the candidate's identity.
2. **The stamp names that pin.** At execution (§3, step S0), the
   assembler (`tools/assemble-ch3-envelope.mjs`, recipe-identical to
   the gate-(a) harness) is re-run with `--pin <deploy pin>` against
   the inventory-identified tree. It stamps the build-identity part
   **part-only** (the tree is never modified), assembles the envelope,
   and that run's envelope SHA-256 is recorded as the operative
   identity. The PUT must upload bytes hashing to exactly that value.
3. **This package's own assembly used the 40-zero placeholder pin**
   (the gate-(a) convention): envelope 1,386,657 bytes, SHA-256
   `969ca4b4f3851c0ffe079ed6044ea494a44bbebdf9bab77378c36be42e41ba33`,
   `pinIsPlaceholder: true`. Byte counts are pin-invariant (verified:
   substituting a second 40-char pin changes only the build-identity
   part's bytes, at identical length). **The placeholder envelope
   must never be uploaded.**

## §2 Preconditions (all read-only; any failure = STOP before any mutation)

- **P1 — Quota census:** fresh `reconcileQuota` — `armed: true`,
  `ok: true`, `currentDayBlocked: false`, **drift empty**, and the
  sole exception exactly the known adjudicated straddler
  (`att-37d63768-db4b-447d-8150-580b7c6ee257`, `estimated_unverified`,
  PT 2026-10-29 → 2026-10-30). Day totals as last recorded
  (PT 2026-10-29 = 57, PT 2026-10-30 = 79, PT 2026-10-31 = 0); any
  unexplained figure is a STOP.
- **P2 — Conflicts:** exactly the **3 known `schedule_dead` rows**
  (ids 1/2/3). A fourth row, or any other conflict class, is a STOP.
  The rows are preserved as a known issue; this gate does not touch
  them.
- **P3 — Queue read-back (cf-api):** queue
  `opalreader-generation-v2` (`93b6a35fb8cf4788a91a2c90b748ae66`),
  `delivery_paused: false` (pre-gate state), sole consumer
  `f260f2188d80426bb0588685e9d084eb`, retention 86,400 s.
- **P4 — Chapter 3 pre-state:** job
  `1832c21fcf0425454227c4736048a8a632f422abca4a2685ddb775bb1681406a`
  `parked_policy` rev 1, 27 rows (3 ready / 24 pending), occurrence
  fingerprint
  `b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`.
- **P5 — Phase + plans + watermarks:** phase `forever-pucked`
  settled **579,339** / estimatedUnverified **19,018** /
  reservedUnverified **5,648** / unknownOpen **0** / remaining
  12,915,013 of 13,500,000; settings revision 1; plans — smoke
  `complete`, old Chapter 2 plan `retired`, fresh Chapter 2 plan
  `complete`, no active plan; sync watermarks content **18** /
  bindings **1818**; live build/etag exactly as §0.
- **P6 — Operative assembly:** §1 step 2 completes and its envelope
  SHA-256 is recorded in the execution record before S1.

## §3 Sequence (exactly three mutations, in this order)

- **S1 — Halt flip (metadata-only):** PUT the script metadata with
  `GENERATION_HALT "1"` on the **current** build. Verify: `/health`
  generation `halted`; script etag **unchanged**
  (`d63b61c3…` — metadata-only flips preserved the etag at gates
  (b)/(c)); observability still enabled. So the system is halted
  before any new code lands, on the old code.
- **S2 — Queue pause:** cf-api PUT the queue with
  `delivery_paused: true` (bodies are a positional argv JSON string;
  a `--data` flag is silently ignored). **Read back:** paused, sole
  consumer unchanged. Containment is now proven on both sides before
  the code PUT (the gate-(a)/D1 rule).
- **S3 — Zero-movement capture:** re-read the §7 verification set;
  it must equal the §2 pre-state exactly. Any movement = STOP.
- **S4 — ONE code PUT:** upload the operative envelope (its metadata
  already carries `GENERATION_HALT "1"`). Exactly one attempt (§8).
- **S5 — Observability check (standing rule):** GET
  `/workers/scripts/{name}/script-settings`. A code upload can
  silently reset observability to null. **Sole contingency:** if —
  and only if — it is null, re-apply observability via the multipart
  PATCH to `/workers/scripts/{name}/settings` (single `settings`
  part; the write path is `/settings`, not `/script-settings`),
  then verify the script etag is unchanged by the PATCH (the
  settings PATCH does not touch code). If observability survived the
  PUT, no PATCH is made.
- **S6 — Read-backs:** GET the script and byte-compare **29/29**
  parts against the operative parts manifest (the GET returns module
  parts only; metadata is proven via the PUT response + the
  `/settings` read); `/health` reports build = the deploy pin and
  generation `halted`; GET `/settings` shows the 10 bindings (names
  + types only); queue read-back still paused, consumer unchanged.
- **S7 — End state:** candidate build live, generation **HALTED**,
  queue **PAUSED**. **No route of the new build is called in this
  gate** (§5 for the single stated exception: the denied probe, if
  Julie includes it).

## §4 Cold-start safeguards (why a halted, unused deploy is safe)

- The three new tables (`d6_park_releases`,
  `d6_chapter_exemptions`, `d6_chapter_exemption_events`) are created
  **lazily, DDL-only, inside `park-release.mjs`**, on the first
  operator write — which cannot happen in this gate. A
  deployed-but-unused build creates nothing.
- Every read path is absence-tolerant and throw-safe in the presence
  of the real Durable Object SQLite `.one()` throw-on-empty
  behavior: a missing table reads as an exact empty set; genuine
  database errors surface as errors, never as empty.
- **Deployed-but-unused ≡ live build, proven:** the test battery's
  no-release invariant shows eligibility output byte-identical to
  the pre-mechanism builder with the tables **absent** and with the
  tables **empty**, across chapter/book/segment scopes.
- `GEN_SCHEMA` is **untouched**: the gen-schema part is
  byte-identical to live and declares exactly the pinned 8 tables;
  no metadata `migrations` key exists, so the deploy performs no
  schema migration of any kind.

## §5 Operator-fence validation — stated honestly

- The four new routes (`POST /v2/d6-release-park`,
  `/v2/d6-revoke-park-release`, `/v2/d6-exempt-chapter-occurrence`,
  `/v2/d6-revoke-chapter-exemption`) sit in the operator-alone fence
  class, mirroring the quota routes: gate skip + dedicated
  migration-operator credential + the unforgeable
  `x-opalreader-operator-admitted` stamp re-checked at the DO class
  gate. The route test suite proves admission and **denial** at both
  the entry and the class gate (37/37 Chapter 3 tests on this tree).
- **No valid operator call is made in this gate.** The fence's
  positive function is therefore not exercised against production
  here; it is proven at Phase A's first audited use, which is itself
  a separately approved gate with its own read-backs.
- **Optional denied probe (Julie's explicit inclusion required):**
  one POST to a new route **without** the operator credential
  (e.g., unauthenticated), expecting a refusal before any store
  contact. It writes nothing by construction — refusal precedes the
  domain handler — but it is a production request against a new
  route, so it is **not** assumed into this gate: it runs only if
  Julie's GO names it.

## §6 Rollback safeguards

- **Permanent floor law:** no build below
  `6a73d9622e1b4eac00c58e289de1c674ed6b3d6b` (etag `a9a4c0c4…`) may
  ever run against this data; the floor does **not** enforce the
  provider-attempt counter and is never a safe re-arm fallback. Any
  rollback needs Julie's separate authorization, halted + paused
  holds for the whole window, an externally archived accounting
  copy, and the target build's proven compatibility — not commit
  recency.
- **Additive-table compatibility (grep-provable):** the three new
  table names occur **only** in `park-release.mjs` (assembler check
  C8, run over every candidate worker source). No older build
  contains the names, so no older build can read, write, or be
  disturbed by the tables.
- **Rollback of the unused build is clean:** if this build is
  rolled back before any release/exemption write, the tables were
  never created (lazy DDL) and nothing persists; the system returns
  to the §0 live identity byte-for-byte.
- **Rollback AFTER any release/exemption write is a different
  case:** the projection + journal rows persist, but an older build
  cannot see them — the parked fence would silently return in full
  while the audit records say otherwise. **No rollback in that
  state is pre-authorized by this proposal**; it needs its own
  compatibility ruling at the time. (This gate creates no such
  state: it makes no release/exemption write.)

## §7 Zero-generation verification set (captured at S3 and again at S6/S7)

Generation halted + queue paused read-backs; quota reconcile
`ok: true` with day totals unchanged; conflicts exactly the 3 known
rows; bindings watermark **1818** and content watermark **18**
(sync families unchanged); phase figures exactly as §2 P5; plan
states exactly as §2 P5 (no new plan, no state change); Chapter 3
job state + fingerprint exactly as §2 P4; settings revision 1.
**Any movement anywhere in this set = STOP** (§8) and is reported,
not repaired.

## §8 STOP law

This gate is **one attempt**. Any failure, ambiguity, unexpected
response, or drift — at any step — means: **stop, preserve the
state exactly as found, and only look.** No retry of the PUT, no
rollback, no fix-forward, no settings touch beyond the §3 S5
contingency, without Julie's fresh explicit yes. A stopped gate is
reported with its evidence; a fresh GO covers a fresh attempt.

## §9 Explicit non-actions

No release or exemption call (valid or otherwise, beyond the §5
optional denied probe if separately included); no revoke call; no
SubmitJob or any submission; no provider contact; no spend; no
quota bootstrap/dispose call; no quarantine release; no Batch
arming; no client change; no change to the 3 `schedule_dead` rows;
no re-arm (halt stays ON, queue stays PAUSED at the end of this
gate).

## §10 What follows (separately decided, in order)

1. **Re-arm decision** — a gate-(c)-style proposal (halt flip back +
   queue unpause, watched windows) is its own Julie decision.
2. **Phase A GO** — release idx 3–25 → hard eligibility read-back
   checkpoint → one SubmitJob. Its own decision.
3. **Phase B GO** — exemption for idx 26 → voice read-back
   checkpoint → segment submission. Its own later decision, after
   Phase A.

## §11 Decision asked of Julie (after Rowan's operational review)

Approve this halted deployment as one gate: S1 halt flip → S2 queue
pause → S4 one code PUT → S5 observability contingency (PATCH only
if the upload reset it) → read-backs, ending halted + paused, under
the §8 STOP law — and state whether the §5 denied probe is included.
