# REPORT — deploy-proposal drafting (for the parent agent)

**Done.** Drafted repo-only, no production contact, no GitHub
posts/pins. Deliverables in `~/workspace/ch2-program/deploy-proposal/`:

- `DEPLOY-PROPOSAL.md` — the proposal, structured exactly per
  Rowan 6545910782 + the task spec.
- `tree-inventory.json` — machine-readable inventory of the
  complete `quota-fix2/worker-build/` tree: 804 files,
  9,919,655 B, per-file SHA-256 + sizes, plus the 28-part
  envelope section with per-part hashes and vs-live status.
  (`v2/` is a symlink to `worker/`; files inventoried once
  under `worker/`.)

## Proposal structure

- **§0** Julie-facing plain-language summary (what the two
  fixes are, what each approval authorizes per stage, what
  stays untouched, the 100/day caveat up front).
- **§1** Lineage chain (dcce900f → 461b38aa → 3e19d1fd →
  3e6fd3af SOURCE PASS), build marker **set at pin time**
  (pin doesn't exist yet; D1 re-reads it), combined-delta
  description per build, the **Rowan-required doc correction
  (cohorts are 8/7/3, not 8/8/2)**, battery figures, the full
  **28-part envelope table** (27 live parts + NEW
  `v2/generation/quota-budget.mjs`; 6 CHANGED content parts —
  coordinator, d6-executor, gen-constants, genstore, service,
  host/adapters; 20 byte-identical, hash-verified against the
  disposition parts-manifest; 1,311,847 module bytes on tree
  bytes), and the metadata spec (main_module, compat
  2026-08-29 + nodejs_compat, 10 bindings incl. 3 inherit
  secrets, GENERATION_HALT "1", no migrations key).
- **§2** Expected pre-state, **explicitly last-recorded, not
  live-read** (this drafting made no production contact), with
  a D0 drift rule distinguishing listening drift from
  generation-plane drift. Key posture fact: production is
  currently **armed + unpaused + idle** (gate-7 re-arm +
  Gate-8 completion), unlike the disposition proposal's
  already-halted start.
- **§3a Gate (a)** P→D0→D1→R→D2→D3→D4 in the established
  pattern, adapted: **Step P actively creates the hold** —
  P1 halt flip via the gate-7 A4 metadata-only mechanism
  reversed (etag expected unchanged, one-value diff proof),
  P2 queue-pause PUT with read-back, P3 halted-idle
  verification — then the standard two-sample D0, D1 with the
  Rowan-mandated changed-file blob comparison (7 files), D2
  single PUT, conditional D3 observability PATCH
  (`/settings` write path, etag-unchanged proof), D4 28-part
  byte-identical verification + **unarmed floor-shape quota
  view check** + playback sanity *read* (no smoke claimed).
  Ends halted + paused + UNARMED.
- **§3b Gate (b)** B0→B1 (one figureless bootstrap invocation;
  first-real-DO-execution honesty note) → B2 (read-only
  reconcile, archived externally, strengthened `ok` semantics)
  → B3 dispositions as **individually named sub-decisions**:
  same-day intervals only, authorizationRef = the recorded
  approval; **multi-day intervals never dispositionable**
  (Hold-B law, not Julie-overridable). Ends ARMED but still
  halted + paused (bootstrap ≠ re-arm).
- **§3c Gate (c)** explicitly out of scope (generation,
  Ch 3, re-arm, Batch, provider tests), with the standing
  carry-overs (fingerprint preflight-or-disclosure, fresh
  quote, fresh GO).
- **§4** Invocation analysis (below).
- **§5** Rollback law: floor = disposition build `6a73d962…`
  + etag `a9a4c0c4…` + its data (permanent, adjudication rows
  exist); clean pre-bootstrap rollback window (gate (a)
  creates no schema/data — mirror of the pre-adjudication
  window); post-bootstrap rules incl. **never claim the floor
  enforces the counter**, halt+pause held for the whole
  window, re-arm requires guarded build restored + clean
  reconcile; external accounting archive; proven-compatibility
  (not recency) exit gate.
- **§6** Disclosures: 100/day app-selected not verified;
  outside-Reader usage unknown/uncountable; harness ≠ smoke
  (RUNNER_EXIT semantics); **winner provenance unresolved**,
  R2 HEAD check explicitly NOT folded in; ledger ≠ provider
  spend, disposed attempt's charge still UNKNOWN; bootstrap
  census unknowable in advance.
- **§7** Non-authorizations. **§8** Gate checklist:
  Rowan operational review (incl. §4 rulings) → Julie (a) →
  route-build cycle if ruled → Julie (b) with named B3
  sub-decisions → (c) separate entirely.

## Bootstrap-invocation findings (§4 of the proposal)

Verified in the quota-fix2 source during drafting:

- `bootstrapQuota` (quota-budget.mjs L279),
  `disposeBootstrapException` (L362), `reconcileQuota` (L478)
  are store functions taking the coordinator object;
  reconcile is SELECT-only (read-only by construction).
- **Zero callers in `worker/`** — coordinator imports only the
  hook functions (reserveForGrant, boundGrantTargets,
  settle/close helpers, quotaBudgetView); genstore only
  applyDispatchQuota; service only closeReservationsForPlan.
  Only tests call the three.
- **No existing surface reaches them**: the `/internal/d6/*`
  route set, the entry's operator fence class
  (`/v2/d6-seed-storage`, `-phase-binding`, `-retire-halted-plan`,
  `-release-quarantine`, `-reconcile-unknown`,
  `-adjudicate-estimated`, diagnostics), the `/v2/commands`
  type switch, and the alarm cases (watchdog/lease/
  retry_grant/handoff_check) — none has a quota member.
  quotaBudgetView is not reconcile's report (no drift/
  exception detail).
