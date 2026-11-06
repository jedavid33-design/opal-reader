# GENERATION TURN-ON — SCOPING PACKAGE: Standard return to normal operations + Batch lane arming (one program, two workstreams)

_Scoping/design document, drafted by Wren 2026-11-06. Sources: the live build source tree (the Grant 1 composed tree, `containment-v4/composed-tree/`, coordinator SHA-256 `5303cb63…`, the tree that produced live build `fdb02395b3775dc945baa395591a73060ab146c4`); the gen-pkg-1 design record (`~/workspace/gen-pkg-1/`); the quota design (`~/workspace/ch2-program/remediation/QUOTA-PROPOSAL.md`); and Wren's own fresh read-only production census of 2026-11-06 (§2). File:line citations are to the composed tree unless another source is named. This package is pinned at `<SCOPE-PIN>` (the pin is carried in the companion CP file, per the established slot pattern)._

---

## 1. Purpose and authority

Julie decided on 2026-11-06 (board comment 6686374302) to scope BOTH remaining generation workstreams in one program:

1. **Workstream 1 — Standard turn-on**: end the gate-era holds and return the Standard lane to normal operations, so generation runs from Julie's app under the standing in-code controls.
2. **Workstream 2 — Batch arming**: design, build, prove on staging, and arm the Batch lane, which the v2 design law has always kept (Standard + Batch both stay) but which has never been armed in the D6 system.

Execution order proposed by this package: **Workstream 1 first** (it is governance and two proven mechanical acts, no code change), **Workstream 2 after Workstream 1 is stable** (it is a real build). One program, two workstreams, each with its own gate chain and Julie's separate GO at each consequential step, per Approval Mode.

**This package authorizes nothing.** It changes no production state, lifts no hold, arms nothing, and spends nothing. It exists so Rowan can rule on the governance questions in §3.3 and the gap analysis in §4, and so Julie can give (or withhold) each gate's GO with the full picture in front of her.

Standing facts the scoping rests on, all re-verified in §2: the Standard lane is **admitted** today (the server would accept Standard intents); what keeps generation off is the pair of deliberate holds — `GENERATION_HALT` = `"1"` and the generation queue paused. The Batch lane is **not admitted**: capabilities reports `batch_not_armed`, and §4 shows that is a code constant, not a setting.

---

## 2. Fresh current-state census (Wren, read-only, 2026-11-06T13:52Z–13:56Z)

All reads read-only; no production state was changed by this census.

