# ADDENDUM — S-3 recovery-path assessment: the two documentary qualifications closed

Case #10 / P8 (issue #15). Prepared by Wren, 2026-11-16, under Rowan's ruling
on the S-3 recovery-path assessment (DOCUMENTARY PASS WITH QUALIFICATIONS;
verbatim board 6920417597). This addendum amends the assessment
(pin `af49923585645fbabc460854f62286ee20c6fe48`) at §3.3 and §3.5 only; all
other sections stand as accepted. It also adopts the ruling's Q1 language
correction (§3 below).
Handoff: RT-H-20261116-4fc6a2
Review pin: PIN-SLOT (repo `jedavid33-design/opal-reader`, branch `ui1-review`;
the Dropbox copy carries the filled pin — the only difference between copies).
Source basis: the deployed build `8a16def4` tree; references are to
`v2/coordinator.mjs` unless another file is named.

## 1. Qualification 1 — every outbox deletion site, enumerated

The assessment's invariant ("the outbox row is deleted only inside
`_voidDispatch`") was overstated. There are exactly three `DELETE FROM
outbox` sites in the coordinator. Each is condition-excluded for the
observed grant (`grant:plan:305078b1fba2c5119a86e142:ch5:3:full`, state
`issued`, never voided, never reported, send attempted):

1. **`_voidDispatch`** — claim-fenced (a `claimed` grant is never voided),
   and additionally unreachable for this row in the drain path: `drainOutbox`
   skips any row whose `send_attempted_at` is set (`if (row.send_attempted_at)
   continue;` — attempted rows are owned by handoff reconciliation, never
   re-invoked, never voided as unsent). This grant's send was attempted: the
   executor's recorded activity (execution, spend intent, `dispatching`
   attempt) exists only downstream of the send's invocation.
2. **Debris clear (in `drainOutbox`)** — deletes a row only when its grant
   is missing, `reported`, or `voided` ("Rows belonging to settled grants
   are debris"). This grant is `issued`: the condition is false.
3. **Ack-after-settle (in `drainOutbox`)** — deletes a row only after a
   send ACK arrives in that same drain pass AND the grant is then found
   settled to a state other than `issued` / `handoff_uncertain`. This grant
   is `issued`: the condition is false.

Corrected invariant, replacing the assessment's §3.3 premise: the outbox row
was created in the same atomic stretch as the grant (issuance), and **no
deletion site can remove the row of a live `issued` grant whose send was
attempted** — each site's guard excludes it under the grant's observed state
and history. The §3.3 conclusion (the lease case's no-outbox-row retirement
branch cannot apply to this grant) therefore stands, on the enumerated
basis rather than the overstated one.

## 2. Qualification 2 — `reconcileUnknown`'s actual invocation path

Binding uniqueness is enforced per (occurrence, revision) — the milestone
verification retains the intended-revision check, as the assessment's
checkpoint language already required. On reconciliation's invocation:

- The coordinator's `reconcileUnknown(jobId, occurrenceId)` (line 2904) has
  exactly **one call site** in the deployed tree: line 4126, inside the
  lease-expiry schedule case, executed in the same drive processing that
  marks the occurrence `outcome_unknown`, for each newly-unknown occurrence.
  For this occurrence's expected entry path (lease expiry), reconciliation
  is therefore not a dangling transition: it is invoked in-line, immediately,
  by the adjudicating pass itself.
- Stated at true strength, two limits: (a) invocation does not guarantee
  adoption — the adopt exit fires only if the deterministic cache key's
  audio provably validates at that moment; (b) **no standing caller re-runs
  coordinator-level reconciliation later.** If audio for the occurrence
  landed only after that pass, no automatic re-invocation exists in the
  deployed source; the occurrence remains `outcome_unknown` until a lawful
  later path (in practice, Julie's `ResolveOutcomeUnknown`). The other
  entry path into `outcome_unknown` (`report_unvalidated` in `handleReport`)
  does not call `reconcileUnknown` in its flow.
- A same-named but distinct function exists one layer down:
  `genstore.reconcileUnknown` (executor attempt-level), wrapped by the
  service's `reconcileUnknownAttempt` and exposed on an operator route
  (`worker-entry-prod-d6.js`:1014). It operates on executor attempts, not
  coordinator occurrences, and is not an invocation path for the
  coordinator's occurrence reconciliation.

The assessment's §3.5 is amended accordingly: eventual reconciliation is
claimed only in the in-line sense above.

## 3. Q1 language correction adopted

The assessment's §2 phrase "vanished unexecuted" is replaced, per the
ruling, with: **"the previously recorded registration is no longer
observable, and no subsequent handler completion or execution has been
recorded."** The exact platform failure mechanism remains undetermined.
P-ABSENT stands as the strongly supported working classification, subject
to the ruling's two evidentiary qualifications (the diagnostics surface
conflates an absent registration with a failed registration read; and
`getAlarm()` can return null during an executing alarm handler, so the
absence of pass 506 does not conclusively establish that no handler ever
entered).

Turn: Rowan's (for the record); the A-3 design-drafting decision is Julie's.
