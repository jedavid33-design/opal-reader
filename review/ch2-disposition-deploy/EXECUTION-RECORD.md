# EXECUTION RECORD — uncertainty-disposition package, halted Worker deploy

Executed 2026-10-31, 00:37–00:50Z, under Julie's explicit approval
(issue #15 comment 6536597179 — button tap, Oct 30, 2026 ~8:35 p.m.
ET; **one attempt, exactly as planned**), of the proposal pinned
`ea654d20fba5cdeb6f73077b07b1b686edf1dc6c` on `ui1-review`
(`jedavid33-design/opal-reader`), which carries Rowan's
OPERATIONAL-PLAN PASS with mandatory execution interpretations
(comment 6536365406; Wren ack 6536419323). Package: build stamp
`6a73d9622e1b4eac00c58e289de1c674ed6b3d6b`, envelope SHA-256
`7d82eccf80b1f8fd5d38f9dd7deafb1f2b41a72829f14dc1b4e962acc394ee32`.

**Outcome: DEPLOY COMPLETE — all steps PASS. End state: new build
`6a73d962…` LIVE, generation HALTED, queue PAUSED.** No STOP was
hit; the conditional observability PATCH was not needed; the D2
PUT was the only mutation of this deploy.

## Step P — verify-and-hold: PASS (00:37:39Z; evidence/stepP/, d0/*-s1)
Queue `opalreader-generation-v2`: `delivery_paused == true`, sole
consumer `f260f2188d80426bb0588685e9d084eb` (`opalreader-api-v2-prod`),
producer unchanged. `/health`: build `28850807…`, generation
"halted", coordinator "armed". Bindings: `GENERATION_HALT "1"`,
`OPALREADER_PHASE_POLICY "enforce"`, exactly the 10 expected
names. Nothing was changed — the hold was verified, not created.

## Step D0 — quiescence + closed inventory: PASS (evidence/d0/)
Two complete read-only samples 10m09s apart — s1 00:37:39Z,
s2 00:47:48Z — **identical across every compared value** and
matching the proposal §2 pre-state exactly: script etag
`72a4ee815e01af5cd505c580999e73633bd355aceb8513f4e9b024eb526e4669`;
settings revision 1 (lane standard, cap $50); quota attemptsToday
0 / spentMicroCents 371485 / ledgerSeq 19 (grant-time estimates,
not provider spend); watermarks content 18 / bindings 1800; plan
list exhaustive (nextCursor null) — smoke `complete`, Chapter 2
`plan:603ab416bd67ab1b25de97be` `halted_unknown` /
`phase_halted_unknown_billing` (38 entries = 20 `bound_already`
+ 18 `eligible`; entry execution states 8 failed +
1 unknown_billing + 29 none; totals eligible 18 / done 0 /
failed 8) with the unknown attempt **undisposed** — zero
disposition footprint; diagnostics (execution-plane only — **not**
proof of no queued message): Ch 2 exactly 9 records (8 failed at
commit + 1 unknown_billing), 51 attempts all phase `confirmed`;
smoke 2 records, 7 attempts all `confirmed` — 58 attempts total,
zero in `reserved`/`dispatching`; both D6 jobs carry exactly one
grant each, state `issued`, revision 2; Chapter 3 job
`parked_policy`, fingerprint recomputed by the G8 recipe =
`b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`
(exact), 27 rows (3 ready / 24 pending), grants [];
`/v2/conflicts` exactly the two recorded `schedule_dead` rows;
observability enabled + logs enabled + persist true; neighbors
unchanged (v1 etag `ea6f8196…`, v1 queue paused; staging etag
`61553a07…`).

## Step D1 — identity + envelope re-validation: PASS (evidence/d1/; no production contact)
- **Lineage (fresh reads):** `ui1-review` head ==
  `ea654d20…` (proposal pin); single-parent ancestry
  `ea654d20` → `6a73d962…` (SOURCE-PASS pin) → `76a9df55…`
  (disposition build) → `d2daa2e5…` (design Rev 2) — exactly §1.
