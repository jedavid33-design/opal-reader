# ROWAN-CP — W-4 DIAGNOSTIC ROUND (recorder chain silences)

**Copy-paste for Rowan (ChatGPT) — Julie relays; Wren records the reply on the board.**
**Handoff:** `<W4-HANDOFF>` · **Pin:** `<W4-PIN>` (repo `jedavid33-design/opal-reader`, branch `ui1-review`) · Package: `W4-DIAGNOSTIC-ROUND.md` (this CP is its companion; the full dossier with source citations is in the package file in this folder).
**Standing context:** production HELD (GENERATION_HALT "1", queue paused; live build `ef69b8f9…`). Turn-on 2 closed 2026-11-12: Julie's GO was consumed by expiry because P-12's required independent recorder resumption never occurred. Julie has directed this diagnostic round; she is in no hurry. **This round is documentary only — no production act of any kind is proposed or authorized.**

## What W-4 is, in one paragraph

The coordinator's drive chain is a self-perpetuating platform alarm: each delivered pass processes due schedule rows and, in its `finally`, unconditionally re-arms the next alarm (min pending `due_at`, else now + 10 min watchdog). The P2 recorder writes one row per pass (stage, outcomes, `armedAfter` = post-pass `getAlarm()`), rethrowing errors so thrown passes and their retries are recorded too. Three times now, a due alarm has simply never been delivered: the last pass records normally, its `armedAfter` sets a due time ~10 minutes out, and then — nothing, indefinitely. `getAlarm()` keeps reporting that same past-due value for days; `recordingFailures` stays 0; no error row ever appears. Each of the first two silences ended only when an authorized wake-path command (a `RequestPause` stimulus/probe) ran `wake()` → `_armAlarmIfEarlier()`, whose deployed R5a past-due disjunct (`armed <= now − 1h`) re-registered and the chain revived within seconds. The third silence never ended; it consumed the turn-on 2 GO.

## The three instances (dossier §2 gives full citations and brackets)

- **S-0 (pre-recorder):** registration set 2026-11-01T19:49:36Z never delivered; the recorder build's deploy (2026-11-02T15:32:31Z) neither dropped, retimestamped, nor revived it; ~52 h standing until Grant 2's stimulus (2026-11-03T23:26:13Z) revived the chain (pass 1 within seconds). **Whether a fault brackets the registration time is a named gap (G-1)** — fault #1 is of that era but its bracket against this timestamp has not been extracted.
- **S-1 (W-4 as classified):** last pass 296 at 2026-11-04T20:56:59Z, due 21:06:29Z, never delivered; fault #2 was observed in the era (~23:20Z) but its onset is **unbracketed** against the due time (one unobserved interval) — consistent with, not proven as, fault-coincident. Stood 26 h+ past due at window close; revived by the resume gate's wake probe (row 297, 2026-11-06T03:43:37Z, 1.38 s after dispatch).
- **S-2 (turn-on):** pass 451 at 2026-11-07T04:03:48Z sits **inside** fault #3's onset bracket (last good reads 04:00:59Z; 1101 verified 04:08Z); the due time 04:13:48Z falls inside the **sustained** fault (cleared ~2026-11-08T00:46Z). Sixty-seven hourly reads (Nov 9–12) then showed the registration frozen, `pendingSchedule` 1 / `pendingWatchdog` 1 (D = A geometry), failures 0 — including ~3.5 fault-free days. No wake-path traffic occurred in the entire silence (reads only, plus the two control-plane close acts), so R5a's disjunct — satisfiable since 2026-11-07T05:13:48Z — never had an occasion to run. GO expired 2026-11-12T11:08Z. The registration stands past due at last observation; nothing watches it now.

**Narrowing, with its caveat:** because thrown passes (and retries) are recorded, zero post-cessation rows + zero recording failures narrow the space to *never invoked* or *invocation failed before user code* — subject to the preserved dual-channel caveat (a pass whose SQL row **and** KV health write both fail leaves no trace; assessment §5/§10 item 10). Containment is excluded on this record (NORMAL throughout; a stop would have deleted the registration). The platform documentation boundary is unchanged: post-retry-exhaustion `getAlarm()` semantics, catch-up delivery, and any revival mechanism are UNSPECIFIED; Workers Logs telemetry is unreadable on our credential.

## Hypothesis register (dossier §4)

- **H-1 — the fault ate the delivery** (invocation/retries failed platform-side during a 1101; nothing re-registers afterwards). Leading for S-2; unproven generally.
- **H-2 — clear-weather delivery loss / read-registration divergence** (the B1 delivery-side family). Preserved; primary if any silence is shown to begin in clear weather.
- **H-3 — invocation failed pre-handler.** Observationally identical to H-1 on our surfaces; recorded as an observability limit.
- **H-4 — the recovery shape is the defect (cause-independent).** The only unconditional re-arm lives inside the alarm handler; R5a's cure is wake-gated; reads are deliberately inert. A single lost delivery is therefore permanently fatal until an unrelated command happens by — proven at source strength and observed three times. Proposed as the primary frame: it is the only hypothesis a design change can address.

## What we are asking Rowan to rule on

- **Q-1.** Does the dossier hold at documentary strength (instances, brackets, common shape)? Re-classifications or strikes?
- **Q-2.** The hypothesis register: additions, strikes, re-rankings — and is H-4 accepted as the primary frame?
- **Q-3.** Gaps to close before any design round: G-1 (fault #1's bracket vs S-0 — documentary, records on disk); G-2 is already closed (resume record, cited); G-3 (a read-only look at the **staging** coordinator's chain history as a platform-vs-instance discriminator — in scope for a later round?). Any others?
- **Q-4.** Design directions for the NEXT round, to be developed only as she directs: (a) a read-path liveness registration (bends "reads never write" — location is itself a design question); (b) a P-12 successor predicate in the resume gate's GR-2C shape (the gate's own counted wake + observed recorder-row checkpoint, replacing passive observation); (c) observability only (standing recorder read); (d) a platform-semantics escalation (support/community), within Julie's WAIT law and the free-tier constraint.
- **Q-5.** Interim: a **weekly read-only recorder check** (log-only; report only on spontaneous revival or a changed registration) while the design conversation proceeds — yes/no?

Holds restated: no stimulus, command, deploy, containment act, settings/queue change, gate, or spend in this round. Any future stimulus is its own proposal under its own Julie GO. WS2/Batch untouched, separately gated.

**Please end your reply by naming whose turn it is.**
