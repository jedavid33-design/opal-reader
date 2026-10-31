# COMBINED DEPLOYMENT — REVISED PLAN (Option 3 + the four amendments)

**Tree:** the combined local tree at `~/workspace/ch2-program/quota-routes/`
(cache remediation + quota guard + quota-fix + quota-fix2 + the quota
operator routes), to be pinned fresh on `ui1-review` in repo
`jedavid33-design/opal-reader` after Rowan's source review of the
combined tree.
**Supersedes:** `deploy-proposal/DEPLOY-PROPOSAL.md` (pin
`6a7301dca1b0f411b773c85e4c9d77620039270b`, filed as board comment
6545996086, Handoff RT-H-20261031-c3ba88), as amended by Rowan's
operational review 6546037460 (CONDITIONAL PLAN PASS: DP1 Option 1
accepted at design level, DP2 resolved to **Option 3**, four binding
amendments) and by the route build it authorized (Julie's approval,
board comment 6546054510).
**Status of this document:** the revised execution plan for the same
three gates. It authorizes nothing. Gate (a) still needs Rowan's
SOURCE REVIEW of the final combined tree (this plan's tree, routes
included) and then Julie's separate approval; gates (b) and (c)
remain separate later approvals, each with their own sub-decisions.

---

## 0. For Julie — the short version

Same shape as before, tightened by Rowan's review:

