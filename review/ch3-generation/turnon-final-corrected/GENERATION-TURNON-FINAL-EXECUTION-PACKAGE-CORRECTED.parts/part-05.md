hers. It does not retroactively reclassify check #1, does not amend any closing value other than the P-5 plan-state baseline as stated, and authorizes nothing.

#### 2.3-C Artifact 2 — the termination act

**Of record (filed 2026-11-06).** The termination act of record: acting as the duty's owner, Wren disabled the `phaseb-resume-postgate-watch` job on **2026-11-06T23:48Z** (`cron.update`, `enabled: false`; the definition and run history are preserved). Termination trigger: condition (a) of the watch's terms — Rowan's acceptance of the resume gate's execution record (her execution review, verbatim board 6686319232, 2026-11-06), the earlier of the two conditions (the 14-day bound, 2026-11-20T03:58Z, did not fire). Recorded in the watch log's Termination entry (`~/workspace/goals/opal-roundtable/hidden_files/phaseb-resume-postgate-log.md`, appended 2026-11-06) and in this package. With §2.3-A's verification and this act, the OQ-5 observation obligation is discharged and P-14's evidence is complete.

With artifact 1 read and quoted (§2.3-A), the movement formally dispositioned (§2.3-B), and the termination act of record (§2.3-C), the OQ-5 observation duty stands discharged and P-14 is evaluable at gate time on this evidence.

### 2.4 Act 2 — deployment under the existing holds (counted act 1)

The candidate is deployed while BOTH holds stand (`GENERATION_HALT` `"1"`, queue paused). The deploy changes code only; it lifts nothing, unpauses nothing, and writes no settings record.