| Surface | Read | Value |
|---|---|---|
| Health | `GET /health` | build `fdb02395b3775dc945baa395591a73060ab146c4`, coordinator `armed`, generation `halted` |
| Capabilities | `GET /v2/generation/capabilities` | generationState `halted`; standard `{admitted: true}`; batch `{admitted: false, reason: "batch_not_armed"}`; configuredLane **null** |
| Phase (in capabilities) | forever-pucked ↔ book `5c589095-f812-48a2-8ab2-03ba2791f2b2` | budget 13,500,000; settled 1,037,880; estimatedUnverified 19,018; reservedUnverified 5,648; remaining **12,456,472** |
| Containment | `GET /v2/d6-containment` (operator) | state **NORMAL**, known/verified true, `stopConfidence: not_applicable`; closed-episode summary prevEpisode 3 / 1 attempt / not exhausted; alarm block armedAt **1793973224012** (a standing registration), pendingSchedule 1, pendingWatchdog 1 |
| Drive recorder | `GET /v2/d6-diagnostics?drive=1` | latest retained window = passes **311–360** (the read returns the latest 50), every pass stage `complete`, `recordingFailures` 0, latest pass recorded 1793972624012 (2026-11-06T13:43:44Z). **The chain is alive and passing under the holds.** Each recent pass's sole outcome is the binding-projection sweep (scanned/published/noop/conflicts/pending all 0) — no plan outcomes, no grants: there is no non-terminal plan for a pass to advance |
| Plans | `GET /v2/d6-plans` | 5 plans, all terminal: Phase B `plan:19cad189fab54b9c804a74a6` **complete** (totals done 1, entry `ready`, execution `committed` — read directly, §2 note), Ch 3 `plan:e377a555…` complete, Ch 2 `plan:b2dc2a3d…` complete, smoke `plan:3183ecbf…` complete, old Ch 2 `plan:603ab416…` retired. **No active plan exists.** |
| Parked job | `GET /v2/jobs/1832c21f…` | state `parked_policy`, revision 1, lane standard, grants [] — untouched, as preserved |
| Conflicts | `GET /v2/conflicts` | exactly **4** rows, all `schedule_dead` (ids 1–4, the pinned baseline set) |
| Quota | `GET /v2/quota` | day 2026-11-06: attemptsToday 0 (estimate-ledger), providerDispatchesToday 0, providerReservedToday 0, providerAttemptDailyLimit 100; month 2026-11 spent 302,292 units, monthlyCap $50, settingsRevision 1, parked null |
| Quota reconcile | `GET /v2/d6-quota-reconcile` (operator) | armed true, ok true, drift []; sole exception the known adjudicated straddler (`att-37d63768…`, `estimated_unverified`) |
| Queue | cf-api GET queue | `opalreader-generation-v2` (93b6a35f…): **delivery_paused true**; sole consumer `f260f2188d80426bb0588685e9d084eb` |
| Script settings | cf-api GET script settings | binding `GENERATION_HALT` = `"1"`; `OPALREADER_PHASE_POLICY` = `enforce`; compatibility_date 2026-08-29 + `nodejs_compat` |
| Script-settings | cf-api GET script-settings | observability enabled + logs persisted (intact) |
| FP book quote | `GET /v2/d6-eligibility?bookId=5c589095…&scope=book` | **314 eligible, 414,050 chars, expected 5,837,168 units (≈ $5.84)**, digest `7d76a0538d8156a050eab0c34ecdb584d92da0c39f6d97a2589fc16ad5e5247f`; exclusions: bound_already 93, voice_prompt 0, parked 0, other 0; advisory true |
| Staging | `GET https://opalreader-api-v2.…/health` | worker `opalreader-api-v2` live: build `2fe71b5f…`, scope `staging-smoke`, coordinator armed, generation halted |

§2 note — the Phase B plan's stored state: the execution record's precision note (pin `c36740ed…`) recorded that the plan row's `state` field read `active` on the plan surfaces during the completion polls. This census reads the plan directly and it now reports **`complete`**, consistent with `driveOnce`'s finish step settling a fully-done plan on a subsequent pass. No discrepancy is carried forward.

What the census establishes for scoping: production is exactly in its documented end state — HELD at NORMAL, chain alive and idling, no active work, FP's remaining book quoted at ≈ $5.84 against ≈ $12.46 of phase room.

---

## 3. Workstream 1 — Standard turn-on (return to normal operations)

### 3.1 The exact mechanical changes (two acts, both proven in the gates)

Turn-on is the resume gate's lift pair, performed once and **not** reversed at the end:

1. **Halt lift** — flip the `GENERATION_HALT` plain-text binding from `"1"` to `"0"` by the metadata-only envelope upload proven in the C1/Grant-1/resume lineage and used at the resume gate's GR-3 step (evidence: `resume-execution/` flip set + EXECUTION-LOG): all 31 script parts byte-identical to the live build (manifest-compared before upload), only the binding text changes, script etag unchanged, observability re-checked after the upload (and re-applied by the multipart settings PATCH if the upload reset it — the standing post-upload rule). Effect in source: the entry computes `generationEnabled = env.GENERATION_HALT === "0"` (`worker-entry-prod-d6.js:326`) and only then wires `sendGrant` from the queue binding (`:343`) — with the halt lifted, grant outbox rows actually dispatch; the entry's halt admission fence (`isHaltRefusedCommand`, `:296-306`) also stops refusing the legacy staging command shapes.
2. **Queue unpause** — cf-api `PUT` the queue with `queue_name` + `settings.delivery_paused: false`, then read back `delivery_paused: false` (the proven pattern; a `--data`-style silent no-op is impossible under the read-back rule).

No code deploy. No settings-record change. No containment transition (containment is NORMAL and inert; it is not part of the on/off path at all — it was a gate-era verification instrument, and it stays available).

### 3.2 The operating model after turn-on (proposed)

