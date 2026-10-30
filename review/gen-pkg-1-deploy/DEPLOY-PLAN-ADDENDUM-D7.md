# DEPLOY-PLAN ADDENDUM D7 — Gate 2/3 representation under the D7-2 quarantine

Status: repo-only, pinned with the D9-E evidence package.
This addendum corrects the representation
of Gates 2 and 3 in `DEPLOY-PLAN-DRAFT.md` under the D7-2
birth-mark + grant-quarantine design (Rowan ruling, board issue
#15 comment 6524426826; Julie's approval of the build, comment
6524562842), as corrected by the D8 build under Rowan's review
of the D7-2 build (comment 6525035570) — see the D8 section at
the end of this addendum. It authorizes nothing. The deployment
plan remains on HOLD pending Rowan's re-review of the corrected
build and Julie's separate Gate 1 decision; Gates 2 and 3 remain
separate Julie decisions after that.

## What D7-2 changed about the shape of the problem

D7-2 (Rowan's evidence re-review, comment 6524120231) found that
the signed plan's Gate 2 — recording the Forever Pucked phase
binding — does more than lift a budget check: with the registry
established, the production entry's `submitIntent` ADMITs durable
plans (plan + first job, state `active`) even while
GENERATION_HALT = "1". The draft plan's Gate 2/3 wording treated
the binding write and the client publication as spend-adjacent
only through the later re-arm; in fact they create the conditions
under which newly submitted plans exist in an armed-shaped store,
and a later GENERIC re-arm (halt flip + queue delivery) would
have let the driver grant those staged plans without any
per-plan human decision.

The quarantine design separates the two things the draft plan
conflated:

- **ADMISSION is allowed while halted.** Submitting an intent
  while GENERATION_HALT !== "0" creates the durable plan and its
  first job, state `active`, with zero grants, zero ledger
  movement, zero outbox rows (d6-correction C3's contract,
  unchanged). Admission is not spend.
- **SPEND AUTHORITY is what is fenced.** Every plan born while
  halted is birth-marked in the same transaction as its insert
  (`d6_quarantine_holds`, reason `born_while_halted`). The mark —
  not the halt flag — is the fence: the D6 grant guard refuses
  held plans absolutely, the driver skips them, and the executor
  refuses their jobs, all independent of the halt flag's current
  value. A generic re-arm therefore grants NOTHING that was
  staged while halted. Plan-less generation work is refused at
  admission through the real entry while halted (423
  `generation_halted`) — RequestSynthesis / RequestResume since
  D7-2, and plain SubmitJob / RequestRepair since D8-2 (below) —
  and any plan-less job that nevertheless reaches the grant
  guard while halted is refused + durably marked there; a
  plan-less job born inside a recorded halt epoch is fenced by
  the guard's halt-epoch ledger even when its halt-era grant
  attempts were refused before the guard ever ran.

## Corrected Gate 2 representation

Gate 2 (operator-only Forever Pucked phase-binding write +
read-back) is represented as follows, replacing any draft wording
that implied the binding write itself arms or endangers spend:

1. The binding write establishes the phase→book registry. From
   that moment, intents for the bound book are ADMITTED while
   halted — and every such plan is born quarantined. Admission
   under Gate 2 creates fenced work only; it creates no spend
   authority, for any plan, ever.
2. The binding write does NOT release any hold, and no plan
   submitted before or after it gains grantability from it.
   Phase binding, settings changes, client publication, and
   re-arm are all non-clearing acts by construction (the release
   is a separate code path none of them call).
3. D0's obligation is restated accordingly (see below): the
   pre-deploy inventory must enumerate not only active plans but
   every DURABLE plan and job that could become grantable, with
   its quarantine state read from the store — "no active plans"
   is not the proof; "no active, grantable, unheld work" is.

## Corrected Gate 3 representation

Gate 3 (client publication) is represented as follows:

1. Publication makes plan creation reachable from Julie's
   devices. Any plan a device submits while the worker is halted
   is born quarantined and renders in the client as "Waiting —
   needs approval before it can start" (the client's
   approvalRequired wording) — never as working/generating.
