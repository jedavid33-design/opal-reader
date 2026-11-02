# Phase B — R2 stimulus gate proposal (one RequestPause wake probe)

**Status: PROPOSAL ONLY — NOT APPROVED, NOT TO BE EXECUTED.**
Prepared in parallel with the R5a revision package under Rowan's
rulings (assessment ruling: R2 preferred over R1 as the first
diagnostic stimulus, subject to a separately approved execution
gate; revision ruling `6584187105`: R2 paperwork may proceed
alongside the offline R5a work — **no production R2 stimulus is
authorized**). Execution would need Rowan's approval of this gate
**and** a fresh explicit Julie GO (§8). Production remains under
INVESTIGATION HOLD.

**What R2 is.** Exactly one durable command — `RequestPause` with a
fresh `command_id`, targeting the reserved nonexistent job
`alarm-wake-probe:nonexistent` — sent through the ordinary command
path. From shipped source (verified for the revision package): the
command is recorded (1 `commands` row), `wake()` runs, the apply
step rejects with `job_not_found` **before any job transition**, and
`wake()`'s arming evaluation runs again post-apply. On the
*currently shipped* build, the expected arming result is **zero**
`setAlarm` calls (B1: D = A, the strict `due < armed` test fails) —
R2 on the shipped build is a probe of whether the platform reacts
to the wake at all, observed through the recorder. On a future
R5a build the same command is the natural revival stimulus; **this
gate as written is for the shipped build.** (Sequencing — R2 before
R5a, R5a+containment before R2, or R2 as the R5a gate's stimulus —
is Rowan's to rule; unresolved decision 5 in the package. This
paperwork is complete for the shipped-build form.)

---

## 1. Preflight / census (any mismatch = STOP, before the stimulus)

The common preflight (from the amended assessment §7, re-based to
current values): live build stamp `86ad06ab…`; GENERATION_HALT "1";
queue delivery paused; settings revision 1; preserved plan/job
exactly at their recorded state (plan active, entry pending,
occurrence `pending`, job `queued` rev 1, quarantine unheld, grants
[]); phase figures frozen (settled 1,029,420 / estimatedUnverified
19,018 / reservedUnverified 5,648 / unknownOpen 0); quota reconcile
`ok: true` with the sole straddler exception; conflicts exactly the
four baseline `schedule_dead` rows; parked job fingerprint
`b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`;
watermarks 18 / 1841; and a `drive=1` read recording armedAt,
pendingSchedule, pendingWatchdog, tableState, recorderHealth as
they then stand.

Plus the R2-specific preflight (assessment ruling item 3):

1. **Target nonexistence verified:** `alarm-wake-probe:nonexistent`
   resolves to no job on the live job/plan reads.
2. **Fresh command_id:** generated for this execution, never used
   before, and recorded in the execution record *before* the
   stimulus is sent.
3. **Recorder state known:** if the preflight `drive=1` read shows
   any recorder row or an armedAt different from the last recorded
   observation, the state has already moved — **STOP; no stimulus
   is needed or permitted; classify and report.**

## 2. The stimulus (exactly this, once)

One `POST /v2/commands` with `{command_id: <fresh>, type:
"RequestPause", payload: {jobId: "alarm-wake-probe:nonexistent"}}`.
Expected response: outcome `rejected`, reason `job_not_found`.
**No re-send** under any circumstance — a timeout or ambiguous
response is a STOP-and-classify event, not a retry (the command_id
makes a duplicate detectable; detection is not permission).

## 3. Mutation budget

| item | budget |
|---|---|
| commands rows | **exactly 1** (the stimulus) |
| `setAlarm` registrations | **≤1 conditional** (shipped build: 0 expected in B1; 1 possible only if D < A — the B2 shape) |
| schedule rows | 0 expected (watchdog already pending; if pendingWatchdog were 0 at preflight that is a census deviation = STOP) |
| uploads / PATCHes / hold flips / queue changes / SubmitJob | **0** |
| recorder rows | accrue only if passes run; classified per §5 |
| spend | $0 |

## 4. Observation window

`drive=1` + plan/job reads at approximately +2, +12, and +37
minutes after the stimulus (the final read beyond one full
35-minute stall-window convention), then a closing census (§6).
No further stimulus of any kind during the window, whatever the
reads show.

## 5. Result classification (mandated wording)

- **Revival observed** (recorder rows appear, and/or grant state
  moves): classify every movement against the §7.3 pre-classified
  set (grants [] → [the one grant], occurrence pending → granted,
  job queued rev 1 → generating rev 2, derived reserved 0 → 12,
  phase figures frozen, dispatched 0). Any movement outside the set
  = STOP + report. A revived chain is then a live condition:
  correction 6 applies (§7) and containment (once deployed) is the
  standing answer.
- **No revival observed:** the result is reported **only** in these
  terms — "**no observed revival within the tested window, subject
  to recorder limitations**" — and never as proof that B2 is
  impossible. A negative R2 does not definitively eliminate B2
  (ruling, required corrections): the recorder has a dual-failure
  blind spot, and a wake whose arming evaluation is a no-op under
  the shipped condition is *expected* to produce no registration in
  B1 whether or not the platform would have delivered one.

## 6. Preservation checks (closing census)

Repeat §1 verbatim. Expected deltas, and only these: +1 commands
row; ≤1 conditional registration; recorder rows if passes ran;
grant-cycle state **only** if revival occurred and only within the
§5 pre-classified set. Ends **HELD**: GENERATION_HALT "1", queue
paused, preserved plan and exemption untouched, no hold or queue
change at any point in the gate.

## 7. STOP conditions

**Correction 6 (ruling item 6) — governs every STOP in this
document, verbatim:** STOP prevents additional operator stimuli but
cannot itself stop an already-revived alarm chain. A successful
recovery may continue watchdog and grant/void activity beyond the
observation window, indefinitely under the holds; containment of a
revived chain requires its own independently gated procedure, and
that continuing effect must be explicitly addressed before any
production stimulus. **For this gate specifically: once the single
command is sent, there is nothing left for a STOP to prevent — the
gate's remaining steps are reads only, and if the chain revives,
STOP does not quiet it.**

STOP (before the stimulus) on: any §1 mismatch; target existence
ambiguous; command_id collision; recorder state already moved.
STOP (after the stimulus — reads and reporting only) on: response
other than the expected `rejected`/`job_not_found`; any state
movement outside §5's pre-classified set; any hold/queue/build
change from any source during the window.

## 8. Exact Julie GO scope a future execution would need

> "GO — execute exactly one R2 stimulus attempt per this gate as
> pinned: preflight census, exactly one `RequestPause` command with
> the recorded fresh command_id targeting
> `alarm-wake-probe:nonexistent`, no re-send, observation reads
> only, ending HELD. I understand a negative result will be reported
> as 'no observed revival within the tested window, subject to
> recorder limitations' and proves nothing about B2, and that if
> the chain revives, no STOP can quiet it — containment is a
> separate gated procedure."

**Turn: Rowan's** (gate review). No GO is requested by this
proposal.
