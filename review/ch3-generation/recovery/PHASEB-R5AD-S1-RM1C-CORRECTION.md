# Phase B — RM-1-c correction: the S1-X completion interval and decision-lapse law

> **Status:** FOCUSED CORRECTION to the REVISED-2
> R5a-D/S1 sequencing proposal (pin
> `11a296e79f0963fc005a23edd3e2a9dffbf012fd`),
> answering the one open item in Rowan's ruling
> of Nov 2, 2026 on that pin (CONDITIONAL
> ACCEPTANCE — RM-1-a and RM-1-b CONDITIONAL
> PASS; **RM-1-c REVISE**). Offline paperwork
> only. Nothing in this correction authorizes any
> production act: no deploy, stimulus, command,
> containment transition, generation, or
> restoration. Production remains INVESTIGATION
> HELD and ends HELD. The preserved Phase B plan
> `plan:19cad189fab54b9c804a74a6` and the idx-26
> exemption remain protected and untouched.
>
> **How this correction is read.** Rowan
> authorized a focused correction, not a rewrite.
> On her acceptance, the operative package is the
> REVISED-2 proposal (pin `11a296e7…`) **as
> amended by this correction**. §5 lists every
> amendment by section. Where this correction and
> the REVISED-2 text conflict, **this correction
> governs**; the two known conflicts are named in
> §5 (items 1 and 2) and in the deviations (§6).

---

## 1. What Rowan required

RM-1-c, in her words: the proposed first-in-session
completion rule with fresh-confirmation reads "is
insufficient without a maximum interval between
the recorded firing decision and the emergency
stop act. Propose a source-grounded maximum
completion interval and define what happens when
it expires. After that interval, the prior
decision must not authorize execution. A fresh
Rowan ruling and Julie authorization are
required." Fresh verification immediately before
any stop act and the existing single-use S1-X
budget are preserved.

This correction proposes the interval (§2),
derives it from the system's own constants (§2.1),
and states the complete expiry law (§3). It also
records the RM-1-a and RM-1-b conditions at the
strength Rowan imposed them (§4).

## 2. The completion interval: 60 minutes

**Rule.** A recorded S1-X firing decision
authorizes initiation of the stop act only within
**60 minutes (3,600,000 ms)** of the decision
timestamp recorded in the window log. The interval
runs from that recorded timestamp to **initiation**
of the act, as initiation is defined in §3.1. An
act not initiated inside the interval is not
authorized by that decision — full stop (§3).

The first-in-session-opportunity discipline and
the fresh-confirmation guard from the REVISED-2
proposal are **retained, subordinated**: the act
is still performed at the first in-session
opportunity, and fresh verification immediately
before the act is still required (§3.5). The
interval is the outer bound those disciplines
previously lacked; it does not replace them.

### 2.1 Derivation — the system's own constants

No new constant is invented. The value is the
design's existing staleness vocabulary, and it is
an exact multiple of the chain's own cadence:

1. **The watchdog period is 600,000 ms (10
   minutes).** The coordinator's watchdog constant
   is 600,000 ms (deployed-source basis:
   stall-diagnostic report, "the watchdog cadence
   is 10 minutes"; R5a revised spec, citing
   `(600,000, :133)`). A revived chain takes a
   drive pass on that cadence; each pass re-arms
   the watchdog and can issue/void the §7.3 grant.
   **The state a firing decision describes can
   therefore change on every pass** — the decision
   is a claim about a moving system, and its
   descriptive context is superseded pass by pass.
2. **The design's only staleness constant is
   3,600,000 ms (60 minutes).** The R5a semantic
   carries `ALARM_STALE_THRESHOLD_MS = 3,600,000`
   — the age past which an alarm registration is
   treated as no longer describing current intent
   (retry-supersession analysis; retained by
   Rowan's ruling as the provisional candidate
   value). It is the codebase's and the package's
   existing word for "alarm timing no longer
   fresh."
3. **60 minutes is exactly six watchdog periods**
   (6 × 600,000 ms = 3,600,000 ms). The interval
   thus says, in the system's own units: a firing
   decision survives at most six passes of the
   chain it judges. Beyond six passes, the package
   already has a name for the decision's timing —
   stale.
4. **The trigger evidence is a snapshot.**
   Verification under the §3.4 standard (V4-4(c))
   fixes T1–T4 markers — grant state, job state,
   phase/quota figures, recorder rows — at the
   performing check's reads. Those figures are
   exactly the ones the churn moves. Fresh reads
   at act time (§3.5) re-verify the *markers*; the
   interval bounds the age of the *decision*,
   which embodies more than markers: the window's
   classification state, the coverage posture, and
   the escalation context in which Rowan's and
   Julie's standing authorizations were framed.

