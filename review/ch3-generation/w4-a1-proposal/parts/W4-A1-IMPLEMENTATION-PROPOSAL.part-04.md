- *Containment transitions:* a stop commits either before the stretch (seen by the re-read — the act is suppressed) or after initiation (the stop's `deleteAlarm` follows in JS order; the platform storage-effect ordering between them is **assumption family A-3**, unresolved since the containment design — and the mechanisms that surface a violation are unchanged: the stop's read-back verification and the stop-confidence derivation, which contest a surviving registration rather than hiding it).

**Named residual (not smoothed):** the reported registration cannot be re-read synchronously, so an evaluation's stale determination rests on the value returned by the `await` immediately preceding its stretch. A registration initiated by another path *during that await* is invisible to the evaluation. Its consequence is bounded: the evaluation can then initiate a registration for the current minimum due (§above) — an act that is recorded, strike-counted, and at worst redundant; it cannot register a later-than-current-minimum due, cannot act under a committed stop, and cannot dispatch (held state). T-17/T-18 exercise the modeled forms of these races; the platform's storage-effect ordering (A-3) remains an assumption, as it has been throughout the containment program.

### 5.3 Read purity (IC-7)

No read surface changes: the diagnostics GET, the containment GET, the weekly peek, and every other GET perform **zero** of §5.1's writes (T-13/T-28). Linkage of delivery/continuation evidence to an evaluation happens in the observer's own records, outside production storage.

## 6. Expanded offline acceptance matrix — with phase obligations

Base matrix T-00–T-15 (amended design §8), Rowan's additions T-16–T-29 (ruling §10), and this proposal's two completions: **T-30** (the exact-threshold boundary) and **T-31** (predicate precedence under overlap). **Phase key:** **A-1** = executed against the A-1 implementation candidate before its deploy gate; **A-3** = specified now, executed in the A-3 implementation phase (the deferral Rowan permits, identified explicitly here); no deferred test may be reported as passed, and the A-1 battery's report must list A-3-deferred rows as DEFERRED, never omitted. Standing regression suites (containment 42, P2 32, R5A 23, V-3 5, S1 9, B-G2 110 — at their current counts or reviewed successors) must remain green on the A-1 tree. Harness: the house harness (real node:sqlite, production `.one()` semantics). **Stated limit, unchanged:** offline tests establish implementation behavior under modeled conditions, never actual platform delivery.

