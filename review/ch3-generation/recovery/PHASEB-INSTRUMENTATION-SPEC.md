# Phase B Instrumentation — IMPLEMENTATION SPECIFICATION (P2)

- **Status: SPECIFICATION ONLY.** No code has been deployed, no
  production call has been made, nothing is authorized by this
  document. It specifies the build that the companion gate proposal
  (`PHASEB-INSTRUMENTATION-GATE-PROPOSAL.md`) would execute if —
  and only if — Rowan passes that gate and Julie gives an explicit
  GO.
- **AMENDED — HOLD FOR CORRECTIONS implemented.** Rowan's review
  of the original spec + gate (`ROWAN-P2-SPEC-GATE-REVIEW.md`:
  "HOLD FOR CORRECTIONS. NOT APPROVED FOR DEPLOYMENT") named six
  required corrections. All six are implemented in this amendment:
  §1.3 maps each correction to the sections that carry it, and
  `PHASEB-INSTRUMENTATION-AMENDMENT-NOTES.md` is the full
  compliance record (changed sections, old vs new hashes, battery
  outcome). The two-part architecture is preserved. The T0–T10
  battery has been EXECUTED against the exact candidate tree in
  this amendment (§9; log `instrumentation-spec/BATTERY-RUN-LOG.txt`,
  SHA-256 `1fcacefa8e60062a87e9a3ecff47a59667346a1450d9282daf818bffbb85c2ce`,
  exit code 0, 32/32 tests passing). This amendment is again
  PROPOSAL ONLY: it awaits Rowan's review of the amended spec +
  gate, and any execution still requires her PASS and Julie's
  explicit GO.
- **Authority:** Rowan's P2 instrumentation design review
  (`ROWAN-P2-INSTRUMENTATION-DESIGN-REVIEW.md`): "DESIGN APPROVED
  WITH REQUIRED REFINEMENTS… Prepare an implementation
  specification and separately reviewable proposed build/deploy
  gate, grounded in the exact deployed 31-part source. Include the
  expected two-part diff, test plan, mutation budget, rollback
  conditions, preservation checks, and explicit STOP conditions.
  No production changes or deploy-ready execution are authorized
  yet."
- **Design implemented:** `PHASEB-INSTRUMENTATION-DESIGN.md`
  (SHA-256 `c1e7fcf8e70a2ef0bd819f338527dce8dec1a4227e501a0dade292e4f0235210`),
  including its three deviations from the diagnostic report's §8
  sketch, all three ACCEPTED by Rowan (handler-level recording;
  last-N read; per-pass `armed_after`).
- **Source basis:** the deployed parts preserved at
  `phaseb-attempt3/evidence/parts-e0/` (31 parts, build
  `1c2d1d0fa7ebb769f68cfb327fb9fde7d4d30867`, script etag
  `f15fb1ae40f870fc4493f3499db0b096c4d801b9fff8d20fe5538d84c69c82ed`).
  The expected diff in Appendix A was produced by copying the two
  deployed parts into `instrumentation-spec/scratch/`, editing the
  copies, and diffing against the deployed originals; the patch
  round-trips byte-for-byte (§2.3). The local
  `~/workspace/d6-build/impl/` tree was NOT used; it does not
  correspond to the live build (diagnostic report §0).

## 1. Compliance map — every ruling and refinement, by name

### 1.1 Rowan's six design rulings

