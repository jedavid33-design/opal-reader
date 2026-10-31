# DEPLOYMENT PROPOSAL — uncertainty-disposition package, halted pause-first

**Status: PROPOSAL ONLY.** Prepared by Wren under Rowan's SOURCE
PASS (issue #15, `jedavid33-design/opal-roundtable`, comment
6536181155), which cleared the S1/S2 focused HOLD and passed the
uncertainty-disposition build at pin
`6a73d9622e1b4eac00c58e289de1c674ed6b3d6b`. This is design §11
gate 4. **This proposal is not deployment authorization.** It
goes to Rowan for operational-plan review first; Julie's
explicit deployment decision comes after her review. Nothing in
this document, its pin, or its filing authorizes any production
action.

**Shape:** a Worker-only, halted, pause-first deploy modeled on
the combined Chapter 2 deploy (proposal pin `cf89a2e8…`;
executed Oct 30, 2026, record 6533267319), itself modeled on the
Gate-1 Option-B execution. Production is **already halted +
already queue-paused**, so the sequence is verify-and-hold:
**P → D0 → D1 → R → D2 → D3 → D4**. There is **no client
publication** and **no Step S / playback smoke** (see D4: the
new feature is operator-only and dormant until the separate
adjudication gate; nothing user-visible changes). The deploy
**ends still halted + still paused**. Adjudication execution,
plan retirement, and re-arm are later, separate Julie gates
(design §11 gates 5–7).

