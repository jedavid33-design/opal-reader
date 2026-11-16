# A-3 DORMANT DEPLOYMENT — EXECUTION RECORD

Case #10 / P8 (issue #15). Executed by Wren, 2026-11-16, in one attended
window under Julie's execution GO (board 6926261875), the dormant
deployment proposal (pin `76673997dbe0768c8b0cac294e414f72dc4db834`),
and Rowan's proposal PASS WITH BINDING CONDITIONS E1–E8 (verbatim
board 6926248489). Handoff: RT-H-20261116-a3deploy
Review pin: PIN-SLOT (repo `jedavid33-design/opal-reader`, branch `ui1-review`;
the Dropbox copy carries the filled pin — the only difference between copies).

## Outcome: DORMANT DEPLOYMENT EXECUTED — ONE counted act

The accepted A-3 candidate is now the live production build, with the
scheduler uninitialized and inactive and no Cron Trigger in existence.
Generation remains LIVE under the standing release. Chapter 6 is
exactly as it was. No activation, trigger, halt, queue, settings,
containment, or repair action occurred.

## Preparation (offline, before any counted act)

- **Stamped tree** prepared from the accepted candidate (pin
  `7f8b98d4a82f2fb41a88caf0e7a03be5e9a0148b`): 31 files, identical set;
  exactly one differing file, `v2/host/build-identity.mjs`, differing
  only in the BUILD_COMMIT string (composed-base value replaced by the
  accepted pin). Verified mechanically; manifest filed as
  STAMPED-TREE-MANIFEST.md in this gate's workspace and pinned with
  this record.
- **Binding inventory (E2)** verified by identity and type from the
  live settings GET: ALLOWED_ORIGIN (plain_text), COORDINATOR
  (durable_object_namespace), GEMINI_API_KEY (secret_text),
  GENERATION_HALT (plain_text, `"0"`), OPALREADER_ACCESS_TOKEN
  (secret_text), OPALREADER_GENERATION_V2 (queue),
  OPALREADER_MIGRATION_OPERATOR_TOKEN (secret_text),
  OPALREADER_PHASE_POLICY (plain_text), OPALREADER_STORAGE
  (r2_bucket), OPALREADER_V2_SCOPE (plain_text) — 10 bindings, carried
  into the upload metadata verbatim (secrets as `inherit`), with the
  live observability object carried verbatim.
- **Disclosed preparation correction:** the upload script's first
  draft carried a guessed expected-inventory containing two wrong
  names (a `PROVIDER_ATTEMPT_DAILY_LIMIT` binding, which is in fact a
  code constant, and a `TTS_CACHE` KV binding, which does not exist)
  and missing two real ones. The pre-upload assertion aborted the
  script BEFORE any upload attempt — **no counted act was consumed** —
  the expected list was corrected to the verified live inventory
  (identical across the census read and the pre-upload read), and the
  correction is noted in the script itself. The production state was
  never in question; the error was in the executor's checklist, and
  the assertion caught it as designed.

## Pre-flight census repeat (E3) — ALL MATCH

/health build `8a16def4…`, generation enabled; capabilities Standard
admitted / Batch not armed; recorder latest pass 505, `armedAt` null,
pendingSchedule 3, pendingWatchdog 1, recordingFailures 0 (S-3 stands
P-ABSENT as the supported working classification); containment NORMAL,
`updatedAt` 1793933356719; quota attempts/dispatches/reserved 0,
ledgerSeq 405; reconcile ok, drift [], censusComplete; 8 plans;
Chapter 6 plan active {14, 10, 0, 0}, settled 188,064; phase settled
sum 2,036,610; **Chapter 6 detail (E3):** job `generating` rev 4;
grants 2 `reported` + 1 `issued` (rev 4); occurrences 10 `ready` +
1 `granted` + 3 `pending`; the uncertain execution
`exec-c30d5a24-4b7c-455b-84f3-713aa3848541` `attempted` with attempt
`att-741ceee0-645e-4558-9b85-fd6e1cd653b8` seq 1, phase `dispatching`,
outcome/cost/providerRequestId all null, upper bound 16,808 — exactly
the documented outstanding disposition; repair derivation effective 0,
discharged [1], recorderVerified true, cached projection strikes 1;
conflicts exactly 4; schedules [].

