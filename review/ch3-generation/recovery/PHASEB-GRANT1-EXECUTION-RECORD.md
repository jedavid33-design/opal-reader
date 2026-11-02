# Phase B Recovery — Grant 1 EXECUTION RECORD (R5a-D + S1 window opening + S1-X binding)

**Case:** Opal Reader v2 Phase B recovery, Case #10 / P8 (issue #15,
`jedavid33-design/opal-roundtable`).
**Authorization:** Grant 1 — Julie's GO, given in the Coding Projects chat
2026-11-02 ~6:15 p.m. ET via the decision buttons + the confirming message
**"GO — Grant 1 (deploy + window + emergency stop)"**, recorded on issue #15
**before any Stage-1 act** (board comment `6590949982`, Handoff ID
`RT-H-20261102-fffddf`, recorded by Wren).
**Operative package:** `PHASEB-R5AD-S1-SEQUENCING-PROPOSAL-REVISED2.md`
(pin `11a296e79f0963fc005a23edd3e2a9dffbf012fd`, `ui1-review`, repo
`jedavid33-design/opal-reader`) as amended by
`PHASEB-R5AD-S1-RM1C-CORRECTION.md` (pin
`f374ee740eb871b6799518935b15aa5dfd8f9dfa`); the deployment itself executed
per the accepted R5a-D readiness package
`PHASEB-R5AD-READINESS-PACKAGE.md` (pin
`74b7120ee7073ba2df3544a98991819a89cf0420`) as carried into REVISED-2 Part A.
Design gate: Rowan PASS WITH CONDITIONS (final ruling, board `6590928756`,
2026-11-02).
**Scope executed:** Part A (R5a-D deployment) + Part B (72-hour S1 window
arrangements incl. the monitoring vehicle and the standing Layer-1 option)
+ Part C (S1-X bound to the operative pin and this window under the
RM-1-c lapse law). **Excluded and not performed:** Grant 2 / Part D (no
stimulus was sent or is authorized by this record), C3, restoration, R3-V,
any generation, any containment transition, any queue/hold/settings change
beyond the one authorized upload.
**Executor:** Wren (this run). All times UTC unless marked ET.
**Outcome (stated first): STAGE 1 PASS (vehicle armed, smoke test passed on
both records). STAGE 2 (R5a-D) EXECUTED — census 19/19 PASS, assembly exact,
battery 42/42 + 23/23 + 32/32 exit 0, build pin `fdb02395…`, exactly ONE
upload, D2 read-back 31/31 with V1–V7 7/7 PASS, post-window-open sets
V8a/V8b 7/7 PASS. The S1 window OPENED at 2026-11-02T23:28:41Z and runs to
2026-11-05T23:28:41Z. Production ends HELD (halted + queue paused), exactly
as it began. Mutations: exactly 1 (the script upload). $0.**

---

## 1. Stage 1 — the monitoring vehicle (Part B setup; REVISED-2 §3.2)

### 1.1 Window log

Created `~/workspace/goals/opal-roundtable/hidden_files/phaseb-s1-window-log.md`
(header + "LOG OPENED — Stage 1 setup" entry, 2026-11-02T23:20Z). Every
check appends one entry at execution time; a check that produces no entry
is a MISSED check by definition (§3.2).

### 1.2 Jobs created

Both jobs are owned by `goal:opal-roundtable`, deliver to the Coding
Projects chat (`9b55bc59-2f29-40af-8392-201cc714e035`), timezone
America/New_York, and carry §3.2's discipline in substance in their bodies
(the full bodies are preserved in
`grant1-execution/job-body-hourly.md` / `job-body-6h.md`): the complete
§3.1 read set per check; log-append at execution time with raw values; the
W-0/W-1p/W-1f/W-2/W-3e/W-3u/W-4 taxonomy; the two-record gap cross-check
(window log × scheduler run history, +10-minute jitter tolerance); the
escalation triggers (§3.2 (i)–(vi)) incl. the firing-decision path with the
RM-1-c 60-minute completion interval; the WINDOW-FAILED rule; and the hard
limits — **read-only production access only; NO containment transition, NO
command, NO stimulus, NO S1-X act, NO queue/hold/settings change;
production state is never changed by a check run**.