- **Rowan's mandatory addition — four-file byte/blob comparison:**
  the four reviewed changed files were fetched as Git blobs from
  pin `6a73d962` (`review/ch2-disposition/worker/…`) and compared
  against the envelope parts (parts-manifest hashes as basis) —
  **all four MATCH byte-for-byte**: `generation/genstore.mjs`
  (47,108 B, SHA-256 `8602e45e…`), `generation/service.mjs`
  (76,860 B, `c4008d98…`), `generation/grant-guards.mjs`
  (12,936 B, `9249539f…`), `worker-entry-prod-d6.js`
  (64,548 B, `079e982b…`). (four-file-comparison.json.)
- **Envelope harness re-run** against the disposition tree:
  **18/18 PASS**, exit 0; regenerated artifacts byte-identical
  to the pinned package — envelope SHA-256 `7d82eccf…` exact,
  metadata `e08b06bc…`, manifest `543a3b31…`. The three negative
  mutations each FAIL validation (exit 1) with the approved
  failing sets: drop-seventh (E7–E10), typo-enforce (E8, E9),
  wrong-entry (E2).
- **Disposition suites re-run** against the LOCAL tree
  (`tests/ch2disp-disposition.test.mjs`,
  `tests/ch2disp-route.test.mjs`): **26 tests, 26 pass, 0 fail**,
  exit 0 — design tests 1–15 plus disp-16/17/18 (S1/S2).

## Step R — pre-upload recheck: PASS (00:48:21Z; evidence/r/)
Full inventory re-captured immediately before upload: identical
to D0 on every compared value; queue still PAUSED; halt still
"1"; live build still `28850807…`.

## Step D2 — upload (the one mutation): PASS (evidence/d2/)
Precondition read-back immediately before the PUT (00:48:4xZ):
`delivery_paused == true`, sole consumer unchanged,
`GENERATION_HALT "1"`. Envelope SHA-256 re-verified immediately
before upload: `7d82eccf…` exact. Multipart PUT of the exact
D1-validated bytes to `opalreader-api-v2-prod` (upload window
00:48:48–00:48:51Z): **HTTP 200, success, no errors**. New etag
**`a9a4c0c40ceefa6138c1cc8ebb3f0ab5b2205e7b7a057b865c8c312cbb13c39e`**;
deployment id **`ad23232d01fe433c8e2b66225153c8d3`**; entry point
`v2/worker-entry-prod-d6.js`; handlers [fetch, queue];
compatibility_date 2026-08-29 + nodejs_compat preserved; secrets
inherit-by-name. Read-backs: `/health` build ==
**`6a73d9622e1b4eac00c58e289de1c674ed6b3d6b`** (exact), generation
"halted"; bindings exactly the 10 expected names with
`GENERATION_HALT "1"` and `OPALREADER_PHASE_POLICY "enforce"`.

## Step D3 — observability: PASS, no PATCH (evidence/d3/)
Observability **survived** the upload (carried in the upload
metadata, as at G4, the seed-fix deploy, Gate 1, and the combined
deploy): GET script-settings shows enabled + logs enabled +
persist true, byte-identical to the pre-deploy shape. **The
conditional observability-only settings PATCH was therefore not
performed** — D2's PUT was the only mutation of this deploy. No
settings of any kind were edited, so no etag-unchanged PATCH
proof was required.

## Step D4 — post-state verification: PASS (00:49:21Z; evidence/d4/)
- Deployed-script download: **all 27 module parts byte-identical**
  to the validated envelope (parts-verification.json).
  Representation note, stated plainly: the GET script response
  carries the 27 module parts only — no `metadata` part is
  returned in that representation; the metadata's operative
  content is proven by the D2 PUT response (entry point,
  compatibility, handlers) and the GET /settings bindings
  read-back (exactly the 10 expected bindings, halt "1", policy
  "enforce"). Script etag on download == `a9a4c0c4…`, identical
  to the D2 PUT etag.
