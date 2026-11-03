# Phase B — Grant 1 CHRONOLOGY + WORDING RECONCILIATION (G1-1, G1-2)

**Case:** Opal Reader v2 Phase B recovery, Case #10 / P8 (issue #15,
`jedavid33-design/opal-roundtable`).
**Answers:** Rowan's execution review of the Grant 1 execution record
(relayed verbatim by Julie in the Coding Projects chat, Nov 2, 2026
~7:07 p.m. ET; preserved as `ROWAN-GRANT1-EXECUTION-REVIEW.md`) —
verdict PASS WITH CONDITIONS, two corrections: **G1-1 CHRONOLOGY** and
**G1-2 S1-X WORDING**. Until this reconciliation is accepted, R5a-D
closure is **PROVISIONAL** (Rowan's term); this document requests its
conversion to full documentary closure.
**Scope:** read-only evidence gathering + offline paperwork. No
production mutation of any kind was made for this reconciliation, and
no part of the execution was rerun. Every timestamp below was read
firsthand from its platform record during this reconciliation and is
quoted verbatim from that record. Nothing is backdated: the
reconciliation cites platform records as they read now, and where a
time is known only from the executor's own record it is labeled as
such and paired with the nearest independent corroboration.
**Operative record pair after this filing:** the Grant 1 execution
record (pin `f9b295436f4fe6114d2080c902c59c302c4c29c7`, preserved
unchanged) **as read with this reconciliation** (its pin is named in
the companion cp and the board summary). The execution record is not
edited; corrections land here, per the standing correction pattern
(cf. the C2 record correction).

---

## G1-1 — Chronology reconciliation

### The record's clock basis

The execution record states its basis on its face: *"All times UTC
unless marked ET."* Every execution timestamp Rowan flagged —
deployment 23:25Z, window opening 23:28Z, V8b 23:53Z — is a UTC time
on Nov 2, 2026. In Julie's timezone (America/New_York, EST = UTC−5)
those same instants are **18:25, 18:28, and 18:53** — the early
evening of Nov 2, after Julie's 18:15 GO and before her 19:07 relay
of Rowan's review. The reconciliation below establishes each claimed
action from independent platform clocks.

### The reconciled timeline

Platform sources: **CF** = Cloudflare API (deployments list for
`opalreader-api-v2-prod`, read in this reconciliation); **GH** =
GitHub API (git commit objects in `jedavid33-design/opal-reader`;
issue-comment objects in `jedavid33-design/opal-roundtable`, read in
this reconciliation); **SCHED** = the runtime scheduler's run history
(`phaseb-s1-window-watch`, read in this reconciliation); **LOG** =
the S1 window log (`phaseb-s1-window-log.md`, entries written at
execution time); **FS** = filesystem mtimes of the gate's evidence
files on this machine (executor-local, cited only as corroboration);
**CHAT** = the Coding Projects chat record as cited in the execution
record/board filings.

| # | Action (as claimed in the record) | Record's time (UTC) | EST equivalent | Independent corroboration (verbatim) |
|---|---|---|---|---|
| 1 | Julie's GO (Grant 1) given in chat | ~2026-11-02T23:15:49Z (CHAT, as recorded) | 18:15:49 | GH: the GO's board filing (comment `6590949982`) `created_at: 2026-11-02T23:17:31Z` — the filing postdates the chat GO by ~1.7 min, as expected for a record made after the act |
| 2 | Rowan's final design ruling filed on the board | 2026-11-02T23:16:17Z | 18:16:17 | GH: comment `6590928756` `created_at: 2026-11-02T23:16:17Z`; its summary `6590930901` at `23:16:24Z` |
| 3 | Window log opened (Stage 1 setup) | 2026-11-02T23:20Z (LOG, minute precision) | 18:20 | LOG entry itself; bracketed by SCHED rows 4–6 |
| 4 | Smoke run scheduled + started | 2026-11-02T23:19:59Z | 18:19:59 | SCHED: run `9a4ffe50-f9c5-47f0-ba78-4577e891c85a`, `scheduled_for_utc: 1793661599` (= 23:19:59Z), `started_at_utc: 1793661599` |
| 5 | Smoke read set executed; SMOKE entry appended | reads 23:20:26Z–23:20:41Z; entry 2026-11-02T23:21:10Z (LOG) | 18:21:10 | LOG entry's own timestamps, inside the SCHED run window (rows 4–6) |
| 6 | Smoke run finished, status "succeeded"; smoke report delivered to chat | finished 2026-11-02T23:22:21Z | 18:22:21 | SCHED: `finished_at_utc: 1793661741` (= 23:22:21Z), `status: succeeded` |
| 7 | Stage-2 census (set c0) started | 2026-11-02T23:23:46Z (executor record) | 18:23:46 | FS: battery logs written 23:24:08Z–23:24:10Z immediately after the census-driven assembly (row 8) |
| 8 | Gate battery completed (42/42 + 23/23 + 32/32) | by ~2026-11-02T23:24:10Z | 18:24:10 | FS: `containment-gate.log` mtime 23:24:08.377Z, `r5a-gate.log` 23:24:08.957Z, `p2-gate.log` 23:24:10.154Z (all +0000) |
| 9 | Build pin created (`fdb02395…`) | 2026-11-02T23:24:32Z | 18:24:32 | GH: commit `fdb02395b3775dc945baa395591a73060ab146c4`, author date = committer date `2026-11-02T23:24:32Z` |
| 10 | **The upload (exactly one)** | PUT dispatched 2026-11-02T23:25:20Z (executor record) | 18:25:20 | **CF: deployment `552db8a1-70e4-4a7f-9480-585bb99ab961`, `created_on: "2026-11-02T23:25:22.426096Z"`, `source: "api"`, annotation `workers/triggered_by: upload`, version `3fb01c7d-0feb-432f-a901-b04bb68c8ddc` at 100%. The upload response preserved in evidence carries the identical stamp: `modified_on: "2026-11-02T23:25:22.426096Z"`, `etag: "bb90f18223e1802e1c417f17359f344499dc2d29c78e54db259f6f9ae4ac5c9e"` — the platform's completion stamp lands 2.4 s after the executor's dispatch time, the expected shape for one PUT** |
| 11 | D2 read-back complete → **WINDOW OPEN** | 2026-11-02T23:28:41Z | 18:28:41 | LOG: WINDOW-OPEN entry at `2026-11-02T23:28:41Z`; FS: `verify-d2.log` mtime 23:28:41.288Z |
| 12 | V8a set (+10 min) | captured from 2026-11-02T23:38:41Z | 18:38:41 | FS: `verify-v8a.log` mtime 23:39:00.635Z (capture completing ~19 s after its start) |
| 13 | V8b set (+25 min) | captured from 2026-11-02T23:53:41Z | 18:53:41 | FS: `verify-v8b.log` mtime 23:53:59.438Z (capture completing ~18 s after its start) |
| 14 | Execution record pinned (`f9b29543…`) | 2026-11-02T23:54:36Z | 18:54:36 | GH: commit `f9b295436f4fe6114d2080c902c59c302c4c29c7`, author date = committer date `2026-11-02T23:54:36Z` — after V8b's capture completed (row 13), as the record's own order requires |
| 15 | Execution summary filed on the board | 2026-11-02T23:55:25Z | 18:55:25 | GH: comment `6591560197` `created_at: 2026-11-02T23:55:25Z` |
| 16 | Rowan's execution review relayed by Julie | 2026-11-03T00:07Z | 19:07 (Nov 2) | CHAT, as recorded in the review's record note — after every execution timestamp above |

For completeness on the pin lineage Rowan reviewed: the RM-1-c
amendment pin `f374ee74…` (the build pin's parent) carries GH
committer date `2026-11-02T22:40:55Z` — earlier the same evening,
before the GO, as the design sequence requires.

Two query notes, for the record's completeness: (a) the Cloudflare
deployments **list** endpoint is the source of row 10; a single-item
GET addressed by the version id returned 404 (the deployments API
keys deployments by deployment id — `552db8a1…` — not by version id
`3fb01c7d…`); the list resolves the version to its deployment
unambiguously (100% traffic, source `api`). (b) The deployments list
also shows the immediately preceding deployment at
`created_on: "2026-11-02T20:05:27.448668Z"` — the C1 upload, matching
the C1 gate's recorded stamp — and no deployment between it and the
Grant 1 deployment, corroborating "exactly one upload" in this gate.

### Ordering checks (all hold)

GO (row 1) → ruling + GO filed (rows 1–2) → smoke scheduled,
executed, succeeded (rows 4–6) → census → battery (rows 7–8) →
build pin (row 9) → upload (row 10) → D2 / window open (row 11) →
V8a (row 12) → V8b (row 13) → record pin (row 14) → board summary
(row 15) → Rowan's review (row 16). Every gate-order constraint in
the operative package is satisfied by the platform timestamps
themselves, not merely by the executor's account: the GO's filing
predates the smoke run; the smoke's success predates the census;
the build pin predates the upload by 48 seconds (pin-then-deploy,
never deploy-then-pin); the record pin postdates the last
verification set it reports.

### Finding (at true strength)

**No discrepancy was found in any platform record.** Three
independent platform clocks — Cloudflare's deployment record,
GitHub's commit/comment timestamps, and the scheduler's run
history — plus executor-local file mtimes agree with the execution
record's UTC timeline at every point checked, to within seconds
(the largest gap is the upload's 2.4 s dispatch-to-platform-stamp
interval, which is the expected direction and shape). Each claimed
completed action in the record is corroborated by at least one
record the executor does not control.

What this reconciliation **cannot** establish is the state of the
clock in Rowan's review environment: that clock is not observable
from here. What can be established is that, if her review context
was displaying a "current time" earlier than the record's latest
timestamps (e.g., a context anchored before 23:53Z, or a non-UTC
local rendering read against the record's UTC figures), the
record's timestamps would read as later than that context — while
on every authoritative clock available to this reconciliation the
actions occurred at the stated UTC times, in the stated order, on
Nov 2, 2026, between Julie's 18:15 EST GO and her 19:07 EST relay
of the review. The record's times are neither future-dated on any
platform clock nor backdated in this reconciliation: each is quoted
from the platform record that made it.

**Requested disposition:** G1-1 answered; R5a-D closure converts
from PROVISIONAL to full documentary closure on Rowan's acceptance
of this reconciliation — subject to G1-2 below, which is corrected
in the same filing.

---

## G1-2 — S1-X wording correction (execution record §4)

### The error, quoted verbatim

Execution record §4, on the RM-1-c interval (line breaks as in the
record):

> "Per RM-1-c: the **maximum completion interval is 60 minutes**
> from the recorded decision timestamp to initiation of the stop
> (dispatch of the operator `{action:"stop_chain"}` call; first
> durable marker = `stop_chain:applied`); a decision not completed
> inside it is **LAPSED** (recorded as such; authorizes nothing; a
> later stop needs a fresh Rowan ruling and a fresh Julie
> authorization; a lapse does not consume the single-use budget,
> and a new in-window decision requires the full §3.4 evidence
> standard on fresh reads)."

The sentence is internally split: its first half correctly bounds
**initiation** ("to initiation of the stop"), but its lapse clause
— "a decision not **completed** inside it is LAPSED" — states the
wrong test. Rowan's G1-2 is correct.

### The accepted law (RM-1-c §3.1, quoted verbatim)

> "**Completion.** The act's in-bound `verify_chain_stop` attempts
> (≤3, episode bound unchanged) and their recording. Completion is
> **not** separately clock-bound: what the interval bounds is
> initiation. Once initiated in-interval, the act completes under
> the design's existing verification discipline, whenever its
> reads land."

### The correction (operative for all future citation)

The §4 lapse clause is replaced, for all future citation of the
execution record, by:

> "Per RM-1-c: the 60-minute interval bounds **initiation** of the
> stop — dispatch of the operator `{action:"stop_chain"}` call
> (first durable marker = `stop_chain:applied`) must occur within
> 60 minutes of the recorded decision timestamp. A decision whose
> stop act has **not been initiated** within the interval is
> **LAPSED** (recorded as such; authorizes nothing; a later stop
> needs a fresh Rowan ruling and a fresh Julie authorization; a
> lapse does not consume the single-use budget, and a new
> in-window decision requires the full §3.4 evidence standard on
> fresh reads). A decision whose act **was** initiated inside the
> interval does **not** lapse because its bounded verification
> (`verify_chain_stop`, ≤3 attempts under the episode bound)
> completes after the interval: completion is not clock-bound
> (RM-1-c §3.1)."

Terminology note for future documents: RM-1-c names the bound the
"completion interval" while defining it (§3.1) as an initiation
bound. Future citations should write "the 60-minute initiation
bound (RM-1-c's 'completion interval')" on first use, so the name
cannot re-import the corrected error.

### Scan of the record and cp for the same error

Every occurrence of the completion/initiation vocabulary in the
execution record and the Grant 1 cp was read for the same defect:

- **Record §4, one further sentence — scanned, correct:**
  "a guard failure after initiation is NOT COMPLETED, distinct
  from LAPSED" — this is RM-1-c §3.2's own distinction (the
  fresh-confirmation guard failing at an in-interval act attempt);
  it states no completion deadline. No correction.
- **Record §1.2 — scanned, name reference only:** the job bodies
  carry "the RM-1-c 60-minute completion interval" — RM-1-c's own
  defined term, carrying no lapse statement; the terminology note
  above governs its reading. No correction.
- **Record §§3.6–3.7 and the cp — scanned, correct uses:**
  "capture completed 2026-11-02T23:28:41Z" (D2) and "the window
  opened at completion of the D2 read-back" state facts about the
  read-back, not the S1-X interval. The cp contains no lapse
  wording at all. No corrections.

**Exactly one sentence carried the error — §4's lapse clause —
and it is corrected above.**

---

## Status after this reconciliation

- G1-1: answered with platform-corroborated timestamps; no
  discrepancy found; nothing backdated.
- G1-2: the §4 lapse clause corrected by quotation and replacement;
  the original record (pin `f9b29543…`) is preserved unchanged and
  is read with this reconciliation as the operative pair.
- Production: untouched by this reconciliation; HELD throughout.
  The S1 window runs on its verified timestamps (opened
  2026-11-02T23:28:41Z; closes 2026-11-05T23:28:41Z) under the
  §3.2 vehicle; monitoring and escalation requirements unchanged.
- Grant 2, C3, restoration, R3-V, and generation remain separately
  gated; nothing here requests or implies any of them.

**Turn: Rowan's — acceptance of this reconciliation converts
R5a-D's closure from PROVISIONAL to full.**
