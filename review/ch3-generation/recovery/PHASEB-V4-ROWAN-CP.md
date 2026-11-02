# Copy-paste for Rowan — Containment V4 package (REVISE BEFORE GATE APPROVAL answered)

Rowan — V4 package, answering your V3 ruling (REVISE BEFORE
GATE APPROVAL) correction by correction. Offline only; no
production calls; production HELD; no gate approved, no GO
requested or implied. Documents pinned in `opal-reader`,
branch `ui1-review` (pin in the board summary): design v4
`PHASEB-CONTAINMENT-DESIGN-V4.md` (18,365 B), async analysis
v4 `PHASEB-CONTAINMENT-ASYNC-ANALYSIS-V4.md` (13,684 B),
gates v4 `PHASEB-RECOVERY-GATES-V4.md` (38,359 B), risk
register `PHASEB-UNRESOLVED-RISK-REGISTER.md` (8,342 B),
identities `containment-v4/CANDIDATE-IDENTITIES.md`.

**R1 — stop-record truth.** The record now separates (i)
the ENUM (never downgrades — your accepted v3 claim), (ii)
the LAST SUCCESSFUL VERIFICATION (immutable: `stopVerifiedAt`
etc. are never erased by a later failure), and (iii) CURRENT
PHYSICAL CONFIDENCE — a DERIVED, displayed value that
degrades freely. Derivation is read-side: a pure exported
`deriveStopConfidence(read, fresh)`; `fresh` is the calling
surface's own `getAlarm()` observation in the same request
(value / failed / unavailable). Chosen over a stored field
because the degrading evidence is observed by reads, reads
must never write, and a stored field can go stale in
exactly the silent way you prohibited. The full truth table
(14 rows: enum × stored record × later evidence → displayed
string, each cell justified in one line) is design v4 §2.3
and is the proof artifact; the construction argument: an
unreadable record returns `unknown` first; a fresh non-null
registration returns `contested` BEFORE any verified check
(present physical evidence dominates); `verified_*` is
reachable only through a recorded successful verification,
and `verified_current` additionally requires a fresh null
in the same derivation; failed-after-success is checked
before the plain-unverified return, so it displays
`unknown`, never a forgiven verified. Vocabulary:
`not_applicable / verified_current / verified_recorded /
contested / unverified / unknown`. Both surfaces compute it
(state route + drive=1); the v3 collapse of a FAILED
registration read to "absent" is removed on both — a failed
read now degrades confidence to `unknown` instead of
risking a false `verified_current`. One ruling item: row
11 (failed-after-success + fresh null → `unknown`,
deliberately darker than row 3) — design §9.1.

**R2 — async ordering narrowed.** Analysis v4 separates
(a) JS-level initiation order within an invocation
(SOURCE-PROVEN) from (b) platform storage-effect ordering
across invocations (ASSUMED, A-3 family, UNRESOLVED — no
documentation found). Claims WITHDRAWN BY NAME (analysis
v4 §3, six items, incl.): "the re-check makes the last
physical act win in every interleaving" (v3 candidate
header); "a stop committed after the setAlarm initiation
deletes after it — last physical act wins" (v3 analysis
§4.2); "either ordering ends stopped" (v3 analysis §4.1,
second half); "the LAST PHYSICAL ACT wins" (v3 design §3);
and the two matching code comments. The stop act needs no
ordering assumption: its read-back IS the ground truth for
the moment of the read (D-4). Every other place that leaned
on effect-ordering was re-examined: the wake-vs-stop and
verify-vs-wake races now conclude only that the re-check
prevents INITIATION over a stop the wake could have seen;
any residual divergence is DETECTED at the next read
(`contested`), not claimed prevented. Classification table
O-1…O-8 in analysis v4 §4; O-6 (effect ordering) and O-7
(A-3) stay ASSUMED/UNRESOLVED. Grep-verified: no withdrawn
formulation survives in the v4 documents or either v4 tree
(outside the withdrawal list itself).

**R3 — retry-exhaustion law.** Episode = one stop, keyed
by its `stop_chain` audit-event row id. Exhaustion is
durable at the moment the bound is reached (state flag +
`stop_episode_exhausted` audit event, same transaction as
the attempt's record). A clear CLOSES the episode
atomically inside its own transaction: summary copied to
`prevEpisode*` + `stop_episode_closed` audit event BEFORE
the current fields reset — nothing is informally reset,
and the exhausted episode stays disclosed on both surfaces
indefinitely. A new stop mints a new episode ONLY via a
new `stop_chain`. Code enforces: refusal at the bound (no
physical act, no writes), refusal after the physical fault
clears, exhaustion recording, summary persistence
(CT15a–c). Paperwork carries: the anti-circumvention rule
— clear + re-stop to reset a budget is prohibited; further
verification after exhaustion requires a fresh ruling from
you + Julie's authorization under the new gates micro-scope
**R3-V**; restoration paperwork must disclose the episode
summaries (design §6). One disclosed deviation from the
tasking's phrasing: the live counter resets on clear (the
carried v3 tests assert that shape and may not be
loosened); the persistence lives in `prevEpisode*` + the
append-only audit. The disclosure property you required is
fully implemented and tested.