2. Publication does NOT release any hold and does not change any
   plan's spend authority.
3. The published client's Generate controls can therefore be
   live BEFORE any re-arm without creating a spend path: the
   worst case of an early submission is a fenced plan awaiting a
   per-plan operator release that itself requires Julie's
   separate approval.

## Re-arm, restated

The re-arm gate (halt flip + queue delivery enable) remains a
separate Julie decision, and its meaning is now narrower and
safer than the draft stated: re-arm restores spend authority
ONLY for work that was never quarantined (pre-existing unmarked
plans and jobs, and work submitted after the re-arm). Everything
born while halted stays fenced until individually released.

## Per-plan release — a new, separate gate class

The quarantine release (POST /v2/d6-release-quarantine,
migration-operator fence) is the ONLY clearance. Its properties,
which any future release authorization must name:

- one subject per release (exact plan ID, or exact job ID for a
  guard-marked plan-less job); a release never affects siblings;
- idempotent (a duplicate release is an applied no-op returning
  the standing record);
- audited on the hold row itself (released_at, release_source
  stamped server-side as "operator-route", release_actor_class
  "operator"; the birth record is immutable and never deleted);
- refused for a plan in `halted_unknown` — release is not a
  reconcile, and no release papers over unresolved billing (the
  Ch 2 path remains reconcile + retire under their own gates);
- the route's existence is NOT authority: EACH production
  release requires Julie's separate, specific approval naming
  the plan, exactly as each re-arm does.

## Second layer retained: the pre-re-arm exhaustive inventory

The quarantine is the code fence; the inventory remains as the
operational second layer, unchanged in obligation and now
readable directly from the store. Before any re-arm, D0/D4-style
fresh live reads must enumerate:

- every plan in a non-terminal state, with its quarantine hold
  state (held / released / never held) read from
  `d6_quarantine_holds`;
- every job in a grantable state (queued / generating /
  paused_quota), with its hold state;
- grants in `issued` state and unsent outbox rows (work already
  authorized before the halt — the only pre-re-arm spend that
  can move at re-arm, each item named);
- the Ch 2 halted_unknown plan and the Ch 3 parked job,
  byte-identical, unreleased, never driven.

Any item the inventory cannot classify stops the re-arm. The
inventory is a verification layer over the code fence, not a
substitute for it: if the two ever disagree, the code fence is
what runs, and the disagreement itself is a stop.

## D8 corrections (Rowan review 6525035570) — what they change in this plan

Rowan accepted the D7-2 birth-mark architecture and the C3
preservation, and withheld implementation sign-off on two
blockers. The D8 build (same approval, comment 6524562842;
repo-only) corrects both. Nothing in this section authorizes
anything; Gates 1–3 and every release remain separate Julie
decisions, and this plan still requires Rowan's re-review of
the corrected proofs before Gate 1 is put to Julie.

### D8-1 — hold reads fail closed

Every quarantine hold read at a spending or execute fence is
now strict: the grant guard (inside the grant transaction),
the driver's skip, and the executor's pre-claim defense ensure
the schema and read the hold such that ANY schema or read
failure throws/refuses BEFORE any grant, ledger reservation,
outbox row, or provider contact. The D7-2 catch-all read
("any error means no hold") survives only on read-only views
(plan status/summary), and there only for a genuinely absent
table. Proven by fault injection (candidate suite
genpkg1-quarantine-d8, tests D8-1a–d): a forced hold-SELECT
failure against a held plan and a held plan-less job yields a
thrown refusal with zero grants/ledger/outbox/provider calls
and the hold row byte-unchanged; the executor refuses with the
distinct reason `quarantine_check_failed`.

### D8-2 — plan-less staging can no longer become spendable, on any path

