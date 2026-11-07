es cannot be satisfied inside the morning schedule, the run stands down pre-lift — it does not compress the clearance | §3, §4.2, §4.3 (FC group), §4.13 (i) |
| **A4** Pre-lift reuse separated from post-lift expiry; every act counted | Two branches counted separately: pre-lift stand-down = **zero counted acts** with the GO's fate decided by Julie's adoption choice (§5 clause); post-lift endings (expiry, PRE-SMOKE STOP) = lifts 2 + closes 2, **GO consumed**; total gate act budget stated | §4.13, §5, §6 |
| **A5** Auditable clearance evidence; 12 **elapsed** hours; disqualifying gap resets qualification | The lookback is **elapsed wall-clock time** evidenced by named artifacts: the `fp-ch2-generation-monitor` run-log excerpt, hash-preserved in the gate's evidence set, plus the gate's own census and confirmation sets; a disqualifying gap is defined (any 1101-observed read, or an evidence gap > 40 minutes, inside the window) and resets the 12-hour clock; **this package claims no clearance today** | §4.2, §4.3 (FC-1) |
| **A6** Clean inherited terminal snapshot + fresh smoke baseline; inherited accounting separated | At the inherited plan's clean terminal read, a named **snapshot** (plan totals/state, bindings watermark, phase accounting, quota day counters) is filed in the evidence set; the smoke's baselines are struck **from that snapshot**; the execution record keeps inherited dispatches/bindings/settlement in a **separate ledger section** (Appendix A) — never co-mingled | §4.8, §4.11 (COMPLETE evidence), Appendix A |
| **OQ-1** Bounded WAIT + progress-earned extension | Adopted with A1's formulas | §4.10 |
| **OQ-2** P-1 with explicit pre-smoke stop and re-hold | Adopted: the PRE-SMOKE STOP is a named gate outcome with its procedure | §4.8, §4.11, §4.13 (ii) |
| **OQ-3** Same-morning census **and** confirmation before lifts | Adopted as corrected: prior-evening reads are rehearsal only and satisfy nothing | §3, §4.3 (FC-3) |
| **OQ-4** No pre-authorized wake stimulus | Adopted: no wake act, command, or stimulus of any kind is authorized anywhere in this package | §4.8, §5, §6 |
| **OQ-5** Do not repeat the unchanged-build admission probe | Adopted: no probe act; build-identity predicates (P-1) carry the burden | §1, §4.6, §6 |
| **OQ-6** 72-hour reuse **amended**: only for a qualifying pre-lift stand-down, only if Julie explicitly adopts; post-lift expiry consumes | Adopted as amended: the GO passage presents adoption as an **explicit clause Julie accepts or strikes** when she gives the GO; a post-lift no-submission expiry consumes the GO regardless of the adoption choice | §4.13, §5 |
| **OQ-7** Minimum 12 **elapsed** fault-free hours + two complete clearance sets ≥ 30 minutes apart | Adopted with the precision: elapsed time, evidenced per A5 — not a reading count | §4.2, §4.3 (FC-1, FC-3) |
| **OQ-8** w = 8, R = 12 advisory planning only; observed dispatch accounting controls | Adopted: the fit test is reported at census as information; no predicate passes or fails on w or R; every execution decision uses observed counts | §4.3 (P-13), §4.8, §4.9 |

**Also carried from the proposal, as ruled:** A-variant morning scheduling (§3); Option D (guard-parameter change) deferred — no code changes anywhere in this gate; the §6.5 conforming clarification executed in gate 1 (a verified fault suspends on verification + the exception window, not at a bound) is stated as standing law at §4.11.

## §3 The schedule — one gate morning; targets subordinate to predicates (A3)

**Gate-1's lesson first, because it schedules this section.** In the first attempt the census ran at 08:23–08:28 ET on a PT day already ~6½ hours old, the smoke submitted at 01:35:32Z, and the plan's release (the 07:00Z reset) fell **after** its 05:35:32Z decision bound. This gate runs on a **young PT day at a humane hour** (A-variant, as passed), so that a quota park's release reset falls inside the outer bound §4.10 defines.

**No calendar date is named in this package, and none can be.** A gate morning exists only when the FC-1 lookback predicate (§4.3) can pass — i.e., when the logged evidence shows the fault cleared and 12 elapsed fault-free hours accumulated. As of this package's drafting (Nov 7, 2026), the monitor log available to it shows the 1101 signature **continuously since 23:06 ET Nov 6 through its 09:06 ET Nov 7 run**; clearance is an execution-time census outcome only, and **no clearance is claimed today**. The GO passage (§5) carries the scheduling rule: the gate runs on the first morning on which the clearance predicates can be met, as determined by the evidence and reported to Julie the evening before where the evidence allows.