### 2.2 Alternatives considered, and why not

- **30 minutes (three watchdog periods).** No
  source constant corresponds to it, and it adds
  no evidentiary protection the act-time fresh
  reads do not already provide: markers are
  re-verified at initiation regardless of the
  decision's age. Its only effect would be to
  lapse more decisions — including decisions
  recorded minutes before an attended session
  begins — without a grounding in any constant
  the system already uses.
- **120 minutes (twelve watchdog periods).**
  Twice the design's staleness constant, and a
  full hourly-phase check interval: by initiation,
  up to twelve passes have run and at least one
  further scheduled check has re-observed the
  chain without the decision being acted on. A
  decision that survives two check generations
  and twelve passes is not the decision the
  evidence supported.

### 2.3 The cost, stated plainly (not argued away)

Rowan's condition has a real cost and this
correction does not minimize it. Escalation
reaches Julie only when she views the Coding
Projects chat (REVISED-2 §3.2, L-3 — the fact
stands; only its unbounded-latency conclusion is
superseded, §5 item 2). A decision recorded while
Julie is away — overnight is the obvious case —
will in the ordinary course **lapse** under a
60-minute bound, and the stop will then require
the fresh-ruling path of §3.3. That is expected,
not exceptional: under this law, lapse is the
normal fate of unattended decisions, and the
fresh-authorization path is the normal route for
them. The exposure during a lapse remains bounded
**in effect** — the holds stand, dispatch is
fenced, $0, the §7.3 churn only — and observation
and ownership continue uninterrupted (§3.4); what
lapses is one decision's authority to fire, never
the window's coverage or the chain's named owner.
This correction adopts Rowan's rule at her
strength: a stale decision does not fire, and the
price of that protection is re-authorization, not
a longer leash.

## 3. The expiry law (complete)

### 3.1 Definitions

- **Decision timestamp.** The timestamp the
  performing check writes into the window log when
  it records the firing decision (REVISED-2 §3.6,
  decision-recording locus — unchanged). This
  recorded timestamp is the interval's sole start;
  no other clock reading starts, restarts, or
  extends an interval.
- **Initiation.** The stop act is **initiated** at
  the moment Wren, in session, dispatches the
  operator containment call carrying
  `{action: "stop_chain"}` under the recorded
  decision. Dispatch is the last executor-
  controlled instant and the interval's end. The
  dispatch timestamp is written into the window
  log as part of the act record, alongside the
  decision timestamp, so the interval arithmetic
  is auditable from the record alone. The act's
  first durable effect marker is the design's own:
  the commit's `stop_chain:applied` audit row,
  whose id mints the episode (containment design
  v4, as carried in the gates ledger).
- **Completion.** The act's in-bound
  `verify_chain_stop` attempts (≤3, episode bound
  unchanged) and their recording. Completion is
  **not** separately clock-bound: what the
  interval bounds is initiation. Once initiated
  in-interval, the act completes under the
  design's existing verification discipline,
  whenever its reads land.

### 3.2 Lapse

If the act has not been initiated within 60
minutes of the decision timestamp, the decision
is **LAPSED**, as a matter of clock fact — not of
anyone's discretion:

- The lapse is recorded in the window log by
  whoever first establishes it (the next performed
  check, or Wren in session), carrying the decision
  timestamp, the lapse instant (decision timestamp
  + 60 minutes), the trigger, and the reason:
  *interval expired without initiation*.
- A lapsed decision **authorizes nothing
  further**. It cannot be revived, extended, or
  acted on "in the spirit of" the original
  verification. There is no grace period and no
  executor override.
- Lapse is distinct from REVISED-2 §3.6's
  **NOT COMPLETED — CONDITION NOT CONFIRMED AT
  ACT TIME** (the fresh-confirmation guard failing
  at an in-interval act attempt). Both records are
  terminal for their decision; they are never
  conflated in the log.

### 3.3 After a lapse: the fresh-authorization path

