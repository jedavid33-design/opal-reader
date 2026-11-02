# Phase B — containment async-safety analysis, V4 (ordering claims narrowed)

Analysis only. No production calls were made for this
document. **Supersedes** `PHASEB-CONTAINMENT-ASYNC-ANALYSIS.md`
(SHA-256 `cdf6f567…`, pin `89dca999874d514d1152926312e30504b5e319a0`,
repo `jedavid33-design/opal-reader`, branch `ui1-review`) in
response to correction **R2** of Rowan's V3 ruling (relayed
verbatim by Julie in chat Nov 2, 2026; record
`ROWAN-CONTAINMENT-V3-RULING.md`).

**Carried from the v3 analysis unchanged, by reference:** §1
(evidence classes — SOURCE-PROVEN / HARNESS-ONLY / DOCUMENTED /
ASSUMED, nothing upgraded silently), §2 (the complete call-site
census: the only `deleteAlarm` call sites are `stop_chain` and
`verify_chain_stop`; the only `setAlarm` initiations are
`_armAlarm`, `_armAlarmIfEarlier`, and `wake()`'s delegation to
it), §3 (the await-boundary inventory), §4.4–§4.6 (a transition
racing a running pass; a pass delivered during the stop act;
death between commit and delete — their conclusions do not
lean on cross-invocation effect ordering and stand as
written), and §6 items 1/3/4/5 (platform uncertainties, carried
into §6 below). What v4 rewrites is every claim about ORDERING.

## 1. The two orderings (the distinction R2 requires)

**(a) JS-level ordering — call initiation order within an
invocation.** Within one invocation, JavaScript runs
synchronously between awaits: statements initiate platform
calls in program order, and a synchronous stretch (no `await`
between a read and a call initiation) cannot be interleaved
by another invocation's synchronous stretch on the same
isolate thread. Claims of this kind are **SOURCE-PROVEN** from
the code shape.

**(b) Platform storage-effect ordering — when initiated
storage operations TAKE EFFECT relative to each other across
invocations.** `setAlarm`, `deleteAlarm`, and `getAlarm` are
platform storage operations. The order in which their EFFECTS
become visible across concurrent invocations — e.g., whether
a `setAlarm` initiated before a `deleteAlarm` can nevertheless
take effect after it, or whether either is guaranteed to be
the "final" physical state — is **platform behavior**. The
reviewed Cloudflare documentation specifies the semantics of
each operation individually (a registration persists until
replaced or deleted; a subsequent `getAlarm()` after a
completed `deleteAlarm` reads null — D-4) but does **not**
specify cross-invocation effect ordering for racing
operations. Claims of this kind are therefore **ASSUMED**
(the A-3 family) and **UNRESOLVED**, unless a specific
documented fact covers them.

The v3 text repeatedly slid from (a) to (b): proving that a
`deleteAlarm` is INITIATED after a `setAlarm` and then
speaking as if the final physical registration state were
thereby guaranteed. That inference is not supported, and v4
withdraws it wherever it appeared.

## 2. What the stop act actually rests on (no ordering needed)

The stop act (`stop_chain`, and `verify_chain_stop`'s retry)
needs NO cross-invocation ordering assumption at all, because
its verification is a READ-BACK, not an ordering argument:

1. The act observes the registration (`getAlarm()`), deletes
   only if one is observed, then reads back.
2. The read-back — `getAlarm()` returning null AFTER this
   invocation's own `deleteAlarm` completed — is the ground
   truth for the claim "no registration existed at the moment
   of the read-back," resting on D-4 (documented per-operation
   semantics within one invocation's completed sequence), not
   on any race outcome.
3. What the read-back does NOT prove is the future: a racing
   wake whose `setAlarm` effect lands after the read-back
   would leave a registration the record does not yet know
   about. V3's text let "verified" sound like a standing
   physical guarantee. V4's design answers this in the truth
   model, not in ordering claims: the displayed confidence is
   re-derived at every read (design v4 §2), so the first
   surface read that observes the surviving registration
   displays `contested`. The divergence window is bounded by
   "until the next read," and the claim displayed in the
   window is `verified_recorded`/`verified_current` — a claim
   about the verification event and the current observation,
   which is exactly what the evidence supports (design v4
   §2.3, rows 3–6).

## 3. Claims withdrawn by name

Each item: the v3 formulation, where it stood, and its v4
replacement. (Grep verification, §7: none of the withdrawn
formulations appears in the v4 candidate or composed trees.)

1. **"The re-check makes the last physical act win in every
   interleaving (analysis doc §3)."** — v3 candidate
   `coordinator.mjs` header comment (the V3 ADDENDUM block);
   the composed candidate carried the equivalent claim in its
   header. **Withdrawn.** V4 replacement (now in the v4
   coordinator header): the re-check "prevents the wake from
   INITIATING a registration over a stop committed before its
   re-check read. It does not by itself prove the final
   physical registration state: cross-invocation storage-
   effect ordering is platform behavior (analysis v4 §1(b),
   ASSUMED/UNRESOLVED)."
2. **"a stop committed after the `setAlarm` initiation deletes
   after it — last physical act wins, as in §4.1"** — v3
   analysis §4.2 (the fix paragraph). **Withdrawn.** The
   supported statement is §5.2 below: the stop's delete is
   initiated later; its EFFECT relative to the wake's
   registration is platform behavior; if the registration
   survives, the stop's own read-back shows it (stop records
   unverified) or the next surface read degrades confidence
   to `contested`.