| Job | Schedule | State at creation |
|---|---|---|
| `phaseb-s1-window-watch` | interval 1 h, from creation | **enabled** |
| `phaseb-s1-window-watch-6h` | interval 6 h, from creation | created **disabled**; enabled by the +12 h handoff (§3.2) |

Phase mechanics per §3.2: the hourly job owns the window from open to
+12 h; its checks at/after +12 h first confirm the 6-hourly job is enabled
and verifying (a direct status read), disable the hourly job only after
that confirmation, and log the handoff; if the 6-hourly job cannot be
confirmed enabled, hourly coverage CONTINUES and the failure is escalated —
a coverage gap is never accepted silently. The 6-hourly job's runs at/after
+24 h additionally assemble the Part D preflight facts (report only), and
its run at/after +72 h runs the closing census, logs WINDOW-CLOSE, and
disables itself at the end of that run (§3.5).

### 1.3 Smoke test — PASS on both records (Rowan's mandatory condition)

The hourly job was triggered once by scheduler run-now against the
pre-window state:

- **Scheduler record:** manual run `9a4ffe50-f9c5-47f0-ba78-4577e891c85a`,
  scheduled 2026-11-02T23:19:59Z; the scheduler's execution record for the
  run reads status **"succeeded"** (run window 23:19:59Z → 23:22:21Z),
  read back independently from the scheduler's own history.
- **Window-log record:** the run itself appended the **SMOKE** entry at
  **2026-11-02T23:21:10Z**: the full §3.1 read set (10/10 GETs, all HTTP
  200) with raw values, closing with "EXACT MATCH on every value returned
  by the §3.1 read set … NO DEVIATION" against the pre-window baseline
  (build `27b2b3a9…`, armedAt 1793562576104, recorder missing/[]/null,
  containment NORMAL/absent/verified on both surfaces, plan preserved,
  phase frozen on both surfaces, quota ok with the sole straddler,
  conflicts exactly ids 1–4, queue paused, health halted/armed).

Both records confirm independently → the vehicle is armed and Stage 2 was
permitted to proceed. The hourly job remains enabled; any of its runs
before window-open log as PRE-WINDOW (excluded from coverage). One
scheduled run is expected at 2026-11-03T00:19:30Z if Stage 2 has not opened
the window before it — it did not fire before window-open (the window
opened 23:28:41Z; see §3), so zero pre-window scheduled runs occurred. [NB:
the scheduler's delivery of the smoke run arrived as a chat report
23:22:21Z — the two-record evidence above is what the PASS rests on.]

---

## 2. Stage 2 census — 19/19 PASS, zero deviations (readiness package §4)

Fresh pre-gate census of production (capture set `c0`,
`grant1-execution/evidence/`, started 2026-11-02T23:23:46Z; checker
`grant1-execution/census_check.py`, exit 0). The package's 16 census items,
with item 7 enumerated as 7a (capabilities phase block) + 7b (diagnostics
`plan.phaseAccounting`) and item 14 as 14 + 14b — **every phase-accounting
expectation was verified on BOTH surfaces**:

0 registry (rev 1, exactly 1 book, FP id) · 1 script (etag
`adb8e5a5…`, downloaded byte size 1,512,268) · 2 parts 31/31 byte-identical
to the C1 closing stamped manifest (coordinator = containment-only
`6c19a50e…`; the R5a delta ABSENT from the live script) · 3 bindings 10,
HALT "1", policy enforce · 4 settings rev 1 (standard, cap $50) · 5 queue
paused, 1 consumer `f260f218…`, retention 86,400 · 6 capabilities
(d6StandardOnly, batch_not_armed, 13 migrations, coherent) · 7a+7b phase
EXACT on both surfaces (settled 1,029,420 / estimatedUnverified 19,018 /
reservedUnverified 5,648 / inFlightUpper 0 / unknownOpen 0 / remaining
12,464,932; provider_unverified) · 8 quota reconcile ok, pages 3/3, drift
[], totals exact, sole straddler exception, PT days 57/79/44/76, today
(2026-11-02) dispatched 0, derived reserved 0 · 9 plans exactly 5 in pinned
states · 10 Phase B plan active, entry exact (569 chars, occurrence
`2a85f74f…`, pending, executionState null), job queued rev 1 grants [],
quarantine held false · 11 eligibility (bound 26 / parked 0 / eligible 1;
digest `cdef2c7e…` on all three scopes; idx-26 R2 key FREE) · 12 conflicts
exactly the four pinned rows, field-exact · 13 parked Ch 3 job fingerprint
`b991f18a…` exact · 14+14b watermarks 18/1841, 1,841 entities, key absent,
0 changes · 15 drive baseline (recorder missing/[]/null; armedAt
**1793562576104** — the dated preflight expectation read live and matched;
pendingSchedule 2 / pendingWatchdog 1; containment NORMAL/absent/verified
with empty stop/episode fields on **both** surfaces) · 16 preconditions
(GO on the board at `6590949982`; build-pin parent `f374ee74…` confirmed
as the ref head; smoke PASS on both records, §1.3).