Rowan's required contents (6536181155) are carried as follows:
deterministic deployed build identity (§1) and etag (recorded
at D2, §3); full envelope/artifact proof (§1 + the envelope
proof report in this package); pre-state verification (§2 +
D0's two-sample method); queue PAUSED and generation HALTED at
every step (§3, verified at P, R, D2 precondition, D4);
read-back verification (D2/D4); a rollback procedure consistent
with the adjudication floor (§5, carrying design §5.3); STOP
criteria (§4).

---

## 1. Lineage and build identity

Reviewed identity (all pins on `ui1-review`,
`jedavid33-design/opal-reader`, single-parent linear chain):

```
6a73d9622e1b4eac00c58e289de1c674ed6b3d6b   S1/S2 corrections  ← DEPLOY THIS TREE
76a9df55e971396a489fc3dc5a8e82c4bb7466d3   disposition build (tests 1–15)
d2daa2e544bc2588573d1777c303c9cb9c433fc8   adjudication design Rev 2 (docs)
170876e04af2004fa01f8f698ea0dc1392d1ed0e   combined-deploy evidence (docs)
cf89a2e88c1b61b8e43b1981bd2389a5b314cf10   combined-deploy proposal (docs)
288508073b5218a6e0dd90b68d497a331ad872b6   fence + fixes = CURRENT LIVE WORKER
   … gen-pkg-1 lineage …
```

**New build identity:** per the build-marker rule, the deployed
Worker's `/health` build will read
**`6a73d9622e1b4eac00c58e289de1c674ed6b3d6b`** (the pin of the
tree being deployed). The marker needs **no tree edit**: as at
Gate 1 and the combined deploy, `host/build-identity.mjs` is the
envelope's sole stamp part — the tree on disk keeps
`BUILD_COMMIT = "UNBUILT"` (verified by the harness, E5/E6) and
the assembled part bytes carry the pin exactly once. The
validated envelope below is therefore already the exact byte
stream whose `/health` will report `6a73d962…`.

**Disposition-package content** (delta vs the live build's
source tree — exactly 4 modified worker files, 0 added,
0 removed, verified by recursive diff; 2 added test suites;
zero baseline-suite edits):

- **The disposition path (design §4/§7):** a new, separate
  store function `genstore.adjudicateEstimated` + an
  operator-only route in the reconcile fence class. It disposes
  ONE confirmed/unknown attempt as the distinct outcome
  `estimated_unverified`; `cost_micro_cents` stays NULL; the
  deployed reconcile machinery is untouched (the new outcome
  joins none of `ATTEMPT_OUTCOMES`, `KNOWN_OUTCOMES`,
  `SETTLEMENT_OUTCOMES`); figures are server-derived only
  (estimate = the attempt's own-length `expectedCostMicro` from
  its plan entry; reservation = the attempt row's recorded
  `upper_micro_cents`); caller-supplied figures refuse.
  (`generation/genstore.mjs`, `generation/service.mjs`,
  `worker-entry-prod-d6.js`.)
- **Adjudication schema (§5.1):** `d6_billing_adjudications` +
  the append-only amendments table — additive **lazy DDL beside
  their only writer**, NOT in `GEN_SCHEMA`, no ALTER. The
  amendment OPERATION/route does **not** ship (schema only;
  its absence is test-pinned). This deploy never invokes the
  disposition, so it creates **no** new schema (§5).
- **Presence-checked accounting (§5.4/§6):** read-only
  `sqlite_master` pair-presence check on every accounting read
  (both absent ⇒ unverified figures exactly zero, reads never
  run DDL; both present ⇒ strict sums; exactly one present ⇒
  throw `adjudication_schema_inconsistent`); `phaseAccounting`
  keeps its three deployed definitions verbatim and adds
  `estimatedUnverifiedMicro` / `reservedUnverifiedMicro`;
  capabilities remainder subtracts the reservation (Q4);
  `provider_unverified` stays visible in diagnostics and
  plan/phase summaries even after retirement.
  (`generation/genstore.mjs`, `generation/service.mjs`.)
- **Grant-guard shape fence (§6.2):** the guard refuses
  `phase_accounting_incomplete` when either unverified field is
  missing or not a safe integer. (`generation/grant-guards.mjs`.)
- **S1/S2 corrections (Rowan 6535697368, cleared 6536181155):**
  S1 — `adjudicateEstimated` refuses
  `adjudication_cost_inconsistent` unless the source row's
  `cost_micro_cents` is precisely NULL, before any
  DDL/UPDATE/INSERT. S2 — `unverifiedAccounting` throws
  `adjudication_row_missing` for any `estimated_unverified`
  attempt lacking its linked unamended adjudication row (the
  throw propagates through phase accounting, capabilities, plan
  summaries, and the grant guard); `d6PhaseBudgetCheck` also
  rejects negative unverified figures as
  `phase_accounting_incomplete`.
- **Battery on the reviewed tree (Wren-run, Rowan-inspected):**
  129 suites 107 pass / 22 fail; 1,041 tests 1,019 pass /
  22 fail; zero assertion failures; the 22 failing suites are
  exactly the recorded D8 baseline set (byte-identical failing
  list); design tests 1–15 all pass, plus disp-16/17/18 for
  S1/S2. Disclosed harness caveat (BUILD-REPORT §6): the
  lazy-DDL-inside-the-transaction path is proven against real
  node:sqlite transactional DDL but its first execution against
  the production Durable Object is necessarily the adjudication
  gate itself — **this deploy does not exercise it** (the
  writer never runs), the same posture as the live-proven
  reconcile/retirement lazy-DDL precedents.

**Deploy envelope (validated, not a spec):** assembled from the
disposition tree by the actual-envelope harness (the combined
package's proven harness with the tree/pin substitutions and
one log-label correction — see the proof report); **PASS
18/18**, all three negative mutations FAIL as required with the
same failing check sets as the combined proof. 27 module
parts, 1,256,138 module bytes; envelope 1,263,057 bytes,
**SHA-256
`7d82eccf80b1f8fd5d38f9dd7deafb1f2b41a72829f14dc1b4e962acc394ee32`**;
metadata SHA-256 `e08b06bc…` — byte-identical to the Gate-1 and
combined-deploy metadata (same spec `0dafd14c…`, same 7 spec
bindings + 3 inherit secrets, `GENERATION_HALT "1"`,
`OPALREADER_PHASE_POLICY "enforce"`, compatibility 2026-08-29 +
nodejs_compat, observability per spec, no `migrations` key).
Part set identical to the combined envelope (27/27); changed
bytes are exactly the four disposition files plus the stamp
part. Full proof: `envelope/ENVELOPE-PROOF-REPORT.md` +
`parts-manifest.json` in this package.

**Live identity superseded:** Worker `opalreader-api-v2-prod`,
build `288508073b5218a6e0dd90b68d497a331ad872b6`, etag
`72a4ee815e01af5cd505c580999e73633bd355aceb8513f4e9b024eb526e4669`,
deployment id `ccb584808ab84132a6484d0627463515` (as recorded by
the combined deploy's execution record; re-verified at D0/D2
execution time).

---

## 2. Expected pre-state (re-verified at D0; proposal-time reads noted)

Basis: the combined deploy's verified post-state (execution
record, comment 6533267319 — D4 found the post-state identical
to its D0 on every compared value except build/etag), plus
fresh read-only checks taken at proposal time (Oct 30, 2026
~8:07 p.m. ET — `/health`, queue GET, script-settings GET,
script /settings GET; nothing mutated):