| # | Ruling | Where implemented |
|---|---|---|
| R-1 | Handler-level placement: APPROVED | §3 — the recorder lives in the subclass alarm handler in `worker-entry-prod-d6.js`; `driveOnce` is not edited. |
| R-2 | Record-then-rethrow original exception: REQUIRED | §4.2 — on any drive-path throw, the recorder runs first, then `throw e` rethrows the identical error object; the recorder itself never throws (§4.3). Test group T3 asserts object identity of the rethrown error. |
| R-3 | Retention: 288 rows APPROVED as a count cap, not a guaranteed duration | §3.3 + §7 — enforced as `LIMIT 288` in the prune; all duration figures in this spec are labeled estimates derived from the 10-minute watchdog cadence, never guarantees. |
| R-4 | Clock: testable clock with unchanged production semantics | §6 — `_drivePassNow()` mirrors `GenerationCoordinator._now()` (`coordinator.mjs:384`): `env.now()` when provided, else `Date.now()`. The production env carries no `now` function, so production behavior is `Date.now()`, exactly as the shipped coordinator behaves. |
| R-5 | Read route: existing operator-gated diagnostics `drive=1` APPROVED; reject ambiguous mode combinations | §8 — mode selected by the presence of a `drive` parameter; `drivePassDiagnostics` rejects, with the named reason `diagnostics_mode_ambiguous` (HTTP 400 via the class gate's existing rejected mapping), every combination except exactly `drive="1"` with no `planId`, no `jobId`, no `cursor`. As amended by C5/C6: a REPEATED mode parameter is also ambiguous — the class gate counts occurrences (`getAll`), and the public entry's forward, which copies each parameter singly and would otherwise collapse a repeat to its first value, forwards repetition explicitly (`repeated=1`) so the rejection fires on the real route too (battery T7). |
| R-6 | Outcomes: 8,000-character limit conditionally accepted, with explicit truncation and preservation of diagnostic meaning | §5.3 — allowlist projection first, then entry-granular truncation under the cap with a terminal marker entry stating kept/dropped counts and field-slicing; the stored value is always valid JSON; `outcomes_truncated` flags every truncated record. |

### 1.2 Rowan's six required refinements

| # | Refinement | Where addressed |
|---|---|---|
| F-1 | Prevent sensitive data leakage through outcomes and exception fields | §5 — the full sanitization specification: a field allowlist for outcomes (the recorder is the table's only writer; sanitization happens at write time, before storage), a scrubber for error name/message (no stack traces, no URLs, no long identifier-shaped runs, bounded lengths), and test group T5 including a forbidden-pattern scan of stored rows. As amended by C5: a read-side revalidation layer (§5.5) re-validates every stored value before it is returned, and the former raw fallback for unparseable stored JSON is abolished — no raw stored content can escape through the read surface. |
| F-2 | Preserve the distinction between absent alarm execution and failed diagnostic recording | §4.4 — the recorder-health channel in DO key-value storage (a storage facet the SQL table does not share), plus the read's three-state `tableState` and the interpretation matrix in §8.4. The residual blind spot is stated plainly in §4.4. |
| F-3 | Document retry-burst and pruning overhead | §7 — per-pass write inventory, the ≤6-retry burst arithmetic (labeled Cloudflare documentation, not observation), prune cost, and the total storage bound under the cap. All sizes are labeled estimates. |
| F-4 | Test recorder failures at every step without altering alarm semantics | §9, test group T4 — fault injection at DDL, serialization, getAlarm readback, insert, prune, and the health channel's get/put, each with an equivalence assertion against the unmodified build's behavior on the same seeded store. |
| F-5 | Keep Step-0 procedural correction separate from instrumentation | §10.1 — the step-0 correction (verifying an issued grant before unpause; diagnostic report §7, Rowan's attempt-3 review) is named OUT OF SCOPE for this spec and for the companion gate. Nothing in the diff touches it. |
| F-6 | State clearly that constructor/platform failures preceding handler invocation remain unobservable | §10.2 — stated in both this spec and the gate proposal: if the DO cannot be instantiated, or the platform never invokes `alarm()`, no recorder code runs and no row exists; that state is classified INCONCLUSIVE (§8.4, as amended by correction C1): consistent with a dead alarm chain but not proof of one, since a constructor/platform failure before handler invocation leaves the identical absence. The instrumentation does not name a platform-side root cause. |

### 1.3 Rowan's HOLD-FOR-CORRECTIONS corrections (this amendment)

| # | Correction (Rowan's words, condensed) | Where implemented |
|---|---|---|
| C1 | "No rows plus no health record" is INCONCLUSIVE — consistent with H1 but not proof; retain the dual-channel-failure and pre-handler limitations | §8.4 (matrix), §10.2, §4.4 — and the gate's §6 V5, §8, §12. Every place the absence was previously stated as H1 evidence/proof is rewritten to this classification. |
| C2 | Budget must explicitly account for a possible observability PATCH after the forward upload AND a separate conditional PATCH after a rollback upload | Gate §5 (budget table), §9 (S-7), §10 (authorization block). Spec side: no change needed (the spec carries no mutation budget). |
| C3 | §7.3: verify the predicted grant/reservation transition against deployed behavior; any unmatched state movement is STOP | Gate §7.3, rewritten from a firsthand source trace with file:line anchors. The prior draft's claim that phase `reservedUnverified` increases is WITHDRAWN — it is disproven by the deployed accounting derivation (genstore.mjs `phaseAccounting` reads only adjudication/attempt-log state, which grant issuance never writes). Battery T2 observes the verified transition live in the harness. |
| C4 | Distinguish successful diagnostic capture from healthy coordinator execution; error-stage rows and recorder-health failures are findings requiring classification, not automatically failed instrumentation | §8.5 (new classification table + named disposition: executor reports, Rowan classifies) — and the gate's §6 V5. |
| C5 | Strengthen hostile-input coverage for allowlisted string values and the `outcomesRaw` fallback; no raw sensitive content may escape through malformed stored JSON | §5.1 (grammar-or-scrub string discipline), §5.2 (error-name identifier path), §5.3 (marker gains `fieldsScrubbed`), §5.5 (new: read-side revalidation — the raw fallback is ABOLISHED; parse failure yields `outcomes: null` + `outcomesMalformed`), §8.3 (response shape). Implemented in both candidate parts; hostile cases in T5. |
| C6 | T0–T10 must EXECUTE against the exact candidate tree before deployment; include KV fault behavior and end-to-end diagnostics forwarding | §9 — EXECUTED: 32/32 tests, exit code 0, full log at `instrumentation-spec/BATTERY-RUN-LOG.txt` (SHA-256 `1fcacefa8e60062a87e9a3ecff47a59667346a1450d9282daf818bffbb85c2ce`). Battery-found corrections to this spec's own test text (T3(ii) stage boundary, T4 getAlarm surface) are recorded in §9's group notes and in the amendment notes. |

## 2. The change in one paragraph + the expected diff

### 2.1 What changes

Exactly two of the 31 deployed parts change:

- **`v2/worker-entry-prod-d6.js`** gains: (1) a module-level block
  — the `d6_drive_passes` DDL, the recorder constants (retention,
  caps, health key), the outcomes allowlists, the text scrubber,
  the outcomes projector, and the truncating serializer; (2) three
  class members on `OpalReaderCoordinatorProd` — `_drivePassNow()`
  (the clock seam), `_noteDrivePassHealth()` (the health channel),
  `_recordDrivePass()` (the recorder) — and a restructured
  `alarm()` that tracks its stage, captures `driveOnce`'s return
  value, records last on both paths, and rethrows the original
  error unchanged; (3) a `drive` branch in the class-gate
  diagnostics handler dispatching to the new service read; (4)
  `"drive"` added to the public entry's diagnostics forward
  whitelist (one token).
- **`v2/generation/service.mjs`** gains: (1) `isNoSuchTableError`
  added to the existing `./quarantine.mjs` import (one line);
  (2) `drivePassDiagnostics({…})` beside `attemptDiagnostics` —
  the mode-validating, read-only drive-pass read; (3) the method
  name in the export list (one line).

Nothing else changes. `driveOnce`, `coordinator.mjs`,
`worker-entry.js`, `worker-entry-prod.js`, and the other 26 parts
are byte-identical to the deployed build.

### 2.2 Diff statistics (measured from the actual diff, Appendix A)

| Part | Deployed lines | Candidate lines | Added | Removed | Hunks |
|---|---|---|---|---|---|
| `v2/worker-entry-prod-d6.js` | 1,964 | 2,365 | +418 | −15 | 4 |
| `v2/generation/service.mjs` | 1,589 | 1,829 | +241 | −1 | 3 |
| **Total** | | | **+659** | **−16** | **7** |

SHA-256 of the deployed originals (from `parts-e0/`):

- entry: `292ca83e892d5d675f1c107ea4adf1fed34cca6c054fcd068c51b403f79f8a31`
- service: `aeeee06c8af9789426ae8135bd020be77e8ef3ea350de744472743e3dd14bd1d`

SHA-256 of the candidate parts (deployed + this diff):

- entry: `45daf26ca850835c698863cb08ca39a8c6f1b2f1450488d1e710f0cd87d7c4ab`
- service: `41f27492447296f25f958836a65d8e04592c2ba3cd330a2d2854ed98433eefda`

(These supersede the original draft's candidate pins —
entry `f98a4552…`, service `0e7deef2…`, +399/−16 — which the
HOLD-FOR-CORRECTIONS amendment replaced; see the amendment
notes for the full old-vs-new record.)

### 2.3 Diff provenance and verification performed for this spec

The candidate parts were produced by editing scratch copies of
the deployed parts (`instrumentation-spec/scratch/v2/…`), never
the evidence originals. Both candidate parts pass a module-syntax
parse (`node --check`). Applying Appendix A's diff to pristine
copies of the deployed originals with `patch -p1` reproduces the
candidate parts byte-for-byte (SHA-256 verified for both parts).
That round-trip is the identity the companion gate's build stage
re-verifies before any upload. It is also re-verified inside the
executed battery (T0), against the assembled candidate tree the
battery ran on (§9).

### 2.4 An honest delta against the design's estimate

The design estimated ≈+100 lines total. The original draft's
diff was +399/−16; this amendment's is +659/−16. The recording
core the design scoped (DDL, recorder, alarm restructure, read
method, dispatch, whitelist) is close to that estimate; the
growth is (a) the machinery Rowan's refinements added after the
estimate was written — F-1's allowlist projector + scrubber +
T5-grade write-time discipline, R-6's entry-granular truncating
serializer, F-2's health channel (≈+160 lines across the three,
approximate attribution); (b) comment density: the deployed
parts carry their rationale in comments on every mechanism (the
file headers and per-route rulings history are the codebase's
norm), and this diff follows that norm (≈+120 lines of the
entry's growth is comment text, approximate attribution); and
(c) THIS AMENDMENT's correction-5 hardening, ≈+260 lines over
the original draft: the read-side revalidation layer in the
service part (a second, independent sanitizer on the read path —
key lists, grammars, and caps duplicated as a cross-part
contract), the grammar-or-scrub string discipline and the
error-name identifier path in the entry part, and the
repeated-parameter forwarding the battery's T7 case proved
necessary (the public forward was silently collapsing repeated
parameters). No functional element beyond the design +
refinements + the six corrections is included. Rowan reviews
this actual diff, by hash, through the companion gate; if the
size itself is a concern, the honest cut candidates are comment
density and the serializer's marker bookkeeping — not the
sanitization or the health channel, which are rulings, not
options.

## 3. Schema

### 3.1 The table (exact DDL, as it appears in the diff)

```sql
CREATE TABLE IF NOT EXISTS d6_drive_passes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,            -- handler entry time, ms epoch (recorder clock, §6)
  finished_at INTEGER,            -- record time, ms epoch; NULL only if a future writer changes
  stage TEXT NOT NULL,            -- step in progress at capture (§4.1); "complete" = ran end to end
  drive_invoked INTEGER NOT NULL, -- 1 iff driveOnce was called in this pass
  outcomes_json TEXT,             -- sanitized projection of driveOnce's outcomes (§5); NULL if not invoked or it threw
  outcomes_truncated INTEGER NOT NULL DEFAULT 0, -- 1 iff a §5.3 marker is present (truncation, field-slicing, or scrubbing occurred)
  error_name TEXT,                -- sanitized (§5.2 name path); NULL on success
  error_message TEXT,             -- scrubbed, ≤500 chars (§5.2); NULL on success
  armed_after INTEGER             -- getAlarm() read back at record time; NULL if that read failed
);
```

The DDL is executed by the recorder itself on every pass
(`CREATE TABLE IF NOT EXISTS` — the codebase's proven lazy,
DDL-only, idempotent pattern: `gen-schema.mjs` header;
`PLAN_RETIREMENT_SCHEMA` / `ensurePlanRetirementSchema()` at
`service.mjs:516–524`; `ensureQuarantineSchema` at
`quarantine.mjs:110`). No migration, no bootstrap call, no
`.one()` read is involved, so the real-DO empty-result throw
hazard does not arise. The table is additive: the current build
contains no reference to it; a rollback build ignores it (§8 of
the gate proposal).

### 3.2 The prune (exact statement, as it appears in the diff)

```sql
DELETE FROM d6_drive_passes
  WHERE id NOT IN
    (SELECT id FROM d6_drive_passes
      ORDER BY id DESC LIMIT ?)
```
with the bound parameter `DRIVE_PASS_RETENTION = 288`, executed
immediately after each successful insert, in the same recorder
call. The subquery walks the INTEGER PRIMARY KEY; steady state
deletes exactly the rows above the cap (normally one). A prune
failure leaves the inserted row in place and the table above cap
until the next successful pass prunes again — the cap is
self-healing, and a prune failure is recorded on the health
channel with step `"prune"` (§4.4).

### 3.3 Retention semantics

288 is a **count cap** (ruling R-3). At the shipped watchdog
cadence (10 minutes, `WATCHDOG_PERIOD_MS`, `coordinator.mjs:133`)
a healthy held system writes ~6 rows/hour, so 288 rows correspond
to an *estimate* of ~48 hours; under a retry burst the same count
covers far less wall time (§7). No duration is promised anywhere
in this spec or the gate.

## 4. The recorder

### 4.1 Stage tracking

`alarm()` is restructured so `rec.stage` always names the step in
progress; a throw therefore records the step that threw:

| Recorded `stage` | Meaning |
|---|---|
| `base_alarm` | `await super.alarm()` (deployed line 1460) threw |
| `construct` | `_cache()` / coordinator / service construction (1461–1463) threw |
| `recover` | `service.recover()` (1464) threw |
| `drive` | `service.driveOnce()` (1465) was invoked and threw (`drive_invoked = 1`) |
| `flush` | `cache.flush()` (1466) threw (the drive itself completed; its outcomes are recorded) |
| `complete` | the handler ran end to end |

This is the design's stage table with one naming already in the
design (`base_alarm` … `complete`); the code sets `rec.stage`
immediately BEFORE each step, and `rec.driveInvoked = 1`
immediately before the `driveOnce()` call, so both fields are
exact at any throw point. `rec.outcomes` captures the array
`driveOnce` returns (`service.mjs:1046`) — the value its only
caller previously discarded.

### 4.2 Control flow (exact shape, as it appears in the diff)

```
alarm():
  rec = { at: _drivePassNow(), stage: "base_alarm",
          driveInvoked: 0, outcomes: null,
          errorName: null, errorMessage: null }
  try:
    super.alarm();            stage → "construct"
    cache/coord/service;      stage → "recover"
    recover();                stage → "drive"; driveInvoked = 1
    outcomes = driveOnce();   stage → "flush"
    cache.flush();            stage → "complete"
  catch e:
    rec.errorName/errorMessage ← e.name / e.message (raw here;
      scrubbed at write time, §5.2)
    await _recordDrivePass(rec)     -- record
    throw e                          -- then rethrow, unchanged (R-2)
  await _recordDrivePass(rec)        -- success path: record last
```

### 4.3 Write discipline — the recorder can never break the chain

- **Record last.** Success path: after `cache.flush()`, after
  every real effect of the pass. Throw path: from the catch,
  after the failing step, before the rethrow.
- **Record-then-rethrow (R-2 REQUIRED).** The rethrown value is
  the identical error object the drive path threw (`throw e` —
  no wrapping, no substitution). Platform alarm-retry behavior
  for a throwing handler is therefore exactly the shipped
  build's.
- **The recorder never throws.** `_recordDrivePass` wraps its
  whole body in try/catch; any failure is noted on the health
  channel (§4.4) and discarded. This mirrors the shipped
  best-effort noting discipline (`service.mjs:897`,
  `noteHaltObservation` under `try { … } catch { /* guard notes
  strictly */ }`).
- **No scheduling contact.** The recorder performs no
  `setAlarm`, no schedule-table read or write, and no `wake()`.
  The base alarm's unconditional re-arm in its `finally`
  (`coordinator.mjs:2489–2525`) has already run before the
  subclass records anything, on both paths. One `getAlarm()`
  read (for `armed_after`) is the recorder's only contact with
  the alarm API, and it is a read.

### 4.4 The recording-failure channel (refinement F-2)

A failed recording must itself be observable through a channel
that does not depend on the failed write. The recorder therefore
maintains one small object in **DO key-value storage** —
`this.state.storage.get/put` under the key
`"d6DrivePassRecorderHealth"` (constant `DRIVE_PASS_HEALTH_KEY`
in the entry; the same literal in `drivePassDiagnostics` — a
cross-part contract pinned by test T9):

```json
{ "recordingFailures": 0, "lastFailureAt": null,
  "lastFailureStep": null, "lastFailureName": null,
  "lastRecordedAt": null }
```

- On any recorder-step failure (DDL, serialize, insert, prune):
  best-effort read-modify-write incrementing `recordingFailures`
  and stamping `lastFailureAt` (recorder clock), `lastFailureStep`
  (`"ddl" | "serialize" | "insert" | "prune"`), and
  `lastFailureName` (sanitized per §5.2's error-name path,
  ≤100 chars). Before carrying a previously stored object
  forward, the writer projects it onto these five fields — a
  corrupt or foreign-written health object cannot smuggle extra
  keys or hostile values into a later write.
- On every successful record: best-effort update of
  `lastRecordedAt`.
- A `getAlarm()` readback failure is NOT a recording failure: the
  schema defines `armed_after` as nullable for exactly this case;
  the row is written with `armed_after = NULL` and the failure
  counter is untouched.
- **Precedent honesty:** the deployed parts use `state.storage`
  for `.sql`, `transactionSync`, `setAlarm`, and `getAlarm`
  (`coordinator.mjs:359, 391, 2462, 2481`) — but NO part currently
  uses the key-value `get/put` facet. This spec introduces its
  first use. It is the same platform storage object, and it is
  the only channel on that object whose failure modes are
  independent of the SQL layer (a second SQL table would fail
  together with the first under a SQL-layer fault — the failure
  mode that matters most here). The test harness's storage fake
  must be extended with async `get/put` (§9, T1); that extension
  is test-tree work, not a production part.
- **Residual blind spot, stated plainly:** if a pass's SQL write
  AND its health note both fail (e.g. the DO's storage is wholly
  faulting at that instant), that pass's recording failure leaves
  no trace in either channel. Two things bound the damage: such a
  storage fault would simultaneously break the coordinator's own
  writes and the ordinary read surfaces (independently
  observable), and §8.4's interpretation matrix classifies
  "no rows + no health object" as INCONCLUSIVE — consistent with
  H1 but never proof of it, and never read as proof of anything
  beyond "the handler has not observably run." The distinction F-2
  requires is preserved in every state where at least one
  channel works — which includes the entire realistic failure
  space of the recorder itself (a bug in the DDL, the insert, or
  the prune cannot take down the KV note).

## 5. Sanitization (refinement F-1, as amended by correction C5)

Sanitization is **two-layered**. The primary layer is at **write
time**, inside the recorder: the recorder is the table's only
writer — no other code path in the diff inserts into
`d6_drive_passes` — so the stored form is safe by construction
(§5.1–§5.3). The second layer, added by correction C5, is
**read-side revalidation** (§5.5): the read surface does NOT
trust storage. A corrupt or foreign-written row — or a corrupt
health object — must not let raw stored content escape through
the diagnostics surface, so every stored value is re-validated
before it is returned, and the former "parsed where it parses,
raw otherwise" fallback is **abolished**: the raw stored string
is never returned, under any circumstances. The shipped precedent
for the projection shape is `sanitizeDiagnosticDetail`
(`service.mjs:1428–1442`): an allowlist projection over a fixed
key set with per-string bounds, under the stated rationale that
"segment text or any other stored field can never ride this
surface, whatever a detail payload holds" (`service.mjs:1410–1414`
comment). This spec applies that discipline at BOTH boundaries,
which is stronger than either alone: the unsanitized value never
reaches durable storage, and a value that somehow reached storage
unsanitized still cannot leave through the read.

### 5.1 Outcomes allowlist (exact)

Per-plan outcome objects (`service.mjs:928–1046`) are projected
onto exactly these keys, and only scalar values
(string/number/boolean) survive:

```
planId, state, stopReason, grantId, grantRefused, skipped,
quarantined, approvalRequired, quarantineCheckFailed, advanced
```

These are plan ids, state names, and reason codes — internal
identifiers and code vocabulary already exposed on the operator
diagnostics surface today. No other key survives, whatever a
future `driveOnce` grows: segment text, occurrence payloads,
provider data, and detail JSON have no path in.

The binding-projection entry is projected onto its numeric
tallies only (`scanned, published, noop, conflicts, pending` —
the exact return shape of `reconcileBindingProjections`,
`binding-projection.mjs:240–243`). Its error variant
(`{ bindingProjectionError: <raw error string> }`,
`service.mjs:1043–1045`) is recorded as
`{ "bindingProjectionError": true }` — presence only; the raw
sweep error string is deliberately NOT recorded. (The row's own
error fields are the exception channel, and they belong to the
handler's throw, which is the datum the investigation needs; a
sweep error rides a pass that otherwise completed, and its
existence — not its text — is what a reader needs. If Rowan wants
the sweep error scrubbed-and-kept instead, that is a one-line
change to the projector, flagged here as the single judgment call
in this section.)

String values in allowlisted fields pass through the
**grammar-or-scrub discipline** (§5.1a) and are capped at 200
chars (`DRIVE_PASS_FIELD_CAP`); any slice sets `fieldsSliced`
and any scrubbing sets `fieldsScrubbed`, both reported by the
truncation marker (§5.3), and either sets
`outcomes_truncated = 1`.

### 5.1a String discipline for allowlisted outcome fields (C5)

Every allowlisted outcome string is stored via exactly one of
two paths, so the stored form is safe **by construction**, even
for adversarial values:

- **Grammar path.** `planId` and `grantId` are machine
  identifiers from closed alphabets the shipped code itself
  generates (`plan:<hex>`; `grant:<jobId>:<revision>:full|probe`
  — `coordinator.mjs:1696`). A value matching its field's
  grammar (`/^plan:[A-Za-z0-9_-]+$/`,
  `/^grant:[A-Za-z0-9_:\-.]+$/`) cannot contain whitespace,
  control characters, or a URL — the alphabets exclude `/`,
  spaces, and every control character — so it is stored as-is,
  length-capped. `state` / `stopReason` / `grantRefused` /
  `skipped` are code vocabulary (lowercase snake_case constants
  from the shipped stop maps, state writes, and guard reasons):
  a value matching `/^[a-z0-9_]+$/` is such a token by shape and
  is likewise stored as-is, length-capped. (The token grammar is
  deliberately NOT the prose scrub for these fields: legitimate
  vocabulary such as `phase_halted_unknown_billing` is a single
  ≥24-char identifier run, and redacting it would destroy the
  datum. A lowercase snake token carries no URL structure, no
  whitespace, and no control characters by construction.)
- **Scrub path.** A value that does NOT match its field's
  grammar is not an identifier or a code token at all — it is
  hostile or corrupt free text, and takes the full prose scrub
  (§5.2's `scrubDrivePassText`): control characters flattened,
  URL-shaped runs replaced with `[url]`, ≥24-char
  identifier-shaped runs replaced with `[redacted]`, capped at
  200 chars. Scrubbing sets `fieldsScrubbed`, disclosed in the
  marker — the record never pretends to be a naive copy.

### 5.2 Error fields (exact scrub)

Only `e.name` and `e.message` are ever read from a thrown error —
never `.stack`, never any other property. They take **different
paths**, because they are different kinds of value:

- **The NAME path** (`error_name`, and the health channel's
  `lastFailureName`): an error name is a bare class identifier
  (`Error`, `SqliteError`, `ProductionR2NamespaceError`). A value
  matching `/^[A-Za-z_$][A-Za-z0-9_$]*$/` cannot contain a URL,
  whitespace, or control characters, so it is stored as-is,
  capped at 100 chars. A non-identifier name takes the prose
  scrub below. (Battery finding that forced this path: the prose
  scrub's ≥24-char redaction reduced
  `ProductionR2NamespaceError` — 25 chars — to `[redacted]`,
  destroying exactly the datum the recorder exists to surface.
  T3(iib) pins the corrected behavior.)
- **The prose scrub** (`error_message`, cap 500 — the 500
  precedent is `sanitizeDiagnosticDetail`'s slice), via
  `scrubDrivePassText(value, cap)`:

1. Non-strings and empty strings → NULL.
2. Control characters (U+0000–U+001F, U+007F) flattened to spaces
   (no newlines can smuggle structure into a stored field).
3. URL-shaped runs (`http://…` / `https://…` through the next
   whitespace) replaced with `[url]`.
4. Identifier-shaped runs of ≥24 chars from `[A-Za-z0-9_-]`
   replaced with `[redacted]` — this catches UUIDs, tokens, and
   request ids embedded in messages. Accepted cost, stated
   plainly: a benign long identifier in a message (e.g. an
   attempt id in the adjudication error at `service.mjs:1552–1553`)
   is also redacted; the error's prose — what names the failing
   site — survives intact.
5. Trimmed; sliced to the cap.

### 5.3 Truncation (ruling R-6)

Serialization order: project (§5.1) → `JSON.stringify` → if the
result exceeds 8,000 chars (or any field was sliced or scrubbed),
truncate at **entry granularity**: whole entries are kept from
the front (drive order — `driveOnce` selects plans by
`created_at`, so the earliest-selected plan's outcome, the most
diagnostic, is kept first); the first entry that would cross the
cap and everything after it is dropped; a terminal marker entry
is appended:

```json
{ "truncated": { "keptEntries": 3, "droppedEntries": 57,
                 "fieldsSliced": false, "fieldsScrubbed": false } }
```

and `outcomes_truncated` is set to 1. The invariant is exact:
`outcomes_truncated` is 1 **exactly when** a marker is present,
and the marker always discloses slicing and scrubbing — the
stored form is never a silently altered copy of the outcomes
array. The stored value is always
valid JSON (never a mid-string slice). Bound argument: after the
200-char field cap, one entry is at most ~2.3 KB (10 keys +
string caps + JSON overhead), so at least one whole entry plus
the marker always fits under 8,000 — truncation always
terminates with ≥1 real entry. Production currently has exactly
one selectable plan, so the cap is not expected to bind at all;
it exists for pathological plan counts.

### 5.4 Pre-write assertion (test-side)

Test group T5 (§9) scans every stored row the battery produces —
including rows written from deliberately poisoned outcomes and
errors — for forbidden patterns (URL schemes, ≥24-char
identifier runs in the error fields, stack-trace markers,
non-allowlisted keys in parsed outcomes) and fails on any hit.
This is the enforcement that the allowlist in §5.1 is complete
against the real `driveOnce` output shape, not just against the
fixtures. As amended by C5, T5 also covers the READ side (§5.5):
rows and a health object are written DIRECTLY into storage in
hostile form (malformed JSON, valid JSON with non-allowlisted
keys, URL/token-shaped strings, oversized strings,
unicode/control characters, an out-of-vocabulary stage, a health
object carrying smuggled keys), and the read's response is
scanned end-to-end: no raw stored content may appear anywhere in
it.

### 5.5 Read-side revalidation (correction C5)

The read path (`drivePassDiagnostics`) never returns a stored
value it has not re-validated. The key lists, grammars,
vocabularies, and caps below are local copies of the recorder's
— a second cross-part contract beside the health-key literal,
pinned by the battery's hostile-storage cases (T5) and the
round-trip identity for clean rows (T9):

- **`outcomes_json` that does not parse, or parses to a
  non-array:** `outcomes` is `null` and the pass carries
  `outcomesMalformed: true`. There is **no raw fallback** — the
  response shape contains no field that can carry the stored
  string (the original draft's `outcomesRaw` is removed).
- **A parsed outcomes array** is re-projected through the read
  side's own copy of the §5.1 allowlist and §5.1a string
  discipline (sweep tallies numeric-only; the sweep-error entry
  a presence flag; the truncation marker re-validated field by
  field). If re-projection changes the value, the pass carries
  `outcomesRevalidated: true`. For rows the recorder itself
  wrote, re-projection is the identity — T9 asserts
  `outcomesRevalidated: false` and byte-equal outcomes on clean
  rows, so the defense layer is invisible in the normal case.
- **`stage`** is checked against the six-value vocabulary
  (`base_alarm | construct | recover | drive | flush |
  complete`); anything else is returned as `"unrecognized"`.
- **`error_name` / `error_message`** are re-sanitized on read
  (name path / prose scrub, §5.2, at the same caps); numeric
  fields are returned only when finite numbers, else `null`.
- **`recorderHealth`** is projected onto its five known fields
  with per-field type checks (failure step checked against
  `ddl | serialize | insert | prune`; `lastFailureName` through
  the name path). Extra stored keys never reach the response.

## 6. Clock seam (ruling R-4)

`_drivePassNow()` on the class:

```js
typeof this.env.now === "function" ? this.env.now() : Date.now()
```

— the identical idiom to `GenerationCoordinator._now()`
(`coordinator.mjs:384`). The coordinator's env in the subclass
alarm is `d6HostEnv(this.env, cache)`, a spread of the class env;
the recorder reads the class env directly. In production the
platform env carries no `now` function, so the recorder's clock
is `Date.now()` — unchanged production semantics. In the test
harness, `env.now` is the fake clock (the do-harness pattern,
§9), making `at`, `finished_at`, and the health timestamps
exactly assertable. All three timestamps in a record use this
one seam; no other clock is consulted.

## 7. Overhead: retry bursts, pruning, storage bound (refinement F-3)

All figures in this section are **estimates** derived from the
shipped constants and the outcome-object shape; no instrumented
pass has ever run, so nothing here is measured.

**Per-pass write inventory** (appended after all drive work):
1 DDL exec (`IF NOT EXISTS` — a catalog no-op after the first
pass), 1 `getAlarm()` read, 1 INSERT, 1 prune DELETE, 1 KV
`get` + 1 KV `put` (the health note). In steady state the prune
deletes exactly the rows above the cap (normally 1). The prune's
subquery is a bounded walk of the INTEGER PRIMARY KEY (≤289 ids);
the DELETE touches only above-cap rows. No other storage is
touched by the recorder.

**Retry bursts.** Per Cloudflare's documented alarm semantics as
recorded in the diagnostic report §0/§10 (documentation, not
observation of this DO): a throwing alarm invocation is retried
with backoff, at most 6 retries. Each retry is a full handler
invocation and writes its own row, so one persistently throwing
due alarm can add up to 7 rows within minutes. If EVERY watchdog
cycle threw persistently: ~42 rows/hour attempted, and the
288-row retained window would cover ~6.9 hours of wall time
(arithmetic on the cap, not a duration promise). In the expected
held-and-healthy state: ~6 rows/hour, 288 rows ≈ ~48 hours. The
count cap holds in all cases: storage is bounded by rows, not by
rate.

**Row size and total bound.** Typical row (current production
shape — one selectable plan plus the sweep entry): outcomes JSON
an estimated 150–450 chars; total row an estimated 0.3–0.7 KB.
Worst-case row: outcomes at the 8,000-char cap + a 500-char error
+ names/numbers → ≤ ~8.7 KB. **Table bound at the cap: 288 ×
8.7 KB ≈ ≤ 2.5 MB absolute worst case; realistically ≈ ≤ 200 KB.**
Plus one health object (<300 bytes). Both are immaterial against
the coordinator store's existing contents, and the worst case is
a hard arithmetic bound from the cap, not a projection.

**Timing.** The recorder's work is a handful of SQLite/KV
operations appended to each alarm invocation, after the drive
work completes (or fails). It cannot influence scheduling
decisions (it reads no schedule state and writes none; §4.3).
The one honest residual is microseconds-to-milliseconds of extra
handler time per pass — named in the design §4 and unchanged
here.

## 8. The read surface

### 8.1 Route and fences (unchanged)

`GET /v2/d6-diagnostics` — the shipped operator surface. The
public entry applies the production gate + operator admission
and stamps `x-opalreader-operator-admitted: 1` on the forward;
the class gate requires the stamp (else HTTP 403
`migration_operator_required`). This diff adds `"drive"` to the
forwarded-parameter whitelist (entry, one token) and a dispatch
branch in the class-gate handler: the presence of a `drive`
parameter (any value) routes to `drivePassDiagnostics` instead
of `attemptDiagnostics`, passing `drive, planId, jobId, limit,
cursor` through for validation. No new route, credential, or
fence class; the client build has no path to this surface.

### 8.2 Mode validation (ruling R-5, exact behavior)

`drivePassDiagnostics` rejects — returning
`{ "outcome": "rejected", "reason": "diagnostics_mode_ambiguous" }`,
which the class gate's existing tail maps to **HTTP 400** — in
every case except the single unambiguous one:

| Request | Result |
|---|---|
| `?drive=1` (optionally `&limit=n`) | the drive-pass read (200) |
| `?drive=1&planId=…` / `&jobId=…` / `&cursor=…` | 400 `diagnostics_mode_ambiguous` |
| `?drive=0`, `?drive=true`, `?drive=` (any value ≠ `"1"`) | 400 `diagnostics_mode_ambiguous` |
| no `drive` parameter (with/without a target) | `attemptDiagnostics`, exactly as shipped (including its own `diagnostics_target_required` rejection) |

The modes never blend: a drive response contains no attempt
data, and an attempt response is byte-for-byte the shipped one.

### 8.3 Parameters and response (exact)

`limit`: default 50; non-numeric → default; clamped to 1..288
(the `attemptDiagnostics` clamp idiom, `service.mjs:1449`,
widened to the retention cap). No cursor in drive mode (a cursor
parameter is a mode violation, §8.2); the read is newest-first
by row id, and the retention window bounds its size.

Response (HTTP 200) shape, exactly as the diff returns it:

```json
{
  "mode": "drive_passes",
  "found": true,
  "tableState": "populated",
  "drivePasses": [
    { "id": 12, "at": 1793587200000, "finishedAt": 1793587200003,
      "stage": "complete", "driveInvoked": true,
      "outcomes": [ …projected outcome objects… ],
      "outcomesMalformed": false, "outcomesRevalidated": false,
      "outcomesTruncated": false,
      "errorName": null, "errorMessage": null,
      "armedAfter": 1793587800000 }
  ],
  "alarm": { "armedAt": 1793587800000,
             "pendingSchedule": 3, "pendingWatchdog": 1 },
  "recorderHealth": { "recordingFailures": 0,
    "lastFailureAt": null, "lastFailureStep": null,
    "lastFailureName": null, "lastRecordedAt": 1793587200003 },
  "asOf": 1793587205000
}
```

- `outcomes` is the stored JSON parsed AND re-validated (§5.5).
  If a stored value fails to parse, or parses to a non-array,
  `outcomes` is null and `outcomesMalformed` is true — the raw
  stored string is NEVER returned (the original draft's
  `outcomesRaw` fallback is abolished by correction C5: a corrupt
  row is reported as malformed, not echoed). If re-validation
  altered a parsed value, `outcomesRevalidated` is true.
- `alarm.armedAt` is a live `getAlarm()` at read time (null if
  that read fails); `pendingSchedule` / `pendingWatchdog` are
  `COUNT(*)` over the coordinator's `schedule` table
  (`coordinator.mjs:181–184`; the watchdog-count idiom at
  `coordinator.mjs:2470`).
- `recorderHealth` is the §4.4 object **as re-validated on read**
  (§5.5: projected onto its five known fields), or null when the
  KV read fails or the key was never written.
- `asOf` is `coord._now()` (the sibling-read idiom,
  `service.mjs:1249`).
- **Read-only discipline:** the method performs SELECTs, one
  `getAlarm()`, and one storage `get`. It creates nothing (a
  missing table is reported, §8.4 — the read does NOT run the
  DDL), and no `wake()` is reachable from it.

### 8.4 `tableState` and the interpretation matrix (refinement F-2)

`tableState` is `"missing"` when the SELECT fails with a
no-such-table error (the `quarantineHoldRowSafe` discipline,
`quarantine.mjs:124–149`, via the newly imported
`isNoSuchTableError`; any other error is rethrown and surfaces
as a fault, never as a state), `"empty"` when the table exists
with zero rows, `"populated"` otherwise.

| `tableState` | `recorderHealth` | Reading |
|---|---|---|
| `missing` | null | **INCONCLUSIVE — consistent with H1 but not proof of it.** The handler has not observably run since the instrumented build deployed (no record, no failure note). The same absence is produced by (a) the chain not delivering invocations (H1), (b) every pass failing BOTH channels — the SQL write and the KV health note together (which would coincide with storage faults visible on other surfaces), and (c) a constructor/platform failure before handler invocation, which leaves no trace in either channel (§10.2). Never read as proof of any one of these alone. |
| `missing` | `recordingFailures > 0` | The handler IS running; recording is failing at or before the table write; `lastFailureStep` names where. **Absent execution is excluded.** |
| `empty` | any | The table exists, so the recorder's DDL has succeeded at least once — the handler HAS run since deploy (the recorder is the table's only creator). Zero rows with a created table means every insert since has failed or been pruned — but the prune never empties the table, so `empty` + `recordingFailures = 0` is an anomaly to report, not interpret. |
| `populated` | any | Normal. `recordingFailures > 0` alongside rows means recording failed on some passes and succeeded on others; the failure count plus gaps in the `at` cadence bound how many passes were lost. |
| `populated` | null | Rows are accruing but the health channel itself has never been written — the KV facet specifically is failing while SQL works. A channel fault, reported as such; it does not cloud the rows' evidence. |
| `missing` | `lastRecordedAt` set, `recordingFailures = 0` | Contradictory on its face (a successful record implies the table exists; nothing ever drops it). Report as an anomaly; do not interpret. |

### 8.5 Capture success vs coordinator health (correction C4)

A populated read proves something about the **recorder**; it
proves much less, by itself, about the **coordinator**. The two
must never be conflated — in particular, an error-stage row is a
SUCCESSFUL diagnostic capture of an unhealthy pass, not a failed
instrument, and a recorder-health failure says nothing about
whether drive passes ran well or badly. Post-deploy readings are
classified with this table; the disposition step is named and
mandatory:

| Observation | What it proves about the RECORDER | What it does / doesn't say about the COORDINATOR | Disposition |
|---|---|---|---|
| Row with `stage = "complete"`, no error fields | Capture worked for that pass | The pass ran end-to-end; its outcomes are the coordinator evidence | Read the outcomes; no action |
| Row with an error stage (`base_alarm` / `construct` / `recover` / `drive` / `flush`) | Capture worked — the recorder recorded a throwing pass and the handler rethrew the identical error | The pass FAILED at the named stage; the error fields are the coordinator evidence. This is a finding about the coordinator, NOT a recorder failure and NOT, by itself, a deploy failure | **Executor reports the row verbatim; Rowan classifies** (pre-existing coordinator fault vs build-attributable change — gate RB-1 turns on that classification, and the executor never makes it alone) |
| `recordingFailures > 0` (health channel) | The recorder failed to write on that many passes, at the named steps | Nothing, directly: the coordinator may have run perfectly while its passes went unrecorded. The count + `at` cadence gaps bound how much observation was lost | **Executor reports; Rowan classifies** (recorder defect vs platform storage fault). Not a deploy failure by itself |
| Rows present but a pass's `outcomesMalformed` / `outcomesRevalidated` is set | The read-side revalidation (§5.5) caught a stored value the recorder would not have written | Evidence of storage corruption or a foreign writer — a platform/storage finding, not a coordinator-behavior finding | **Executor reports; Rowan classifies** |
| No rows + no health object | Nothing about the recorder can be told (it may never have run, or both its channels failed) | **INCONCLUSIVE** — consistent with H1 (no delivery) but not proof; the dual-channel-failure and pre-handler possibilities stand (§8.4) | Report as inconclusive; the gate leaves the instrument in place (gate §6 V5) |

## 9. Test plan — EXECUTED in this amendment (correction C6)

**This battery has been run.** Executed against the exact
candidate tree of this amendment (the §9.0 assembly: all 31
`parts-e0` parts with the two amended parts replaced), on
2026-11-02: **32 tests, 32 pass, 0 fail, exit code 0.** The full
log is preserved at `instrumentation-spec/BATTERY-RUN-LOG.txt`
(SHA-256 `1fcacefa8e60062a87e9a3ecff47a59667346a1450d9282daf818bffbb85c2ce`);
the harness and battery sources are preserved beside it
(`instrumentation-spec/tests/harness.mjs`,
`instrumentation-spec/tests/battery.test.mjs`) so the run is
replayable from the record. The companion gate's build stage
still re-verifies assembly + identity (its B1–B3) before any
upload; this execution is the evidence Rowan's correction
required BEFORE deployment could be considered — syntax checks
and the patch round-trip alone were explicitly insufficient, and
they are not what is reported here. Pass criteria are stated per
group; the gate's STOP conditions treat any failure, and any
incomplete log, as a stop.

Two group texts below differ from the original draft because the
EXECUTION corrected them (the battery is the authority; the
changes are also listed in the amendment notes): T3(ii)'s stage
boundary (a cache-construction fault present from the start is
recorded at `base_alarm`, because the base alarm constructs the
cache first) and T4's `getAlarm` case (the shipped coordinator
itself reads `getAlarm` on the grant path, so that fault fails
the pass at the drive stage — the recorder's guarantees, not
alarm resolution, are what that case pins).

### 9.0 Why the battery runs against the candidate tree (and what "candidate tree" means)

The candidate tree is assembled by copying all 31 parts from
`parts-e0/` into a scratch worker tree (preserving the `v2/…`
relative layout, so the parts' relative imports resolve exactly
as deployed) and applying Appendix A. The only other complete
tree in the workspace, `~/workspace/d6-build/impl/` with its
suites, is **verified divergent** from build `1c2d1d0f`
(diagnostic report §0: 12 modules match, 12 differ, 7 deployed
modules absent) — a green battery there would prove nothing
about the deployed code. The harness pattern the battery uses is
the program's existing one (`tests/helpers/do-harness.mjs` in
the worker-build trees): a Durable-Object-shaped runtime over
REAL SQLite (`node:sqlite`), a `SqlCursor` whose `.one()` THROWS
on empty/multiple results (production semantics), a fake clock
via `env.now`, async `setAlarm`/`getAlarm`, and crash =
discarding the instance while keeping storage. Import paths are
adapted to the candidate tree's layout; the harness's semantics
are not changed.

**Named harness extensions the battery requires** (test-tree
work only; no production part is touched):

1. The fake `state.storage` gains async `get`/`put` over a Map
   (the shipped fake has no KV facet; §4.4 introduces its first
   production use).
2. An entry-class instantiation path: `OpalReaderCoordinatorProd`
   constructed over the fake state, with a stub
   `OPALREADER_STORAGE` binding (an in-memory R2 fake sufficient
   for `_cache()`: the alarm path constructs the cache but, while
   halted, performs no audio reads on the seeded scenarios) and
   no queue binding (so `d6HostEnv` wires no `sendGrant` —
   matching production HELD exactly).
3. A statement-matching fault-injection wrapper around the fake
   `storage.sql` (throws a chosen error when the SQL matches a
   chosen pattern), plus fault switches on `storage.getAlarm`,
   `storage.get`, and `storage.put`. This is how T3/T4 inject
   failures at exact steps.

**What remains untestable locally, named plainly:** real alarm
DELIVERY (the harness invokes `alarm()` directly — delivery is
the platform's, and it is the very thing under investigation);
real-DO behavior beyond the harness's documented fidelity (its
`.one()` throw semantics are pinned, but it is not the
platform); the 1101-class instantiation faults; and every
dashboard/API surface. The battery proves the CODE's behavior
under invoked alarms and injected faults. It cannot and does not
claim to prove the platform will deliver alarms.

### T0 — Assembly and identity

Assemble the candidate tree per §9.0; verify: 29 parts
byte-identical to `parts-e0/`; the 2 edited parts hash to §2.2's
candidate SHA-256s; part count still 31; both edited parts pass
a module-syntax parse. **Pass:** all hashes and counts exact.

### T1 — Harness bring-up

With the §9.0 extensions: construct the entry class over (a) an
empty store and (b) a store seeded to the attempt-3 closing
shape (the preserved Phase B plan active/queued with its single
pending occurrence, the parked job, the four baseline conflicts,
phase accounting at the attempt-3 figures — structural seeding
from the execution record, no production data copied). **Pass:**
construction succeeds on both; `ensureGenSchema` + the shipped
schema bootstrap complete with no `.one()` deadlock (the
P8-class hazard, exercised deliberately on the empty store).

### T2 — Normal recording

Seeded store (b), halt on. Invoke `alarm()` 6 times, advancing
the fake clock 10 minutes between invocations. **Pass:** exactly
6 rows; every row `stage = "complete"`; `drive_invoked = 1`;
`at`/`finished_at` equal the fake-clock values (the clock seam,
R-4 — and, in a variant run without `env.now`, `at` tracks wall
`Date.now()`); `outcomes` equal `driveOnce`'s actual return
projected through §5.1 (compared against the return of a
`driveOnce()` call on an identically seeded shadow store driven
through the same base-alarm + recover composition the class
alarm performs, since the class discards the return by design);
`armed_after` equals the harness's armed value after each pass;
plan/job/quota state after each pass identical to the unmodified
build's on the twin store; health shows `recordingFailures = 0`
and `lastRecordedAt` advancing. (Executed: pass 1's recorded
outcomes include the preserved-plan-shaped grant issuance —
`grantId` present, exactly the §7.3-of-the-gate transition —
observed live in the harness.)

### T3 — Stage capture + record-then-rethrow (R-2, F-4)

On twin seeded stores (candidate vs unmodified parts), inject
one drive-path throw per run: (i) in the base alarm's schedule
processing, (ii) in `_cache()` construction, (iii) in `recover()`
(fault on its scan), (iv) in `driveOnce()` (fault on the
`d6_plans` select). **Pass, per run:** `alarm()` rethrows the
IDENTICAL error object injected (`===`); exactly one row, with
`stage` = `base_alarm` / `construct` / `recover` / `drive`
respectively, the injected error's scrubbed name/message, and
`drive_invoked` = 1 only in run (iv); all durable state
transitions (plan states, schedule rows, conflicts, quota)
identical between candidate and unmodified runs — including the
base chain's re-arm behavior (the harness's armed value after a
throwing pass matches the unmodified build's).

**Executed-shape note for (ii)** (battery-established, firsthand
from the shipped composition): the base alarm
(`OpalReaderCoordinator.alarm`, `worker-entry.js:270`) constructs
the cache FIRST, inside `super.alarm()` — so a cache-namespace
fault present from the start is recorded at stage `base_alarm`
with the construction error's name (`ProductionR2NamespaceError`),
and the battery asserts exactly that (T3(iib)). The `construct`
stage names the SUBCLASS's own construction step, which runs
after `super.alarm()` returns; the battery exercises it with a
fault that arrives between the two constructions (T3(ii)). Both
rows are successful captures of a construction failure; the stage
records WHERE in the composition the pass died, which is the
datum the stage field exists to provide.

### T4 — Recorder-step failure injection (F-4)

Drive path healthy; inject one recorder fault per run: DDL
(fault on `CREATE TABLE … d6_drive_passes`), insert (fault on
`INSERT INTO d6_drive_passes`), prune (fault on the prune
DELETE), `getAlarm` (storage.getAlarm throws), health `put`
throws, health `get` throws. **Pass, per run (recorder-step
faults — DDL / insert / prune / health get / health put):**
`alarm()` RESOLVES (never throws) and every drive-path effect is
identical to the no-fault baseline (T2's twin comparison); for
DDL/insert/prune faults, the health object shows
`recordingFailures` incremented by exactly 1 with the correct
`lastFailureStep` (`"ddl"` / `"insert"` / `"prune"`); for the
prune fault, the row IS present (insert succeeded) and the table
sits above cap until a later healthy pass prunes it back to
exactly 288-or-fewer; for health-channel faults, recording
itself is unaffected (rows accrue) and the next healthy pass's
health note lands (the channel self-heals); a serialization case
is covered by injecting a throw inside the serialize step at the
wrapper level (a throwing outcomes getter): the catch discipline
names it `"serialize"`, increments the health counter, and the
record call returns without throwing. (The projected structure
is plain scalars by construction, so `JSON.stringify` has no
production failure mode — stated plainly.)

**The `getAlarm` case is the named exception, corrected by
execution.** The shipped coordinator itself reads
`storage.getAlarm()` — `GenerationCoordinator._armAlarmIfEarlier`
(`coordinator.mjs:2481`), called from `requestGrant`'s `wake()`
on the grant path inside `driveOnce`. A `getAlarm` fault
therefore does NOT leave the alarm resolvable: the pass fails at
the **drive** stage (the grant step's wake throws before
issuance — no grant, no spend), `alarm()` rethrows the identical
injected object, and the recorder's guarantees are what the case
pins: the row IS written, with `armed_after` NULL (the recorder's
own read is isolated in its own try/catch), and
`recordingFailures` is NOT incremented. The original draft's
blanket "alarm resolves" wording for this sub-case was falsified
by the shipped code's own `getAlarm` use; the recorder never
breaking the alarm is a guarantee about RECORDER steps, and it
holds for every one of them.

### T5 — Sanitization (F-1)

Unit level: `projectDrivePassOutcomes` / `serializeDrivePassOutcomes`
/ `scrubDrivePassText` against hostile inputs — exercised through
the recorder method that owns them (they are module-private by
design; `_recordDrivePass` is the unit boundary) — outcomes carrying
extra keys (a segment-text-shaped field, a detail payload with a
URL and a token), a `bindingProjectionError` whose string is a
URL + token, allowlisted string fields of 10,000 chars, error
messages containing URLs, a 36-char UUID, control characters, a
5,000-char message, an error object with a crafted `.stack` and
extra properties. Integration level: a twin-store pass whose
`driveOnce` is made (via seeded state) to emit the widest real
outcome shape. **Pass:** stored rows contain ONLY allowlisted
keys; the sweep error string never appears (presence flag only);
no stored field matches /https?:\/\//; `error_message` contains
no ≥24-char identifier run outside the `[redacted]` marker and
no stack content; `error_name` is either a grammatical class
identifier stored exactly (the §5.2 name path — long real names
such as `ProductionR2NamespaceError` MUST survive) or scrubbed
to the same standard as the message; `error_message` ≤ 500
chars, `error_name` ≤ 100; sliced fields are flagged
(`fieldsSliced` → marker + `outcomes_truncated = 1`), scrubbed
fields likewise (`fieldsScrubbed`); grammatical identifiers
(plan/grant ids, code tokens) are stored byte-exact with NO
marker (T5b); the forbidden-pattern scan over ALL stored rows in
the battery is clean.

**Read-side hostile storage (C5, §5.5):** rows are inserted
DIRECTLY into `d6_drive_passes`, bypassing the recorder —
malformed JSON in `outcomes_json` (including a URL + token
embedded in the malformed text), valid JSON carrying
non-allowlisted keys and a URL-shaped `planId`, valid JSON that
is not an array, an out-of-vocabulary `stage`, hostile
`error_name` / `error_message` — plus a health object carrying
smuggled keys and hostile field values. **Pass:** the read
returns `outcomes: null` + `outcomesMalformed: true` for the
malformed rows (and NO field anywhere in the response carries
raw stored content — the response shape has no raw fallback);
the valid-but-hostile row is re-projected (extra keys gone,
URL-shaped values scrubbed) with `outcomesRevalidated: true`;
the stage reads `"unrecognized"`; the health object is returned
as exactly its five known fields, projected and scrubbed.

### T6 — Truncation at the cap (R-6)

Fabricate outcomes of 60 synthetic plan entries (via direct
recorder calls with constructed outcome arrays). **Pass:**
stored `outcomes_json` ≤ 8,000 chars; parses as JSON; the final
entry is the truncation marker with exact kept/dropped counts;
kept entries are the FIRST entries, whole, in order;
`outcomes_truncated = 1`. Boundary cases: an outcomes array
whose projection is exactly ≤ 8,000 stores untruncated with flag
0; a single maximal entry (≈2.3 KB by construction) always fits
with the marker — asserted, not assumed.

### T7 — Mode rejection (R-5)

Call the class-gate diagnostics handler (operator stamp present)
and `drivePassDiagnostics` directly with: `drive=1` alone;
`drive=1` + planId; `drive=1` + jobId; `drive=1` + cursor;
`drive=1` REPEATED (`drive=1&drive=1` — through the full public
route, whose forward copies parameters singly; the forward must
carry the repetition explicitly or the class never sees it);
`drive=0`; `drive=true`; `drive` absent + valid planId (attempt
mode); `drive` absent + no target. **Pass:** the drive-mode
combinations return exactly
`{ outcome: "rejected", reason: "diagnostics_mode_ambiguous" }`
(HTTP 400 at the handler); `drive=1` alone returns the §8.3
shape; attempt mode behaves byte-identically to the unmodified
build, including its own `diagnostics_target_required`
rejection; with the operator stamp ABSENT, both modes return
403 `migration_operator_required`, exactly as shipped.

### T8 — Retention and bursts

Drive 300 recorder records (direct `_recordDrivePass` calls and
alarm invocations mixed), then a simulated retry burst: 7
consecutive throwing passes on one due alarm. **Pass:** row
count is exactly 288 after the 300; retained ids are the newest
288 in order; the burst adds its rows and the count never
exceeds 288 at any assertion point after a completed pass;
oldest rows are dropped first.

### T9 — Round-trip + the cross-part key contract

Record passes through the entry class (healthy and
fault-injected runs from T3/T4), then read through the full
route path (public-entry forward → class gate → service) with
the operator stamp. **Pass:** the read returns exactly the
recorded rows (all fields, §8.3 shape); `recorderHealth` is the
object the recorder wrote — proving the entry's
`DRIVE_PASS_HEALTH_KEY` and the service's literal key agree;
`tableState` transitions `"missing"` (before the first pass) →
`"populated"` (after it); `alarm.armedAt` / pending counts match
the harness's storage state at read time.

### T10 — Shipped-surface equivalence smoke

Against twin stores (candidate vs unmodified parts), run a
scripted sequence of the shipped read surfaces — capabilities,
plan status (all 5 plans), eligibility (chapter + segment +
book), quota, conflicts, attempt diagnostics for the preserved
plan — and compare responses field-for-field, excluding only
`asOf`/`quotedAt` timestamps. **Pass:** identical. Named
limitation: no pre-existing regression suite corresponds to
build `1c2d1d0f` (the impl-tree suites target a divergent tree),
so this equivalence smoke plus T0–T9 ARE the battery; Rowan's
review of the actual diff is the other leg, exactly as the
diagnostic report's harness caveat prescribes.

## 10. Explicit exclusions and limitations

### 10.1 Step-0 stays separate (refinement F-5)

The step-0 procedural correction — the next generation proposal
must explicitly resolve the shipped system's inability to verify
an issued grant before unpause (diagnostic report §7; Rowan's
attempt-3 review: "Do not silently substitute a different
checkpoint") — is **out of scope** for this spec and for the
companion gate. Nothing in the diff touches grant verification,
the unpause sequence, or any generation procedure. The
instrumentation neither implements nor prejudges the correction;
it only makes future drive passes observable.

### 10.2 What this instrumentation cannot see (refinement F-6)

**Constructor/platform failures preceding handler invocation
remain unobservable.** If the platform cannot instantiate the
Durable Object (the 1101-fault mode), or never delivers the
alarm invocation at all, no handler code runs: no row, no health
note, nothing. That absence is classified **INCONCLUSIVE**
(correction C1): it is consistent with H1 (a dead alarm chain)
but it is NOT proof of H1 or of any other single cause — the
pre-handler failure and a dual-channel storage failure (§4.4)
produce the identical absence, and the instrumentation does not
and cannot name the platform-side root cause. (The disposition
consequence is unchanged: the remedy path is the same, which is
why the gate treats the no-rows outcome as a successful
observation rather than a failed gate — gate §6 V5.) Likewise,
a pass that begins after the last recorded pass and is still in
flight when the DO is evicted leaves no row for its partial
progress (recording is end-of-pass by design); and per §4.4, a
simultaneous dual-channel storage failure hides its own
recording failure. Every other stage of the shipped alarm
path — base alarm, construction, recover, drive, flush — is
observed by exactly one row per invoked pass.

### 10.3 Not in this spec

No client change; no staging change (staging runs an older,
different build and is untouched by the companion gate); no
change to the preserved Phase B plan, the idx-26 exemption, the
halt, or the queue; no generation of any kind. The deploy
itself, its census, and its verification are the companion gate
proposal's subject, not this spec's.

## Appendix A — the expected two-part diff (verbatim)

Produced as §2.3 describes; applies to the deployed parts with
`patch -p1` from the tree root (paths `v2/…`). This is the diff
the companion gate builds and hash-verifies; any byte of
difference between a built candidate and this appendix's result
is a STOP under that gate.

```diff
--- a/v2/worker-entry-prod-d6.js
+++ b/v2/worker-entry-prod-d6.js
@@ -413,6 +413,242 @@
   });
 }
 
+// PHASE B INSTRUMENTATION (P2; design
+// PHASEB-INSTRUMENTATION-DESIGN.md as approved with refinements,
+// spec PHASEB-INSTRUMENTATION-SPEC.md): one durable row per
+// subclass alarm pass, written by the recorder below, so a drive
+// stall can be told apart from a silent alarm chain. The recorder
+// is the table's ONLY writer and sanitizes at write time
+// (allowlist projection + grammar-or-scrub discipline, spec
+// §5.1–§5.2); the read surface (service.mjs
+// drivePassDiagnostics) trusts nothing it reads back and
+// re-validates every stored value before returning it (spec
+// §5.5). Nothing here changes what a pass DOES: recording is
+// last, best-effort, and a drive error is rethrown unchanged by
+// alarm() after recording, so platform alarm-retry semantics are
+// exactly the shipped ones.
+const DRIVE_PASS_SCHEMA = `
+CREATE TABLE IF NOT EXISTS d6_drive_passes (
+  id INTEGER PRIMARY KEY AUTOINCREMENT,
+  at INTEGER NOT NULL,
+  finished_at INTEGER,
+  stage TEXT NOT NULL,
+  drive_invoked INTEGER NOT NULL,
+  outcomes_json TEXT,
+  outcomes_truncated INTEGER NOT NULL DEFAULT 0,
+  error_name TEXT,
+  error_message TEXT,
+  armed_after INTEGER
+);
+`;
+// The recorder-health channel: the one record of recording ITSELF
+// failing, kept in DO key-value storage under this key — a storage
+// facet the SQL table does not share, so a SQL-layer fault cannot
+// hide its own trace. service.mjs drivePassDiagnostics reads the
+// same literal key (a cross-part contract, pinned by the spec's
+// round-trip test). Shape:
+// { recordingFailures, lastFailureAt, lastFailureStep,
+//   lastFailureName, lastRecordedAt }.
+const DRIVE_PASS_HEALTH_KEY = "d6DrivePassRecorderHealth";
+// Retention is a COUNT cap (Rowan's ruling): the newest 288 rows
+// are kept; at the 10-minute watchdog cadence that is an ESTIMATE
+// of ~2 days, never a guaranteed duration.
+const DRIVE_PASS_RETENTION = 288;
+const DRIVE_PASS_OUTCOMES_CAP = 8000; // chars, on outcomes_json
+const DRIVE_PASS_FIELD_CAP = 200;     // chars, per outcome string field
+const DRIVE_PASS_ERROR_CAP = 500;     // chars, on error_message
+const DRIVE_PASS_NAME_CAP = 100;      // chars, on error_name
+// The outcomes allowlist: exactly the scalar fields driveOnce
+// writes on its per-plan outcome objects (service.mjs driveOnce),
+// plus the binding-projection sweep's numeric tallies. Anything
+// else a future outcome grows is dropped at record time, never
+// stored — segment text, detail payloads, and provider data have
+// no path into this table.
+const DRIVE_PASS_OUTCOME_KEYS = Object.freeze([
+  "planId", "state", "stopReason", "grantId", "grantRefused",
+  "skipped", "quarantined", "approvalRequired",
+  "quarantineCheckFailed", "advanced",
+]);
+const DRIVE_PASS_SWEEP_KEYS = Object.freeze([
+  "scanned", "published", "noop", "conflicts", "pending",
+]);
+
+// Scrub one free-text field (an error name or message) for durable
+// storage: non-strings and empties become NULL; control characters
+// are flattened; URL-shaped and long identifier-shaped runs are
+// redacted (an error message in this codebase can embed a provider
+// request id or a storage detail); the result is length-bounded.
+// The diagnostic shape survives — the error's name and its prose —
+// never the raw string, and never a stack trace (only .name and
+// .message are ever passed here).
+function scrubDrivePassText(value, cap) {
+  if (typeof value !== "string" || value.length === 0) return null;
+  let s = value.replace(/[\x00-\x1f\x7f]+/g, " ");
+  s = s.replace(/https?:\/\/\S+/g, "[url]");
+  s = s.replace(/\b[A-Za-z0-9_\-]{24,}\b/g, "[redacted]");
+  s = s.trim();
+  if (s.length === 0) return null;
+  return s.length > cap ? s.slice(0, cap) : s;
+}
+
+// Write-time discipline for allowlisted outcome strings (Rowan
+// correction 5 — hostile-input coverage): a stored string is safe
+// BY CONSTRUCTION, via exactly one of two paths.
+//   * GRAMMAR path: planId / grantId are machine
+//     identifiers from closed alphabets the shipped code itself
+//     generates (`plan:<hex>`,
+//     `grant:<jobId>:<revision>:full|probe` — coordinator.mjs
+//     grant issuance). A value matching the field's
+//     grammar cannot contain whitespace, control characters, or a
+//     URL (the alphabet excludes '/', ' ', and every control), so
+//     it is stored as-is, length-capped. A value NOT matching its
+//     grammar is not an identifier at all — it is hostile or
+//     corrupt free text and takes the scrub path.
+//   * TOKEN path: state / stopReason are code vocabulary
+//     (lowercase snake_case constants from the shipped stop maps
+//     and state writes). A value matching /^[a-z0-9_]+$/ is such a
+//     token by shape and is stored as-is, length-capped; anything
+//     else takes the scrub path.
+//   * NAME path: error names (the row's error_name, the health
+//     channel's lastFailureName) are bare class identifiers
+//     (Error, SqliteError, ProductionR2NamespaceError). A value
+//     matching the identifier grammar cannot contain a URL,
+//     whitespace, or control characters, so it is stored as-is,
+//     length-capped — the prose scrub's >=24-char redaction would
+//     otherwise destroy exactly the long class names this
+//     recorder exists to surface (a battery finding: the prose
+//     scrub reduced ProductionR2NamespaceError to "[redacted]").
+//     A non-identifier name takes the scrub path.
+//   * SCRUB path: the full prose scrub (scrubDrivePassText) —
+//     control characters flattened, URL-shaped runs replaced,
+//     >=24-char identifier-shaped runs redacted, capped. Any value
+//     changed by scrubbing (or by the length cap) is reported via
+//     fieldsScrubbed / fieldsSliced so the record never pretends
+//     to be a naive copy.
+const DRIVE_PASS_PLAN_ID_GRAMMAR = /^plan:[A-Za-z0-9_-]+$/;
+const DRIVE_PASS_GRANT_ID_GRAMMAR = /^grant:[A-Za-z0-9_:\-.]+$/;
+const DRIVE_PASS_TOKEN_GRAMMAR = /^[a-z0-9_]+$/;
+
+const DRIVE_PASS_NAME_GRAMMAR = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
+
+// The NAME path for error names (see the discipline comment
+// above): identifier-grammar values are stored as-is
+// (length-capped); anything else takes the full prose scrub.
+function sanitizeDrivePassName(value) {
+  if (typeof value !== "string" || value.length === 0) return null;
+  if (DRIVE_PASS_NAME_GRAMMAR.test(value))
+    return value.length > DRIVE_PASS_NAME_CAP
+      ? value.slice(0, DRIVE_PASS_NAME_CAP) : value;
+  return scrubDrivePassText(value, DRIVE_PASS_NAME_CAP);
+}
+
+function sanitizeDrivePassOutcomeString(key, value, flags) {
+  if (value.length > DRIVE_PASS_FIELD_CAP) flags.fieldsSliced = true;
+  const grammar = key === "planId" ? DRIVE_PASS_PLAN_ID_GRAMMAR
+    : key === "grantId" ? DRIVE_PASS_GRANT_ID_GRAMMAR
+    : DRIVE_PASS_TOKEN_GRAMMAR;
+  if (grammar.test(value) && value.length <= DRIVE_PASS_FIELD_CAP)
+    return value;
+  if (grammar.test(value)) { // grammatical but oversized: cap only
+    flags.fieldsSliced = true;
+    return value.slice(0, DRIVE_PASS_FIELD_CAP);
+  }
+  const scrubbed = scrubDrivePassText(value, DRIVE_PASS_FIELD_CAP);
+  flags.fieldsScrubbed = true;
+  // scrubDrivePassText returns null only for empty-after-scrub;
+  // the stored form is the empty string in that case (the field
+  // was present; its content did not survive sanitization).
+  return scrubbed === null ? "" : scrubbed;
+}
+
+// Project driveOnce's outcomes array onto the recording allowlist.
+// Only scalar values survive; string fields pass through
+// sanitizeDrivePassOutcomeString (grammar-or-scrub, above — any
+// slicing is reported via fieldsSliced, any scrubbing via
+// fieldsScrubbed); the binding-projection entry keeps only its
+// numeric tallies, and its error variant keeps only a presence
+// flag — the raw sweep error string is NOT recorded (the row's
+// error fields are the exception channel, and they belong to the
+// handler's own throw).
+function projectDrivePassOutcomes(outcomes) {
+  if (!Array.isArray(outcomes)) return null;
+  const entries = [];
+  const flags = { fieldsSliced: false, fieldsScrubbed: false };
+  for (const entry of outcomes) {
+    if (!entry || typeof entry !== "object" || Array.isArray(entry))
+      continue;
+    if (entry.bindingProjection &&
+        typeof entry.bindingProjection === "object") {
+      const sweep = {};
+      for (const k of DRIVE_PASS_SWEEP_KEYS)
+        if (typeof entry.bindingProjection[k] === "number")
+          sweep[k] = entry.bindingProjection[k];
+      entries.push({ bindingProjection: sweep });
+      continue;
+    }
+    if ("bindingProjectionError" in entry) {
+      entries.push({ bindingProjectionError: true });
+      continue;
+    }
+    const o = {};
+    for (const k of DRIVE_PASS_OUTCOME_KEYS) {
+      const v = entry[k];
+      if (typeof v === "string")
+        o[k] = sanitizeDrivePassOutcomeString(k, v, flags);
+      else if (typeof v === "number" || typeof v === "boolean")
+        o[k] = v;
+    }
+    entries.push(o);
+  }
+  return { entries, fieldsSliced: flags.fieldsSliced,
+           fieldsScrubbed: flags.fieldsScrubbed };
+}
+
+// Serialize the projected outcomes under the 8,000-char cap with
+// EXPLICIT truncation (Rowan's condition): entries are kept whole,
+// from the front (drive order — the earliest-selected plan's
+// outcome is the most diagnostic); the first entry that would
+// cross the cap and everything after it is dropped, and a terminal
+// marker entry states exactly what was kept, what was dropped, and
+// whether any field was sliced or scrubbed. After the per-field cap
+// a single entry is ~2.3 KB worst case, so at least one whole entry
+// plus the marker always fits; the stored value is always valid JSON.
+function serializeDrivePassOutcomes(outcomes) {
+  const projected = projectDrivePassOutcomes(outcomes);
+  if (projected === null) return { json: null, truncated: 0 };
+  const full = JSON.stringify(projected.entries);
+  if (!projected.fieldsSliced && !projected.fieldsScrubbed &&
+      full.length <= DRIVE_PASS_OUTCOMES_CAP)
+    return { json: full, truncated: 0 };
+  // Entry-granular truncation (spec §5.3), also entered whenever
+  // a field was sliced or scrubbed: the marker is appended so the
+  // invariant holds — outcomes_truncated is 1 exactly when a
+  // marker is present, and the marker discloses kept/dropped
+  // counts plus slicing and scrubbing. The stored form is never
+  // a silently altered copy of the outcomes array.
+  const kept = [];
+  let dropped = 0;
+  for (let i = 0; i < projected.entries.length; i++) {
+    const marker = { truncated: {
+      keptEntries: kept.length,
+      droppedEntries: projected.entries.length - i,
+      fieldsSliced: projected.fieldsSliced,
+      fieldsScrubbed: projected.fieldsScrubbed } };
+    if (JSON.stringify([...kept, projected.entries[i], marker]).length
+        <= DRIVE_PASS_OUTCOMES_CAP) {
+      kept.push(projected.entries[i]);
+    } else {
+      dropped = projected.entries.length - i;
+      break;
+    }
+  }
+  const marker = { truncated: {
+    keptEntries: kept.length, droppedEntries: dropped,
+    fieldsSliced: projected.fieldsSliced,
+    fieldsScrubbed: projected.fieldsScrubbed } };
+  return { json: JSON.stringify([...kept, marker]), truncated: 1 };
+}
+
 // The D6 production coordinator: the EXISTING production class
 // (same export name the live script's COORDINATOR binding names),
 // carrying the D6 overrides. Continuity is the design: this class
@@ -584,13 +820,41 @@
         const cache = await this._cache();
         const coord = new GenerationCoordinator(this.state, d6HostEnv(this.env, cache));
         const limRaw = url.searchParams.get("limit");
-        const result = await d6Service(coord, d6HostEnv(this.env, cache))
-          .attemptDiagnostics({
-            planId: url.searchParams.get("planId"),
-            jobId: url.searchParams.get("jobId"),
-            limit: limRaw === null ? undefined : Number(limRaw),
-            cursor: url.searchParams.get("cursor"),
-          });
+        const service = d6Service(coord, d6HostEnv(this.env, cache));
+        // PHASE B INSTRUMENTATION (P2): the presence of a drive
+        // parameter selects the drive-pass read INSTEAD of attempt
+        // diagnostics. The service validates the mode strictly
+        // (drive must be exactly "1", and no attempt target —
+        // planId / jobId / cursor — may ride along) and rejects
+        // every ambiguous combination as diagnostics_mode_ambiguous;
+        // the modes never blend into one response. A repeated
+        // mode parameter is itself ambiguous (searchParams.get
+        // would silently take the first), so the class counts
+        // occurrences and reports them via repeatedModeParam.
+        const repeatedModeParam =
+          url.searchParams.getAll("drive").length > 1 ||
+          url.searchParams.getAll("planId").length > 1 ||
+          url.searchParams.getAll("jobId").length > 1 ||
+          url.searchParams.getAll("cursor").length > 1 ||
+          // The public entry forwards repetition on the public
+          // query explicitly (its per-parameter copy collapses
+          // repeats to the first value; see the forward site).
+          url.searchParams.get("repeated") === "1";
+        const result = url.searchParams.get("drive") !== null
+          ? await service.drivePassDiagnostics({
+              drive: url.searchParams.get("drive"),
+              planId: url.searchParams.get("planId"),
+              jobId: url.searchParams.get("jobId"),
+              limit: limRaw === null ? undefined : Number(limRaw),
+              cursor: url.searchParams.get("cursor"),
+              repeatedModeParam,
+            })
+          : await service.attemptDiagnostics({
+              planId: url.searchParams.get("planId"),
+              jobId: url.searchParams.get("jobId"),
+              limit: limRaw === null ? undefined : Number(limRaw),
+              cursor: url.searchParams.get("cursor"),
+            });
         await cache.flush();
         return result && result.outcome === "rejected"
           ? json(400, result) : json(200, result);
@@ -1452,18 +1716,148 @@
     return json(200, result);
   }
 
+  // The recorder's clock: the coordinator's own seam
+  // (GenerationCoordinator._now(), coordinator.mjs) — env.now()
+  // when a harness provides one, Date.now() in production, where
+  // the platform env carries no now function. Testable, with
+  // production semantics unchanged (Rowan's clock ruling).
+  _drivePassNow() {
+    return typeof this.env.now === "function"
+      ? this.env.now() : Date.now();
+  }
+
+  // One best-effort note on the recorder-health channel (DO
+  // key-value storage, DRIVE_PASS_HEALTH_KEY). Never throws: the
+  // channel is itself best-effort, and its failure is part of the
+  // residual blind spot the spec names (a pass whose SQL write AND
+  // health note both fail leaves no trace of its recording
+  // failure; the handler's absence is still distinguishable from a
+  // recorded failure whenever at least one channel works).
+  async _noteDrivePassHealth({ failure = null, recordedAt = null } = {}) {
+    try {
+      const rawPrev = await this.state.storage.get(DRIVE_PASS_HEALTH_KEY);
+      // Project the previously stored value onto the five known
+      // fields before carrying anything forward: a corrupt or
+      // foreign-written health object must not smuggle extra keys
+      // (or hostile values) into this write.
+      const prev = (rawPrev && typeof rawPrev === "object" &&
+                    !Array.isArray(rawPrev)) ? rawPrev : {};
+      const health = {
+        recordingFailures:
+          typeof prev.recordingFailures === "number" &&
+          prev.recordingFailures >= 0 ? prev.recordingFailures : 0,
+        lastFailureAt:
+          typeof prev.lastFailureAt === "number" ? prev.lastFailureAt : null,
+        lastFailureStep:
+          typeof prev.lastFailureStep === "string" ? prev.lastFailureStep : null,
+        lastFailureName:
+          sanitizeDrivePassName(prev.lastFailureName),
+        lastRecordedAt:
+          typeof prev.lastRecordedAt === "number" ? prev.lastRecordedAt : null };
+      if (failure) {
+        health.recordingFailures += 1;
+        health.lastFailureAt = this._drivePassNow();
+        health.lastFailureStep = failure.step;
+        health.lastFailureName =
+          sanitizeDrivePassName(failure.name);
+      }
+      if (recordedAt !== null) health.lastRecordedAt = recordedAt;
+      await this.state.storage.put(DRIVE_PASS_HEALTH_KEY, health);
+    } catch { /* best-effort by design; see the spec §5 */ }
+  }
+
+  // Record one alarm pass in d6_drive_passes. NEVER throws: any
+  // failure of the recording steps (DDL, serialization, insert,
+  // prune) is noted on the health channel and discarded here, so a
+  // recorder fault can never break the alarm chain, mask the
+  // original drive error, or alter any outcome — the shipped
+  // best-effort noting discipline (driveOnce's noteHaltObservation
+  // call, service.mjs). The getAlarm() readback is defined as
+  // nullable (armed_after), so its failure records NULL and is NOT
+  // counted as a recording failure. The recorder performs no
+  // setAlarm, no schedule read or write, and no wake: it observes
+  // the chain and does not participate in it.
+  async _recordDrivePass(rec) {
+    let step = "ddl";
+    try {
+      const sql = this.state.storage.sql;
+      sql.exec(DRIVE_PASS_SCHEMA);
+      step = "serialize";
+      const ser = serializeDrivePassOutcomes(rec.outcomes);
+      step = "getalarm";
+      let armedAfter = null;
+      try {
+        const armed = await this.state.storage.getAlarm();
+        armedAfter = typeof armed === "number" ? armed : null;
+      } catch { armedAfter = null; }
+      step = "insert";
+      sql.exec(
+        `INSERT INTO d6_drive_passes
+           (at, finished_at, stage, drive_invoked, outcomes_json,
+            outcomes_truncated, error_name, error_message, armed_after)
+         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
+        rec.at, this._drivePassNow(), rec.stage,
+        rec.driveInvoked ? 1 : 0, ser.json, ser.truncated,
+        sanitizeDrivePassName(rec.errorName),
+        scrubDrivePassText(rec.errorMessage, DRIVE_PASS_ERROR_CAP),
+        armedAfter);
+      step = "prune";
+      sql.exec(
+        `DELETE FROM d6_drive_passes
+          WHERE id NOT IN
+            (SELECT id FROM d6_drive_passes
+              ORDER BY id DESC LIMIT ?)`,
+        DRIVE_PASS_RETENTION);
+    } catch (e) {
+      await this._noteDrivePassHealth({ failure: {
+        step, name: e && e.name ? String(e.name) : "Error" } });
+      return;
+    }
+    await this._noteDrivePassHealth(
+      { recordedAt: this._drivePassNow() });
+  }
+
   async alarm() {
     // The coordinator's own alarm first (schedule, leases, parks),
     // then the D6 driver's recovery + continuation. While halted,
     // d6HostEnv wires no sendGrant, so driveOnce can settle plan
     // state and re-derive grants but nothing can leave the outbox.
-    await super.alarm();
-    const cache = await this._cache();
-    const coord = new GenerationCoordinator(this.state, d6HostEnv(this.env, cache));
-    const service = d6Service(coord, d6HostEnv(this.env, cache));
-    await service.recover();
-    await service.driveOnce();
-    await cache.flush();
+    //
+    // PHASE B INSTRUMENTATION (P2): the pass is recorded by
+    // _recordDrivePass — the stage reached, the outcomes array
+    // driveOnce already computes (captured here, at its only
+    // caller, instead of being discarded), any throw, and the
+    // armed value read back. rec.stage names the step IN PROGRESS,
+    // so a throw records the step that threw; "complete" means the
+    // handler ran end to end. Recording is last on both paths; on
+    // a throw the ORIGINAL error is rethrown unchanged after
+    // recording (Rowan's record-then-rethrow requirement), so
+    // platform alarm-retry behavior is identical to the shipped
+    // build.
+    const rec = { at: this._drivePassNow(), stage: "base_alarm",
+      driveInvoked: 0, outcomes: null,
+      errorName: null, errorMessage: null };
+    try {
+      await super.alarm();
+      rec.stage = "construct";
+      const cache = await this._cache();
+      const coord = new GenerationCoordinator(this.state, d6HostEnv(this.env, cache));
+      const service = d6Service(coord, d6HostEnv(this.env, cache));
+      rec.stage = "recover";
+      await service.recover();
+      rec.stage = "drive";
+      rec.driveInvoked = 1;
+      rec.outcomes = await service.driveOnce();
+      rec.stage = "flush";
+      await cache.flush();
+      rec.stage = "complete";
+    } catch (e) {
+      rec.errorName = e && e.name ? String(e.name) : "Error";
+      rec.errorMessage = e && e.message ? String(e.message) : String(e);
+      await this._recordDrivePass(rec);
+      throw e;
+    }
+    await this._recordDrivePass(rec);
   }
 }
 