1. **Upload** (cf-api, multipart PUT to the script endpoint for `opalreader-api-v2-prod`): the metadata part carries `main_module` naming the entry module (`v2/worker-entry-prod-d6.js`, per the design §3.1 flip evidence), `compatibility_date` and compatibility flags preserved from the current script settings (read at gate time, never assumed), and the live binding set with every secret carried as `{"type":"inherit"}` — no secret value is read or carried by the act. The `GENERATION_HALT` plain_text binding is carried at `"1"` — the deploy envelope changes no binding value. The file parts are the stamped candidate set (§1.4): the 31 parts of §1.3's manifest, each part's SHA-256 verified against the manifest immediately before upload.
2. **Read-backs** (all required): the deployments list shows the new deployment (its id and timestamp recorded); `/health` reads build `ef69b8f9…`, generation `halted`; the script etag is read from the GET response headers and SAVED as an evidence artifact (Rowan R4) — the new etag becomes the reference for Act 4's flip.
3. **Observability rule** (standing deploy law): GET the script-settings; a code upload can reset observability to null. If null, re-apply it (enabled + logs persisted) via the multipart settings PATCH to `/workers/scripts/{name}/settings` (a single `settings` part; NOT `/script-settings`), then verify the script etag is UNCHANGED by the PATCH. The re-apply, if needed, is part of this act's verification discipline, not a separate counted act; whether it was needed is recorded either way.
4. **Hold verification**: after the deploy, the settings binding read shows `GENERATION_HALT` still `"1"` and the cf-api queue read shows `delivery_paused: true`. A deploy that moved either hold stops the gate (§2.5.1's predicate re-verification catches it in any case).

### 2.5 Act 3 — post-deploy verification and the refused-intent probe (counted act 2)

#### 2.5.1 Post-deploy predicate re-verification

Before the probe, the census predicates that name state (P-2 holds, P-3 containment, P-4 conflicts, P-5 plans, P-6 parked job, P-7 settings, P-8 reconcile, P-9 phase accounting, P-10 watermarks, P-12 recorder) are re-run against the new build, plus: capabilities + health read back the candidate's build identity (`ef69b8f9…`); the phase registry renders unchanged (FP present, budget 13,500,000, the FP binding link intact). A deploy that moved any state predicate stops the gate before the probe: the state is preserved, the deviation reported, and the deploy dispositioned under §2.11 before anything else is contemplated. (Runtime adoption note: these read-backs prove script deployment and the read surfaces' behavior on the new build; the standing limitation — that a deploy + read-backs do not prove adoption by every DO instance — is carried at §5, and the probe below is the gate's functional evidence on the admission path itself.)

#### 2.5.2 The probe

Exactly ONE intent, submitted by Wren through the client connector (a SubmitJob-class command; counted): a named unonboarded library book — **Finding Home** (any of the six unonboarded books serves; this package names Finding Home so the gate record has no open choice), `phase: null`, chapter scope, Standard lane. Expected and REQUIRED outcome, on the enforcement build: `{ outcome: "rejected", reason: "book_not_onboarded" }`. The probe's safety basis is the ordering proven offline (build spec §2.2; T-NO-MUTATION): the refusal precedes every write, so the probe cannot spend, reserve, or generate. The probe is the GO's sole named exception to its no-Wren-submission bar. No FP probe is run: the smoke itself is the FP admission proof, and an FP admission failure would refuse closed at submission (no spend) inside the gate's observation.

#### 2.5.3 Zero-movement read-back

Immediately after the probe: plans list unchanged (still exactly the five baseline plans, all terminal); sync watermarks unchanged (content 18, bindings 1842); phase accounting unchanged (P-9's figures); quota counters unchanged (`providerDispatchesToday` 0; no new attempt-ledger movement attributable to the probe). Each read is recorded with its timestamp.

#### 2.5.4 Probe failure disposition

If the probe is ADMITTED, or refused under any reason other than `book_not_onboarded`, or any §2.5.3 read moved — STOP: no lift is attempted, the gate ends HELD (the holds never moved), and the deploy is dispositioned under §2.11 (rollback to the composed build) before anything else is contemplated. The failure is reported to Julie and Rowan with the probe's full read-back set.

### 2.6 Acts 4–5 — the lifts (counted acts 3 and 4, separately authorized)

The GO (§3) authorizes the two lifts as two separate acts, in this order, each with its own verification; the second does not proceed on the first's failure. Both mechanics are the proven ones (Gate 4; the resume gate's GR-3/GR-4 steps).

1. **Act 4 — halt lift.** The metadata-only envelope flip: a multipart settings upload carrying all 31 script parts byte-identical to the DEPLOYED candidate (manifest-compared against §1.3 + §1.4's stamp, immediately before the flip) with exactly one binding text changed — `GENERATION_HALT` `"1"` → `"0"`; secrets as inherit; no secret value read or carried. Read-backs (all required): the settings binding reads `"0"`; `/health` reads generation `enabled`, build still `ef69b8f9…`; the script etag is UNCHANGED from §2.4's saved artifact; observability intact (re-checked; the §2.4.3 rule applies if reset). Effect in source: `generationEnabled` wires `sendGrant`, and the entry's halt admission fence stops refusing synthesis commands.
2. **Act 5 — queue unpause.** cf-api PUT on queue `opalreader-generation-v2` with `queue_name` + `settings.delivery_paused: false`, then read back `delivery_paused: false`. (The cf-api body is the positional argv JSON; a body-less call changes nothing — the read-back is the proof, as the standing lesson requires.)

After Act 5 the system stands TURNED ON (not yet "under observation" — that state begins with the smoke's submission and the gate's observation of it). The emergency re-hold (§2.8) stands armed from this moment, and the no-indefinite-enabled predicate (§2.8.4) binds from this moment.

### 2.7 The smoke (Julie's act; Wren observes read-only)

- **Who submits**: Julie, from her own app, Standard lane — no Wren-submitted intent (the probe at §2.5.2 is the sole exception, and it is a refusal test, not generation). The smoke proves the NORMAL path, which is Julie's.
- **Target**: Forever Pucked **Chapter 4** (chapterIndex 3), chapter scope, **`keepGoing` OFF** (the plan is exactly one chapter, bounded by construction), lane standard, phase forever-pucked — or another single chapter Julie names when she gives the GO (§2.1). Expected for Chapter 4: 20 eligible segments, 26,638 chars, expected 375,535 units (≈ $0.38); exclusions bound_already 1 (Segment 1 already generated), voice_prompt 0, parked 0. The clock starts at Julie's submission (the plan's creation read-back).
- **Exposure signals** (signals, never caps — the Gate 4 law): settled for the chapter exceeding 2× expected (751,070 units), or provider dispatches for the chapter exceeding 60 in a day (the ruling-accepted escalation threshold) — either = Wren reports to Julie the same day; neither auto-stops Julie's plan. The plan's own guards (phase budget projection, quota, storage) are