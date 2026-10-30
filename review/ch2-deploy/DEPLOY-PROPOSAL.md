# DEPLOYMENT PROPOSAL — combined Chapter 2 package (fence + fixes), halted pause-first

**Status: PROPOSAL ONLY.** Prepared by Wren under Rowan's ruling
6532784704 (issue #15, `jedavid33-design/opal-roundtable`), which
cleared the F1/F2 focused HOLD, confirmed the Workstream A fence
SOURCE PASS at pin `288508073b5218a6e0dd90b68d497a331ad872b6`, and
kept Workstream B's B1/B2/B3 SOURCE PASS in force. **This proposal
is not deployment authorization.** It goes to Rowan for
operational-plan review/sign-off first; Julie's explicit
deployment decision comes after her review. Nothing in this
document, its pin, or its filing authorizes any production action.

**Shape:** a Worker-only, halted, pause-first deploy modeled on
the Gate-1 Option-B execution (order P → D0 → D1 → R → D2 → D3 →
D4 → S; executed Oct 30, 2026, record 6529680512), adapted to
present facts: the queue is **already paused** and generation is
**already halted** (Step P verifies-and-holds rather than newly
pausing), **no client publication** is part of this deploy, there
is **no Step S** (no attended smoke is proposed — the deploy ends
halted and paused, and playback is untouched by a Worker-only
code swap verified at D4), and the deploy **ends still halted +
still paused**. Re-arm is a later, separate Julie gate.

---

## 1. Lineage and build identity

Reviewed identity (all pins on `ui1-review`,
`jedavid33-design/opal-reader`, single-parent linear chain):

```
288508073b5218a6e0dd90b68d497a331ad872b6   F1/F2 fence corrections  ← DEPLOY THIS TREE
ca504eea9a006435867edd713eefec19bb5ea7cb   fence build (T1–T15)
62365a82d8d401913695712d0d0648ededf7b966   B1/B2/B3 corrections
2261f8ff90b1db118fbcef1b506d899b8541968b   A fence design Revision 1 (docs)
22a849a87b36c8f6688e2d4804e586afe84287d0   B fix package build
8bd9d4ac748d9d8c68fc5d9bda8af769c971f315   A fence design packet (docs)
548a0ffefdd263643506ed26fd984aa8dbb449b4   gen-fix-1 (current LIVE client base)
   … gen-pkg-1 lineage …
f3b6e6e9fd7a44532ceef86e484a79e466b36d4d   gen-pkg-1 candidate = CURRENT LIVE WORKER
```

**New build identity:** per the build-marker rule, the deployed
Worker's `/health` build will read
**`288508073b5218a6e0dd90b68d497a331ad872b6`** (the pin of the
tree being deployed), carried in the envelope's sole stamp part
(`host/build-identity.mjs`; the tree on disk keeps `"UNBUILT"`).

**Combined-package content** (delta vs the live build's source
tree — exactly 6 modified worker files, 0 added, 0 removed;
4 added test suites; zero baseline-suite edits):

- **Workstream B fixes** — B1: Gemini 3.8 interactions adapter
  marks a no-audio HTTP-200 `contentBlocked` only on clear
  policy-refusal evidence; unclassified no-audio stays on the
  unknown-billing path (`host/adapters.mjs`). B2: operator-only
  `POST /v2/d6-reconcile-unknown` route with required `planId` +
  explicit settlement outcome; settlement vocabulary
  success / failed_known / no_charge validated as a (cost,
  outcome) pair in the store (`worker-entry-prod-d6.js`,
  `generation/genstore.mjs`, `generation/service.mjs`). B3:
  pre-split of >1,200-char segments at the executor's
  pre-dispatch seam, incidence-reduction claim only
  (`generation/policy-split.mjs`, additions only;
  `generation/d6-executor.mjs` seam).
- **Workstream A fence** — strict, fail-closed plan-state
  dispatch fence in the executor's pre-claim block: one
  authoritative resolution from persisted records
  (`d6_plan_jobs` + job `data_json`) feeding both the quarantine
  check and the state fence; refusal of `complete` / `partial` /
  `retired` / `halted_unknown` before claim, execution, spend
  intent, attempt, or provider contact; F1 (each message-carried
  plan field validated independently) and F2 (present-but-blank
  stamps/links are corruption, not absence) included
  (`generation/d6-executor.mjs`).
- **Battery on the reviewed tree (Wren-reported, Rowan-inspected):**
  127 suites 105 pass / 22 fail; 1,015 tests 993 pass / 22 fail;
  zero assertion failures; the 22 failing suites are exactly the
  recorded D8 baseline set; fence suite 29/29; B suites 9/9 each;
  the mandatory R4-1 non-resumption regression passes in both
  halt states.

**Deploy envelope (validated, not a spec):** assembled from the
combined tree by the proven actual-envelope harness; **PASS
18/18**, all three negative mutations FAIL as required.
27 module parts, 1,217,416 module bytes; envelope 1,224,335
bytes, **SHA-256
`9c5f1ce4103dea7d07099f2332c954cdecd25c299e12f14077ccf9b9033ff21a`**;
metadata SHA-256 `e08b06bc…` — byte-identical to the Gate-1
metadata (same spec `0dafd14c…`, same 7 spec bindings +
3 inherit secrets, `GENERATION_HALT "1"`,
`OPALREADER_PHASE_POLICY "enforce"`, compatibility 2026-08-29 +
nodejs_compat, observability per spec, no `migrations` key).
Closure delta vs the gen-pkg-1 envelope fully explained: +1 part
`v2/generation/quarantine.mjs` (byte-identical file; newly
reachable because the fenced executor imports it directly).
Full proof: `envelope/ENVELOPE-PROOF-REPORT.md` +
`parts-manifest.json` in this package.

**Live identity superseded:** Worker `opalreader-api-v2-prod`,
build `f3b6e6e9fd7a44532ceef86e484a79e466b36d4d`, etag
`82b3be1db8a75758128cab38b363985795ac223bdf1812d9698c5c8a07730545`
(etag as recorded at Gate 1; re-verified at D0/D2 execution time).

---

## 2. Expected pre-state (re-verified at D0; proposal-time reads noted)

Read-only checks taken at proposal time (Oct 30, 2026 ~16:30 ET —
`/health`, queue GET, script-settings GET; nothing mutated):

- `/health`: build `f3b6e6e9…`, generation **"halted"**, scope
  production, coordinator "armed".
- Bindings (GET /settings): exactly the 10 expected names —
  `GENERATION_HALT` plain_text **"1"**, `OPALREADER_PHASE_POLICY`
  plain_text **"enforce"**, 3 secrets by name (values never read).
- Queue `opalreader-generation-v2` (id
  `93b6a35fb8cf4788a91a2c90b748ae66`): **delivery_paused: true**;
  sole consumer `f260f2188d80426bb0588685e9d084eb`
  (`opalreader-api-v2-prod`); producer `opalreader-api-v2-prod`.

Expected at D0 (execution-time re-verification, two samples
≥10 min apart per the Gate-1 pattern):

- Settings revision **1** (lane standard, cap $50); quota view
  unchanged (attemptsToday 0 / spentMicroCents 371485 /
  ledgerSeq 19 — grant-time estimates, not provider spend).
- Watermarks: content 18 / bindings 1800.
- Plan inventory exactly: smoke plan `complete`; Chapter 2 plan
  `plan:603ab416bd67ab1b25de97be` **`halted_unknown`**
  (stopReason `phase_halted_unknown_billing`; 8 failed +
  1 unknown_billing + 9 never attempted; 0 committed); Chapter 3
  job **`parked_policy`**, fingerprint **`b991f18a…`** recomputed
  exact by the G8 recipe.
- Phase binding recorded: `forever-pucked` ↔ bookId
  `5c589095-f812-48a2-8ab2-03ba2791f2b2`.
- `/v2/conflicts`: exactly the two recorded `schedule_dead` rows.
- Neighbors unchanged: v1 Worker etag `ea6f8196…`, v1 queue
  paused; staging etag `61553a07…`; client `main` @ `232cc00e…`
  (untouched by this deploy).

---

## 3. Ordered steps (adapted P → D0 → D1 → R → D2 → D3 → D4)

**Step P — Verify-and-hold (no new pause).** Read the queue:
`delivery_paused` must already be `true`, sole consumer
unchanged; read `/health`: generation must read "halted" and
`GENERATION_HALT` binding must read "1". **STOP** if the queue is
not paused, the consumer set differs, or generation is not
halted — do not "fix" the state under this proposal; report.
(If the queue were found unpaused, pausing it would be the
Gate-1 Step P action and would require the executor to record
the deviation and re-seek direction before proceeding.)

**Step D0 — Quiescence + closed inventory (read-only).** Two
complete samples ≥10 min apart under containment; every compared
value identical: §2 inventory exact (plan states, Ch 2 counts,
Ch 3 fingerprint, settings rev, quota view, watermarks,
conflicts rows, grants on both D6 jobs as recorded at Gate 1,
neighbors). **STOP** on any drift between samples or from §2.

**Step D1 — Identity + envelope re-validation (no production
contact).** Re-read `ui1-review`: head must be the proposal pin's
lineage tip carrying this proposal, with `28850807…` the reviewed
tree pin in its ancestry exactly as §1. Re-run the envelope
harness against the combined tree: 18/18 PASS, envelope SHA-256
must equal `9c5f1ce4…` exactly; re-run the three negative
mutations (each must FAIL validation). Re-run the adversarial
spoofed-planId test set against the combined tree (the Gate-1 D1
pattern: concealment defeated at the executor fence, the
per-occurrence granted-state check, and the linkage-resolving
grant guard; positive control commits — run against the LOCAL
harness, never production). **STOP** on any mismatch.

**Step R — Re-check (read-only).** Full §2 re-check immediately
before upload: inventory identical to D0; queue still PAUSED;
halt still "1". Per the signed Option-B interpretation: a
Step-P/R error STOP takes priority even if a later read-back
shows the expected state. **STOP** on any difference.

**Step D2 — Upload (the only mutation in this proposal).**
Precondition read-back: `delivery_paused == true` and halt "1",
taken immediately before the PUT. Re-verify the envelope SHA-256
immediately before upload. Multipart PUT of the exact
D1-validated bytes to `opalreader-api-v2-prod`: main_module +
filename attributes, secrets inherit-by-name, `GENERATION_HALT
"1"` in metadata (lands halted — the same value as live; this
deploy changes code only). Record: HTTP status, new etag,
deployment id. Read-backs: `/health` build ==
`288508073b5218a6e0dd90b68d497a331ad872b6`, generation "halted";
bindings exactly the 10 expected names with halt "1" and phase
policy "enforce". **STOP** on any read-back mismatch (rollback
per §5).

**Step D3 — Observability.** GET script-settings: observability
must show enabled + logs enabled + persist (it is carried in the
upload metadata, as at G4, the seed-fix deploy, and Gate 1). If
reset to null: re-apply via the multipart PATCH to
`/workers/scripts/opalreader-api-v2-prod/settings` (single
`settings` part; observability object only), then verify the
script etag is **unchanged** by the PATCH (the settings PATCH
does not touch code). **STOP** if observability cannot be
restored with the etag unchanged.

**Step D4 — Post-state verification (read-only).** Download the
deployed script and verify **28/28 parts byte-identical** to the
validated envelope (27 modules + metadata); script etag == the
D2 PUT etag. Then: queue still PAUSED, sole consumer unchanged;
settings revision still 1; quota view unchanged; watermarks
18 / 1800; plan list exactly the §2 plans with identical states;
diagnostics read (stated at true strength: execution-plane only,
not proof of no queued message) — Ch 2 exactly 8 failed +
1 unknown_billing, zero attempts in `reserved`/`dispatching`;
Ch 3 job still `parked_policy` + fingerprint exact; grants on
both jobs unchanged; conflicts identical; neighbors identical
(v1, staging, client). Playback/sync sanity: the client is
untouched and the state plane is unchanged, so no device step is
proposed; Julie may listen freely at any time, as throughout.
**STOP** on any mismatch (rollback per §5).

**End state:** new build `28850807…` LIVE, generation HALTED
(`GENERATION_HALT "1"`), queue delivery PAUSED, settings rev 1,
Ch 2 `halted_unknown`, Ch 3 `parked_policy`. Nothing generated,
nothing spent, nothing reconciled, nothing retired, nothing
released, nothing unpaused.

---

## 4. STOP conditions (any step)

Any value differing from §2/§3 expectations; any envelope hash,
part, or identity mismatch; any non-200 or ambiguous mutation
response (read back before concluding anything — a bodiless or
failed call is never assumed to have landed or not landed);
queue-state UNKNOWN at any point; observability unrestorable
with etag unchanged; any urge to widen scope (client change,
data write, operator-route execution) — all are outside this
proposal. On STOP: preserve all evidence, change nothing
further, report to Julie and the board. A stopped deploy is
never restarted on the executor's own call; a fresh Julie Go
covers one attempt.

## 5. Rollback

- **Primary posture: fix-forward.** If D4 fails on a defect in
  the new code, the system is already in its safest state (halted
  + paused; the deploy writes no data), so diagnosis proceeds
  without time pressure and any corrective deploy is a new,
  separately authorized act.
- **Code rollback (available):** re-upload of the archived
  current-live build `f3b6e6e9…`. Its upload envelope is
  deterministically re-assemblable from its pin and was
  replay-proven byte-identical at Gate 1 D1 (envelope SHA-256
  `9cb9d0da…`, 26 parts). A rollback upload is itself a deploy:
  it requires Julie's authorization and the same D3/D4
  verification, and it lands halted + paused identically.
- **Schema honesty:** this deploy introduces exactly one new
  table definition, `d6_reconcile_audit`, and it is **lazily
  ensured beside its only writer** (the reconcile store path) —
  it is NOT in the eager schema bootstrap, and this proposal
  never executes reconcile, so the deploy itself creates **no**
  new schema. If a later, separately authorized reconcile ever
  creates it, the table is additive-only and is never read by the
  `f3b6e6e9…` code — rolling back across it is safe, and no
  schema rollback is needed or proposed. All other combined-tree
  changes are code-only; the fence reads tables that already
  exist live (quarantine machinery shipped in `f3b6e6e9…`).
- **Data:** the deploy performs no data writes of any kind, so
  there is nothing to roll back in the data plane.

## 6. What this deploy does NOT do

Each of the following remains a separate, later Julie gate,
none of them authorized by this proposal or by its approval:

- executing the reconcile route against the Chapter 2 unknown
  attempt (and its precondition: **independent provider billing
  evidence** in hand before asserting no-charge or any known
  cost — never inferred from an API parameter);
- retiring the halted Chapter 2 plan;
- unpausing the queue or flipping `GENERATION_HALT` (re-arm);
- any quarantine release; the Chapter 3 parked-job resume;
- Batch arming; any generation intent; any spending;
- any client publication (the live client already contains the
  gen-pkg-1 + gen-fix-1 surfaces and needs no change).

## 7. Julie's approval request (text for the decision, after Rowan's plan review)

> ❗️ **Deploy decision — combined Chapter 2 package.**
> Rowan has passed the fence source and the three Chapter 2
> fixes, and (pending her sign-off on this plan) the deploy plan.
> Approving deploys the new Worker code **while everything stays
> halted and the queue stays paused** — the same pause-first
> pattern as Gate 1: verify the hold, prove nothing has drifted,
> upload, verify the deployed bytes and the untouched state,
> stop. It does **not** reconcile or retire the Chapter 2 plan,
> does **not** re-arm, and generates and spends **nothing**.
> After it lands, clearing the halted plan, re-arming, and
> Chapter 2's fresh go each come back to you as separate taps.