- **No external path exists**: DO SQLite is reachable only
  from code inside the Worker; the Cloudflare API cannot
  invoke a DO method or run SQL. Stated plainly in the
  proposal: **no mechanism exists in this build; new code is
  required.**

Options presented for Rowan's ruling:

- **Decision Point 1 (mechanism) — Option 1**: minimal
  operator routes in the exact seed-storage fence class
  (`POST /v2/d6-quota-bootstrap`, `POST
  /v2/d6-quota-dispose-exception`, `GET
  /v2/d6-quota-reconcile`): operator credential at the entry,
  unforgeable `x-opalreader-operator-admitted` stamp re-checked
  at the DO class gate, bootstrap handler halt-only +
  figureless, disposition passes only the fields the store
  function re-validates itself. Own build + source-review
  cycle. (The only viable mechanism.)
- **Decision Point 2 (sequencing) — Option 3** (fold the route
  build into this deploy: one upload, but the combined tree
  exceeds the SOURCE-PASSED tree and needs its own source
  review; a route-design hold would delay the whole deploy)
  vs **Option 4** (deploy quota-fix2 as-is under gate (a);
  route cycle + mini-deploy follow; cache fix live soonest,
  guard inert until gate (b)). Wren's lean is recorded in the
  proposal, labeled as such: Option 4.

## OPEN questions for Rowan

1. **§4 Decision Point 1**: rule on the route mechanism as
   specified (route names/shapes are proposals, not
   decisions).
2. **§4 Decision Point 2**: fold-in (Option 3) vs follow-up
   (Option 4) sequencing.
3. Whether the gate-(a) D1 harness check count / negative
   mutations need re-specification for the 28th part, or the
   adapted harness output at D1 suffices as in prior deploys.
4. Whether B2's success criterion (strengthened `ok`, or
   `ok === false` fully explained by enumerated exceptions)
   matches her intent for the bootstrap gate.
5. Whether she wants the gate-(b) execution to include any
   same-day disposition proposals in the same sitting, or
   dispositions always as a later, separate sitting after the
   B2 report is reviewed.

## Notes for the parent

- The deploy pin for the final tree does **not** exist yet;
  the proposal states the build marker is set at pin time and
  D1 re-reads it. Pinning the full quota-fix2 tree + this
  proposal (child of `3e6fd3af…` on `ui1-review`) is the
  natural next step when the parent files — not done here
  (task was document-only, no pins).
- One judgment call inside the proposal worth flagging: §2's
  drift rule (listening drift on bindings/sessions is recorded
  and carried at D0; only generation-plane drift STOPs).
  Prior proposals used stricter identical-inventory language;
  the Gate-8 run + Oct 31 listening make a verbatim-identity
  D0 unrealistic, and the rule is stated openly for Rowan to
  strike if she disagrees.
- `tree-inventory.json`'s envelope section initially marked
  build-identity.mjs "CHANGED" vs live; corrected to the
  STAMPED-AT-ASSEMBLY wording (tree carries "UNBUILT"; live
  carries its pin) before delivery.