- `/health`: build `288508073b5218a6e0dd90b68d497a331ad872b6`,
  generation **"halted"**, scope production, coordinator
  "armed".
- Bindings (GET /settings): exactly the 10 expected names —
  `GENERATION_HALT` plain_text **"1"**, `OPALREADER_PHASE_POLICY`
  plain_text **"enforce"**, 3 secrets by name (values never read).
- Queue `opalreader-generation-v2` (id
  `93b6a35fb8cf4788a91a2c90b748ae66`): **delivery_paused: true**;
  sole consumer `f260f2188d80426bb0588685e9d084eb`
  (`opalreader-api-v2-prod`); producer `opalreader-api-v2-prod`.
- Observability (GET script-settings): enabled + logs enabled
  + persist true — the shape the combined deploy left in place.

Expected at D0 (execution-time re-verification, two samples
≥10 min apart per the Gate-1 / combined pattern, closed
inventory — every compared value identical across both samples
and to this section):

- Script etag `72a4ee81…`; settings revision **1** (lane
  standard, cap $50); quota view unchanged (attemptsToday 0 /
  spentMicroCents 371485 / ledgerSeq 19 — grant-time estimates,
  not provider spend).
- Watermarks: content 18 / bindings 1800.
- Plan inventory exactly: smoke plan `complete`; Chapter 2 plan
  `plan:603ab416bd67ab1b25de97be` **`halted_unknown`**
  (stopReason `phase_halted_unknown_billing`; 38 entries =
  20 `bound_already` + 18 `eligible`; diagnostics: 8 failed +
  1 unknown_billing + 9 never attempted; 0 committed); Chapter 3
  job **`parked_policy`**, fingerprint **`b991f18a…`** recomputed
  exact by the G8 recipe.
- Diagnostics (execution-plane only — **not** proof of no queued
  message): 58 total confirmed attempts account-wide (51 Ch 2 +
  7 smoke), zero in `reserved`/`dispatching`; grants on both D6
  jobs as recorded at Gate 1 (each one grant, state `issued`,
  revision 2).
- Phase binding recorded: `forever-pucked` ↔ bookId
  `5c589095-f812-48a2-8ab2-03ba2791f2b2`.
- `/v2/conflicts`: exactly the two recorded `schedule_dead` rows.
- **Zero disposition footprint:** no adjudication has ever
  executed; the unknown attempt stands undisposed. (The
  adjudication tables are created only by the disposition
  transaction itself, which has never run — so no adjudication
  rows exist. This is the precondition §5's pre-adjudication
  rollback window depends on, and D0/D4 re-verify the plan's
  undisposed state through the diagnostics/plan surfaces.)
- Neighbors unchanged: v1 Worker etag `ea6f8196…`, v1 queue
  paused; staging etag `61553a07…`; client `main` @ `232cc00e…`
  (untouched by this deploy).

---

## 3. Ordered steps (P → D0 → D1 → R → D2 → D3 → D4)

**Step P — Verify-and-hold (no new pause).** Read the queue:
`delivery_paused` must already be `true`, sole consumer
unchanged; read `/health`: generation must read "halted" and
the `GENERATION_HALT` binding must read "1". **STOP** if the
queue is not paused, the consumer set differs, or generation is
not halted — do not "fix" the state under this proposal; report.
(If the queue were found unpaused, pausing it would be the
Gate-1 Step P action and would require the executor to record
the deviation and re-seek direction before proceeding.)

