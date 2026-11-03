ROWAN-CP — Grant 1 CHRONOLOGY + WORDING RECONCILIATION (G1-1, G1-2). Start here.

**READ FIRST:** `00-INSTRUCTIONS-FOR-ROWAN.md` in this folder. This
package answers your Grant 1 execution review (PASS WITH
CONDITIONS) — the two corrections only. No execution was rerun; no
production mutation of any kind was made; production remains HELD.
R5a-D closure is PROVISIONAL until you accept this reconciliation.

**Files in this folder (this rotation):**
1. `00-INSTRUCTIONS-FOR-ROWAN.md` — standing instructions (unchanged).
2. `PHASEB-GRANT1-EXECUTION-RECORD.md` — the execution record,
   **preserved unchanged** (pin
   `f9b295436f4fe6114d2080c902c59c302c4c29c7`).
3. `PHASEB-GRANT1-CHRONOLOGY-RECONCILIATION.md` — this round's
   document; read it **with** the record as the operative pair.
4. `PHASEB-GRANT1-RECONCILIATION-ROWAN-CP.md` — this file.

**Pin:** `RECONCILIATION_PIN`
(repo `jedavid33-design/opal-reader`, branch `ui1-review`, single
parent `f9b29543…` — the record pin).
(The pinned cp carries this pin slot; this Dropbox copy carries the
filled pin. That one line is the only difference — the standing
pin-slot pattern.)

---

**G1-1 — CHRONOLOGY: no discrepancy found; every timestamp
corroborated by an independent platform clock.**

The record's basis is UTC throughout (stated on its face). Its
flagged times are Nov 2, 2026 evening in EST: deployment 18:25,
window open 18:28, V8b 18:53 — after Julie's 18:15 GO, before your
review's 19:07 relay. Authoritative stamps, each read firsthand
from its platform record for this reconciliation:

- **Upload — Cloudflare:** deployment
  `552db8a1-70e4-4a7f-9480-585bb99ab961`,
  `created_on 2026-11-02T23:25:22.426096Z`, source `api`, triggered
  by upload, version `3fb01c7d…` at 100% — identical to the
  preserved upload response's `modified_on` and etag `bb90f182…`;
  2.4 s after the record's 23:25:20Z dispatch time. The previous
  deployment in the same list is the C1 upload (20:05:27Z) — no
  other deployment between: exactly one upload in this gate.
- **Pins — GitHub:** build pin `fdb02395…` committer
  `2026-11-02T23:24:32Z` (48 s before the upload — pin precedes
  deploy); record pin `f9b29543…` committer
  `2026-11-02T23:54:36Z` (after V8b completed).
- **Board — GitHub:** GO filing `6590949982` created
  `2026-11-02T23:17:31Z`; execution summary `6591560197` created
  `2026-11-02T23:55:25Z`.
- **Smoke — scheduler:** run `9a4ffe50…` scheduled/started
  23:19:59Z, finished 23:22:21Z, status `succeeded`; the window
  log's SMOKE entry (23:21:10Z) sits inside that run window.
- **Verification sets — file records:** `verify-d2.log` written
  23:28:41Z (= the WINDOW-OPEN stamp in the log), `verify-v8a.log`
  23:39:00Z, `verify-v8b.log` 23:53:59Z.

Every ordering constraint holds on the platform timestamps
themselves (GO → smoke → census/battery → build pin → upload →
D2/open → V8a → V8b → record pin → summary → your review). What
cannot be established from here is your review environment's
clock; on every authoritative clock available, the actions
occurred at the stated UTC times in the stated order. Nothing
was backdated — each figure is quoted from the platform record
that made it. (Full table with all 16 events in the
reconciliation, §G1-1.)

**G1-2 — WORDING: one sentence carried the error; corrected by
quotation and replacement.**

Record §4 read: "a decision not **completed** inside it is
**LAPSED**" — wrong test, as you ruled. RM-1-c §3.1 bounds
**initiation** ("what the interval bounds is initiation… Once
initiated in-interval, the act completes under the design's
existing verification discipline, whenever its reads land"). The
corrected §4 wording (operative for all future citation; the
record itself is preserved and read with the reconciliation):
the 60-minute interval bounds **initiation** of `stop_chain`; a
decision whose act was **not initiated** within it is LAPSED; a
decision initiated in-interval does **not** lapse because its
bounded verification (`verify_chain_stop`, ≤3 attempts) completes
later. The full record + cp were scanned for the same error: §4's
"NOT COMPLETED, distinct from LAPSED" is RM-1-c's own guard
distinction (correct); §1.2's "completion interval" is RM-1-c's
defined name (carries no lapse statement); the remaining
"completion" uses concern the D2 read-back. Exactly one sentence
was wrong, and it is the one you named.

**What this round decides:** your acceptance converts R5a-D
closure from PROVISIONAL to full documentary closure. S1 remains
open on its verified window timestamps (opened
2026-11-02T23:28:41Z, closes 2026-11-05T23:28:41Z) under the
watch vehicle. Grant 2, C3, restoration, R3-V, generation:
unchanged, separately gated, not requested.

Your turn, Rowan.
