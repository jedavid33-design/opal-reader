# Phase B Instrumentation — AMENDMENT NOTES (HOLD-FOR-CORRECTIONS)

- **What this is:** the compliance record for the amendment of
  `PHASEB-INSTRUMENTATION-SPEC.md` and
  `PHASEB-INSTRUMENTATION-GATE-PROPOSAL.md` under Rowan's review
  (`ROWAN-P2-SPEC-GATE-REVIEW.md`): **"HOLD FOR CORRECTIONS. NOT
  APPROVED FOR DEPLOYMENT"**, six required corrections (C1–C6).
- **Status:** amendment complete; documents + local test evidence
  only. **No production calls, no deploy, no pinning, no board
  posts** were made for this amendment. The deployed evidence
  parts (`phaseb-attempt3/evidence/parts-e0/`) were never edited;
  all candidate work happened in
  `instrumentation-spec/scratch/`. The amended spec + gate await
  Rowan's review; any execution still requires her PASS and
  Julie's explicit GO. The two-part architecture is preserved.
- **Battery:** EXECUTED against the exact final candidate tree —
  32 tests, 32 pass, 0 fail, exit code 0. Log:
  `instrumentation-spec/BATTERY-RUN-LOG.txt` (5,855 B, SHA-256
  `1fcacefa8e60062a87e9a3ecff47a59667346a1450d9282daf818bffbb85c2ce`).
  Harness + tests preserved at `instrumentation-spec/tests/`
  (`harness.mjs`, `battery.test.mjs`); the run is replayable.

## 1. Correction-by-correction compliance table

| # | Rowan's correction | How implemented | Where |
|---|---|---|---|
| C1 | No-rows + no-health is INCONCLUSIVE (consistent with H1, not proof); retain dual-channel-failure and pre-handler limitations | Every H1-evidence/proof phrasing rewritten to the inconclusive classification, with both limitations named at each site | Spec §1.2 (F-6), §1.3, §4.4, §8.4 (matrix row 1), §8.5, §10.2; Gate header, §6 V5, §8 (not-triggers), §12 |
| C2 | Budget: 1 forward upload + ≤1 conditional observability PATCH after it; PLUS, conditionally, 1 rollback upload + ≤1 conditional observability PATCH after the rollback; each PATCH settings-only, code etag unchanged across it | Budget table rewritten with four separately counted rows + the in-words envelope; STOP S-7 extended to the rollback PATCH (a third PATCH of any kind is itself a STOP); authorization block covers both PATCHes explicitly | Gate §5, §9 (S-7), §10; rollback procedure wording aligned in §8 |
| C3 | Verify the §7.3 predicted grant/reservation transition against deployed behavior; ONLY the exactly-verified transition is pre-classified; any unmatched movement is STOP | Firsthand trace from parts-e0 (anchors below, §3 of these notes). The verified set: issuance writes + derived movements (grants []→[one issued grant], occurrence pending→granted, job queued rev 1→generating rev 2, derived reserved 0→12) + the bounded lease-expiry/re-grant cycle with invariants. **The prior draft's "phase reservedUnverified increases" is WITHDRAWN as disproven**: `phaseAccounting` (genstore.mjs:403) derives it only from adjudication/attempt-log state that grant issuance never writes — all five phase figures must remain exact. Battery T2 observed the verified transition live (pass-1 grant under halt, twin-identical state) | Gate §7.3 (rewritten), §7 P-2; Spec §1.3, §9 T2 note |
| C4 | Distinguish diagnostic capture success from coordinator health; error-stage rows and recorder-health failures are findings requiring classification (named disposition), not automatically failed instrumentation | Classification table: observation → what it proves about the RECORDER → what it does/doesn't say about the COORDINATOR → disposition (**executor reports verbatim; Rowan classifies**). V5's rows-present verdict no longer requires `recordingFailures 0`; error-stage and health-failure readings are named findings with the disposition step | Spec §8.5 (new); Gate §6 V5 (rewritten), §8 (not-triggers) |
| C5 | Hostile-input coverage for allowlisted string values + the `outcomesRaw` fallback; no raw sensitive content may escape through malformed stored JSON | **Code changed in both parts** (see §4): write-time grammar-or-scrub discipline for outcome strings (identifier/code-token grammars stored as-is; anything else fully scrubbed, disclosed via the new `fieldsScrubbed` marker field); error **name** identifier path (battery finding: the prose scrub redacted the 25-char `ProductionR2NamespaceError` to `[redacted]`); read-side revalidation layer (allowlist re-projection, stage vocabulary, health projection, per-field re-scrub); **`outcomesRaw` ABOLISHED** — parse failure or non-array → `outcomes: null` + `outcomesMalformed: true`, never the raw string; health writer projects the previous object before carrying it forward. Hostile-storage test cases added (malformed JSON, non-allowlisted keys, URL/token strings, oversized, unicode/control, smuggled health keys) | Spec §5 (intro, §5.1, §5.1a new, §5.2, §5.3, §5.4, §5.5 new), §8.3; battery T5/T5b |
| C6 | Execute T0–T10 against the exact candidate tree; include KV fault behavior + end-to-end diagnostics forwarding | Battery built (candidate tree = 31 parts-e0 parts with the 2 amended parts; baseline twin = pristine copy; real-SQLite DO harness with throwing `.one()`, KV facet, statement-matching fault injector, entry-class instantiation) and EXECUTED: 32/32, exit 0, full log preserved + hash-cited in both documents. KV get/put faults in T4; e2e forwarding (public entry → forward whitelist → class gate → service read → response shape) in T9; repeated-parameter case in T7 forced a real code fix (§4) | Spec §9 (header + T2/T3/T4/T5/T7 texts as executed); Gate §4 B3 |