@@ -1713,9 +2107,18 @@
   // above; forward() stamps the admission the class gate checks).
   if (isDiagnosticsRoute) {
     const dUrl = new URL("https://do.internal/internal/d6/diagnostics");
-    for (const k of ["planId", "jobId", "limit", "cursor"])
+    for (const k of ["planId", "jobId", "limit", "cursor", "drive"])
       if (url.searchParams.get(k) !== null)
         dUrl.searchParams.set(k, url.searchParams.get(k));
+    // PHASE B INSTRUMENTATION (P2): the copy above takes each
+    // parameter singly, which would silently collapse a REPEATED
+    // parameter to its first value before the class gate could
+    // see it. Repetition of any diagnostics parameter is
+    // forwarded explicitly so the drive-mode ambiguity rejection
+    // (diagnostics_mode_ambiguous) can fire on it.
+    if (["planId", "jobId", "limit", "cursor", "drive"]
+        .some((k) => url.searchParams.getAll(k).length > 1))
+      dUrl.searchParams.set("repeated", "1");
     return forward(new Request(dUrl.toString(), { method: "GET" }));
   }
   if (request.method === "GET" && url.pathname === "/v2/d6-eligibility") {
--- a/v2/generation/service.mjs
+++ b/v2/generation/service.mjs
@@ -28,6 +28,7 @@
   ensureQuarantineSchema, quarantineHoldRow,
   quarantineHoldRowSafe, recordQuarantineHold, applyQuarantineRelease,
   quarantineView, heldQuarantineStrict, noteHaltObservation,
+  isNoSuchTableError,
 } from "./quarantine.mjs";
 import { closeReservationsForPlan } from "./quota-budget.mjs";
 