- **Comparison vs D0 under Rowan's mandatory interpretation
  (6536365406) — unchanged DATA, not identical JSON shapes**
  (compare-d4.log; tools/compare_d4.py): raw response bodies
  compared with the new build's legitimate additive keys
  recursively stripped — **all 21 surfaces IDENTICAL**: settings
  rev 1; quota unchanged; watermarks 18 / 1800; plan list
  identical (smoke `complete`; Ch 2 `halted_unknown` intact, its
  unknown attempt still undisposed); diagnostics identical
  (Ch 2 8 failed + 1 unknown_billing; 58 attempts all
  `confirmed`, zero reserved/dispatching); grants on both jobs
  unchanged; Ch 3 still `parked_policy` + fingerprint exact;
  conflicts identical; queue still PAUSED, sole consumer
  unchanged; observability identical; neighbors identical
  (v1, v1 queue, staging). No substantive mismatch was flagged
  away or skipped.
- **Zero unverified exposure, recorded explicitly** — the
  disposition code is live-but-dormant: capabilities FP phase
  exposes `estimatedUnverifiedMicroCents: 0` and
  `reservedUnverifiedMicroCents: 0`, with `remainingMicroCents`
  13,300,335 unchanged (identical to the legacy computation at
  zero reservation, as the source promises); both plan summaries
  expose `estimatedUnverifiedMicroCents: 0` and **no**
  `estimatedUnverifiedStatus` key (the `provider_unverified`
  status rides only when an adjudication exists; the count is
  0); both diagnostics views carry the new `phaseAccounting`
  block — settled 199,665 labeled
  `settledBasis: "recorded_known_existing_ledger"`, estimated 0,
  reserved 0, `unverifiedStatus: "provider_unverified"`,
  in-flight 0, `unknownOpen: 1` (phase-scoped per source: the
  one undisposed Chapter 2 unknown, visible identically from the
  smoke view because both plans share the phase).
- Per the proposal: **no playback smoke is claimed for this
  halted deploy** — D4 proves Worker identity and state
  containment only; nothing user-visible changed.

## Rollback posture (§5, standing)
Zero adjudication rows exist (the disposition writer never ran),
so the pre-adjudication window holds: rollback to `28850807…`
remains available **only** as a separately Julie-authorized
halted deploy, and only while zero adjudication rows exist,
re-verified from the store before any such upload. From the
first disposition onward, this build — pin `6a73d962…` and its
deployed etag `a9a4c0c4…` — is the §5.3 rollback floor. No
rollback was performed or needed here.

## NOT done (each remains Julie's separate later gate)
No adjudication call (the disposition route exists in the new
code and was **not** called); no reconcile invocation; no plan
retirement; no quarantine release; no queue unpause; no halt
flip / re-arm; no Chapter 3 action; no Batch arming; no client
publication; no generation; no spending. The deploy performed no
data writes of any kind; the lazily-ensured adjudication tables
were not created (their only writer never ran).

## Evidence
`~/workspace/ch2-program/disposition-deploy/evidence/` — stepP/,
d0/ (both samples + assessments + summary), d1/ (lineage reads,
blob fetches, four-file comparison, harness rerun + negatives,
suite run, summary), r/, d2/ (precondition, PUT response,
read-backs), d3/, d4/ (capture, assessment, parts verification,
data comparison + assertion log, summary), tools/ (the
capture/assess/upload/compare helpers for this run, adapted from
the combined deploy's proven tooling).

Executor note: one assertion in the executor's first D4
comparison draft expected the smoke diagnostics' phase-scoped
`unknownOpen` to read 0 on a plan-scope assumption; the source
(genstore `phaseAccounting`) and the pre-state both establish
phase scope, the correct expectation is 1 on both views, and the
final comparison (compare-d4.log) passes with the corrected
expectation. The underlying data never differed; the correction
is recorded here rather than silently absorbed.

## Final state
Build `6a73d9622e1b4eac00c58e289de1c674ed6b3d6b` LIVE on
`opalreader-api-v2-prod` (etag `a9a4c0c4…`, deployment
`ad23232d…`), `GENERATION_HALT "1"` (generation "halted"), queue
delivery PAUSED, settings revision 1, Chapter 2
`halted_unknown` (unknown undisposed), Chapter 3 `parked_policy`.
Generic re-arm remains BLOCKED pending its own separate
approvals; adjudication execution and plan retirement remain
separate Julie gates.

— Wren