## 2. C3 verification anchors (deployed parts, firsthand)

- `driveOnce`: `generation/service.mjs:888`; plan selection
  exclusion `:923`; grant step `coord.requestGrant(jobId)` `:992`;
  outbox drain gated on `typeof env.sendGrant === "function"` `:1034`.
- `requestGrant`: `coordinator.mjs:1805`; `_issueGrant` `:1636`;
  `LEASE_MS` (15 min) `:134`; grantId grammar
  `` `grant:${jobId}:${job.revision}:${probe ? "probe" : "full"}` ``
  `:1696`; grants INSERT `:1743`; outbox INSERT `:1755`;
  `case "lease"` `:2536`; void call
  `"lease_expired_undelivered"` `:2589`; `retry_grant` scheduled
  +30 s `:1801`; `case "retry_grant"` `:2625`, re-request `:2636`.
- `reserveForGrant`: `generation/quota-budget.mjs:544`;
  `derivedDayTotals` `:193`; `boundGrantTargets` `:624`.
- `SEGMENT_ATTEMPT_BUDGET = 12`: `generation/gen-constants.mjs:16`;
  `upperBoundAttemptMicro` `:88` (569 chars → 12,803);
  `upperBoundOccurrenceMicro` `:95` (12 × 12,803 = 153,636).
- `phaseAccounting`: `generation/genstore.mjs:403`;
  `reserveAttempt` (the only writer of `reserved`/`dispatching`
  attempt-log phases) `:129`.
- `sendGrant` wired only when `GENERATION_HALT === "0"`:
  `worker-entry-prod-d6.js:323`, `:340`.

The one element deliberately NOT pre-classified: a quota-reconcile
read turning non-ok (reconcile internals were not separately
traced) — the gate names it unmatched movement → STOP.

## 3. Exact changed sections

### Spec (`PHASEB-INSTRUMENTATION-SPEC.md`)

- Header: amendment status block added (corrections, battery
  evidence, still proposal-only).
- §1.2: F-1 row extended (read-side layer); F-6 row rewritten to
  the inconclusive classification.
- §1.3: NEW — the C1–C6 compliance map.
- §2.2: diff statistics + candidate hashes replaced (see §5).
- §2.3: battery T0 round-trip cross-reference added.
- §2.4: growth attribution rewritten (+659/−16; ≈+260 attributed
  to the C5 hardening).
- §4.4: `lastFailureName` sanitization now by §5.2's name path;
  health writer projects the stored object before carry-forward;
  the residual-blind-spot paragraph now names the INCONCLUSIVE
  classification.
