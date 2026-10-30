# DEPLOY-PLAN ADDENDUM D7 — Gate 2/3 representation under the D7-2 quarantine

Status: LOCAL, repo-only. This addendum corrects the representation
of Gates 2 and 3 in `DEPLOY-PLAN-DRAFT.md` under the D7-2
birth-mark + grant-quarantine design (Rowan ruling, board issue
#15 comment 6524426826; Julie's approval of the build, comment
6524562842). It authorizes nothing. The deployment plan remains
on HOLD pending Rowan's re-review of the quarantine build and
Julie's separate Gate 1 decision; Gates 2 and 3 remain separate
Julie decisions after that.

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
  staged while halted. Plan-less jobs that attempt a grant while
  halted (legacy RequestSynthesis / RequestResume shapes) are
  refused at admission through the real entry (423
  `generation_halted`) and refused + durably marked at the guard
  on flagged coordinator paths.

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