**No deviation of any size was found; no stop condition arose.**

---

## 3. Assembly, battery, pin, upload, verification (readiness package §§3, 7, 8)

### 3.1 Assembly (fresh; §3 item 1)

From the census-downloaded live parts (`evidence/parts-c0`) + the stored
diff `containment-v4/coordinator-composed-vs-containment.diff` (SHA-256
`8c8b96fd…`, 8,975 B, re-verified), applied to the coordinator part only.
Assertions all held: exactly **1 of 31 parts differs from live** —
coordinator `5303cb63…` (314,712 B, the composed R5a+containment form);
30 parts byte-identical incl. the identity part still carrying the live C1
stamp (`873d6cb9…`, 411 B); `node --check` clean. Unstamped manifest
SHA-256 `212e127f…`.

### 3.2 Gate battery on the assembled tree (§8) — all exit 0

Complete runs on the gate-assembled tree, full logs captured
(`grant1-execution/logs/`, combined in the pinned
`BATTERY-RERUN-LOG.txt`, SHA-256 `43758c86…`). Identity fixtures were
parameterized for this tree per the standing rule (the composed fixtures
plus `v2/host/build-identity.mjs` at the assembled tree's live-C1 stamp
part `873d6cb9…` as a changed part — fixture data only, no behavioral
assertion changed; the P2 suite ran with BASE and parts at their suite
defaults, the unmodified pre-instrumentation build):

- **Containment battery v4 incl. CT14d: 42 passed / 42, exit 0** (log
  SHA-256 `b8645ebb…`)
- **R5a suite: 23 passed / 23, exit 0** (log SHA-256 `95d7bda4…`)
- **P2 parameterized regression: 32 passed / 32, exit 0** (log SHA-256
  `cec7fd10…`)

### 3.3 Build pin (§3 item 3)

`fdb02395b3775dc945baa395591a73060ab146c4`. One clean single-parent child of `f374ee74…` on `ui1-review`
(repo `jedavid33-design/opal-reader`) carrying the unstamped candidate
manifest (`candidate-manifest-unstamped.json`, SHA-256 `212e127f…`) + the
battery rerun log; the head was **re-read in a separate call** after
pinning and confirmed (parentage, tree, message, blob hashes) before the
stamp was made.

### 3.4 Stamp + envelope (§3 items 4–5)