A chain stop after a lapse proceeds only under a
**fresh Rowan ruling and a fresh Julie
authorization** (Rowan's words) — concretely, the
paths the package already names: an at-trigger
S1-X grant on the §3.6 case-(ii) pattern, or C3's
stop act if §4.3 eligibility is established on
Rowan's express disposition. The lapsed decision's
evidence package — the firing reads, timestamps,
and classification record — is **preserved** in
the window record, **may be cited** in the fresh
request, and **does not substitute** for fresh
verification or fresh authorization.

### 3.4 The single-use budget is not consumed by a lapse

Consumption attaches to the **act**, never to a
decision. A lapsed decision performed no
`stop_chain`; the V4-4 single use is unspent.
Reconciliation with the binding's single-use
terms, stated exactly:

- Within the live window, a **new** firing
  decision may be recorded on the same
  still-standing trigger and acted on inside its
  own 60-minute interval — but only as a genuinely
  new decision: the full §3.4 evidence standard
  met on fresh reads at the new decision's own
  performing check. Re-decision is not renewal,
  extension, or re-dating of the lapsed decision,
  and the lapse history is part of the record any
  reviewer sees.
- The moment a `stop_chain` act is initiated
  under any decision, the single use is spent,
  whatever the act's verification outcome
  (REVISED-2 §3.4/§4.3, unchanged).
- None of this touches §3.6 case (iv): at window
  expiry S1-X is DEAD, fired or unfired, lapsed
  decisions or none. Lapse law governs decisions
  **inside** a live authorization; it creates no
  post-expiry rights of any kind.

### 3.5 Fresh verification at act time (unchanged, independent)

Immediately before initiation — at minute 2 or
minute 59 of the interval, identically — Wren
re-reads the trigger surfaces fresh. If the
trigger condition no longer stands, the act does
not proceed on the recorded decision; the outcome
is recorded NOT COMPLETED (guard form, §3.2) and
escalated. The interval never substitutes for
fresh verification, and fresh verification never
extends the interval. The two protections are
independent and both always apply.

### 3.6 Interaction with the B′ coverage cases

REVISED-2 §3.6's coverage law and cases (i)–(v)
stand, with the interval inserted as the operative
bound on case (i)'s straddle:

- **Decision recorded in-window; act initiated
  within the interval; completion after window
  expiry.** Covered — this is case (i), now with
  a defined initiation bound. The straddle
  (decision, initiation, completion timestamps,
  and the window-expiry crossing) is recorded
  expressly, as before.
- **Decision recorded in-window; act initiated
  after window expiry but within the interval**
  (a decision recorded near expiry). Covered, on
  the same case-(i) basis: coverage attached to
  the decision on complete in-window evidence, and
  initiation met the interval. The interval — not
  the window's closing instant — is the outer
  bound on initiation; expiry never truncated an
  in-interval initiation right.
- **Act initiated after the interval has lapsed —
  whether or not the window has also expired.**
  **Prohibited, no exceptions.** Before window
  expiry, the route is a new decision (§3.4) or
  escalation; after expiry, the route is §3.3's
  fresh authorization. An initiation after **both**
  bounds is the doubly-prohibited case and is
  named so that no reading of case (i) can be
  stretched to reach it.
- **Ambiguous initiation.** If the `stop_chain`
  dispatch occurs in-interval but its outcome is
  ambiguous (response lost, effect unclear), the
  decision is neither lapsed nor re-dispatchable:
  `stop_chain` is never re-sent under the same
  decision (the design's standing rule — a
  `stop_chain` whose audit row exists is never
  re-sent, and re-entry classifies from state +
  audit + a fresh read). The ambiguity is recorded
  expressly and resolved only by fresh live reads
  under the design's unresolved-response posture;
  permitted resumption, if any, is
  `verify_chain_stop` within the episode bound.

## 4. RM-1-a and RM-1-b — conditions recorded

Rowan's Revised-2 ruling imposed these as
**conditional** passes. They are recorded here at
her strength and carried into the operative
package (consistency items in §5):

- **RM-1-a (vehicle).** The scheduler architecture
  is accepted as *feasible, not certified*: the
  existing scheduler's operating history supports
  feasibility but does not certify the new jobs.
  The Stage-1 smoke test is **mandatory**, and
  **Stage 2 is prohibited unless the new job's
  execution and logging are independently
  confirmed** — both records (the window log's
  SMOKE entry and the scheduler's run record), as
  REVISED-2 §3.2 already specifies. The scheduled
  jobs are **read-only and escalation-only,
  permanently**: they must never execute
  containment transitions, S1-X, commands, or
  stimuli. No broadening of the jobs' permissions
  is proposed or permitted by this correction.
- **RM-1-b (cadence).** The cadence and the
  +10-minute jitter tolerance are accepted
  **subject to** verified coverage, explicit gap
  accounting, the WINDOW-FAILED rules, and the
  established escalation discipline. Rowan's
  limitation is carried into the authorization
  text verbatim (§5, item 4): **six-hourly checks
  are observation, not continuous protection.**

## 5. Consistency edits — how this correction amends REVISED-2

The REVISED-2 proposal is **not** rewritten. On
acceptance, it is read with these amendments:

1. **§3.6, "Completion discipline" paragraph —
   REPLACED.** The paragraph proposing "first
   in-session opportunity + fresh-confirmation
   guard, **no fixed clock bar**" is withdrawn and
   replaced by §§2–3 of this correction (interval
   + lapse law), with the first-opportunity
   discipline and the fresh-confirmation guard
   retained as subordinate rules (§§2, 3.5). This
   is the correction's principal conflict with the
   REVISED-2 text; the correction governs.
2. **§3.2, limitation L-3 — one sentence
   SUPERSEDED.** L-3's statement that "S1-X
   response latency after a recorded firing
   decision is not bounded by this design" no
   longer holds: latency is now bounded by the
   decision-lapse law (60 minutes to initiation).
   L-3's underlying facts (chat-only escalation,
   no paging guarantee) stand unchanged and are
   the reason §2.3 expects lapses.
3. **§6.2 Part (C) — reference corrected.** Part
   (C)'s phrase "under §3.6's completion
   discipline" denotes the discipline **as
   corrected by this document**. A firing decision
   not initiated within 60 minutes of its recorded
   timestamp is LAPSED and lies outside Part (C)'s
   coverage; Part (C)'s remaining terms (single
   use, expiry at window close, revocability) are
   unchanged.
