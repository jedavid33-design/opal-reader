ROWAN-CP — Grant 1 EXECUTION (R5a-D deployed; S1 window OPEN). Start here.

**READ FIRST:** `00-INSTRUCTIONS-FOR-ROWAN.md` in this folder. Production
remains HELD (halted + queue paused). This package asks for your
independent EXECUTION REVIEW of Grant 1 — it authorizes nothing further.
Grant 2 / Part D, C3, restoration, R3-V, and all generation remain
separately gated and are NOT requested here.

**What happened, in one paragraph.** Julie granted Grant 1 (board
`6590949982`). Stage 1 stood up the monitoring vehicle (two scheduler
jobs + the window log) and the mandatory smoke test PASSED on both
records (scheduler execution record "succeeded" for run
`9a4ffe50-f9c5-47f0-ba78-4577e891c85a` + the run's own SMOKE entry in the
window log, exact match, no deviation). Stage 2 executed R5a-D per the
accepted readiness package: fresh census **19/19 PASS** (item 7 verified
on BOTH phase surfaces), fresh assembly (exactly one part differs from
live — the composed coordinator), battery **42/42 + 23/23 + 32/32, all
exit 0**, build pin below, **exactly ONE upload** (HTTP 200; observability
survived — no settings PATCH), D2 read-back 31/31 with **V1–V7 7/7 PASS**,
and **V8a (+10 min) and V8b (+25 min) both 7/7 PASS**. No wake signature
appeared in any gate read (armedAt bit-identical throughout; recorder
still missing/[]/null; zero §7.3-set transitions). **The 72-hour S1
window opened at completion of the D2 read-back: 2026-11-02T23:28:41Z**,
and closes 2026-11-05T23:28:41Z. Mutations: exactly 1 (the upload). $0.
Ends HELD.

**Files in this folder (this rotation):**
1. `00-INSTRUCTIONS-FOR-ROWAN.md` — standing instructions (unchanged).
2. `PHASEB-GRANT1-EXECUTION-RECORD.md` — the full execution record
   (Stage 1 + Stage 2 + S1-X binding as executed + mutation tally +
   stated limitations).
3. `PHASEB-GRANT1-EXECUTION-ROWAN-CP.md` — this file.

**Pins (repo `jedavid33-design/opal-reader`, branch `ui1-review`):**
- Build pin (the deployed build's stamp; /health reads it):
  `fdb02395b3775dc945baa395591a73060ab146c4`
- This execution record's pin: `GRANT1_RECORD_PIN`
  (The record as pinned carries the pin slot in its §7; this Dropbox copy
  carries the filled pin. That one line is the only difference — the
  standing pin-slot pattern.)

**Key figures for your review:** new script etag
`bb90f18223e1802e1c417f17359f344499dc2d29c78e54db259f6f9ae4ac5c9e`;
31/31 parts byte-identical to the stamped manifest; 29/31 identical to
the pre-deploy C1 build `27b2b3a9…`; coordinator
`5303cb6323da01c21a5ebe9a7983f87abe08e14945660daaebce99734849e1ed`;
containment NORMAL/absent/verified on both surfaces (no transition has
ever run); armedAt 1793562576104 bit-identical across census, D2, V8a,
V8b; phase frozen on both surfaces (settled 1029420 / estUnverified
19018 / reservedUnverified 5648 / remaining 12464932); quota ok, reserved
0, dispatched 2026-11-02 = 0; conflicts exactly ids 1–4; watermarks
18/1841.

**What your review decides:** whether R5a-D CLOSES on this record. S1
stays open under the window vehicle until Stage 4 (window close, closing
census, your review of the window record) dispositions it under §4.3.
The +24-hour Part D checkpoint is 2026-11-03T23:28:41Z — if no natural
wake has been observed by then, a preflight will be presented to Julie
and Grant 2 will be her separate decision; nothing about that is
requested or implied here.

Reply through Julie as usual; end by naming whose turn it is.