- **Julie generates from the app.** The generation client (live build `d5b-v2-generation-client-3`, entry `app-269.js`) already implements the full flow: capabilities-driven lane rendering, the server-quoted confirmation dialog, one SubmitJob per intent, plan status in plain words (gen-pkg-1 design brief §1–§5; client source §4.4 below). Submitting a chapter/book intent creates a plan; the standing alarm chain's drive passes advance it (grant → queue → D6 executor → commit → binding projection publishes the audio to all devices with no app open — the F2 hands-off property).
- **The per-plan gate regime ends.** No more per-chapter GOs, censuses, or executor runs by Wren for ordinary generation. Wren's role returns to monitoring and exception-handling.
- **Standing controls that remain in code** (none of these is a gate-era hold; all are permanent design):
  - **Phase guard** (grant-guards.mjs): a plan riding a budgeted phase is refused grants that would project past the phase budget (`phase_budget`), refused outright while its phase is halted for unknown billing, and shape-fenced on the accounting object. Forever Pucked's budget is $13.50 with ≈ $12.46 remaining — the rest of the book (≈ $5.84 expected) fits inside it.
  - **Provider-attempt quota guard** (quota-budget.mjs): 100 provider dispatches per Pacific-Time day, an app-selected Reader policy cap (gen-constants.mjs:20-30 — expressly NOT a verified Google limit); per-grant reservations are cohort-bounded to 12 worst-case slots per fresh occurrence (`boundGrantTargets`, quota-budget.mjs:586-641), so a single day's cap can never be consumed by one grant's worst case.
  - **Settings monthly cap**: $50/month outer backstop, checked at grant issuance (coordinator.mjs:1981); the settings record is CAS-guarded (`_setSettings`, coordinator.mjs:2752-2772) and carries the quota counter in the app's Settings view.
  - **Storage guard**: every plan-linked grant re-projects R2 usage (base + committed + remaining eligible chars × 3,012.6 B/char × 1.10) and refuses at the 10 GB free-tier boundary (grant-guards.mjs `d6StorageProjection`) — fail-closed, permanent.
  - **Quarantine fences**: plans/jobs born in a halt epoch or held for cause stay fenced until an operator per-subject release; no client act clears them (grant-guards.mjs D7-2/D8-2 law). This matters at turn-on: anything staged during the halt era that ever attempts a grant is refused and marked, never silently granted (§3.3 Q4).
  - **Containment**: remains NORMAL/inert. `contain_drive`/`stop_chain` remain available as emergency instruments under their own authorization rules, unchanged.
- **The off-switch stays proven**: the re-hold pair (queue re-pause via cf-api PUT + read-back, then halt re-flip to `"1"` by the same envelope method, each verified) is exactly the resume gate's closing sequence. §3.3 Q5 asks who may invoke it outside a gate.

### 3.3 Open governance questions (for Rowan's ruling and Julie's decision — stated as questions, not answers)