1. **The three little operator buttons now exist in code.** The
   prior proposal found that the safety counter's three tools
   (switch it on, read its report, settle one old entry by hand)
   had no buttons at all. Rowan chose the design (three narrow
   operator-only buttons in the same locked class as the tools
   you've already approved), you approved building them, and they
   are built and tested — repo-only, nothing deployed. Rowan
   reviews the whole combined package next.
2. **Still one combined code deploy** (Rowan's Option 3): the
   stuck-segment fix + the true 100/day counter + the three
   buttons ship together, in ONE code upload, so production sees
   one window instead of two. Before that upload, production is
   put in the full safety hold (generation halted + queue paused)
   and **stays** there.
3. **One new step at the very front (Rowan's Amendment 1):** a
   read-only roll call (P0) before anything is touched — what's
   live, what's running, is anything mid-flight — with a hard
   rule: if anything unexpected shows up, everything stops
   before the first change.
4. **Stricter drift rule (Amendment 2):** nothing that changes in
   your library between snapshots gets waved through as "just
   listening" anymore. Every change needs a receipt, or the
   deploy stops.
5. **Stricter re-arm rule (Amendment 3):** if the counter's
   report ever comes back "not clean but explained," that can
   close the switch-on step as a documented hold — but it can
   NEVER be used to turn generation back on. Turning back on
   always needs a fully clean report read at that moment, plus
   your separate go-ahead.
6. Nothing in this plan generates audio, spends money, arms the
   counter, or touches Chapter 3. Those are gates (b) and (c),
   still entirely yours, still later.

---

## 1. What is being deployed (the final combined tree)

### 1.1 Lineage

```
6a7301dc  deploy proposal + envelope snapshot (the prior plan)
   └─ <NEW PIN, assigned at D1>  the combined tree: quota-fix2
      (pin 3e6fd3af — SOURCE PASSED with the cache remediation,
      Rowan 6545910782) + the quota operator routes build
      (this tree; BUILD-REPORT.md alongside this plan)
```

Exactly one new commit, parent `6a7301dc…`, containing the complete
updated tree snapshot. The pin is created only after Rowan's source
review of the combined tree passes (Option 3 sequencing, §7).

### 1.2 The tree

- Root: `~/workspace/ch2-program/quota-routes/` — `worker-build/`
  (the complete build tree) + `BUILD-REPORT.md` +
  `REVISED-DEPLOY-PLAN.md` + `logs/` + `logs-baseline/`.
- `worker-build/v2` is a symlink to `worker-build/worker` (one
  physical tree, inventoried once under `worker/`; envelope part
  names carry the `v2/` prefix).
- Delta vs the quota-fix2 tree (recursive diff, verified in the
  route build's report): exactly **two** paths —
  `worker/worker-entry-prod-d6.js` CHANGED (the three routes) and
  `tests/quota-operator-routes.test.mjs` NEW (15 tests). Every
  other file is byte-identical to the SOURCE-PASSED quota-fix2
  tree, including `worker/generation/quota-budget.mjs` (no export
  change was needed — the three functions were already exported),
  the cache-refresh code, the coordinator, and all
  unknown-billing protections.

### 1.3 The envelope (counts as produced by THIS tree)

Module parts: **28** (the live worker's 27 + the new quota
module). Amendment 4's rule applies: these counts are what this
tree produces and what D1's harness must reproduce — they are
stated here as the tree's measured output, not as an assumption
carried from the prior plan.

| Class | Count | Parts |
|---|---|---|
| CHANGED content vs live | **7** | `v2/coordinator.mjs` (5d072763…, 274,953 B), `v2/generation/d6-executor.mjs` (c3613a81…, 46,660 B), `v2/generation/gen-constants.mjs` (9af664fa…, 4,936 B), `v2/generation/genstore.mjs` (811b6b15…, 48,703 B), `v2/generation/service.mjs` (aeeee06c…, 77,995 B), `v2/host/adapters.mjs` (f8ac357e…, 39,224 B), **`v2/worker-entry-prod-d6.js` (91ab9d5c…, 80,488 B — the route build's change; this part was byte-identical in the quota-fix2 envelope)** |
| NEW | 1 | `v2/generation/quota-budget.mjs` (2b399245…, 42,048 B) |
| STAMPED AT ASSEMBLY | 1 | `v2/host/build-identity.mjs` (378 B at tree size; carries the fresh review pin exactly once in the assembled envelope) |
| Byte-identical to live | 19 | the remaining parts |
| **Total module bytes** | | **1,327,787** at tree stamp size (the exact assembled byte count + envelope SHA-256 are D1 harness outputs and must match at D2, as in every prior deploy) |

Upload metadata: identical in shape to the live script's current
settings (re-read at D1, never assumed) — `main_module`
`v2/worker-entry-prod-d6.js`, compatibility `2026-08-29` +
`nodejs_compat`, the same 10 bindings including the 3 secrets as
`{"type":"inherit"}`, `GENERATION_HALT` **"1"** at D2 (the hold
Step P created), observability preserved, **no `migrations` key**.

### 1.4 What the code does (unchanged from the prior plan, plus the routes)

1. **Cache refresh** (`host/adapters.mjs`): the commit probe can
   re-read a key whose memoized value is a cached miss, so a
   just-flushed object is seen. Targets Signature B of the
   Chapter 2 diagnosis.
2. **Quota guard** (`generation/quota-budget.mjs` + coordinator /
   executor / genstore / service wiring): the application counts
   **actual provider dispatches** against the app-selected cap
   `PROVIDER_ATTEMPT_DAILY_LIMIT = 100`, via a dispatch ledger +
   grant reservations. **Completely inert until the bootstrap
   record exists**; pre-bootstrap the system behaves as the floor
   build does. The old rule that let a >100-occurrence job be
   refused forever is fixed (grant evaluation runs against the
   bounded cohort), and the day-wide cap holds across mechanisms.
3. **The three operator invocation routes** (entry part; the
   route build's addition, §7.1): the ONLY invocation mechanism
   for the bootstrap, the read-only reconciliation, and
   single-exception dispositions — operator-fenced, halt-gated
   where state-changing, figureless/allowlisted inputs, bounded
   outputs. Deploying them changes nothing by itself: no route
   is called during gate (a) except the read-only reconcile at
   D4, which must answer its unarmed floor shape (§3.4).

### 1.5 What does NOT change (unchanged from the prior plan)

- The **client**: nothing is published to `main`; no app files
  change.
- The **data**: gate (a) writes no D1/DO/R2 data. The quota
  tables are created lazily by the store's additive DDL inside
  the bootstrap transaction — which gate (a) never runs.
- **Settings** stay revision 1 (lane `standard`, cap $50).
- **Chapter 3** stays `parked_policy`, fingerprint
  `b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`.
- The **queue's consumer** is untouched; Step P only pauses
  delivery.
- **Batch** stays unarmed.
- The **rollback floor** stays the disposition build 6a73d962….

### 1.6 Standing truths carried forward (unchanged)

- **The live floor build does not enforce the new counter, and
  never will.** Today's `attemptsToday` (18 on its day) counts
  grant-ledger rows, not provider calls.
- **100/day is an application-selected cap**, not a verified
  Google limit. The project-specific Google limit and any usage
  of the same project outside Reader are **not known**; nothing
  in this plan claims the counter proves compliance with an
  external limit — it proves the application's own dispatches
  stay within the application's own budget.
- **Test success is not provider verification.** Every test in
  this program is a fake/harness test with zero provider calls.
- **Winner provenance stays UNRESOLVED** (the diagnosis's
  Signature A question). No R2 read is folded into any gate of
  this plan; closing it needs its own authorization, only if
  Rowan requires it.
- Ledger figures are recorded/known **application** accounting in
  micro-dollars despite the `MicroCents` names — never
  provider-confirmed spend.

---

## 2. Gate (a) — the hold, then the deploy

Sequence: **P0 → Step P (P1–P3) → D0 → D1 → R → D2 → D3 → D4.**
Every step's result is read back before the next begins. Any STOP
condition ends the run in the safest state reached; nothing is
retried under the same approval.

### 2.0 Step P0 — read-only live census + race fence (NEW — Amendment 1)

Before P1 touches anything, a **read-only** census establishes
the exact pre-state. GETs and connector reads only; P0 performs
no mutation of any kind.

P0 records:

1. **Worker identity:** the exact live build (`/health`: build
   `6a73d962…`, generation state) and the script **etag**
   (`a9a4c0c4…` at last verification; re-read, never assumed).
2. **Bindings + operator readiness:** the bindings list from
   `GET /workers/scripts/{name}/settings` (names + types only —
   secret values are never exposed or read), confirming the
   bindings the combined build expects, **including the presence
   of the migration-operator credential binding** the new routes
   (and gate (b)) depend on. Readiness is presence/shape only;
   no credential value is displayed, logged, or tested against
   production in P0.
3. **Hold state:** `GENERATION_HALT` current value (expected
   `"0"` — production is currently armed and idle; P0 records
   whatever it actually is).
4. **Queue state:** the queue's consumer list (sole consumer
   `f260f2188d80426bb0588685e9d084eb` expected) and
   `delivery_paused` (expected `false`).
5. **Fresh generation-plane census:** active plans and jobs
   (expected: none active — smoke `complete`, old Ch 2
   `retired`, fresh Ch 2 `complete`, Ch 3 job `parked_policy`);
   in-flight dispatches/attempts (expected: **zero**); claims
   and grants outstanding (expected: only the retired plan's
   known stale rows, proven non-executable by the gate-7 fence
   demonstration); Chapter 3 state + fingerprint (expected:
   `parked_policy`,
   `b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`);
   unknown-billing status (expected: `unknownOpen 0`); phase +
   settings spending controls (expected: forever-pucked settled
   579,339 / estimatedUnverified 19,018 / reservedUnverified
   5,648 / remaining 12,915,013; settings revision 1).

**P0 STOP conditions** — any one of these ends the run before P1:

- any **active generation** (a plan or job in a dispatching
  state, or any sign of a live run);
- any **unknown in-flight provider call** (a dispatching attempt
  whose outcome is not recorded, or a claim/grant that could
  still dispatch);
- any **material difference** from the recorded idle pre-state
  (build, etag, bindings, queue, plan/job states, Ch 3
  fingerprint, unknown-billing, spending controls);
- any census item that **cannot be established** (a read fails,
  a surface is unreachable, a value is ambiguous).

Why the fence exists (stated plainly, per the amendment): the
halt at P1 prevents NEW dispatches from the moment it lands; it
is **not** proof that a provider request already in flight
before P1 was canceled. P0 therefore has to show zero in-flight
work BEFORE the halt is flipped, and P3 (§2.1) re-reads the same
census after the hold to prove **nothing slipped across the halt
transition**.

### 2.1 Step P — create the hold (P1–P3, as amended)

Production is currently **armed + unpaused + idle**. Gate (a)
begins by reversing the gate-7 A4/A6 acts, in the same order
those acts used in reverse:

- **P1 — halt flip (metadata-only).** Freshly download the live
  parts; re-upload them **byte-identical** with the live
  metadata, changing exactly one value: `GENERATION_HALT`
  `"0"` → `"1"`. (Mechanism proven at gate 7 in the other
  direction: parsed-JSON metadata diff of exactly one value;
  script etag expected **unchanged** — `a9a4c0c4…` — because the
  module bytes do not change; observability expected to
  survive; both read back.) A code PUT is NOT used for the halt.
- **P2 — queue pause.** PUT the queue with `delivery_paused:
  true`; read back `delivery_paused == true`.
- **P3 — halted-idle verification.** Re-run the P0 generation-
  plane census. Required: `/health` generation `"halted"`; the
  diagnostics/quota views show no active plan or job; Chapter 3
  fingerprint unchanged; unknown-billing unchanged; **and the
  census is identical to P0's** — nothing slipped across the
  halt transition. Any delta = STOP with the hold in place.

The hold then persists through D0–D4, the rollback decision
point R, and — if gate (a) completes — **indefinitely, until a
later gate's own approval changes it.** Gate (a) never un-holds.

### 2.2 Step D0 — two-sample before-state

Two independent samples of production state, taken minutes
apart, both AFTER the hold is proven (P3):

- **Sample contents (each):** script etag + `/health`; full
  settings read-back (bindings names/types via `/settings`);
  queue state; sync snapshots for `content` and `bindings`
  families (full payloads, digested); plans list + the Ch 3 job;
  settings revision + quota view; phase accounting.
- **D0 compares the two samples under the Amendment-2 rule
  (§2.2.1).** Identical generation plane is required; any
  content/bindings difference must be resolved by the
  provenance rule before proceeding. D0's verified state becomes
  the **baseline** for D4 and for any rollback accounting.

#### 2.2.1 The drift rule (REWRITTEN — Amendment 2)

The prior plan's rule — bindings/content watermark drift is
presumed listening and carried forward — is **struck**. The
rule for every comparison in this plan (D0, D4, rollback
accounting) is:

- **Generation plane** (plans, jobs, attempts, grants, claims,
  quota counters, phase accounting, settings revision, Ch 3
  state/fingerprint): **strict identity.** Any delta = STOP.
- **Bindings / content** (audio bindings, book content,
  occurrence data): **no automatic classification.** Every
  differing entity requires a **per-entity source/provenance
  diff** demonstrating the change is an approved, non-generation
  mutation (e.g. a Shelf listening-session append through the
  frozen bridge, a client sync write) — with the evidence
  recorded. **Any unexplained binding/content change, and any
  change consistent with unapproved synthesis, binding
  overwrite, new generation, or data loss = STOP**, not a
  carried-forward baseline.
- **Session / playback-position state** may differ only with
  the same source evidence (which surface wrote it, when, under
  whose action). "It looks like listening" is not evidence.
- **Chapter 2 and parked Chapter 3 keep strict identity** in
  all cases — no provenance exception applies to their
  generation-relevant state.

### 2.3 Step D1 — validate the FINAL combined tree (REWRITTEN — Amendment 4)

D1 validates the **final combined tree after the route build** —
the exact tree Rowan source-reviewed. Nothing about the
envelope is inherited from the prior plan's D1.

D1 produces, as harness outputs (counts are outputs, never
assumptions):

1. **Fresh lineage:** the combined tree pinned as ONE
   single-parent child of `6a7301dc…` on `ui1-review` (per-blob
   SHA assertions; commit message verified; pin read back).
2. **Machine-readable inventory** of the pinned tree (the
   `tree-inventory.json` discipline: every file, SHA-256,
   bytes), regenerated from the pinned snapshot.
3. **The assembled envelope:** all 28 module parts from the
   pinned tree; **every changed/new module hash listed**
   (7 changed + 1 new vs live, §1.3); the assembly stamp
   (`v2/host/build-identity.mjs`) carrying the fresh pin
   **exactly once**; tested genuine module part names and
   entrypoint (`main_module` `v2/worker-entry-prod-d6.js`);
   compatibility `2026-08-29` + `nodejs_compat`; bindings and
   secrets-inherit metadata compared against the live
   `/settings` read (names/types only); `GENERATION_HALT`
   **"1"**; **no `migrations` key**; final envelope byte count
   and SHA-256 recorded.
4. **Negative mutations** — the assembly must REFUSE each of:
   a missing part; a duplicate part; a part whose hash differs
   from the inventory; **a spoofed operator route** (an entry
   part whose quota handlers lack the operator-admitted stamp
   check, the halt check, or the figureless/allowlist refusal
   constants — D1 asserts these at source level over the entry
   part, so a fence-weakened entry can never assemble); a wrong
   `GENERATION_HALT` value; any unexpected metadata key; any
   `migrations` key.
5. **Fake/harness rehearsal** of the revised sequence against
   the final code, with the rehearsal record filed at D1:
   halt enforcement (state-changing quota routes refuse when
   `GENERATION_HALT !== "1"` — route suite QROUTE-10/14);
   queue-pause treated as the runbook precondition it is (the
   Worker cannot read queue state — §4.0); **pre-bootstrap data
   unchanged** (the deployed code, exercised in-harness,
   creates no quota record and moves no counter before the
   bootstrap — route suite + quota suites); **no provider
   call** anywhere in the rehearsal (all fakes); and the
   **rollback STOP** behavior (each STOP condition in §2/§5
   exercised or source-traced, with the outcome recorded).
   A harness result is process evidence only — it is not a
   provider-facing smoke and is never reported as one.

### 2.4 Step R — rollback decision point (unchanged in substance)

After D1 and before D2, the run pauses and the D0/D1 evidence
is reviewed. Proceeding to D2 requires the gate-(a) approval's
own terms (Julie's approval for gate (a) names D2 explicitly,
as in prior deploys). No new approval is minted by R; it is the
last no-consequence exit.

### 2.5 Step D2 — the single code PUT

- ONE multipart PUT of the D1-assembled envelope with the D1
  metadata. No second PUT under this approval for any reason.
- On ANY failure or ambiguity at D2: **stop and only look** —
  no retry, no rollback PUT, no fix-forward without a fresh
  approval (the C2 discipline of the Oct 30 deploys).

### 2.6 Step D3 — observability (conditional, unchanged)

After the PUT, GET `/workers/scripts/{name}/script-settings`.
If observability was reset to null by the upload, re-apply it
with the settings-only multipart PATCH to
`/workers/scripts/{name}/settings` (single `settings` part;
observability object only), then prove the script **etag is
unchanged** by the PATCH (the settings PATCH does not touch
code). If observability survived (as it has in every recent
deploy), D3 is a recorded no-op.

### 2.7 Step D4 — verification (as strengthened by Amendment 4)

All reads; the run ends **halted + paused + unarmed**.

1. **Deployed parts:** download the live script; all **28
   parts byte-identical** to the D1 envelope (stamp = the new
   pin); `/health` build = the new pin; generation `"halted"`.
2. **Data integrity vs the D0 baseline**, under the §2.2.1 rule:
   plans/jobs/Ch 3/settings/watermarks compared per-entity; any
   unexplained delta = STOP (the deploy record reports it; no
   remediation under this approval).
3. **Unarmed quota view:** `GET /v2/d6-quota-reconcile` via the
   operator connector returns the **floor shape** —
   `{ armed: false, ok: false, reason: "not_armed" }` — proving
   the route and its fence work live AND that the guard is
   present but **UNARMED**: no bootstrap record exists, no quota
   table was created, the counter is not yet counting. (This is
   a read of a SELECT-only surface — the one route gate (a)
   exercises. It is not a generation smoke and proves nothing
   about provider behavior.)
4. **Playback sanity (READ):** a bindings snapshot read shows
   the library intact (watermark 1818 expected). **No smoke is
   claimed**: no generation, no provider call, no device action
   is part of gate (a). (Any device playback check Julie wants
   is hers to make afterward, as with prior deploys.)

---

## 3. (Reserved — the prior plan's §3 numbering is kept in the gate-(b) section below.)

---

## 4. Gate (b) — bootstrap, reconcile, dispositions (separate approval)

Gate (b) begins only after gate (a) completes and its record is
reviewed. Production enters gate (b) **halted + paused**, and
leaves it the same way.

### 4.0 How the operator acts (the invocation mechanism — §4 of the prior plan, now resolved)

All three acts run through the existing operator connector
(`custom.opalreader-v2-prod-operator`), one credential surrogate
per request, with the production scope/instance headers the
connector already sends:

- **Bootstrap:** `POST /v2/d6-quota-bootstrap` — **no body
  fields** (figureless; an empty/absent body is the only
  admissible call shape besides `{}`).
- **Reconcile:** `GET /v2/d6-quota-reconcile`.
- **Disposition (per attempt):** `POST
  /v2/d6-quota-dispose-exception` with exactly
  `{ attemptId, dayKey, authorizationRef, source, note }`.

**Halt + queue-pause verification around state-changing calls
(DP1):** the Worker **cannot read queue state** (its queue
binding is send-only; no pause-state surface exists in the
tree — verified in source during the route build), so the
code-level half of the rule is the handlers' own halt fence
(bootstrap and disposition refuse unless `GENERATION_HALT` is
exactly `"1"`, enforced inside the DO before any store contact;
proven by QROUTE-10/14). The queue-pause half is an
**execution-time precondition of this gate**: step B0 below
re-verifies halt + pause by cf-api read-back **immediately
before** B1, and again before any B3 call, in the same session.
A failed re-verification = STOP, no call.

### 4.1 Step B0 — preconditions re-verified (same session)

- `/health` build = the gate-(a) pin; generation `"halted"`;
  `GENERATION_HALT` read-back `"1"`; queue `delivery_paused ==
  true` read back. (This is P2/P3's hold, re-proven — not
  assumed to have persisted.)
- The D4 unarmed floor shape re-read (reconcile:
  `not_armed`). Any other answer = STOP.

### 4.2 Step B1 — the bootstrap (ONE call)

Exactly one figureless bootstrap call under the gate-(b)
approval. Expected result (from the diagnosis's census of the
floor history; the call's own read-back is authoritative):

- `alreadyArmed: false`; the bootstrap record written once
  (timestamped, with the assigned/exception counts and the
  pinned limit 100).
- Every historic attempt with provable same-day (or
  dispatching-phase) evidence gets its day stamped from its own
  surviving evidence; **ambiguous rows are assigned nothing**
  and reported as exceptions.
- The response's exception detail is bounded (exact count +
  first ≤100 identities + truncation flag). A truncated
  exception list is itself a finding: B2 must then page the
  full set via repeated reconciles as dispositions land, and
  the gate-(b) record must enumerate **all** of them before it
  closes.

Idempotence is the store's: an accidental second call assigns
nothing twice and never rewrites the record (proven in
QROUTE-9). The approval still authorizes exactly one deliberate
call.

### 4.3 Step B2 — reconcile, and what its outcomes mean (Amendment 3 applied)

Immediately after B1, one reconcile read. Outcomes:

- **`ok === true`:** the ledger, reservations, and stamps agree
  and no current-day exception blocks. Gate (b) may proceed to
  B3 decisions on a clean report.
- **`ok === false`, fully explained:** gate (b) may complete
  **only as a DOCUMENTED ACCOUNTING HOLD**: every discrepancy
  and every open exception is enumerated in the gate-(b) record;
  no unexplained drift exists; the system is left **halted +
  paused** with the hold recorded in explicit terms. **This is
  not re-arm clearance** — see §4.5.
- **`ok === false` with anything unexplained:** STOP; the hold
  is recorded as unexplained; no B3 under this approval.

Bootstrap is **not** arming for generation: it turns on
accounting only. Generation stays halted + paused regardless of
B2's outcome.

### 4.4 Step B3 — dispositions (each one a named sub-decision)

For each bootstrap exception Julie chooses to settle, ONE
disposition call naming that attempt, its day, and her recorded
approval reference. Hard rules (store-enforced; the route
cannot weaken them):

- **Same-day intervals only.** A multi-day (PT-straddling)
  exception refuses `quota_disposition_ambiguous_interval` —
  permanently, by design (Hold B). It is never dispositioned;
  it ages out under §4.5.
- The named day must lie inside the attempt's own evidence
  interval and be a real calendar day; the store proves both.
- An unattributable exception (no grant on the execution
  record) refuses `quota_disposition_unattributable`.
- Exactly-once: a second disposition of the same attempt
  refuses `quota_disposition_not_an_exception`.
- Each B3 call is preceded by the B0 halt+pause re-verification
  (§4.0) and followed by a reconcile read showing the exception
  list shrink by exactly that attempt.

### 4.5 The re-arm law (Amendment 3 — binding everywhere in this plan)

No step of any gate in this plan re-arms generation. For
completeness, the law any FUTURE re-arm must satisfy — stated
here so no earlier wording anywhere survives against it:

1. The **guarded build** (this combined build or a successor
   Rowan has source-passed) must be the live build.
2. A reconcile read **at the re-arm moment** must return
   **`ok === true`**. An explained `ok === false` — including a
   gate-(b) documented accounting hold — **never** satisfies
   this, at any gate, in any window (including a rollback
   window; §5.3 conforms).
3. **Julie's separate explicit GO** for that re-arm, naming it.
4. All quota/halt/queue checks of that re-arm's own runbook
   pass at execution time.
5. **Multi-day exceptions:** an accounting hold caused by one
   expires **only when the clock leaves its interval** (the
   current PT day is past the interval's last day) **and** a
   fresh reconcile then reads `ok === true`. Nothing else
   clears it — not a disposition (impossible by design), not
   the passage of the gate, not this plan.
6. **Missing route or failed bootstrap = do not re-arm.** If
   the reconcile surface is unavailable or the bootstrap record
   is absent at re-arm time, re-arm is refused outright.

---

## 5. Rollback law

### 5.1 The floor (unchanged)

The minimum build that may ever run against current data is
the **disposition build `6a73d962…`** (etag `a9a4c0c4…`). No
pre-disposition code may ever be deployed again. This combined
deploy does not lower the floor; it raises the guarded ceiling.

### 5.2 The clean window (gate (a) only, unchanged)

From D2 until the gate-(b) bootstrap runs, **no quota schema
or data exists** (the tables are created inside the bootstrap
transaction). A rollback inside this window is therefore
data-clean: it needs only (i) Julie's separate authorization,
(ii) the hold (halt + pause) in place, (iii) a code PUT of the
floor build's envelope (or the then-current guarded build),
(iv) D3-style observability verification, (v) figure read-backs
matching the D0 baseline under the §2.2.1 rule.

### 5.3 After the bootstrap exists (Amendment 3 conformed)

Once any bootstrap/disposition record exists:

- The **hold (halt + queue-pause) is held for the entire floor
  window** — a rollback never transits an armed or unpaused
  state.
- An **external accounting archive** (the reconcile report +
  the bootstrap record + every disposition record, exported
  and pinned) is made BEFORE the rollback PUT.
- The rollback target must have **proven compatibility** with
  the quota records (source-level proof, not commit recency) —
  in practice the guarded build itself or a successor that
  reads the same tables.
- **The floor build does not enforce the counter.** Safety in a
  floor window rests entirely on the held halt + pause, never
  on the floor's accounting.
- Re-arming out of a floor window is governed by §4.5 in full:
  guarded build restored **and** `reconcileQuota.ok === true`
  read at the re-arm moment **and** Julie's separate GO. (This
  replaces any earlier permissive reading under which an
  explained `ok === false` might have sufficed. It does not.)

### 5.4 Rollback STOP conditions

Any of: hold cannot be established or proven; the accounting
archive cannot be produced; target-build compatibility is
unproven; read-backs after the PUT differ from expectations
under §2.2.1. A stopped rollback leaves the system **halted +
paused on the current build** — always a safe resting state.

---

## 6. Gate (c) — generation (unchanged; separate, later)

Nothing in gates (a)/(b) authorizes any of: re-arm (governed by
§4.5 when its own time comes); a provider-facing test call; the
rest of Forever Pucked (book scope — needs a fresh live quote,
the fingerprint-key occupancy question resolved or its exposure
explicitly disclosed, and Julie's fresh GO); Chapter 3 (Julie's
explicit word, its own gate, book order preserved); Batch
arming; any quarantine release. Each remains its own decision
with its own record.

---

## 7. Decision record (resolved — no longer open)

### 7.1 DP1 — RESOLVED: Option 1, BUILT

Rowan accepted the minimal-operator-routes design (6546037460);
Julie approved the repo-only build (6546054510); the routes are
built in this tree (BUILD-REPORT.md is the build's record):

| Route | Internal | Contract |
|---|---|---|
| `POST /v2/d6-quota-bootstrap` | `POST /internal/d6/quota-bootstrap` | Operator fence; **halt-only**; **figureless** (empty body allowlist — any key refuses; figure keys named as figure refusals); store idempotence makes replays safe; response exception detail bounded (count + ≤100 + truncation flag) |
| `POST /v2/d6-quota-dispose-exception` | `POST /internal/d6/quota-dispose-exception` | Operator fence; **halt-only**; closed allowlist `{attemptId, dayKey, authorizationRef, source, note}`; figure keys refused by name; store refusals pass through unchanged (Hold B intact); exactly-once by store state |
| `GET /v2/d6-quota-reconcile` | `GET /internal/d6/quota-reconcile` | Operator fence; read-only (SELECT-only store function); **no halt fence** (a read changes nothing); detail arrays bounded at 100 with exact counts + truncation flags; pre-bootstrap returns the floor shape |

Fence class: the operator-alone class of the existing operator
surfaces (gate skips the client token; migration-operator
credential admits; unforgeable `x-opalreader-operator-admitted`
stamp re-checked at the DO class gate; production
scope/instance headers) — the class through which gates 5–6
already ran. One divergence from the seed-storage precedent is
recorded honestly in the build report: the seed route
additionally requires the client token; the quota routes follow
the five later operator surfaces instead, per the DP1 text
Rowan accepted.

DP1's required source tests are all present in
`tests/quota-operator-routes.test.mjs` (15 tests; the build
report maps each required case to its test).

### 7.2 DP2 — RESOLVED: Option 3 (Rowan's choice over the prior plan's Option 4 lean)

One combined reviewed code deploy: the route code received its
own repo-only approval (6546054510) and receives its own full
SOURCE REVIEW as part of this combined tree; the final envelope
is re-pinned/re-hashed/re-proposed (this plan + D1); only then
does Julie's gate-(a) approval get requested. Gate (a) still
contains **two** PUT-class acts, named as such: the P1
metadata-only halt PUT (byte-identical live parts, one metadata
value) and the D2 code PUT. "One deploy" means one new-code
deployment window, not one HTTP request.

### 7.3 Carried correction

The quota-fix report's cohort arithmetic is corrected wherever
it appears in the record: 18 fresh occurrences cohort as grants
of **8 / 7 / 3** (not 8/8/2). The correction is carried here per
Rowan's instruction; no pinned record is rewritten.

---

## 8. What Julie is asked to approve, in order

Nothing is requested yet. The sequence from here:

1. **Rowan's SOURCE REVIEW of the combined tree** (this plan's
   tree incl. the routes) — no Julie action; Wren pins + files.
2. **Gate (a) approval (Julie)** — P0 → Step P → D0 → D1 → R →
   D2 → D3 → D4 exactly as §2. Ends halted + paused + unarmed.
3. **Gate (b) approval (Julie)** — B0 → B1 (one bootstrap call)
   → B2 (reconcile; an explained `ok:false` closes only as a
   documented accounting hold) → any B3 dispositions, **each
   named individually**. Ends halted + paused.
4. **Gate (c) (Julie, separate, later)** — any generation,
   re-arm (under §4.5), or Chapter 3 movement. Not scoped here.

— End of revised plan —