Deploy tree = assembled tree with `BUILD_COMMIT` stamped to the build pin
(411 B identity part preserved; stamped part SHA-256 `d7a0fa16…`).
**Deployed delta vs live = exactly 2 parts** (coordinator + re-stamped
identity); 29/31 identical to live. Full stamped manifest
(`grant1-execution/build/deploy-manifest-stamped.json`, SHA-256
`f0b3a16d…`). Upload metadata was read fresh from the live `/settings` and
carried forward: the fresh read is **identical** to the C1 gate's
carried-forward metadata after only the two documented GET-projection
transformations (secrets shown as `secret_text` → sent as `inherit`; the
DO binding's `namespace_id` projection dropped for the upload form).
Envelope round-trip verified before upload: parse reproduces metadata +
31 parts, **32/32 byte-identical** (envelope 1,519,242 B, SHA-256
`c1d020f3…`).

### 3.5 The upload — exactly ONE (§3 item 6)

One ES-module multipart PUT at **2026-11-02T23:25:20Z** → **HTTP 200,
success, errors []**, `modified_on` 2026-11-02T23:25:22.426096Z. No second
upload was made or needed. **Post-upload script-settings check:
observability enabled + persisted in the D2 read-back (V3) — the upload
did NOT reset it, so the conditional settings PATCH was not triggered
(0 used of the ≤1 in budget).**

### 3.6 Verification sets (§7)

- **D2 (immediate read-back; capture completed 2026-11-02T23:28:41Z) —
  V1–V7, 7/7 PASS** (`grant1-execution/logs/verify-d2.log`): V1 /health
  build = the build pin, halted, armed. V2 new etag
  **`bb90f18223e1802e1c417f17359f344499dc2d29c78e54db259f6f9ae4ac5c9e`**;
  31/31 parts byte-identical to the stamped manifest; 29/31 identical to
  live; coordinator at the composed hash. V3 settings (rev 1, 10 bindings,
  HALT "1", enforce, observability enabled+persist). V4 queue (paused,
  1 consumer). V5 containment (NORMAL/absent/verified, empty stop fields,
  `stopConfidence: "not_applicable"` on **both** surfaces; recorder
  missing/[]/null unchanged; **armedAt 1793562576104 bit-identical** —
  the deployment performed no alarm action; pendingSchedule 2 /
  pendingWatchdog 1 unchanged). V6 preservation exact on every pinned
  value incl. phase on both surfaces and the parked-job fingerprint.
  V7 no-movement (grants [], occurrence pending, job queued rev 1,
  reserved 0, dispatched today 0, plans 5, conflicts 4).
- **V8a (+10 min set, captured from 2026-11-02T23:38:41Z) — 7/7 PASS**
  (`grant1-execution/logs/verify-v8a.log`): full battery re-read;
  script etag unchanged (`bb90f182…`), 31/31 parts still byte-identical
  to the stamped manifest; bindings + queue immutability re-asserted by
  the V3/V4 reads; preservation and containment projections exact on both
  surfaces; recorder still missing/[]/null; **armedAt 1793562576104
  bit-identical**; no movement anywhere in the preserved set.
- **V8b (+25 min set, captured from 2026-11-02T23:53:41Z) — 7/7 PASS**
  (`grant1-execution/logs/verify-v8b.log`): the same battery, repeated —
  etag and parts unchanged, preservation exact, containment projections
  exact on both surfaces, recorder still missing/[]/null, armedAt
  bit-identical, zero movement.

**No wake signature appeared in any verification read** (no §7.3-set
transition, no drive-pass row, no armedAt change): the gate-time T5 branch
did not trigger; there is no early S1 event to classify. No T1–T4
signature appeared; the conditional rollback was not used. No Class B
condition arose.

### 3.7 WINDOW OPEN

**The 72-hour S1 observation window opened at the completion of the
upload's D2 read-back: 2026-11-02T23:28:41Z (2026-11-02 18:28:41 EST)**,
per REVISED-2 §3.1. The WINDOW-OPEN entry carrying the verified D2 values
was written into the window log as the final Stage-2 act. Window close:
**2026-11-05T23:28:41Z**. +24-hour Part D checkpoint:
**2026-11-03T23:28:41Z**. From this instant the deployed code contains the
R5a disjunct: the first ordinary coordinator wake (expected via
position-sync in ordinary app use) is expected to re-register the stale
alarm, produce exactly one halt-fenced drive pass of the pre-classified
§7.3 shape ($0, no dispatch — halt + queue pause stand), and revive the
~10-minute chain — **that event, when observed, is S1's subject, watched
for by the §3.2 vehicle under the taxonomy; it is not a deployment
failure and no rollback answers it (DV-4).**

---

## 4. S1-X binding as executed (Part C, with the RM-1-c amendment)

Grant 1 Part C stands as granted on the board (`6590949982`): S1-X is
bound to the operative package pin (`11a296e7…` as amended by
`f374ee74…`) and to **this** window (2026-11-02T23:28:41Z →
2026-11-05T23:28:41Z), under V4-4's five conditions and B′: coverage
attaches to a **firing decision recorded before window expiry on complete
in-window evidence**; the completion act may land after expiry only for
such a decision; **after expiry S1-X is dead**. Per RM-1-c: the **maximum
completion interval is 60 minutes** from the recorded decision timestamp
to initiation of the stop (dispatch of the operator
`{action:"stop_chain"}` call; first durable marker =
`stop_chain:applied`); a decision not completed inside it is **LAPSED**
(recorded as such; authorizes nothing; a later stop needs a fresh Rowan
ruling and a fresh Julie authorization; a lapse does not consume the
single-use budget, and a new in-window decision requires the full §3.4
evidence standard on fresh reads). Fresh verification immediately before
any act remains required; a guard failure after initiation is NOT
COMPLETED, distinct from LAPSED; an ambiguous dispatch is never re-sent.
Budget when fired: exactly one `stop_chain` + ≤3 `verify_chain_stop`;
state-row writes ≤4; audit rows ≤5; `deleteAlarm` ≤3; `setAlarm` 0. The
Layer-1 option (Part B2: at most one `contain_drive` for a verified
out-of-set signature) stands as granted; restoration is never part of
S1-X. **Nothing in Part C has fired: no firing decision has been recorded
and no containment transition of any kind has been performed.**

## 5. Mutation tally (exact)

| # | Mutation | Count |
|---|---|---|
| 1 | Worker script upload (the composed build) | **1** |
| — | Settings PATCH | 0 (observability survived; conditional not triggered) |
| — | Queue mutations | 0 |
| — | Containment transitions / commands / stimuli | 0 |
| — | Production data writes of any other kind | 0 |
| — | Provider calls / dollars | 0 / **$0** |

Off-production bookkeeping (not production mutations): two scheduler jobs
created (§1.2), the window log created and appended, two GitHub pins
(build pin + this record's pin), board comments (the GO record + this
gate's summary), and the Dropbox folder rotation for this review.

**Ends HELD in every respect: GENERATION_HALT "1", queue paused,
containment NORMAL/absent (no transition has ever run), the preserved
plan/job/conflicts/watermarks exactly as at census.**

## 6. What this execution does NOT establish (standing limitations, unchanged)

Script deployment + inert read-back on the composed build; R5a's runtime
behavior is **not** exercised until the first wake — Durable Object
runtime adoption by every instance is not proven by an upload; alarm
delivery remains platform-unverified; the recorder's blind spot stands
(a dual failure is indistinguishable from no wake); the provisional
3,600,000 ms threshold and the traffic-independent rate bound remain open
risks; the window's 6-hourly phase is observation, not continuous
protection; C3's verdict, when its own gate comes, is PARTIAL by
construction. R5a-D closes on this record's documentary terms **subject
to Rowan's independent execution review**; S1 remains open until Stage 4
(window close + closing census + Rowan review) dispositions it under
§4.3.

## 7. Pins and references

- Build pin: `fdb02395b3775dc945baa395591a73060ab146c4` (repo
  `jedavid33-design/opal-reader`, branch `ui1-review`) — the deployed
  build's stamp; /health reads it.
- This record's pin: `GRANT1_RECORD_PIN` (filled in the Dropbox copy of
  the companion file; the pinned copy of this record carries the slot).
- Evidence: `~/workspace/ch2-program/ch3-recovery/grant1-execution/`
  (capture sets c0/d2/v8a/v8b, checkers, assembly + envelope scripts,
  logs, job bodies, build/ with both manifests + envelope parse).
- Window log:
  `~/workspace/goals/opal-roundtable/hidden_files/phaseb-s1-window-log.md`.
- Rollback source (unused): the census-downloaded live-C1 parts
  (`grant1-execution/evidence/parts-c0`, byte-identical to the C1 closing
  manifest) + the C1 gate's metadata/order — the §5.2 conditional rollback
  remains available only under its own conditions for a confirmed Class A
  defect; it does not answer a wake.

**Turn: Rowan's — independent execution review of this record (the S1
window runs meanwhile under the §3.2 vehicle; escalations, if any, arrive
in the Coding Projects chat as they occur).**