- §5: intro rewritten (two-layer sanitization; raw fallback
  abolished). §5.1: string values now under §5.1a. **§5.1a NEW**
  (grammar-or-scrub discipline). §5.2: split into the error-NAME
  identifier path and the prose scrub (message). §5.3: marker
  gains `fieldsScrubbed`; trigger includes scrubbing; the
  truncated⇔marker invariant stated exactly. §5.4: extended to
  the read-side hostile-storage scan. **§5.5 NEW** (read-side
  revalidation, exact).
- §8.3: response shape — `outcomesRaw` replaced by
  `outcomesMalformed` + `outcomesRevalidated`; outcomes and
  recorderHealth bullets rewritten to the revalidation behavior.
- §8.4: matrix row 1 rewritten to the INCONCLUSIVE classification
  with all three absence-producing causes named.
- **§8.5 NEW** — capture-vs-health classification table with the
  named disposition step (C4).
- §9: header now reports the EXECUTED battery (32/32, exit 0, log
  hash). T2: shadow-store comparison described as executed;
  pass-1 grant observation noted. T3: executed-shape note for
  (ii) + new T3(iib) (from-the-start cache fault lands at
  `base_alarm` — the base alarm constructs the cache first,
  `worker-entry.js:270`). T4: pass criteria scoped to
  recorder-step faults; the `getAlarm` case rewritten to the
  executed truth (drive-stage surfacing via
  `_armAlarmIfEarlier`, `coordinator.mjs:2481`); serialize case
  described as executed (throwing-getter injection). T5:
  name-path criterion + T5b fidelity + the read-side hostile
  storage cases. T7: repeated-parameter case added.
- §10.2: the "presents exactly as H1" sentence replaced by the
  INCONCLUSIVE classification.
- Appendix A: the embedded diff replaced with the amended
  two-part diff (verified byte-identical to
  `instrumentation-spec/scratch/combined.diff`).

### Gate (`PHASEB-INSTRUMENTATION-GATE-PROPOSAL.md`)

- Header: amendment block added; companion spec hash and both
  candidate pins updated.
- §4 B3: amendment battery evidence added; build-stage run is a
  re-run whose divergence is a STOP.
- §5: mutation budget rewritten (C2 — four counted rows + the
  in-words envelope).
- §6 V5: rewritten (C1 + C4 — four classified readings,
  disposition step, no-rows = INCONCLUSIVE with all three causes
  named; the success shape no longer folds `recordingFailures`
  into the rows-present verdict).
- §7 P-2: state/revision/grants explicitly §7.3-subject.
- §7.3: rewritten in full from the verified trace (C3 — see §2
  above); the `reservedUnverified` prediction withdrawn.
- §8: not-rollback-triggers rewritten (inconclusive wording;
  §7.3 cycle included; Rowan-classified findings excluded);
  rollback procedure's PATCH wording aligned to the budget.
- §9 S-7: extended to the rollback PATCH (C2).
- §10: authorization block covers the rollback upload + its
  PATCH explicitly (C2).
- §12: limitation restated in the INCONCLUSIVE classification.

## 4. Candidate code changes made in this amendment

All in the two candidate parts; diffs regenerated from pristine
deployed copies after every change and re-verified byte-for-byte
(`patch -p1` round-trip; battery T0 also asserts it in-suite).

1. **Read path (service)** — `outcomesRaw` raw pass-through
   REMOVED. `drivePassDiagnostics` now re-validates everything
   (§5.5): malformed/non-array stored JSON → `outcomes: null` +
   `outcomesMalformed: true`; parsed outcomes re-projected
   through a service-local copy of the allowlists/grammars (a
   second cross-part contract) with `outcomesRevalidated`
   flagging any change; stage vocabulary check (`"unrecognized"`);
   error fields re-sanitized; health object projected onto its
   five fields. A `repeatedModeParam` input joins the ambiguity
   rejection.
2. **Write path (entry)** — outcome strings under the
   grammar-or-scrub discipline (§5.1a); the serializer's marker
   gains `fieldsScrubbed` and is emitted whenever a field was
   sliced OR scrubbed (invariant: `outcomes_truncated` = 1
   exactly when a marker is present); the health writer projects
   the previously stored object onto the five known fields
   before carrying anything forward.