**Step D0 — Quiescence + closed inventory (read-only).** Two
complete samples ≥10 min apart under containment; every
compared value identical: §2 inventory exact (plan states, Ch 2
counts incl. the undisposed unknown, Ch 3 fingerprint, settings
rev, quota view, watermarks, conflicts rows, grants, script
etag, neighbors). **STOP** on any drift between samples or
from §2.

**Step D1 — Identity + envelope re-validation (no production
contact).** Re-read `ui1-review`: head must be the proposal
pin's lineage tip carrying this proposal, with `6a73d962…` the
reviewed tree pin in its ancestry exactly as §1. Re-run the
envelope harness against the disposition tree: 18/18 PASS,
envelope SHA-256 must equal `7d82eccf…` exactly; re-run the
three negative mutations (each must FAIL validation). Re-run
the two disposition suites against the LOCAL tree
(`tests/ch2disp-disposition.test.mjs`,
`tests/ch2disp-route.test.mjs` — tests 1–15 + disp-16/17/18;
run against the local harness, never production). **STOP** on
any mismatch.

**Step R — Re-check (read-only).** Full §2 re-check immediately
before upload: inventory identical to D0; queue still PAUSED;
halt still "1". Per the signed Option-B interpretation: a
Step-P/R error STOP takes priority even if a later read-back
shows the expected state. **STOP** on any difference.

**Step D2 — Upload (the only mutation in this proposal).**
Precondition read-back: `delivery_paused == true` and halt "1",
taken immediately before the PUT. Re-verify the envelope
SHA-256 immediately before upload. Multipart PUT of the exact
D1-validated bytes to `opalreader-api-v2-prod`: main_module +
filename attributes, secrets inherit-by-name, `GENERATION_HALT
"1"` in metadata (lands halted — the same value as live; this
deploy changes code only). Record: HTTP status, new etag,
deployment id. Read-backs: `/health` build ==
`6a73d9622e1b4eac00c58e289de1c674ed6b3d6b`, generation "halted";
bindings exactly the 10 expected names with halt "1" and phase
policy "enforce". **STOP** on any read-back mismatch (rollback
per §5).

**Step D3 — Observability (C1-style conditional PATCH).** GET
script-settings: observability must show enabled + logs
enabled + persist (it is carried in the upload metadata, as at
G4, the seed-fix deploy, Gate 1, and the combined deploy — at
every one of those deploys it survived and no PATCH was
needed). **If and only if** the upload reset observability to
null: re-apply it with ONE observability-only settings PATCH —
multipart PATCH to
`/workers/scripts/opalreader-api-v2-prod/settings` (the write
path is `/settings`, NOT `/script-settings`), a single
`settings` part (Content-Type application/json) holding the
approved observability object only; no other settings edits of
any kind. Then verify the script etag is **unchanged** by the
PATCH (the settings PATCH does not touch code) and read the
restored observability back. **STOP** if observability cannot
be restored with the etag unchanged.