Three mechanisms, layered:

1. **Admission refusal, extended.** While GENERATION_HALT !==
   "0", the public entry AND the coordinator class refuse every
   generation-producing legacy command — plain SubmitJob
   (without `data.d6Intent`) and RequestRepair now join
   RequestSynthesis / RequestResume at 423 `generation_halted`.
   The D6 intent shape stays admitted + birth-held (C3 intact,
   d6-correction 5/5 unmodified). Reads, sync, settings, and all
   other commands are behavior-unchanged.
2. **Halt-epoch fence at the guard.** For rows already in the
   store (staged under a pre-D8 entry or by an operator-plane
   path), the guard consults a lazily ensured halt-epoch ledger
   (`d6_halt_epochs`): a still-queued plan-less job born inside
   a recorded halt epoch — including jobs whose halt-era grant
   attempts were refused BEFORE the guard by the quota park,
   daily quota, or monthly cap — is durably marked
   (`born_while_halted`, source `halt_epoch`) and refused at its
   first post-re-arm guarded attempt, until the operator
   releases THAT job. A subject already adjudicated (held or
   released) is never re-adjudicated by the epoch; work born
   before the halt is never suspect.
3. **Production-class alarm audit — bypass found in principle,
   fenced.** Rowan's path audit was warranted: the production
   DO class constructed its superclass with the raw env, so the
   coordinators behind `super.alarm()` (watchdog retry_grant,
   repair machinery) and the `/v2/commands` API dispatch ran
   `_issueGrant` with the D6 guard flags ABSENT — the guard
   existed only on the separately constructed D6 service
   coordinators. A counterfactual run proves reachability: the
   pre-D6 base class's alarm, fired over a store holding a held
   plan plus a 'generating'-state plan-linked probe job with a
   due retry_grant row, ISSUES the grant (grants/ledger/outbox
   0 → 1). No production state can create that probe's state
   combination today (a held plan's jobs are never granted,
   hence never 'generating'), but the unguarded path itself was
   real. The D8 fence is minimal and outside the frozen
   coordinator: the D6 production class stamps both guard flags
   onto its own env after construction, so every coordinator the
   class builds for its post-construction operations runs the
   guard. (The constructor's own coordinator deliberately keeps
   the plain construction env — a schema/settings handle no
   production grant path uses, whose plain behavior the
   baseline suites pin.) Test D8-2c proves the fenced class:
   staged + held subjects are inert across halted and re-armed
   real-class alarms, the probe is refused inside
   `super.alarm()`, and a legitimate pre-existing job still
   grants through the same path — guarded, not broken.

### Gates 2 and 3, restated with the corrected proofs

- **Gate 2 (phase-binding write)** creates registry + admission
  only, exactly as corrected above; under D8 the admission it
  enables is narrower still: only D6 intents are admitted while
  halted, every one born quarantined; legacy staging commands
  are refused outright. The binding write releases nothing.
- **Gate 3 (client publication)** publishes the client at
  publish digest
  `97e280948341e0d993975f46ebf089c10e9a2dfdc74487783ff80dd2069cc398`
  (unchanged by D8 — the corrections are worker-only; held plans
  render "Waiting — needs approval before it can start").
  Publication releases nothing and creates no spend path: a
  device-submitted plan while halted is born quarantined, and
  the client's legacy command shapes are refused at admission
  while halted in any case.
- **Re-arm** restores spend authority only for work that was
  never quarantined and never epoch-suspect; the pre-re-arm
  exhaustive inventory (previous section) stands unchanged, and
  now also enumerates any `d6_halt_epochs` rows so an open or
  unclosed epoch is a named inventory item, not a surprise.