3. **"A stop committed after the `setAlarm` initiation → its
   `deleteAlarm()` is the later physical act and removes what
   the finally registered. Either ordering ends stopped."** —
   v3 analysis §4.1 (finally re-arm trace). **Withdrawn** in
   its second half. The first half (a stop committed BEFORE
   the finally's synchronous gate-read stretch suppresses the
   re-arm) is JS-level and stands (§5.1). "Either ordering
   ends stopped" is replaced by: the end state is whatever
   the next read-back observes, and the record/confidence
   machinery reports it truthfully; no invariant is claimed.
4. **"the LAST PHYSICAL ACT wins; with the §7 re-check, a
   wake resuming after the verify's delete reads the
   post-verify state at its re-check and cannot re-register
   over it"** — v3 design §3 (race posture bullet). The first
   clause is **withdrawn** (same formulation as item 2). The
   second clause stands in narrowed form: at its re-check the
   wake READS the then-current gate state (a JS-level claim
   about which state value the re-check observes, assuming the
   transition's storage commit is visible to a later read —
   D-4-family documented semantics for completed operations)
   and does not initiate if suppressed. Whether the verify's
   DELETE effect vs the wake's hypothetical earlier-initiated
   registration resolve in a particular physical order is not
   claimed.
5. **"a stop committed later lands its deleteAlarm after this
   registration and removes it"** — v3 candidate `_armAlarm`
   code comment (both trees). **Withdrawn**; the v4 comment
   states only that JS ordering cannot order the stop's
   effects, and that any divergence is surfaced by the
   confidence derivation at the next read.
6. **"a deleteAlarm after it — the last physical act wins"** —
   v3 candidate `_armAlarmIfEarlier` re-check code comment.
   **Withdrawn**; replaced by the narrowed comment in item 1's
   terms. (The v3 COMPOSED tree's re-check comment did not
   carry this formulation — it spoke only of what the re-check
   read sees — so no withdrawal was needed there; the v4
   composed comment stands as the memo-variant text plus the
   design-v4 §2 cross-reference. This is also the single
   comment-line difference between the two v4 coordinators'
   containment regions, disclosed in the identities record.)

## 4. Classification of every ordering claim the design relies on