3. **Error-name identifier path (both parts)** — battery finding:
   the prose scrub's ≥24-char redaction destroyed long class
   names (`ProductionR2NamespaceError` → `[redacted]`). Names
   matching the identifier grammar are now stored/returned
   as-is (capped); non-identifiers take the full scrub. Applies
   to the row's `error_name`, the health `lastFailureName`
   (write and carry-forward), and both read-side fields.
4. **Repeated-parameter forwarding (entry)** — battery finding
   (T7): the public diagnostics forward copies each parameter
   singly (`searchParams.get` + `set`), silently collapsing a
   repeated `drive` before the class gate could see it. The
   forward now detects repetition of any diagnostics parameter
   and forwards `repeated=1`; the class gate ORs it (and its own
   `getAll` counts) into `repeatedModeParam`, and the service
   rejects as `diagnostics_mode_ambiguous`. Attempt mode is
   untouched (the flag is only passed to the drive read).
5. **Allowlist reconciliation (service)** — the read-side
   outcome allowlist is exactly the recorder's verified 10 keys
   (`planId, state, stopReason, grantId, grantRefused, skipped,
   quarantined, approvalRequired, quarantineCheckFailed,
   advanced`), confirmed against every `out.*` assignment in the
   deployed `driveOnce` (`service.mjs:888–1046`).

## 5. Old vs new hashes and final counts

| Artifact | Before (reviewed draft) | After (this amendment) |
|---|---|---|
| Spec | 66,557 B, `031f5dd338a38ec4d7f8d8b296d115b479230d88a186c3fc4d8de73015cc6e77` | 98,793 B, `a805b473f293073cad5fd97bbdba05f30c12d76b3b41d78b3742fc0b1e34110e` |
| Gate | 22,446 B, `60e008b5b0f874876ef00467d8cafc3a7f4cd63a0afdf9281cd7430a190eb1c9` | 31,890 B, `d1e954ea1c6321e6782f1f892529c0c24c7bc042c3d68f5548aff10df69a5b9c` |
| Candidate entry part | `f98a45528232b09b53fd1106da4a032374c6d9a9b24f94414133aa3f76057452` | 127,131 B, `45daf26ca850835c698863cb08ca39a8c6f1b2f1450488d1e710f0cd87d7c4ab` |
| Candidate service part | `0e7deef2472a76c77d246cc6fa22bba94ea753a116c9b42980830e5d7ed92be3` | 88,070 B, `41f27492447296f25f958836a65d8e04592c2ba3cd330a2d2854ed98433eefda` |
| Design (unchanged) | 24,208 B, `c1e7fcf8e70a2ef0bd819f338527dce8dec1a4227e501a0dade292e4f0235210` | — |

Final diff (deployed → candidate): entry **+418/−15**, 4 hunks
(diff file 22,405 B); service **+241/−1**, 3 hunks (11,469 B);
**total +659/−16**, 7 hunks; combined diff 33,874 B
(`instrumentation-spec/scratch/combined.diff`). Deployed
originals unchanged: entry `292ca83e…`, service `aeeee06c…`
(parts-e0, build `1c2d1d0f`, etag `f15fb1ae…`).

## 6. Battery outcome summary (final run, exit code 0)

- **T0** assembly & identity: 31 parts, 29 byte-identical, 2
  amended parts match the candidate pins; patch round-trip
  byte-for-byte; `node --check` clean; baseline tree pristine.
- **T1** bring-up: empty store (no `.one()` deadlock; first pass
  records) + seeded attempt-3 shape (plan/job/parked/conflicts
  exact; phase accounting exactly {settled 1,029,420,
  estimatedUnverified 19,018, reservedUnverified 5,648,
  inFlightUpper 0, unknownOpen 0}; quarantine unheld — the seed
  mirrors attempt 3's R1 halt-lift for the submission, disclosed
  in the harness).
- **T2** normal recording: 6 passes; every pass's full DB state
  identical to the unmodified build (excluding the recorder's
  own table); recorded outcomes equal `driveOnce`'s actual
  return projected (shadow-store comparison); pass 1 issued the
  grant under halt with the exact §7.3 grantId shape.
- **T2b** clock fallback: without `env.now`, `at` tracks wall
  `Date.now()`.