@@ -75,6 +76,125 @@
 const JOB_TERMINAL = Object.freeze(
   ["complete", "partial", "failed", "cancelled", "superseded"]);
 
+// ---- Drive-pass read-side revalidation (spec §5.5; Rowan
+// correction 5) ----
+// The recorder (worker-entry-prod-d6.js) sanitizes at write time
+// and is the table's only INTENDED writer, but this read path
+// never trusts storage: a corrupt or foreign-written row — or a
+// corrupt health object — must not let raw stored content escape
+// through the diagnostics surface. Every stored value is
+// re-validated below before it is returned:
+//   * outcomes_json that does not parse, or parses to a
+//     non-array, yields outcomes: null with outcomesMalformed:
+//     true. The raw stored string is NEVER returned (there is no
+//     raw fallback in this response shape).
+//   * a parsed outcomes array is re-projected through local
+//     copies of the recorder's allowlists and string discipline
+//     (grammar-or-scrub); if re-projection changes the value, the
+//     pass is flagged outcomesRevalidated: true.
+//   * error strings are re-scrubbed; stage and failure-step are
+//     checked against their vocabularies; the health object is
+//     projected onto its five known fields.
+// The key lists, grammars, vocabularies, and caps below duplicate
+// the recorder's as a second cross-part contract; the battery's
+// hostile-storage cases (spec §9, T5) pin both sides.
+const DP_READ_OUTCOME_KEYS = Object.freeze([
+  "planId", "state", "stopReason", "grantId", "grantRefused",
+  "skipped", "quarantined", "approvalRequired",
+  "quarantineCheckFailed", "advanced",
+]);
+const DP_READ_SWEEP_KEYS = Object.freeze([
+  "scanned", "published", "noop", "conflicts", "pending",
+]);
+const DP_READ_STAGES = new Set([
+  "base_alarm", "construct", "recover", "drive", "flush",
+  "complete",
+]);
+const DP_READ_FAILURE_STEPS = new Set([
+  "ddl", "serialize", "insert", "prune",
+]);
+const DP_READ_PLAN_ID_GRAMMAR = /^plan:[A-Za-z0-9_-]+$/;
+const DP_READ_GRANT_ID_GRAMMAR = /^grant:[A-Za-z0-9_:\-.]+$/;
+const DP_READ_TOKEN_GRAMMAR = /^[a-z0-9_]+$/;
+
+function dpReadScrub(value, cap) {
+  if (typeof value !== "string") return null;
+  const flat = value.replace(/[\u0000-\u001f\u007f]+/g, " ")
+    .replace(/https?:\/\/\S+/gi, "[url]")
+    .replace(/\b[A-Za-z0-9_\-]{24,}\b/g, "[redacted]")
+    .trim();
+  if (!flat) return null;
+  return flat.length > cap ? flat.slice(0, cap) : flat;
+}
+
+// Error names take the NAME path (the recorder's discipline,
+// mirrored): a bare class identifier cannot contain a URL,
+// whitespace, or control characters, so a grammatical name is
+// returned as-is (length-capped) — the prose scrub's >=24-char
+// redaction would destroy long class names
+// (ProductionR2NamespaceError). Anything else takes the prose
+// scrub.
+const DP_READ_NAME_GRAMMAR = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
+function dpReadNameScrub(value, cap) {
+  if (typeof value !== "string" || value.length === 0) return null;
+  if (DP_READ_NAME_GRAMMAR.test(value))
+    return value.length > cap ? value.slice(0, cap) : value;
+  return dpReadScrub(value, cap);
+}
+
+function dpReadOutcomeString(key, value) {
+  const grammar = key === "planId" ? DP_READ_PLAN_ID_GRAMMAR
+    : key === "grantId" ? DP_READ_GRANT_ID_GRAMMAR
+    : DP_READ_TOKEN_GRAMMAR;
+  if (grammar.test(value) && value.length <= 200) return value;
+  if (grammar.test(value)) return value.slice(0, 200);
+  const scrubbed = dpReadScrub(value, 200);
+  return scrubbed === null ? "" : scrubbed;
+}
+
+function dpReadProjectOutcomes(parsed) {
+  const entries = [];
+  for (const entry of parsed) {
+    if (!entry || typeof entry !== "object" || Array.isArray(entry))
+      continue;
+    if (entry.bindingProjection &&
+        typeof entry.bindingProjection === "object") {
+      const sweep = {};
+      for (const k of DP_READ_SWEEP_KEYS)
+        if (typeof entry.bindingProjection[k] === "number")
+          sweep[k] = entry.bindingProjection[k];
+      entries.push({ bindingProjection: sweep });
+      continue;
+    }
+    if ("bindingProjectionError" in entry) {
+      entries.push({ bindingProjectionError: true });
+      continue;
+    }
+    if (entry.truncated && typeof entry.truncated === "object") {
+      const t = entry.truncated;
+      entries.push({ truncated: {
+        keptEntries: typeof t.keptEntries === "number" ? t.keptEntries : 0,
+        droppedEntries:
+          typeof t.droppedEntries === "number" ? t.droppedEntries : 0,
+        fieldsSliced: t.fieldsSliced === true,
+        fieldsScrubbed: t.fieldsScrubbed === true } });
+      continue;
+    }
+    const o = {};
+    for (const k of DP_READ_OUTCOME_KEYS) {
+      const v = entry[k];
+      if (typeof v === "string") o[k] = dpReadOutcomeString(k, v);
+      else if (typeof v === "number" || typeof v === "boolean")
+        o[k] = v;
+    }
+    entries.push(o);
+  }
+  return entries;
+}
+
+const DP_READ_NUM = (v) =>
+  typeof v === "number" && Number.isFinite(v) ? v : null;
+
 export function createGenerationService({ coord, env = {}, store = null, sources = {},
                                           expectedStorageBase = null,
                                           recountBucket = undefined,
@@ -1581,9 +1701,129 @@
     };
   }
 