- **Q1 — Books with no phase.** Admission law (phase-policy.mjs): a book with no registry row may submit with **no phase at all** and "still runs unbudgeted (phase null)"; only a *budgeted* phase claim is fenced to its bound book. A phase-null plan is governed by the monthly cap, the daily quota, and the storage guard — but by **no per-book budget**. And a NEW phase cannot be created by configuration: the budget registry is the frozen code constant `PHASE_BUDGET_MICRO_CENTS` (gen-constants.mjs:74-76, today exactly one entry), and recording a binding for an unlisted phase throws `phase_not_budgeted` (phase-policy.mjs `recordPhaseBinding`) — so budgeting a new book takes a code change + deploy + an operator binding record. **Question: for books beyond Forever Pucked, is phase-null operation (monthly cap + quota + storage only) acceptable, or must each book first receive a phase and a budget by the code+binding route?** This is the single largest governance decision in the program: it decides whether "normal operations" is a Forever-Pucked-only state or a library-wide one on day one.
- **Q2 — The standing chain under normal operations.** The chain is registered and passing now (§2); with the holds lifted, every pass advances any non-terminal plan: grants issue, dispatch, and parked plans (parked_quota / parked_cap / parked_budget / parked_storage) **resume on their own** when their refusal clears (service.mjs driveOnce + GRANT_STOP_MAP; the parked family is in the driver's dispatchable set). There are no non-terminal plans today, so turn-on itself starts nothing. **Question: is automatic resumption of parked plans under a live chain accepted as the normal-ops semantic (it is the F2 design), with the post-turn-on smoke (§3.4) as its proof — or should any class of plan require a human look before its first post-turn-on grant?**
- **Q3 — The completed plans and the parked job under a live chain.** All five plans are terminal (complete/retired) and the driver never selects terminal plans (service.mjs:1042-1044) — they are inert forever, no action needed or proposed. The Ch 3 **parked job** (`parked_policy`, rev 1) is a different mechanism: it is not plan-linked, the driver never touches it, and the eligible-set builder excludes its occurrences from every plan (service.mjs submitIntent-area comment; the FP quote's parked exclusion is 0 because those occurrences are fenced out upstream). **Question: confirm the parked job simply remains parked under normal operations, its disposition (release / leave) a separate operator decision as today — no turn-on act touches it.**
- **Q4 — Halt-era staged work.** The epoch fence (grant-guards.mjs) durably marks any plan-less job born inside a recorded halt epoch when it first attempts a grant — including after turn-on. The census enumerated plans and the one known parked job, but there is **no read surface that enumerates plan-less legacy jobs**; if any exist from the halt era, they would surface only as quarantine refusals at their first grant attempt. **Question: accept surfacing-by-refusal (fail-closed, operator release per subject) as sufficient, or require a pre-turn-on enumeration attempt (e.g., a diagnostics read) as a turn-on gate census item?**
- **Q5 — The off-switch's authority.** Re-hold (re-pause + re-halt) ends generation immediately and is fully proven. **Question: who may invoke it outside a gate — Wren on observed anomaly (the post-gate watch's POST-GATE-MOVEMENT precedent was report-only), Julie only, or either?** And its mirror: after an emergency re-hold, what re-authorizes turn-on again (a fresh GO in the gate pattern, presumably — to be ruled, not assumed).
- **Q6 — The 4 conflicts rows.** The `schedule_dead` lease rows (ids 1–4) have survived every gate untouched; nothing in normal operations reads or clears them, and no conflicts row may be cleared without separate authorization (standing rule). **Question: leave them permanently as historical record (this package's assumption), or disposition them in a separate micro-scope?**
- **Q7 — The post-gate watch's interplay.** `phaseb-resume-postgate-watch` (daily 18:28 ET) terminates on Rowan's acceptance of the resume execution record — **which she has now given (Nov 6, 2026; board 6686319232)** — once its leg (iii) first-scheduled-run verification lands (tonight's run, 2026-11-06 18:28 ET). Turn-on would supersede its purpose (it watches a HELD system for unexpected movement; a live system moves by design). **Question: confirm the watch terminates on its own terms (leg (iii) check, then disabled) and is NOT extended into a normal-ops monitor; any normal-ops observation duty, if wanted, is a new, separately-scoped decision (§3.4's soak is a candidate shape).**
- **Q8 — The settings `lane` key.** Capabilities' `configuredLane` reads the settings record's `data.lane` (service.mjs:1324-1328) and reads **null** today; the coordinator's settings defaults carry a legacy `geminiLane: "batch"` key (coordinator.mjs:2748) that is a v1-era record, **not** a lane control — submission lane comes from each intent, admission from the allowlist constant, and nothing in Settings can arm or disarm a lane. **Question: no action proposed; stated so no future reader mistakes the settings record for a lane switch. Noted for the record — ruling only if Rowan wants the legacy key cleaned up (a settings write, CAS-guarded, would be its own micro-act).**

### 3.4 Proposed gate shape (proposal, not a ruling)

One turn-on gate, executed under Julie's GO after Rowan rules §3.3:

1. **Census** — the §2 read set repeated; every value matched against this package's census (any drift = the standing executor STOP law).
2. **Lifts** — halt flip (§3.1.1), read-backs; queue unpause (§3.1.2), read-back. Counted acts: 2.
3. **Bounded smoke** — Julie, from her own app, submits **one chapter she chooses** of Forever Pucked (Standard lane, phase forever-pucked, inside the phase budget). Wren observes read-only: plan creation, grant, dispatch, attempts, settlement, binding publication, and Julie's playback of the chapter on her device. No Wren-submitted intent.
4. **Soak / observation** — a defined window (proposal: 7 days, daily read-only checks on the §2 surface set, logged; classifications QUIET / MOVEMENT-EXPLAINED / ANOMALY, anomaly = immediate report, no act beyond §3.3 Q5's ruled authority).
5. **Declaration** — at soak end, an execution record is filed and Rowan reviews it; on her acceptance, normal operations stand declared and the gate-era regime closes. The rest of Forever Pucked (and, per Q1's ruling, any other book) then generates by Julie's app submissions alone.

---

## 4. Workstream 2 — Batch arming

### 4.1 Where `batch_not_armed` is decided

One frozen code constant is the entire admission law:

- `gen-constants.mjs:9` — `export const D6_LANE_ALLOWLIST = Object.freeze(["standard"]);` ("membership in this frozen array is the ONLY lane check used by the service, the executor, and the coordinator patches", :6-8).
- Consulted at: capabilities (service.mjs:1317-1322, which renders the `batch_not_armed` reason string at :1322), intent admission (service.mjs:857 — a batch intent is rejected `lane_not_allowed` before any plan or ledger state moves), the D6 executor's job-lane check (d6-executor.mjs:688), and the coordinator's grant patch (coordinator.mjs:1875, under `env.d6StandardOnly`).

**Arming is therefore a code change + deploy, never a configuration change.** No binding, settings value, or operator route can admit Batch. (Conversely, adding `"batch"` to the array alone would NOT make Batch work — §4.3: admission would open while the D6 executor still refuses every batch dispatch. The allowlist edit is the LAST step of arming, not the first.)

### 4.2 What the design record says Batch is

- **Provider/flow**: Gemini's Batch API (`:batchGenerateContent`), one occurrence per batch job in the carried-over flow: submit with a display name → poll the batch's state → on success, read the inlined response's audio (WAV) → the audio enters the same flush/verify/commit machinery as Standard audio. The fence-before-submit discipline (a durable mapping row written BEFORE the provider call, so a crash can never produce an untracked submission) and the ambiguous-submission reconciliation (enumerate by display name; adopt on match; a never-accepted resolution path) are designed and built in the coordinator (below).
- **Relationship to Standard**: same model (Gemini 3.8 TTS only — the adapter refuses Batch for any other model, adapters.mjs:372), same voices, same output format pin (WAV PCM 16-bit mono 24 kHz). The difference is temporal, not qualitative: Standard synthesizes immediately per dispatch; Batch waits for the provider's batch window (the live client's own wording, app-269.js:644: "Standard makes audio right away. Batch waits for a batch window.").
- **Pricing relationship**: **the design record states none.** The cost model in code is lane-blind: 225 micro-cents per audio second (gen-constants.mjs:64-65), expected cost `round(chars / 15.96 × 225)` and the per-attempt upper bound at chars/10 — identical formulas whichever lane produced the audio, and settled cost is computed from the produced audio's actual duration. No mined design document (gen-pkg-1 brief, CONTRACTS lineage, QUOTA-PROPOSAL) asserts a Batch price differential, and this package asserts none. If a provider Batch discount exists in fact, capturing it would require a design ruling on lane-specific cost accounting; until then Batch's case rests on throughput shape, not savings. **OPEN ITEM B-1.**
- **What was built vs deferred**: the v1-era Batch flow (legacy executor + coordinator batch_maps + Gemini adapter) was carried into the v2 tree as preserved kernels; the D6 (plan-driven, hands-off) system was then built **Standard-only on purpose** — "Lane law: D6 is Standard-only… This executor has no submitBatch call anywhere — the Batch lane cannot execute here" (d6-executor.mjs:46-50). Batch arming for the D6 path was deferred at every design pass; gen-pkg-1 §10 restated "No Batch arming" for the in-app generation package, with arming reserved as a named, separate Julie decision (brief §4, §9 item 5). The quota design flags the one piece never designed at all: "If Batch is ever armed, its polling and submission calls need their own accounting ruling — flagged here, not designed" (QUOTA-PROPOSAL §5).

### 4.3 Gap analysis — the deployed source, component by component

| Component | State | Evidence |
|---|---|---|
| Lane admission (allowlist) | **ABSENT by design** — frozen `["standard"]` | gen-constants.mjs:9; consulted service.mjs:857, :1318; d6-executor.mjs:688; coordinator.mjs:1875 |
| Provider batch submit | **PRESENT** (host adapter) — Gemini `:batchGenerateContent`, single-occurrence inline request, model-gated to Gemini 3.8 TTS | adapters.mjs:364-407 |
| Provider batch polling + result retrieval | **PRESENT** — state poll; failed/cancelled/expired terminal; success extracts inlined audio bytes as WAV | adapters.mjs:409-439 |
| Ambiguous-submission reconciliation | **PRESENT** — display-name enumeration; adopt-on-match; never-accepted evidence check | adapters.mjs:441-469; executor.mjs:224-240 |
| Coordinator Batch mapping (fence-before-submit, state machine, never-accepted resolution) | **PRESENT** — `batch_maps` table + fence/note/adopt/resolve methods | coordinator.mjs:546-556 (DDL), :3740-3855 |
| End-to-end Batch execution flow (fence → submit → poll → report) | **PRESENT but legacy-only** — implemented in `executor.mjs` (:140-240), which the production entry does **not** wire: `worker-entry-prod-d6.js` imports only `createD6Executor` (:271) and instantiates it as the queue consumer (:1824). `executor.mjs` is imported by the tree's non-production entry (`worker-entry.js`) and by utility importers (fingerprint) only | executor.mjs:154-240; worker-entry-prod-d6.js:271, :1824 |
| **D6 (plan-driven) Batch execution** | **ABSENT** — the D6 executor refuses Batch at three independent layers: (1) a batch dispatch payload is refused before claim (d6-executor.mjs:677-684); (2) a job whose lane is outside the allowlist is refused (:688-689); (3) a batch work payload never executes (:841-842). It contains no `submitBatch` call. Meanwhile the D6 work source stamps dispatches with the plan's lane (`mode: view.lane === "batch" ? "batch" : "standard"`, d6-work-source.mjs:114; same in adapters.mjs:806) — so a batch-lane plan's grants would dispatch messages the executor refuses wholesale | d6-executor.mjs:46-50, :677-689, :841-842 |
| Commit / binding path for batch-produced audio | **Machinery PRESENT, integration ABSENT** — flush/verify/commit + binding projection are shared and lane-agnostic at the commit end, but nothing connects a Batch result to them on the D6 path; the legacy flow reports through the legacy report path instead | flush-store/binding-projection via d6-executor commit path; executor.mjs report path |
| Repair chains for Batch failures | **ABSENT on the D6 path** — D6 repair law (executor returns `{repair}` markers; the service owns the chain, REPAIR_MAX_RETRIES 3 inside the 12-attempt segment budget) is written for the Standard executor's outcome shapes; Batch's outcome taxonomy (submitted / ambiguous / rejected / never-accepted / expired) has no D6 repair integration | d6-executor.mjs:52-58 (repair law); gen-constants.mjs:12-18 |
| Quota accounting for Batch calls | **NOT DESIGNED** — the provider-attempt guard's dispatch accounting (`applyDispatchQuota`) is written for the Standard dispatch path; whether a batch submission consumes one provider-attempt slot, and whether polls consume any, has never been ruled (QUOTA-PROPOSAL §5, quoted §4.2). Arming without this ruling would either under-count (a fence bypass) or over-count (Batch unusable) | quota-budget.mjs; QUOTA-PROPOSAL §5 |
| Client Batch exposure | **READY — no client change required** (§4.4) | app-269.js:598-656, :681 |

**Net**: arming Batch on the D6 path is a build, centered on one new component — a Batch execution path inside (or beside) the D6 executor that speaks the coordinator's existing batch_maps contract, reaches the shared commit machinery, integrates the service's repair law, and consumes quota under a new accounting ruling — followed by the one-line allowlist change as the final arming act. The provider adapter and coordinator mapping do NOT need to be built; they need to be *connected* and *proven*.

### 4.4 The client (live build) — what Batch exposure needs

The live client's publication source is established, not guessed: `~/workspace/gen-pkg-1/client-build/genfix1/src/app-269.js` carries the live build marker `d5b-v2-generation-client-3` in-file, and the genfix1 tree is the publication lineage for the live `main` @ `232cc00e…` client. (The `~/workspace/github-repos/opal-reader` checkout is divergent and is NOT the publication source; nothing in this package relies on it.)

In that source, Batch exposure is already fully built and capability-driven:

- The generation sheet renders a Standard/Batch segmented control (app-269.js:598-603).
- On capabilities load, the Batch button's disabled state, styling, and title are set from the server's admission: `genBatchBtn.disabled = !bat.admitted`, title = the server's reason when not admitted (:636-644).
- The click handler selects Batch exactly when the server admits it: "A disabled Batch button never selects anything; when the server admits Batch this same handler selects it" (:652-656), and the submission carries the chosen lane: `submitIntent({ …, lane: ctx.lane, intent })` (:681).

**Consequence**: the moment a production build admits Batch, the live client's Batch button enables itself on next capabilities load — no client build, no publication, no device update. The client side of arming is therefore a *verification* item (an attended device check that the button enables, selects, and submits a batch intent — part of the arming gate, §4.6), not a work item. One wording note: the sheet's helper text already explains the lanes ("Standard makes audio right away. Batch waits for a batch window.", :644), written for this day.

### 4.5 Staging — the test target

The staging worker `opalreader-api-v2` is live (§2: build `2fe71b5f…`, scope `staging-smoke`, generation halted) with its own staging client connector. Consistent with the program's staging-first habits, Batch build work proves there first. What a staging arming test CAN prove without production: the batch execution path end-to-end against the real Gemini Batch API on synthetic content (submit → fence row → poll → retrieval → flush/commit → binding), the batch_maps lifecycle incl. ambiguous and never-accepted handling, quota accounting under the new ruling, repair-chain behavior on a forced batch failure, and the allowlist flip's admission surface (capabilities + intent admission) — all against staging's own store.

What it cannot prove: production parity. Two cautions are recorded as open items rather than assumed away. **OPEN ITEM B-2**: whether the staging worker's deployed entry is the composed tree's `worker-entry.js` (which wires the legacy executor) must be established at build time — staging's wiring materially differs from production's, and a staging pass on the legacy path would prove the components, not the D6 integration. **OPEN ITEM B-3**: whether staging's Gemini calls draw on the same AI Studio prepay balance as production's must be established before any staging provider call; if they share the balance, staging Batch tests spend real (if small) money from the same pot and need a stated test budget.

### 4.6 Risks

- **R-B1 — Admission-before-execution.** Flipping the allowlist before the D6 Batch execution path exists would admit intents whose dispatches the executor refuses wholesale — plans would be created, granted (reserving quota/budget), and refused in a loop of parked/refused outcomes. Mitigation is sequencing law: the allowlist edit is the final commit of the arming gate, never an early step (§4.3 net).
- **R-B2 — Accounting bypass.** Batch submissions/polls outside the quota guard's accounting would silently defeat the 100/day policy cap and the phase projection's attempt assumptions. The accounting ruling (§4.3) is a design-gate deliverable, not an implementation detail.
- **R-B3 — Ambiguity spend.** Batch's defining risk is the ambiguous submission (a POST whose outcome is unknown): the fence + enumeration + never-accepted machinery exists precisely because a blind retry can double-submit and double-spend. The D6 integration must preserve the legacy contract's discipline exactly (fence BEFORE submit; never re-post on a fence alone — executor.mjs:186-192), and its tests must include the crash-between-fence-and-note case.
- **R-B4 — History (context, not evidence).** Julie remembers v1-era Batch as the lane that tangled: in the v1 system, Batch sessions for Forever Pucked became so entangled that the cure was wiping the whole book and re-importing it (main-chat record, Oct 20, 2026). That history is why this workstream's testing burden is set high and why arming is a separate gate after Standard is stable. It is recorded as context for the burden, not as evidence about the v2 components, which are different code.
- **R-B5 — Latency semantics.** Batch completion is provider-paced (a "batch window", unbounded by any Reader-side SLA in the design record). Plans on the Batch lane interact with the driver's pass cadence and the stall/observation habits built for Standard; the design gate must state the expected completion envelope and what "stalled" means for a batch plan, or normal-ops monitoring will misread normal Batch latency as an anomaly.
- **R-B6 — Rollback asymmetry.** A production build that admits Batch, rolled back to a Standard-only build, leaves any in-flight batch maps/plans in a store the older build refuses to advance — the standing rollback pre-holds (halt + pause before any rollback) and the floor law (`6a73d962…` minimum) apply unchanged; the arming gate must state the disposition of in-flight batch work under rollback.

### 4.7 Proposed gate chain (proposal, not a ruling)

Sequenced after Workstream 1's declaration (§3.4 step 5), per Julie's one-program decision:

1. **B-G1 Design gate** — this package's §4 ruled on by Rowan: the D6 Batch execution-path design (which existing contracts it speaks), the quota accounting ruling for submissions/polls (B-1/B-3 resolved or explicitly bounded), the latency/stall semantics (R-B5), rollback disposition (R-B6). Julie's design GO.
2. **B-G2 Build + harness** — local build only: the execution path, repair integration, accounting implementation; the standing batteries plus new Batch batteries (fence/ambiguity/never-accepted, crash-window, accounting, refusal-regression for Standard) — with the standing caveat that harness-green is no evidence for real-DO empty-result paths, so throw-safe tests are explicit.
3. **B-G3 Staging proof** — deploy to staging under its own GO; synthetic-content end-to-end Batch runs incl. forced failure/ambiguity cases; staging evidence record; Rowan source + evidence review.
4. **B-G4 Production arming gate** — census → deploy of the Batch-capable build with the allowlist STILL Standard-only (proving the build is inert) → the allowlist flip as its own recorded act → capabilities read-back (batch admitted) → one bounded Julie-submitted Batch smoke (a segment or chapter she chooses) → observation → execution record + Rowan review. Julie's attended device check (button enabled, §4.4) is part of this gate.

---

## 5. Combined program shape

| Gate | Workstream | Needs from Rowan | Needs from Julie | Character |
|---|---|---|---|---|
| Scoping review (this package) | both | Rulings on §3.3 Q1–Q8; §4 gap acceptance; B-1/B-2/B-3 dispositions | — | Paper only |
| Turn-on gate (§3.4) | 1 | Execution-record review; normal-ops declaration | GO; smoke chapter choice + in-app submission; playback check | Two proven acts + a 7-day soak; no code |
| B-G1 design | 2 | Design ruling incl. quota accounting | Design GO | Paper + source study |
| B-G2 build | 2 | Source review | — (build is local) | The program's one real build |
| B-G3 staging proof | 2 | Evidence review | GO for staging deploy + any staging spend (B-3) | Synthetic content only |
| B-G4 arming | 2 | Execution review | GO; Batch smoke submission; device check | Deploy + one-line flip + smoke |

No time promises are made for any step; effort character only: Workstream 1 is days of paper and observation, Workstream 2 is the program's substantive engineering.

**Cost / free-tier flags.** All infrastructure work stays on the free GitHub + Cloudflare tiers (standing rule); no step in either workstream requires a paid tier — the storage guard's 10 GB boundary is itself a free-tier guard. Generation spend is Gemini prepay, drawn per Julie's standing rule ($20 top-ups at a time, from fun); Workstream 1's smoke and the rest of Forever Pucked (≈ $5.84 expected) sit inside the existing phase budget and the existing prepay balance's purpose. Workstream 2's staging tests may spend small real amounts **only if** B-3 resolves to a shared balance, and then only under a stated test budget in the B-G3 GO. Batch pricing is asserted nowhere (B-1).

---

## 6. What this package does NOT authorize

Everything production. Specifically: no halt flip, no queue unpause, no settings write, no allowlist change, no deploy to any worker (production or staging), no phase binding record, no SubmitJob or other generation command, no containment transition, no quarantine release, no conflicts-row disposition, no parked-job act, and no provider call of any kind. The census in §2 was read-only. Each act named in §3 and §4 requires its own gate and Julie's explicit GO at that gate, exactly as the program has run since October.

— Wren (drafted 2026-11-06; scoping only)