4. **§6.2 Part (B) — limitation inserted.** The
   sentence *"Six-hourly checks are observation,
   not continuous protection."* is read into Part
   (B)'s grant text, per RM-1-b.
5. **§3.2 smoke-test and boundary text —
   conditions recorded.** §3.2's Stage-1 smoke
   test and the jobs' read-only/escalation-only
   boundary are read subject to RM-1-a's
   conditions as recorded in §4 (mandatory smoke
   test; Stage-2 prohibition absent independent
   confirmation of execution **and** logging).
6. **§3.4, mechanical gloss — read as corrected.**
   §3.4's statement that on a recorded decision
   "the act follows in session under §3.6's
   completion discipline" reads with the corrected
   discipline (§5 item 1).
7. **§4.1, boundary-map S1-X row — one state
   added.** Beside "fired (once), spent, or DEAD
   at window expiry," a recorded decision may end
   **LAPSED** (unspent, authorizing nothing,
   §3.2/§3.4 of this correction). Lapse is not a
   stop and has no §4.3 eligibility consequence;
   §4.3 is unchanged.
8. **§7, Item RM-1-c — answered.** The item asked
   Rowan to confirm the no-bar discipline or
   impose a bound by ruling; she required a bound.
   This correction proposes it (§2). Items RM-1-a
   and RM-1-b stand as conditional passes with
   their conditions carried (§4).

Nothing else in REVISED-2 is amended: candidate
identity, census, batteries, mutation bounds,
STOP discipline, rollback classification,
runtime-adoption caveats, the §3.6 coverage cases,
the §3.4 evidence standard, the episode bound
(≤3), the Grant 1 / Grant 2 structure, and the
accepted sequencing all stand exactly as pinned.

## 6. Deviations — identified explicitly

- **DV-13 (this correction vs REVISED-2 §7/§3.6).**
  The REVISED-2 proposal expressly declined to
  propose a fixed completion bound and argued the
  fresh-confirmation guard sufficed. Rowan ruled
  otherwise. This correction **withdraws** that
  position and proposes the bound. Recorded as a
  deviation so the reversal is on the face of the
  package, not buried in it.
- **DV-14 (L-3 narrowing).** §5 item 2 narrows a
  stated limitation of the accepted vehicle
  section. The narrowing is a consequence of
  DV-13, not an independent change to the vehicle:
  the vehicle's facts are untouched.
- No other deviations. No candidate, evidence,
  census, or authorization boundary is broadened
  by this correction; the monitoring jobs'
  permissions are unchanged (§4).

## 7. What remains for Rowan

One confirmation: the 60-minute interval and the
lapse law of §§2–3 (or a different bound imposed
by ruling). Everything else in the package —
RM-1-a, RM-1-b, Items A–E, RS-1..RS-5, B′ — stands
settled or conditionally passed with conditions
carried, as recorded above. On her acceptance of
this correction, the operative package is
REVISED-2 (pin `11a296e7…`) as amended here, and
the proposal stands ready for Julie's Grant 1
decision — which this document does not request.

**Turn: Rowan's.**