+  // PHASE B INSTRUMENTATION (P2) — the drive-pass read: the
+  // records the subclass alarm handler's recorder writes to
+  // d6_drive_passes (worker-entry-prod-d6.js), the live alarm
+  // state, and the recorder-health channel. Selected on the
+  // diagnostics route by the presence of a drive parameter (the
+  // entry forwards it under the same operator-admitted stamp as
+  // attemptDiagnostics above). MODE DISCIPLINE (Rowan's ruling):
+  // drive must be exactly "1" and NO attempt-diagnostics target
+  // (planId / jobId / cursor) may ride along — every other
+  // combination is rejected as diagnostics_mode_ambiguous, never
+  // blended into a merged response. Read-only: SELECTs, one
+  // getAlarm(), one storage.get; no wake, no command, and no
+  // mutation is reachable from here (reads never wake in this
+  // codebase). Stored values are NOT trusted: every field passes
+  // the read-side revalidation above (§5.5) before it is returned,
+  // and a malformed stored outcomes_json yields outcomes: null
+  // with outcomesMalformed: true — never the raw string. Table
+  // states are reported honestly: "missing" (the recorder has
+  // never completed a write — no pass recorded, or every write
+  // failed at the DDL; recorderHealth distinguishes), "empty"
+  // (created, no rows), "populated".
+  async function drivePassDiagnostics({ drive = null, planId = null,
+      jobId = null, limit = 50, cursor = null,
+      repeatedModeParam = false } = {}) {
+    if (drive !== "1" || planId !== null || jobId !== null ||
+        cursor !== null || repeatedModeParam)
+      return { outcome: "rejected", reason: "diagnostics_mode_ambiguous" };
+    const cap = Math.max(1, Math.min(288,
+      Number.isFinite(limit) ? limit | 0 : 50));
+    let tableState = "populated";
+    let rows = [];
+    try {
+      rows = coord._all(
+        `SELECT * FROM d6_drive_passes ORDER BY id DESC LIMIT ?`, cap);
+      if (rows.length === 0) tableState = "empty";
+    } catch (e) {
+      // The quarantineHoldRowSafe discipline (quarantine.mjs): a
+      // genuinely absent table is a state, not a fault; any other
+      // error is rethrown and surfaces as a fault.
+      if (!isNoSuchTableError(e)) throw e;
+      tableState = "missing";
+      rows = [];
+    }
+    const passes = rows.map((r) => {
+      let outcomes = null;
+      let outcomesMalformed = false;
+      let outcomesRevalidated = false;
+      if (typeof r.outcomes_json === "string") {
+        let parsed;
+        try { parsed = JSON.parse(r.outcomes_json); }
+        catch { parsed = undefined; }
+        if (!Array.isArray(parsed)) {
+          outcomesMalformed = true;
+        } else {
+          outcomes = dpReadProjectOutcomes(parsed);
+          outcomesRevalidated =
+            JSON.stringify(outcomes) !== r.outcomes_json;
+        }
+      } else if (r.outcomes_json !== null &&
+                 r.outcomes_json !== undefined) {
+        outcomesMalformed = true;
+      }
+      return {
+        id: r.id, at: DP_READ_NUM(r.at),
+        finishedAt: DP_READ_NUM(r.finished_at),
+        stage: DP_READ_STAGES.has(r.stage) ? r.stage : "unrecognized",
+        driveInvoked: r.drive_invoked === 1,
+        outcomes, outcomesMalformed, outcomesRevalidated,
+        outcomesTruncated: r.outcomes_truncated === 1,
+        errorName: dpReadNameScrub(r.error_name, 100),
+        errorMessage: dpReadScrub(r.error_message, 500),
+        armedAfter: DP_READ_NUM(r.armed_after),
+      };
+    });
+    let armedAt = null;
+    try { armedAt = await coord.state.storage.getAlarm(); }
+    catch { armedAt = null; }
+    const pending = coord._oneOrNull(
+      `SELECT COUNT(*) AS n FROM schedule WHERE state = 'pending'`);
+    const pendingWd = coord._oneOrNull(
+      `SELECT COUNT(*) AS n FROM schedule
+        WHERE state = 'pending' AND kind = 'watchdog'`);
+    let recorderHealth = null;
+    try {
+      // The literal key is the cross-part contract with the
+      // recorder (DRIVE_PASS_HEALTH_KEY, worker-entry-prod-d6.js);
+      // the round-trip test pins that the two never drift. The
+      // stored object is projected onto its five known fields
+      // with per-field validation (§5.5) — never returned raw.
+      const h = await coord.state.storage.get(
+        "d6DrivePassRecorderHealth");
+      if (h && typeof h === "object" && !Array.isArray(h)) {
+        recorderHealth = {
+          recordingFailures:
+            typeof h.recordingFailures === "number" &&
+            h.recordingFailures >= 0 ? h.recordingFailures : null,
+          lastFailureAt: DP_READ_NUM(h.lastFailureAt),
+          lastFailureStep: DP_READ_FAILURE_STEPS.has(h.lastFailureStep)
+            ? h.lastFailureStep : null,
+          lastFailureName: dpReadNameScrub(h.lastFailureName, 100),
+          lastRecordedAt: DP_READ_NUM(h.lastRecordedAt),
+        };
+      }
+    } catch { recorderHealth = null; }
+    return {
+      mode: "drive_passes",
+      found: passes.length > 0,
+      tableState,
+      drivePasses: passes,
+      alarm: {
+        armedAt: typeof armedAt === "number" ? armedAt : null,
+        pendingSchedule: pending ? pending.n : null,
+        pendingWatchdog: pendingWd ? pendingWd.n : null,
+      },
+      recorderHealth,
+      asOf: coord._now(),
+    };
+  }
+
   return { submitIntent, driveOnce, planStatus, seedStorageBase, recover,
            bindPhaseBook, getPhaseBinding,
            reconcileUnknownAttempt, adjudicateEstimatedAttempt, retireHaltedPlan,
            releaseQuarantine, getQuarantine,
-           listPlans, capabilities, eligibilityQuote, attemptDiagnostics };
+           listPlans, capabilities, eligibilityQuote, attemptDiagnostics,
+           drivePassDiagnostics };
 }
```

— Wren (specification only; no production contact of any kind
was made for this document)
