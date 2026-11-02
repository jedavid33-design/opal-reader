# Phase B — R5a retry-supersession analysis and safeguard design

**Status: OFFLINE ANALYSIS AND DESIGN ONLY.** Prepared under Rowan's
R5a revision ruling (board comment `6584187105`, `opal-roundtable`
issue #15, 2026-11-02). Nothing in this document authorizes any
production action. Production remains under INVESTIGATION HOLD.

**Question.** The revised R5a condition treats a past-due armed alarm
value as unarmed and re-registers at the earliest pending due time.
But a past-due `getAlarm()` value does **not** by itself prove that
delivery was lost: the platform may hold a *pending retry* of a
failed alarm invocation. If R5a re-registers while such a retry is
still pending, what happens to the retry — and what safeguard makes
the re-registration acceptable to propose?

---

## 1. Documented platform semantics (basis)

From the alarm-semantics assessment
(`PHASEB-ALARM-SEMANTICS-ASSESSMENT-AMENDED.md`, accepted by Rowan),
with its documentation tags:

- **D1 — at-least-once with bounded retries.** Durable Object alarms
  have guaranteed at-least-once execution. When an `alarm()`
  invocation throws, the platform retries it automatically, with
  **exponential backoff starting at a 2-second delay, up to 6
  retries**.
- **D1 — retries attach to the most recent registration.** Retries
  apply **"only to the most recent `setAlarm()` call."** A new
  `setAlarm()` therefore re-bases the retry chain: the pending retry
  sequence of the previous registration is superseded by the new
  registration.
- **D1 — retry fires only on uncaught exception.** Retries happen
  when the alarm handler throws; a handler that returns normally
  ends the chain.
- **D2 — the retry-gap read.** `getAlarm()` returns the scheduled
  time while an alarm "is considered to be set if it has not started,
  **or if it has failed and any retry has not begun**." A past-due
  armed value is therefore the *expected* read during the gap
  between a failed invocation and the start of its next retry.
- **D2 — ordinary delivery delay.** Apart from retries, delivery
  delay is documented as milliseconds, up to about a minute during
  maintenance or failover.

## 2. What is UNSPECIFIED

The following are **not** pinned down by the reviewed documentation,
and this analysis does not pretend otherwise:

1. **The backoff multiplier and any cap.** Only the 2-second start is
   documented. The derivation in §4 assumes doubling because
   "exponential" with no stated base most commonly means ×2 — an
   **assumption**, labeled as such wherever it is used.
2. **Total retry-window duration.** Follows from (1): not documented.
3. **Post-exhaustion platform state.** After the 6th retry fails,
   whether the registration persists, is dropped, or keeps reading as
   set via `getAlarm()` is unspecified. (This matters for the live
   incident: the armed value `2026-11-01T19:49:36.104Z` has read
   unchanged for ~20 hours.)
4. **Whether a superseded retry's invocation can still arrive.** If a
   retry was already dispatched when `setAlarm()` re-bases the
   registration, whether the in-flight retry invocation is cancelled
   or may still execute is unspecified.
5. **Whether `setAlarm()` during a running handler interacts with
   that handler's own retry chain** beyond the "most recent call"
   rule.

## 3. Supersession scenarios

Let A = the armed value read by a wake, D = the earliest pending due
time, and suppose A is past-due at the moment of the wake.

- **S1 — retry pending, retry would have succeeded.** The failed
  invocation's next retry is scheduled but has not begun. R5a
  re-registers at D. Per D1 the retry chain re-bases to the new
  registration; the alarm fires at D instead. Net effect: the same
  pass runs, driven by the new registration rather than the retry.
  The pass itself is the shipped `alarm()` — idempotent in structure
  (schedule rows carry attempts/state; grants are revision-checked),
  so *which* trigger delivered it does not change pass semantics.
  Harm: none identified in pass behavior; the retry bookkeeping is
  platform-internal.
- **S2 — retry pending, would have failed again.** Re-registration
  replaces a doomed retry chain with a fresh registration whose
  invocation gets its own fresh retry budget. Net effect: *more*
  delivery attempts than the platform alone would have made. Passes
  remain the shipped semantics.
- **S3 — in-flight retry races the re-registration (UNSPECIFIED,
  item 4).** If the retry invocation executes anyway, two
  invocations of `alarm()` could run close together. Durable Object
  invocations for one object are serialized by the platform's
  single-threaded execution model for the object; the passes would
  run sequentially, each re-arming in its `finally`. No concurrent
  mutation hazard beyond ordinary sequential passes is identified
  from source, but the *possibility* of the extra pass is
  platform-unspecified and is counted as residual risk.
- **S4 — no retry pending (delivery genuinely lost).** This is the
  incident hypothesis (B1/B2 family): re-registration is the only
  recovery. The safeguard must not block this case — in the live
  incident A is ~20 hours past due, far beyond any plausible retry
  window.
- **S5 — healthy chain, transient retry gap, heavy wake traffic.**
  The dangerous case for an *unguarded* R5a: an alarm fails, its
  retry is 30 seconds out, and unrelated command/report traffic
  wakes the coordinator; the unguarded condition would re-register
  immediately, churning registrations and (per S1/S2) repeatedly
  re-basing the retry chain — potentially starving a struggling
  alarm of its own retry cadence. This is the case the safeguard
  exists to prevent.

## 4. The safeguard: a stale-age threshold in the condition itself

### 4.1 Mechanism

The past-due disjunct fires only when the armed value has been past
due for **longer than a named threshold**:

```
armed === null || armed === undefined
  || armed <= now - ALARM_STALE_THRESHOLD_MS
  || due < armed
```

with the proposed design constant

```
ALARM_STALE_THRESHOLD_MS = 3,600,000   (60 minutes)
```

enforced inside `_armAlarmIfEarlier()` itself — there is no
procedural step a future caller can forget. Inside the threshold, a
past-due armed value is treated exactly as shipped: the registration
stands, the retry gap is respected.

### 4.2 Derivation (arithmetic shown; assumptions labeled)

Documented inputs: at most **6 retries**; backoff **starts at 2 s**;
exponential. **Assumption (UNSPECIFIED): doubling (×2).**

Retry delays under the assumption: 2 + 4 + 8 + 16 + 32 + 64 =
**126 s ≈ 2.1 minutes** from the first failure until the *last*
retry *begins*. Add the documented ordinary delivery/failover delay
of up to ~1 minute: a generous documented-plus-assumed envelope for
"a legitimate retry could still be pending" is **≈ 3.1 minutes**.

Threshold choice: **3,600 s (60 min)** =

- **≥ 28×** the assumed full retry envelope (126 s), and
- **60×** the documented failover-delay bound (~60 s), and
- ≈ 19× the combined envelope (186 s).

Sensitivity: for the threshold to be too small, real backoff would
have to exceed the assumed envelope by more than an order of
magnitude (e.g., a ×4 multiplier gives 2+8+32+128+512+2048 = 2,730 s
— still inside 3,600 s; a ×5 multiplier gives 7,810 s — outside).
The threshold is therefore robust across the plausible multiplier
range but is **not a proof**: the multiplier is genuinely
unspecified (§2.1).

### 4.3 Why a threshold, and not recorder-evidence preconditions

An alternative safeguard — "re-register only if the recorder shows
no recent pass activity" — was considered and rejected as the
*primary* guard: recorder rows record passes that *ran*; a failed
invocation that threw inside `alarm()` does produce a row under the
instrumented build, but the recorder has a known dual-failure blind
spot (a pass that fails before the handler plus a recorder failure
leaves no trace), so absence of rows cannot certify absence of
retries. The threshold is time-based, needs no evidence surface, and
is enforceable in the condition itself. Recorder evidence remains
useful corroboration at gate time, not a precondition in code.

### 4.4 Effect on the live incident

The live armed value is ~20 hours past due — **20× the threshold**.
The safeguard does not impede the intended recovery in this incident
at all; its entire function is protecting *future healthy chains*
(S5) from wake-driven churn after R5a becomes permanent.

## 5. Residual risk statement

- If the platform's real backoff is qualitatively different from
  every assumption in §4.2 (e.g., a long fixed delay before the first
  retry), a wake could still re-register during a legitimate pending
  retry. Consequences per §3 are bounded (same shipped pass, possibly
  an extra sequential pass) but the behavior is not fully knowable
  offline.
- Post-exhaustion semantics (§2.3) remain unspecified; the threshold
  does not resolve them, it only waits them out.
- **Permanent production safety is NOT claimed until the retry issue
  is resolved** (Rowan's formulation, adopted verbatim). This design
  proposes the threshold as a bounded, reviewable risk-reduction for
  a separately gated deployment decision; it does not certify the
  permanent condition as proven-safe, and the revised execution gate
  (companion document) carries the same limitation in its GO scope.

## 6. Test evidence (offline)

The threshold is exercised in the R5a battery
(`r5a-revision/tests/r5a-battery.test.mjs`, group R5A-T3): armed 5
minutes and 59 minutes past due → **no** re-registration; exactly at
the 60-minute boundary → re-registration (the condition is
inclusive: `armed <= now - ALARM_STALE_THRESHOLD_MS`); 61 minutes →
re-registration; the shipped build at 61 minutes → no
re-registration (the delta is exactly the new disjunct). Real
platform retry behavior **cannot** be tested offline and is listed
as an evidence gap in the package summary.
