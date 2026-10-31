## 8. End state — what "armed" means, and what it does not enable

After a completed gate (b): the durable bootstrap record exists, so
the quota guard is **armed** in the accounting sense — *if* the
grant/dispatch path ever ran, its gates would enforce the
per-dispatch budget from the reconciled ledgers. But:

- GENERATION_HALT remains `"1"`; the queue remains **paused**;
- no plan, job, or queue message can reach a dispatch path —
  arming the counter un-halts nothing, un-pauses nothing, and
  creates no generation;
- the client-visible quota view gains the armed shape (its figures
  derived from the new ledgers), which is a display change only.

Re-arm (halt flip + queue unpause) is a **later, separate gate**
under §10. Generation is later still, under gate (c).

---

## 9. Rollback and containment

- **Floor law (unchanged, restated):** the rollback floor is build
  `6a73d962…` + etag `a9a4c0c4…` + its data. The floor build does
  **not** enforce the provider-attempt counter and must never be
  represented as a safe re-arm fallback. No rollback below the
  settlement build while any adjudication record exists (gate-(b)
  changes nothing about that floor).
- **Bootstrap/dispositions are additive data.** They cannot be
  un-run. A rollback to the floor build would leave the quota
  tables in place, unread by that build; returning to the guarded
  build restores their use. Any rollback execution itself remains
  a separate Julie-authorized act requiring halted + paused holds
  held for the whole window, an externally archived copy of the
  affected records, and proven build compatibility — not commit
  recency.
- **Containment during gate (b):** every step runs behind the halt
  fence with the queue paused; the only writes gate (b) can make
  are the bootstrap record, the quota ledgers' bootstrap rows, and
  (under §7) disposition records. A fault at any step leaves the
  system halted + paused + (at worst) partially bootstrapped in a
  state the reconcile census can still describe truthfully —
  there is no step whose failure hides state.

---

## 10. The re-arm law (restated in full; gate (b) does not satisfy it)

A future re-arm requires **all** of the following, at the re-arm
moment:

1. the guarded build live (not the floor);
2. a fresh, complete, paginated reconcile census in that session;
3. `reconcileQuota.ok === true` on that census;
4. for any current-day hold created by a multi-day exception: the
   clock has left the exception's interval, and condition 3 is
   re-read *after* that moment;
5. Julie's separate, explicit GO for the re-arm itself;
6. the halt-flip and queue-unpause executed as their own recorded
   steps, in that order, each read back.

An explained `ok: false` hold — however well documented — satisfies
none of this. Gate (b) closing as an explained hold leaves the
system exactly as fenced as it is today.

---

## 11. Disclosures

- The 100/day figure is an **app-selected cap** (`PROVIDER_ATTEMPT_DAILY_LIMIT`),
  not a provider limit; Google's own quota is a separate, rolling
  100-requests/day limit that the app counter does not observe.
- Provider usage **outside** the Reader (other tools, other keys)
  is invisible to this counter and always will be.
- Harness green is not a production smoke: B1 remains the first
  real-DO execution of this code (§4.4), and gate (b) is designed
  so that this fact can cost a stopped session, never corrupted
  state.
- Every figure the quota ledger produces is **application
  accounting** — derived from the app's own dispatch records —
  never a provider-verified charge (§6.1).
- The B1 assigned/exception split **cannot be known in advance**;
  anyone quoting one before the call is guessing.

---

## 12. Decision points for Rowan

**DP-B1 — B3 timing.** When a complete B2 census surfaces provably
same-day exceptions, may B3 dispositions be presented to Julie and
executed in the same session, or must the census first be filed
and reviewed before any disposition? *Wren's lean: same-session
permitted, never required* — each disposition still carries its
own individual Julie approval with the §7 presentation, and the
census is complete and archived before the first B3 call either
way. Filing-first remains available whenever the census is large
or surprising.

**DP-B2 — Hold closure.** If gate (b) ends as an explained hold,
who declares it closed? *Wren's lean: Wren files the execution
record; Rowan reviews and closes it* — mirroring the gate-(a)
pattern (execution record → Rowan record review → closure), so no
hold is ever closed on Wren's say-so alone.

No other forks are presented: everything else in this proposal is
fixed by the prior rulings cited in the source index.

---

## 13. Non-authorizations and the approval sequence

This proposal authorizes nothing. The sequence is: Rowan's review
of this proposal → Julie's gate-(b) decision → execution of exactly
B0–B3 as approved → execution record → Rowan's record review.
Not included at any step: re-arm, queue unpause, halt flip,
generation of any kind, provider calls, spending, dispositions
beyond the individually approved §7 items, clearing of the
`schedule_dead` records, the R2-HEAD provenance read, client
publication, or any settings change.

---

## Source index

- `worker/generation/quota-budget.mjs` (deployed tree) —
  `bootstrapQuota`, `reconcileQuota` (L478–542), `disposeBootstrapException`,
  reservation identity, closure fence, derived-totals/drift law.
- `v2/worker-entry-prod-d6.js` (deployed tree) — the three operator
  routes, raw-text body forward, pagination validation, read-purity
  reconcile handler, disposition fault honesty.
- `worker/generation/gen-constants.mjs` — `PROVIDER_ATTEMPT_DAILY_LIMIT = 100`.
- `review/ch2-fresh-ch2/remediation/QUOTA-ADDENDUM.md` — bootstrap
  semantics, interval proof rules, acceptance invariants.
- `review/ch2-fresh-ch2/final-envelope/DEPLOY-PROPOSAL.md` — §4
  gate-(b) shape, §5 gate-(c) boundary, §6 rollback/floor law.
- `review/ch2-fresh-ch2/final-envelope/execution/EXECUTION-RECORD.md`
  (pin `68776e41…`) — gate-(a) end state: build `945875bc…`,
  etag `d63b61c3…`, halted + paused + UNARMED, `not_armed` read.
- Board rulings: quota design pass 6544950778; corrections
  re-review 6545597263; combined source pass 6545910782; deploy
  operational review 6546037460 (Amendments 1–4); routes reviews
  6546277727 / 6546431837; readiness pass 6546757371; gate-(a)
  record pass + deviation ruling 6547070545.