**R4 — C3 mutation ledger.** Gates v4 C3 carries the exact
ledger: steps C3-0…C3-7, each with durable writes counted
(state writes / audit rows / alarm ops), failure modes and
the resulting state, and ambiguous-response handling (a
lost response is resolved by re-reading state + audit; the
step's audit row is its idempotency key). Verification
retries are counted against MAX=3 inside the ledger.
Worst-case totals: state writes ≤6, audit rows ≤7,
`deleteAlarm` ≤3, `setAlarm` 0 (expected no-failure path:
4 / 4 / 1). NOTE: exact accounting RAISES v3's prose
bounds (state ≤3, audit ≤5) — v3 undercounted the stop
act, which is two transactions; the physical bounds are
unchanged. STOP/re-entry (§R): read state + both surfaces
+ audit first, mark steps DONE by their audit rows, resume
only at the first not-DONE step; a `stop_chain` whose
audit row exists is never re-sent — resumption is
`verify_chain_stop` only. C1/R5a-D budgets are reconciled
to named write classes in ledger-lite tables. The C3
dry-run is harness-tested (CT16a–c: sequence, delete
failure + ambiguous re-entry, ambiguous delete resolved by
read-back; landed-delete counts asserted).

**R5 — S1 contingency.** Chosen: **(a)**, with the
**standing conditional pre-authorization** shape
recommended over at-trigger-time. S1's text now states
plainly that `contain_drive` does not stop a chain; S1
keeps it as Layer 1 (bound accumulation + report) inside
S1's GO, and the chain-stop response is the new companion
scope **S1-X** with its own GO wording — S1's GO
explicitly does NOT include `stop_chain` in any form.
Triggers T1–T4 are enumerated and mechanically checkable
against S1's existing reads (out-of-§7.3-set grant
activity; any dispatch under halt; phase/quota movement
beyond the set; second/outside-set movement). Reasoning,
honestly: at-trigger-time authorization can leave a
revived chain running for hours while Julie is
unreachable — bounded in consequence ($0 under the holds,
Layer-1 containment) but unbounded in duration, and
correction 6 requires the continuing effect to be
ADDRESSed by the plan. The standing shape's risk (a stop
on a trigger later judged benign) is bounded by
single-use scope, the C3-verified procedure, an end state
(CHAIN_STOPPED) that is itself gated on return, and
immediate reporting. If S1-X's stop exhausts unverified,
the R3 law applies (R3-V is the only path onward) — that
interaction is written into S1-X. Both GO wordings are in
gates v4 for your ruling and Julie's choice.

**R6 — evidence/census.** All census values in gates v4
carry their observation date (Nov 2, 2026) and are framed
as hard preflight expectations to be re-read at execution
— including armedAt 1793562576104 (2026-11-01T19:49:36.104Z),
pendingSchedule 2 / pendingWatchdog 1, and the recorder
baseline (table missing, `recorderHealth: null`). V3
evidence is preserved untouched; v4 work is new trees
(`containment-v4/`).

**Battery (exact v4 trees, complete runs, exit codes
captured):** containment battery v4 — 41/41 on candidate
AND composed, exit 0 (32 carried v3 tests + CT14×3, CT15×3,
CT16×3); P2 regression 32/32 on both trees, exit 0; R5a
suite 23/23 on composed, exit 0. NO v3 assertion deleted
or loosened; adaptations are header/env/CT0-marker/CT1-
projection extensions, all disclosed in the identities
record, including three corrections made to the NEW v4
tests during development (first run 38/41 — the failures
were my new-test expectations vs the design's own truth
table and the shipped event behavior; no code change
resulted). Candidates vs live: candidate coordinator
`6c19a50e…` (+753/−0), composed coordinator `5303cb63…`
(+795/−12), entry `2bb0608b…` (+175/−3), service
`5c5183e6…` (+73/−2); 28/31 parts byte-identical; round-
trips verified (live→v4, v3→v4, parts-e0→v4, `patch -p1` +
`cmp`). The containment code is byte-identical between the
two v4 coordinators; one re-check COMMENT line differs
(the composed memo variant never carried the withdrawn
claim — analysis v4 §3 item 6).

**Risk register** (`PHASEB-UNRESOLVED-RISK-REGISTER.md`):
15 open entries, R-01…R-15 — A-3 (R-01), the NEW
storage-effect-ordering risk (R-02), retry-supersession
residual (R-03), absent traffic-independent rate bound
(R-04), provisional threshold (R-05), recorder dual-failure
blind spot (R-06), C3 live-chain remainder (R-07),
paperwork-only anti-circumvention (R-08), H1/H4 causation
unproven (R-09), B2 open with B3 CLOSED (R-10), D
unobservable pre-R5a (R-11), post-retry-exhaustion
`getAlarm()` semantics UNSPECIFIED (R-12), the lying-read
residual (R-13), truth-table row 11 (R-14), the
commit→record death window (R-15). Each: basis, bounded
by, what would resolve it, owner.

**Ruling items for you:** (1) truth-table row 11 (design
§9.1); (2) the code/paperwork split for anti-circumvention
(§9.2); (3) the S1-X authorization shape — standing
conditional (recommended) vs at-trigger-time; (4) the
register itself — anything missing or mis-bounded; (5)
the gates v4 as revised (still proposals; no GO is
requested at this step).

Your turn, Rowan.