| # | Claim | Class |
|---|-------|-------|
| O-1 | Within `_armAlarmIfEarlier`, the gate re-read and any `setAlarm` initiation are one synchronous stretch: no transition commit can intervene BETWEEN that read and that initiation | SOURCE-PROVEN (code shape; JS semantics) |
| O-2 | Within `_armAlarm` (the finally re-arm), the gate read and the `setAlarm` initiation are likewise one synchronous stretch | SOURCE-PROVEN (code shape) |
| O-3 | Within `wake()` and the transition actions, the synchronous segments run in program order | SOURCE-PROVEN (JS semantics) |
| O-4 | Within one invocation's completed sequence, `deleteAlarm()` followed by `getAlarm()` reads null (the verification read-back) | PLATFORM-DOCUMENTED (D-4: per-operation semantics) |
| O-5 | A completed storage commit (a transition's `_tx`) is visible to a LATER invocation's read of the same state | PLATFORM-DOCUMENTED (DO storage semantics for completed operations; the same basis every shipped read path already relies on) |
| O-6 | Cross-invocation EFFECT ordering of racing `setAlarm`/`deleteAlarm` initiations (which physical effect lands last) | **ASSUMED — UNRESOLVED** (A-3 family). The design does NOT rely on it: §2 + §5 |
| O-7 | Cross-invocation serialization of whole invocations inside one DO (A-3 proper) | **ASSUMED — UNRESOLVED** (unchanged from v3). Properties leaning on it are the same ones v3 named: neat audit ordering under concurrent transitions; a transition and a pass never inside their synchronous stretches simultaneously across isolates. The transition table + verified-read preconditions keep a lost race REJECTED rather than corrupt even without A-3 |
| O-8 | An in-flight `getAlarm()` racing a `deleteAlarm` returns either the pre- or post-delete value (v3 §4.2 step 3 branches) | ASSUMED as an exhaustive dichotomy — the re-check fix is branch-independent, and v4 additionally notes a third theoretical outcome (the read faults) which the derivation treats as `unknown` — darker, never stronger |

## 5. The two races, re-stated under the narrowed claims

### 5.1 Finally re-arm vs a racing stop

Gate read + `setAlarm` initiation in `_armAlarm` are one
synchronous stretch (O-2). A stop committed BEFORE that
stretch is seen by the gate read and the re-arm is suppressed
— JS-level, proven. A stop committed AFTER the initiation is
a separate invocation whose delete races the registration's
effect: O-6, unresolved. The narrowed conclusion: the finally
re-arm **cannot resurrect over a stop it could have seen**;
for a stop it could not have seen, no end-state invariant is
claimed — the stop act's own read-back and the confidence
derivation report the outcome truthfully. Battery: CT3, CT13e
(harness interleavings; platform executability of the
interleaving itself is §6 item 1, unchanged).

### 5.2 Wake (`_armAlarmIfEarlier`) vs a racing stop

The v2 defect and the v3 fix stand as v3 §4.2 described them,
with the conclusion narrowed: the re-check (O-1) ensures a
wake resuming after its `getAlarm()` await does not INITIATE
a registration when the re-read gate says suppressed. If the
wake initiated BEFORE the stop committed (gate read NORMAL in
the same stretch), its registration and the stop's delete
race at the platform level (O-6). Two sub-outcomes, both
handled without an ordering claim: the stop's own read-back
observes the surviving registration → the stop records
UNVERIFIED (the record never overclaims); or the registration
effects after the read-back → the next surface read displays
`contested` (design v4 §2.3 row 4). Battery: CT13a/CT13b (the
defect demonstration on the v2 tree stands: 0/2 at the
resurrection assertion), CT13c, CT14b (the `contested`
degradation is now itself under test).

### 5.3 Verify's delete vs a parked wake

As §5.2: the wake's re-check reads the gate state current at
its re-check (O-5) and suppresses; the verify's delete rests
on its read-back (O-4). No "last act" claim is made about the
physical resolution. Battery: CT13c.

## 6. Platform uncertainties (for Rowan; carried + one new)

1.–5. as v3 §6 (invocation suspension executability; in-flight
read branch; mid-sequence death modeling; delivery/retry
behavior; real-DO SQLite beyond mirrored `.one()`).
6. **NEW — cross-invocation storage-effect ordering (O-6)**:
whether an earlier-initiated `setAlarm` can take effect after
a later-initiated `deleteAlarm` completes. No documentation
was found that specifies this; the v4 design is built to not
need it (§2), and the divergence it could cause is detected,
not prevented (design v4 §2, register R-02). What would
resolve it: a Cloudflare documentation statement on alarm
storage operation ordering, or a platform statement from a
support case; neither exists today.

## 7. Grep verification (R2's acceptance test)

The final text rule: no sentence in the v4 design, this
analysis, the gates v4, or the v4 candidate/composed code
claims a guaranteed final physical state from initiation
order alone. Verified at package time by grepping the four
documents and both v4 trees for the withdrawn formulations
("last physical act", "makes the last", "wins in every
interleaving", "Either ordering ends stopped"): zero hits
outside this section's own withdrawal list and the risk
register's description of the residual. New tests: none —
platform storage-effect ordering is NOT harness-expressible;
per the ruling it is marked here and in the register, not
tested. (CT14b's `contested` degradation IS tested, because
the derivation is code.)