- **T3** stage capture: all four stages + T3(iib); rethrown
  errors are the identical injected objects (`===`); twin-state
  equivalence under every fault.
- **T4** recorder faults: DDL / insert / prune / getAlarm / KV
  get / KV put / serialize — alarm resolves for every
  recorder-step fault with identical drive effects; health
  bookkeeping exact (incl. prune above-cap for exactly one pass,
  KV channel self-heal); the getAlarm case pins the recorder's
  guarantees against the shipped chain's own getAlarm use.
- **T5 / T5b** sanitization: hostile write inputs (nothing raw
  stored; sweep error = presence flag only; marker disclosure);
  identifier fidelity (real ids/tokens byte-exact, no marker);
  hostile STORAGE on read (malformed → null + flag, no raw
  anywhere in the response; smuggled health keys dropped).
- **T6** truncation: ≤8,000 chars always, valid JSON, whole
  entries + exact marker counts; under-cap stores untruncated.
- **T7** mode rejection: all ambiguous combinations → 400
  `diagnostics_mode_ambiguous` (incl. repeated `drive` through
  the real public route); 403 without the operator stamp (both
  modes); attempt mode key-identical to the unmodified build.
- **T8** retention: 300 records → exactly the newest 288;
  7-throwing-pass burst holds the cap at every assertion point.
- **T9** round-trip + contract: route read (public entry →
  forward → class gate → service) returns exactly the recorded
  rows incl. an error row and a crash-instance pass; health key
  literal pinned in both parts; `tableState` missing →
  populated; alarm block matches harness state.
- **T10** shipped-surface equivalence: capabilities, plans list
  + detail, eligibility (chapter/segment/book), quota,
  conflicts, attempt diagnostics — field-for-field identical
  between candidate and unmodified builds (timestamps excluded).

### Test-implementation corrections disclosed (not code defects)

- The seed submits the plan during a brief env halt-lift,
  mirroring attempt 3's R1 — production behavior for a
  halt-born plan is the quarantine birth-mark, which the seed
  would otherwise (correctly) produce; the attempt-3 closing
  shape is unheld, so the seed reproduces the R1 sequence.
- T6 fixtures use only real allowlisted keys (an earlier fixture
  draft used keys `driveOnce` never emits; the projector was
  correctly dropping them).
- T3(iv)'s `drive_invoked` expectation is 1 (driveOnce WAS
  invoked; it threw inside) — the original draft text already
  said this; the battery's first run asserted it wrongly and was
  corrected.

## 7. Residual overclaim grep (C1 closing check)

Both amended documents were grepped for `evidence for H1`,
`H1 evidence`, `proves`, `proof of H1`, `presents exactly as H1`,
`reservedUnverified increases`, and related forms. Remaining
hits are only: (a) the §1.3 compliance table QUOTING Rowan's
correction topics; (b) the corrected classification itself
("NOT proof of H1"); (c) the §2.2/§2.4 historical supersession
notes carrying the old pins, labeled as superseded. No live
claim in either document states the no-rows outcome as H1
evidence or proof, and no document claims `reservedUnverified`
moves on grant issuance.

## 8. UNVERIFIED items (named plainly)

- **Real alarm DELIVERY** — the harness invokes `alarm()`
  directly; delivery is the platform's and is the very thing
  under investigation. Unchanged from the spec's §9.0 naming.
- **Real-DO behavior beyond harness fidelity** — the harness
  pins `.one()` throw semantics and real SQLite, but it is not
  the platform; the 1101-class instantiation faults and all
  dashboard/API surfaces remain locally untestable.
- **Quota-reconcile internals** — not separately traced; the
  gate treats a non-ok reconcile read as unmatched movement →
  STOP rather than pre-classifying it.
- **The preserved plan's recorded `estMicroCents`** — the
  ledger `attempt` row written at issuance carries the job's
  recorded estimate; §7.3 deliberately does not precompute it
  (the money invariants that ARE pre-classified are the phase
  figures, which must not move at all).
- **KV facet under the real platform** — this build is the
  first production use of `state.storage` get/put in these
  parts; behavior is harness-verified only. The recorder treats
  every KV failure as best-effort by design, so a platform
  surprise degrades observation, never the drive path (T4).

— Wren (amendment only; no production contact of any kind was
made for this document)