- **Proofs on the corrected candidate**: d6-correction C1–C5
  5/5 unmodified; genpkg1-quarantine 10/10 (two disclosed D8
  amendments); genpkg1-quarantine-d8 7/7 (new); full worker
  battery 123 suite files, 101 pass / 22 fail with the failing
  set byte-identical to the recorded 22-name baseline and zero
  assertion failures; actual-D6-envelope proof re-run against
  the corrected candidate (see the D8 build report for the new
  envelope SHA-256; no new bindings).

## D9-E evidence completion (Rowan comment 6526547700) — the plan now points at the final candidate

Rowan's D8 re-review returned a **code-level PASS** for D8-1
and D8-2 (comment 6526547700) and withheld only the
deployment-plan / upload-envelope sign-off, on one ground:
the proof pinned in this package still proved the OLD
26-module envelope of the round-5 candidate, because the
pinned `candidate/worker/` copy predated D7-2. The D9-E
evidence completion (repo-only; no new Julie approval was
required or sought — it executes Rowan's stated next step
under the existing quarantine approval, comment 6524562842)
closes that gap:

- `candidate/worker/` in this package now holds the EXACT
  final D8 Worker source (57 files), byte-identical to the
  local final tree at signed pin
  `f3b6e6e9fd7a44532ceef86e484a79e466b36d4d`, anchored by
  `candidate/candidate-worker-manifest.txt` (per-file
  SHA-256) and `candidate/candidate-delta-manifest.txt`
  (source delta vs the previously pinned candidate: 1 added
  — `generation/quarantine.mjs`; 4 changed; 52 unchanged;
  0 removed).
- The envelope proof was re-run in a CLEAN CHECKOUT of the
  evidence commit with pin `f3b6e6e9…` stamped: **27 module
  parts, 1,183,927 module bytes, envelope 1,190,846 bytes,
  SHA-256 `9cb9d0da0d0790e2a5a0e558c6ff50d6958c83ab2942e487830e6132c15cd9ce`,
  PASS 18/18**; the three negative proofs FAIL with exactly
  the filed check sets (drop-seventh E7/E8/E9/E10;
  typo-enforce E8/E9; wrong-entry E2); all seven byte
  comparisons identical to the filed D8 artifacts. Record:
  `replay/` in this package.
- `DEPLOY-PLAN.md` is reconciled: Gate-1 D1 envelope hash,
  module count (27), signed Worker pin (`f3b6e6e9…`), D4
  part count (27/27), and the current client publication
  digest (`97e280948341e0d993975f46ebf089c10e9a2dfdc74487783ff80dd2069cc398`)
  all refer to the final candidate; the round-5 pin
  `5ae38942…` and its 26-module proof remain only as marked
  history.
- The D0/D4 quiescence obligations in
  `DEPLOY-PLAN-ADDENDUM-D0D4.md` are unchanged and apply to
  the final candidate as written (its "26 parts" figures are
  the LIVE build `ac451df8` archive — that build did not
  change). The rollback review in
  `ARCHIVE-AND-ROLLBACK.md` carries a D9-E note: its §2
  compatibility assessment was verified against the round-5
  candidate (historical); the final candidate's additions
  follow the same additive, lazily-ensured pattern
  (`d6_quarantine_holds`, `d6_halt_epochs`,
  `d6_quarantine_meta` from `generation/quarantine.mjs`),
  and the rollback base — the live `ac451df8` archive — is
  unchanged.
- **Permissions remain distinct and uncombined**: Gate 1
  (worker deploy), Gate 2 (phase-binding write), Gate 3
  (client publication) are three separate Julie decisions,
  in that order; EVERY production quarantine release is a
  further separate, specific Julie approval naming the exact
  plan or job, given in a verified safe/paused state — a
  release is not an implicit spending approval (Rowan,
  6526547700). Re-arm is its own later gate. Nothing in
  D9-E authorizes any of them.

Status after D9-E: the deployment plan awaits Rowan's
deploy-plan sign-off on this completed evidence; Gate 1 is
then Julie's separate decision. Ch 2 stays halted;
Ch 3 stays parked.