| ID | Case (abbreviated; amended-design §8 and ruling §10 carry the full text) | Phase |
|---|---|---|
| T-00 | Implementation tree re-verified against the cited ranges/hashes; manifest diff shows exactly the §1 change surface | A-1 |
| T-01 | P-STALE → exactly one registration; intent precedes act; read-back recorded; stages 1–2 distinct | A-1 |
| T-02 | Healthy chain → decline `not_stale`, zero registrations | A-1 |
| T-03/T-04 | P-ABSENT — **superseded in part by IC-1/T-16:** in the A-1 release P-ABSENT never registers under any corroboration; T-03's registration expectation is WITHDRAWN and replaced by T-16; T-04's decline expectation stands and is subsumed by T-16 | A-1 |
| T-05 | Containment stop commits during the evaluation's await → act suppressed (CT13 pattern, both source tags) | A-1 |
| T-06 | Containment matrix: NORMAL acts; DRIVE_CONTAINED watchdog-only (`contained_drive`); CHAIN_STOPPED declines | A-1 |
| T-07 | **Replaced by T-17/T-18** (ruling: the one-effective-value expectation is insufficient); T-07 is retained only as the weaker observation that both acts are recorded | A-1 |
| T-08 | Crash between registration and completion → unresolved intent visible, counted, never auto-retried | A-1 |
| T-09 | Strike bound: three registering evaluations without an intervening pass → fourth declines `repair_ineffective`; a qualifying pass restores eligibility by derivation | A-1 |
| T-10 | P-FUTURE and P-SILENT → diagnostic records with full predicate values, zero acts | A-1 |
| T-11 | Write-set verification (static scan + behavioral): §5.1's inventory is complete; the entrypoint reaches exactly one method | A-1 |
| T-12 | Scheduler health-state machine — specified for A-3's storage; the state definitions are frozen by this proposal | A-3 (deferred, identified) |
| T-13 | Read purity across all GET surfaces against a stale chain → zero writes | A-1 |
| T-14 | No-dispatch invariant: evaluation against an unhalted fixture submits nothing itself — **scoped note (IC-6):** the A-1 release refuses to act unhalted at all (T-24), so T-14 executes as a design-level assertion on the method's references (part of T-11) until an unhalted authority model exists | A-1 (as scoped) |
| T-15 | Mid-evaluation earlier-row insertion → registered due never later than the stretch's fresh minimum | A-1 |
| T-16 | **(IC-1)** Handler in flight before its recorder write; two null reads; prior complete row unchanged → the evaluation records P-ABSENT as diagnostic-only and registers **nothing** | A-1 |
| T-17 | **(IC-3)** Competing evaluation and ordinary wake select different dues → a valid earlier registration is preserved; both acts recorded with their dues | A-1 |
| T-18 | **(IC-2/IC-3)** Concurrent evaluations cannot bypass the strike bound as recorded: combined registrations increment the counter by the number of acts | A-1 |
| T-19 | Strike state survives a coordinator restart (fresh instance over the same storage); a failed or declined operator invocation does not reset it; an invocation carrying a post-bound authorization does not reset it either | A-1 |
| T-20 | Registration succeeds, completion write fails → unresolved intent remains visible and strike-counted | A-1 |
| T-21 | Scheduler intent storage unavailable → no repair invocation occurs (fail closed, IC-5) | A-3 (deferred, identified) |
| T-22 | Duplicate, delayed, overlapping, and missing scheduler runs remain distinguishable in the health record | A-3 (deferred, identified) |
| T-23 | **(IC-4)** The entrypoint cannot be invoked via the public fetch router or any general-authority path; with the flag binding absent it returns `disabled` and performs zero coordinator interaction; it accepts no arguments | A-1 |
| T-24 | **(IC-6)** Halt lifted, queue state altered in fixture, containment transitioned, or authorization reference missing, in each case **before** the registration stretch → the act is suppressed with `held_state_required` (or the containment outcome); the same change landing **inside** the stretch's re-reads is likewise caught | A-1 |
| T-25 | Expired/ambiguous generation authority → in the A-1 release this is the held-state refusal itself (T-24's halt case): no configuration exists in this release in which an evaluation can indirectly restore dispatch, because the release never acts unhalted | A-1 |
| T-26 | Post-registration read-back returns null → the record carries `readback_null`, `setAlarm` completion stated separately, no success/failure of delivery asserted | A-1 |
| T-27 | Late original-alarm delivery after a repair → no duplicated plan advancement, reservation, or provider submission (row-state processing absorbs it) | A-1 |
| T-28 | Q-5-style observation and diagnostic linkage → zero production writes (extends T-13 to the observer pattern) | A-1 |
| T-29 | L-1 witness fixtures (cadence violations, retry-only sequences, external interference, incomplete terminal verification) → the witness predicates reject all four — executed when L-1's execution package is prepared (L-1 phase), specified here because the predicates are shared | L-1 (deferred, identified) |
| T-30 | **Boundary:** `armed === now − ALARM_STALE_THRESHOLD_MS` exactly → P-STALE (the deployed `<=` semantics, coordinator.mjs:3265); one millisecond later → not stale | A-1 |
| T-31 | **Precedence:** inputs satisfying several classes at once (e.g., CHAIN_STOPPED + P-STALE; strike-bound + P-ABSENT; P-FUTURE + P-SILENT) → the §2.3 order decides, and the record names the deciding step | A-1 |

## 7. Rollback and degradation design