## Act 1 — the upload (the ONLY counted act)

Multipart PUT of the stamped tree (31 parts, 1,642,995 body bytes),
metadata per §2 of the proposal (observability carried verbatim).
**HTTP 200, success true, errors [].** Landing established by
independent read-back:
- Deployments list: new deployment
  `48d8fd7d-462a-4f4e-98da-e9772166a689` at **2026-11-16T19:08:39.040078Z**.
- Script ETag: `00bc4f9025ed515e4d109292af67619d7020cc314eb98b8f05908b29c367504f`
  (1,639,570 bytes), changed from `611a23c8…`.
- /health: build **`7f8b98d4a82f2fb41a88caf0e7a03be5e9a0148b`**,
  generation enabled, coordinator armed.
- Settings: 10 bindings, GENERATION_HALT `"0"`, **observability
  enabled + persisted — INTACT**. Schedules: still [].

**Act 2 was NOT used:** the observability carried in the upload
metadata survived, so the conditional PATCH's prerequisites (landing
established AND observability verified null) were not met. The gate
closes at exactly ONE counted act, inside the two-act ceiling.

## Closing census (§7 + E6) — ALL PASS

1. Scheduler status (`GET /v2/d6-scheduler-status`): **E1 shape A —
   uninitialized, consistent with dormant deployment:** schemaReady
   false, state null, waitHold null, activePass null, guard
   {held: false, holderKind: null, waiters: 0}, recentLog [],
   recentEvents []. Corroborated as verified-inactive by the accepted
   build identity on /health, zero activation acts, the empty trigger
   inventory, and all diagnostic reads succeeding. The scheduler was
   NOT initialized by any mutating operation.
2. Recorder: pass 505 still latest; `armedAt` null; pending 3/1;
   recordingFailures 0. **Recorder migration: NOT YET OBSERVED** (no
   native pass has run on the new build; no A-3-format row exists
   yet) — reported as such per E6, not claimed from deployment alone.
   Historical evidence untouched.
3. Repair continuity (E6): derivation effectiveStrikes **0**, intent 1
   remains discharged, recorderVerified true, unresolvedIntents [];
   no repair evaluation or acknowledgment occurred.
4. Containment NORMAL, `updatedAt` unchanged (1793933356719).
5. Quota ledgerSeq 405, attempts 0; reconcile ok, drift [].
6. Plans: 8; Chapter 6 active 10/14; phase settled 2,036,610;
   conflicts exactly 4.
7. Capabilities unchanged (Standard admitted, Batch not armed).

## Standing state after this gate

- **Live build: `7f8b98d4a82f2fb41a88caf0e7a03be5e9a0148b`** (the A-3
  candidate), ETag `00bc4f90…`. The A-1 build `8a16def4…` is retired
  as the live build and is **prohibited as a rollback target** from
  the moment recorder migration occurs (and by policy under this
  gate's paperwork, in any case going forward the rollback target is
  the pinned recorder-compatible rollback candidate, prepared with
  its OWN distinguishable build identity when a rollback gate is
  authorized — E2/E7).
- Scheduler: dormant (uninitialized). No Cron Trigger exists.
  Activation remains a separate future gate, preceded by the
  separately gated staging/platform verification and the activation
  proposal carrying measured usage and the WAIT-hold installation
  contingency (E8).
- The dormant native-assurance delta is now LIVE CODE under the
  standing release, as disclosed and accepted in Julie's GO: if a
  native pass runs and its exit finds the registration gone with work
  pending, one containment-gated re-arm may occur, and Chapter 6
  movement would be classified and reported under proposal §6 —
  never manufactured, never treated as activation.
- Chapter 6 milestone: still open, state unchanged (10/14, stalled,
  P-ABSENT). The S-3 watches continue.

Turn: Rowan's (execution review).