**The morning's targets** (all subordinate: **if the predicates cannot be satisfied inside this schedule, the run stands down pre-lift under §4.13 branch (i) — it does not compress the clearance, shorten the confirmation separation, or lift early**):

| Step | Target (Z) | Target (ET) | Rule |
|---|---|---|---|
| PT-day reset | 07:00Z | 2:00 a.m. ET | The day the gate runs on is young by construction |
| FC-1 evidence assembly | ~11:15Z | ~6:15 a.m. ET | Read-only; the lookback excerpt is assembled and hash-preserved **before** the census (§4.2) |
| Census set (incl. FC-2 clearance set) | ~11:30–12:00Z | ~6:30–7:00 a.m. ET | Every P-item and FC-item read fresh (§4.3) |
| Confirmation set (FC-3) | ≥ 30 min after the census set completes; target ~12:05–12:30Z | ~7:05–7:30 a.m. ET | **Same morning** (OQ-3); must complete **before the first lift** (A3) |
| The two lifts | ~12:30–13:00Z | ~7:30–8:00 a.m. ET | Only on a fully passed census (§4.6) |
| P-1 observation window | [L2, L2 + 60 min]; target ~13:00–14:00Z | ~8:00–9:00 a.m. ET | L2 = the second lift's verification timestamp (§4.8) |
| A6 snapshot + report to Julie | at the P-1 clean terminal read | — | Julie submits nothing before this report (§4.8) |
| Julie's submission window | opens at the clean-terminal report; **closes 15:00Z** (10:00 a.m. ET) — extended to *report + 60 min* if the clean report lands after 14:00Z | — | Deterministic close; expiry = §4.13 branch (ii) |
| T0 | Julie's submission (the plan's `createdAt`) | — | Every §4.10 deadline is a formula over T0 |
| Inner bound | T0 + 4h (target ~18:00–19:00Z) | ~1:00–2:00 p.m. ET | §4.10 |
| Outer bound | (first PT reset strictly after T0) + 4h (target next-day 11:00Z) | next-day 6:00 a.m. ET | §4.10 |
| Extension deadline (if earned) | outer bound + 4h (target next-day 15:00Z) | next-day 10:00 a.m. ET | §4.10 |
| Absolute cap | T0 + 52h | — | §4.10; the classification lands regardless |

A schedule property worth stating, because the deadline law relies on it: under this schedule the first PT reset strictly after T0 is always the **next** morning's 07:00Z (the gate morning's own reset precedes T0), and a quota park taken on gate day therefore **necessarily persists past the inner bound** — which is exactly the configuration WAIT exists for.

## §4 The gate

### §4.1 Act 0 — the authorization of record

The GO of record is Julie's adoption of §5 at this package's filing pin, recorded on the board (issue #15) **before** the census runs. It names: this package's pin; the chapter she selects for the smoke; and her **adopt/strike decision on the OQ-6 reuse clause** (§5 renders it as a clause she accepts or strikes; the board record preserves which). A GO recorded without the adoption decision is incomplete and the census does not run. Wren's chat report that the GO was given is not the record; the board comment is.

### §4.2 Pre-census clearance-evidence assembly (A5) — read-only, not counted

Before the census set is read, the executor assembles the FC-1 evidence artifact:

1. **The monitor-log excerpt.** From `~/workspace/goals/opal-roundtable/hidden_files/fp-ch2-monitor-log.md` (the `fp-ch2-generation-monitor`'s run log; 20-minute cadence), the contiguous run entries covering the 12 elapsed hours immediately preceding the census start, copied verbatim into the gate's evidence set and preserved with its SHA-256. If the monitor job has been retired or its log cannot cover the full window, the fallback is a **Wren-run clearance cadence log** on the same 20-minute cadence over the same elapsed window, preserved the same way. **There is no third source and no waiver**: if neither artifact evidences the full 12 hours, FC-1 fails and the run stands down (§4.13 (i)) — the lookback is accumulated first, on a later morning if necessary.
2. **The disqualifying-gap rule (A5).** Inside the lookback window, any of the following is a **disqualifying observation**, and the 12-hour clock restarts at that observation: (a) any logged run whose `/v2` reads returned the 1101 signature (HTTP 500, body `error code: 1101`) — or any non-200 on the monitor's plan/job/quota/snapshot reads; (b) an **evidence gap**: an interval betwe