**Step D4 — Post-state verification (read-only).** Download the
deployed script and verify **all 27 module parts
byte-identical** to the validated envelope. Representation
note, stated plainly (from the combined deploy's record): the
GET script response carries the 27 module parts only — no
`metadata` part is returned in that representation; the
metadata's operative content is proven by the D2 PUT response
(entry point, compatibility, handlers) and the GET /settings
bindings read-back (exactly the 10 expected bindings, halt
"1", policy "enforce"). Script etag on download must equal the
D2 PUT etag. Then: queue still PAUSED, sole consumer unchanged;
settings revision still 1; quota view unchanged; watermarks
18 / 1800; plan list exactly the §2 plans with identical states
(Ch 2 still `halted_unknown`, its unknown attempt still
undisposed); diagnostics identical (58 confirmed attempts, zero
reserved/dispatching); grants unchanged; Ch 3 still
`parked_policy` + fingerprint exact; conflicts identical;
neighbors identical (v1, v1 queue, staging, client).
**No playback smoke is claimed or proposed for this halted
deploy:** the deploy swaps Worker code only; the one new
surface is an operator-only route that stays dormant until the
separate adjudication gate, and nothing user-visible changes —
the client is untouched and the state plane is unchanged, so
Julie may listen freely at any time, as throughout. **STOP** on
any mismatch (rollback per §5).

**End state:** new build `6a73d962…` LIVE, generation HALTED
(`GENERATION_HALT "1"`), queue delivery PAUSED, settings rev 1,
Ch 2 `halted_unknown` (unknown undisposed), Ch 3
`parked_policy`. Nothing adjudicated, nothing reconciled,
nothing retired, nothing released, nothing unpaused, nothing
generated, nothing spent.

---

## 4. STOP conditions (any step)

Any value differing from §2/§3 expectations; any envelope hash,
part, or identity mismatch; any non-200 or ambiguous mutation
response (read back before concluding anything — a bodiless or
failed call is never assumed to have landed or not landed);
queue-state UNKNOWN at any point; observability unrestorable
with etag unchanged; any urge to widen scope (client change,
data write, operator-route execution — including a "test"
disposition call) — all are outside this proposal. On STOP:
preserve all evidence, change nothing further; containment is
read-back only — **no automatic retry, rollback, or
fix-forward**; any of those requires fresh Julie authorization.
Report to Julie and the board. A stopped deploy is never
restarted on the executor's own call; a fresh Julie Go covers
one attempt.

## 5. Rollback

- **Primary posture: fix-forward.** If D4 fails on a defect in
  the new code, the system is already in its safest state
  (halted + paused; the deploy writes no data), so diagnosis
  proceeds without time pressure and any corrective deploy is a
  new, separately authorized act.
- **Pre-adjudication code rollback (available, time-boxed by
  fact, not by clock):** re-upload of the current-live build
  `288508073b5218a6e0dd90b68d497a331ad872b6`. Its upload envelope
  is deterministically re-assemblable from its pin and was
  validated at the combined deploy's D1 and executed at its D2
  (envelope SHA-256 `9c5f1ce4…`, 28 parts incl. metadata). This
  rollback is permissible **only while zero adjudication rows
  exist** — i.e., only before any disposition has executed.
  That precondition holds by construction at this deploy (the
  disposition writer never runs under it) and must be
  re-verified from the diagnostics/plan read-backs before any
  rollback upload. A rollback upload is itself a deploy: it
  requires Julie's authorization and the same D3/D4
  verification, and it lands halted + paused identically.
- **Schema honesty:** this deploy introduces exactly two new
  table definitions, `d6_billing_adjudications` and
  `d6_billing_adjudication_amendments`, and both are **lazily
  ensured beside their only writer** (the disposition store
  path) — they are NOT in the eager schema bootstrap, and this
  proposal never executes a disposition, so the deploy itself
  creates **no** new schema. If a later, separately authorized
  disposition ever creates them, the tables are additive-only
  and are never read by the `28850807…` code — per design §5.3,
  code rollback before any disposition executes is clean
  precisely because the tables are additive and unread by prior
  code and the new outcome value exists nowhere in data. No
  schema rollback is needed or proposed. All other
  disposition-tree changes are code-only.
- **Post-disposition floor (design §5.3, carried as standing
  law for every later rollback):** once **any** adjudication
  row exists, the disposition build — identified by this
  deploy's pin `6a73d9622e1b4eac00c58e289de1c674ed6b3d6b` and its
  deployed script etag, both to be recorded in the disposition
  execution record (design §12) — is the **rollback floor**:
  the oldest build that may ever run against the store while
  any adjudication row exists. **Rollback to any
  pre-disposition build (including `28850807…`) is PROHIBITED**
  for exactly as long as an adjudication row exists: a
  pre-disposition build's accounting would silently omit the
  unverified reservation and the `provider_unverified` status,
  and a re-arm on such a build would spend against a budget
  that has forgotten the exposure.
  - **Pre-rollback holds (Decision 2), before ANY
    post-disposition rollback, including to an
    adjudication-aware target:** (1) capture an **external
    adjudication read-back** — the adjudication rows and the
    affected phase's full five-figure accounting via the
    operator/diagnostics reads — and archive it **outside the
    worker** with the rollback record; it is the exit gate's
    comparison baseline. (2) **Verify and hold
    `GENERATION_HALT=1`**: settings/bindings read-back shows
    `"1"` and `/health` reports generation halted (set it and
    read back first if it is not set). (3) **Verify the queue
    is PAUSED** (`delivery_paused` = true, cf-api read-back).
    (4) **Generic re-arm is BLOCKED for the whole window**:
    from the first rollback step until the exit gate passes —
    no halt flip, no queue unpause, no grant, no generation, no
    spend, for any reason, including "test" unpauses.
  - **Exit gate (Decision 3), verifiable:** the rollback is not
    complete, and the halt/queue posture may not change for any
    reason, until all of the following are read back from the
    live build and match: `/health` build identity equals the
    intended target AND the target is at or above the rollback
    floor — where "at or above" means **proven adjudication
    compatibility of the exact target build** (its accounting
    behavior demonstrated, per Rowan's implementation
    verification requirement — NOT merely a newer SHA, date, or
    branch position); the capabilities phase object for every
    phase holding adjudications exposes
    `estimatedUnverifiedMicroCents` and
    `reservedUnverifiedMicroCents` with values **exactly equal**
    to the archived pre-rollback read-back; the disposed plan's
    summary still shows its estimate with the
    `provider_unverified` status. An absent key or a value
    mismatch means the live build cannot account for the
    disposition: **re-arm remains BLOCKED and spend remains
    prohibited**; the only exits are rolling forward (or
    restoring) to an adjudication-aware build and re-running
    the gate.
  - **Honest residual (design §5.3):** the floor is a mandatory
    operator procedure — procedural + verification-based, not a
    mechanically enforced cross-version guarantee. An operator
    rollback performed in defiance of this runbook could still
    cause the omission; that is why the floor is recorded here,
    in the design, and (at gate 5) in the disposition execution
    record, and why the Decision-2 holds **precede** any
    rollback rather than follow it.
- **Data:** the deploy performs no data writes of any kind, so
  there is nothing to roll back in the data plane.

## 6. What this deploy does NOT do

Each of the following remains a separate, later Julie gate,
none of them authorized by this proposal or by its approval:

- executing the disposition call (`adjudicateEstimated`)
  against the Chapter 2 unknown attempt (design §11 gate 5 —
  its own approval, recorded as the call's `authorizationRef`,
  with fresh pre-state identity reads per §12; the execution
  record there also pins this build + its deployed etag as the
  §5.3 rollback floor and archives the external adjudication
  read-back);
- executing the known-cost reconcile route — the original §6
  route remains **NOT SUBMITTED** and is not revived by this
  deploy (no Google per-attempt charge has been established);
- retiring the halted Chapter 2 plan (gate 6);
- unpausing the queue or flipping `GENERATION_HALT` (re-arm,
  gate 7); any quarantine release; the Chapter 3 parked-job
  resume;
- Batch arming; any generation intent; any spending;
- any client publication (the live client already contains the
  gen-pkg-1 + gen-fix-1 surfaces and needs no change);
- the amendment operation/route (schema ships; the operation
  is a separate future chain if provider evidence ever
  appears — design §8/Q3).

## 7. Julie's approval request (text for the decision, after Rowan's plan review)

> ❗️ **Deploy decision — uncertainty-disposition package.**
> Rowan has passed the disposition build (including her two
> safety catches, now fixed) and (pending her sign-off on this
> plan) the deploy plan. Approving deploys the new Worker code
> **while everything stays halted and the queue stays paused** —
> the same verify-and-hold pattern as the last two deploys:
> prove nothing has drifted, upload, verify the deployed bytes
> and the untouched state, stop. The new code only *adds* the
> tool that will later settle the one mystery Chapter 2 charge
> as an honest estimate — it does **not** run that tool, does
> **not** retire the halted plan, does **not** re-arm, and
> generates and spends **nothing**. After it lands, the
> adjudication itself, the retirement, re-arming, and Chapter
> 2's fresh go each come back to you as separate taps.
