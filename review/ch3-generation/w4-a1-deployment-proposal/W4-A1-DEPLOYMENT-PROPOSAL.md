# W-4 TRACK A — A-1 DEPLOYMENT PROPOSAL

**Case:** Opal Roundtable, issue #15 · **Handoff:** `RT-H-20261114-b59a9b`
**Date:** 2026-11-14
**Basis:** Rowan's final implementation ruling (board 6879483631) — FINAL IMPLEMENTATION ACCEPTANCE; deployment-proposal preparation cleared, subject to Julie's preparation GO (given 2026-11-14, board 6879495050).
**What this document is:** a proposal for documentary review. **It authorizes nothing.** Deployment requires (a) Rowan's documentary review of this proposal, then (b) Julie's separate deployment GO. **This proposal contains an explicit confirmation (§11) that no repair evaluation or acknowledgment forms part of the deployment gate.**
**Production state at preparation:** HELD (generation halted, queue paused, containment NORMAL). Preparation made **no production reads and no production contact of any kind**; every production value below is an expectation drawn from the standing record (gate-morning census 2026-11-09; last recorder observation 2026-11-12; the weekly peek of 2026-11-14), to be re-established by the gate-time census (§2) before any upload.

Review pin (repo `jedavid33-design/opal-reader`, branch `ui1-review`): `<PIN>`

## 1. Immutable candidate identity and manifest

The candidate is the RC-corrected tree accepted at pin **`8a16def42e941790ef2eeb460366bb19ef977801`** (repo `jedavid33-design/opal-reader`, branch `ui1-review`). It descends from the manifest-verified S1 candidate tree (the live build's source) and differs from it in **exactly two parts**; the remaining 29 are byte-identical; part count 31.

| Part | SHA-256 |
|---|---|
| `v2/coordinator.mjs` | `39486a7078c6b162520161064613b7488d762067d8e62ba9f9da1b6d933fbf81` |
| `v2/worker-entry-prod-d6.js` | `4e2bed3c7e976db7f514e7d43a92af7d1c6a2a8afcd6d98c62c980aa2d54858b` |

The complete 31-part manifest is pinned with the implementation packages (`A1-CANDIDATE-MANIFEST.md`, corrections pin `c6930dcf…`, RC pin `8a16def4…`; the RC pin's manifest is the operative one). At gate time, before composition, the executor re-hashes the local candidate tree against that manifest; **any mismatch is a STOP** (executor STOP law).

**Build identity:** the deterministic artifact builder substitutes `BUILD_COMMIT` in `v2/host/build-identity.mjs` at compose time with the exact source commit (the part itself is byte-identical to the base pre-build, as in every prior deploy in this chain). The composed artifact for this deployment therefore carries build **`8a16def42e941790ef2eeb460366bb19ef977801`**, and post-deployment `/health` must report exactly that build. Any other reported build is a STOP-and-report condition.

**Accepted evidence (offline, at its stated strength):** A-1 battery 47 pass / 0 fail / 5 deferred-skips at acceptance; S1 9/9; containment 42/42; P2 33/33; R5A 23/23; V-3 5/5 (159 passing). The T-27 evidence supplement (§10) adds one test (T-27s) executed after acceptance on the identical candidate tree: battery now 48 pass / 0 fail / 5 skipped in the complete rerun pinned with this proposal. These results establish offline implementation behavior under modeled conditions. **They do not establish platform alarm delivery.**

## 2. Pre-deployment census (turn-on-2 grade; executed at gate time, before any upload)

The census is a **gate-time procedure under the future deployment GO** — it is specified here, not executed by preparation. Every item has an expected value from the standing record; **any deviation, however small, is a STOP**: preserve state, report the deviation and the proposed explanation to Julie and Rowan, and proceed only on a fresh explicit GO or ruling for that deviation (executor STOP law, standing since 2026-10-31). Reads use the operator connector (production scope headers) and the Cloudflare API; the queue state is proven by cf-api read-back (the Worker cannot read it).

| # | Item | Expected (standing record) |
|---|---|---|
| C-1 | Worker identity: script `opalreader-api-v2-prod`, latest deployment the 2026-11-07 halt flip (`f4c14000…`); code deployment `ee7bcb14…` of 2026-11-07T01:25:44Z | unchanged |
| C-2 | Script etag | `d0eb6ea9b378eaed9a42a4a481d3b5738dc733c13d690463b85a1b918b4674a3` (1,516,396 B) — captured and saved as an artifact at census (R4) |
| C-3 | `/health`: build + generationState | build `ef69b8f91dad3acbed0b9c36cf3c11e238e27f72`; `generationState: halted` |
| C-4 | Settings bindings | 10 bindings; `GENERATION_HALT` = `"1"`; `OPALREADER_PHASE_POLICY` = `"enforce"`; observability enabled + persisted (full settings captured for the §4 before/after comparison) |
| C-5 | Queue `opalreader-generation-v2` (`93b6a35f…`) | `delivery_paused: true`; sole consumer `f260f2188d80426bb0588685e9d084eb` |
| C-6 | Containment (`GET /v2/d6-containment`) | NORMAL; known true; absent false; verified true; `updatedAt` 1793933356719; closed-episode summary: episode 3, 1 attempt, not exhausted; audit history 6 rows |
| C-7 | Capabilities | `generationState: halted`; Batch `admitted: false` (`batch_not_armed`) |
| C-8 | Quota reconcile (`GET /v2/d6-quota-reconcile`) | `ok: true`; censusComplete true; drift []; sole exception the adjudicated straddler `att-37d63768…` (`estimated_unverified`) |
| C-9 | Phase accounting (forever-pucked, both surfaces) | settled 1,406,466; estimatedUnverified 19,018; reservedUnverified 5,648; unknownOpen 0; remaining 12,087,886 of 13,500,000 |
| C-10 | Conflicts | exactly the four preserved `schedule_dead` rows (ids 1–4, 2026-10-29 – 2026-11-01, as recorded); none cleared (Q6) |
| C-11 | Plans | exactly 6: smoke `plan:8f14c888…` `parked_quota` (19/20); `plan:3183ecbf…` complete; `plan:603ab416…` retired; `plan:b2dc2a3d…` complete; `plan:e377a555…` complete; `plan:19cad189…` complete; parked Ch 3 job `1832c21f…` still `parked_policy` rev 1, grants [] |
| C-12 | Settings | revision 1 (lane standard, cap $50) |
| C-13 | Recorder (`GET /v2/d6-diagnostics?drive=1`) | latest pass id 451 at 1794024228557 (2026-11-07T04:03:48Z), complete; reported registration `armedAt` 1794024828557; pendingSchedule 1; pendingWatchdog 1; `recordingFailures` 0. (A newer pass or a changed registration at census is a deviation to report, not to act on — it would mean the chain revived spontaneously, which changes the gate's premises.) |
| C-14 | Sync watermarks | content 18 / bindings 1861 |
| C-15 | Fault clearance (WAIT law) | no 1101 signature in the census reads themselves, and Julie's affirmative clearance that no fault is active or suspected at execution time |

## 3. The upload operation and the permitted mutation inventory

**Composition:** the deployable artifact is composed locally from the pinned candidate tree by the deterministic builder (BUILD_COMMIT substitution per §1), producing the ES-module part set for worker `opalreader-api-v2-prod` with entrypoint `worker-entry-prod-d6.js`.

**Upload:** one multipart upload to the Cloudflare Workers scripts API for `opalreader-api-v2-prod`:
- metadata sets `"main_module": "worker-entry-prod-d6.js"`; the module part is named `worker-entry-prod-d6.js` with content type `application/javascript+module`;
- `compatibility_date` preserved from the current script settings (`2026-08-29`, `nodejs_compat`);
- every existing secret binding is sent as `{"type":"inherit","name":"…"}` — values are never read, reset, or replaced;
- all other bindings are carried from the census-captured settings, unchanged.

**Permitted mutations — the complete inventory (counted acts):**
1. **The code upload** (one act).
2. **At most one settings PATCH, observability only, conditionally:** code uploads in this chain can reset script-settings observability to null. After the upload, the executor GETs script-settings; **if and only if** observability is null, one multipart PATCH to `/workers/scripts/{name}/settings` (single `settings` part) restores the recorded observability object (enabled + persisted) — then the script etag is re-read to prove the PATCH did not touch code. If observability survived, no PATCH occurs.
3. **Nothing else.** No halt flip (`GENERATION_HALT` stays `"1"`), no queue change (stays paused), no binding change, no consumer change, no containment transition, no settings write, no command, **no repair evaluation, no repair acknowledgment** (§11).

Deployment concludes **HELD** by construction: the only state that changes is the running code (plus, conditionally, restored observability metadata).

## 4. Preservation of bindings, configuration, observability, halt, and queue pause

Immediately after the upload (and after any §3.2 PATCH), the executor reads back the full script settings and compares them against the census capture (C-4):
- identical binding names and types; identical plain-text values — in particular `GENERATION_HALT` `"1"` and `OPALREADER_PHASE_POLICY` `"enforce"`;
- compatibility configuration unchanged;
- observability enabled + persisted (post-PATCH if the PATCH was needed);
- queue read-back (C-5) re-taken post-upload: still paused, same sole consumer.
Any difference beyond the code parts themselves is a STOP-and-report condition. Secret values are never exposed by the settings surface (names + types only) and are never requested.

## 5. Schema-initialization effects and read-back expectations

The candidate adds one additive schema effect, exercised by **ordinary operation, not by any executor act**: on the first coordinator construction that is not read-facaded after deployment, the constructor executes the existing `SCHEMA` (unchanged, idempotent) and the new `REPAIR_SCHEMA`, which creates `d6_repair_state` and `d6_repair_events` if absent and inserts the singleton state row (`INSERT OR IGNORE`, id = 1, zero counters). Properties:
- **Additive only**: no existing table, row, or value is altered; the effect is identical in kind to the containment schema's lazy creation.
- **Idempotent**: repeated constructions are no-ops.
- **The read-only audit route never initializes**: `GET /v2/d6-repair-status` constructs its coordinator through the read-surface pattern (`ASSUME_SCHEMA`), so a status read before any ordinary DO traffic reports `initialized: false` — **that is an expected read-back state, not a failure** — and creates nothing.
- The first ordinary DO-touching verification read (§6) performs the initialization as a side effect of normal operation; a subsequent repair-status read then reports `initialized: true`, projection zero, authoritative derivation verified with zero strikes and no events.

No other data effect is expected from deployment. In particular the upload itself writes no DO data.

## 6. Post-deployment verification (read-only, in this order)

1. **Deployments list**: exactly one new deployment, timestamped within the gate window; its script content is the composed artifact.
2. **Script etag**: read via an in-process GET (headers), recorded and saved as an artifact (R4). It will differ from C-2; the new value becomes the standing record.
3. **`/health`**: build `8a16def42e941790ef2eeb460366bb19ef977801`; `generationState: halted`.
4. **`GET /v2/d6-repair-status`** (operator): 200; `initialized` either false (no ordinary DO traffic yet — expected) or true with zero strikes; no error.
5. **`GET /v2/d6-diagnostics?drive=1`** (operator): recorder unchanged — latest pass 451, `armedAt` 1794024828557, pending 1/1, `recordingFailures` 0. **The reported registration is expected to survive the upload bit-identical** (incident-proven three times pre-S1; across-upload survival generally remains UNSPECIFIED — a changed value is reported as an observation, and is a STOP-for-review condition, not something the executor acts on).
6. **`GET /v2/d6-repair-status`** again: now `initialized: true`; derivation verified; effective strikes 0; unresolved intents []; events [].
7. **`GET /v2/d6-containment`**: NORMAL, verified, episode summary and `updatedAt` identical to C-6; audit history still 6 rows.
8. **Capabilities**: `generationState: halted`; Batch still `admitted: false`.
9. **Settings + queue read-backs** per §4.
10. **Client sanity**: the live client is untouched by this deployment (no client publication); no client verification beyond /health is in scope.

Verification failure at any step: STOP, no further act, report to Julie; the rollback question (§9) is Julie's.

## 7. Non-mutating route-admission verification

For the two new routes, admission is proven **without any use of the repair operation**:
1. Credential-less `GET /v2/d6-repair-status` → HTTP 403 (`migration_operator_required` posture).
2. Credential-less `POST /v2/d6-repair-evaluate` → HTTP 403.
3. Operator-credentialed `POST /v2/d6-repair-evaluate` with body `{}` → HTTP 400 `repair_body_not_allowed`. (Body validation runs in the entry branch **before** any coordinator contact; this call writes nothing and invokes no evaluation — proven offline by the battery's routed tests.)
4. Operator-credentialed `GET /v2/d6-repair-status` → HTTP 200 (this is §6.4/§6.6).
**No valid-body POST to the evaluate route is made at any point in this gate.**

## 8. STOP conditions and ambiguous-outcome handling

- **Census deviation** (any §2 item): STOP before upload; report; fresh GO or ruling required for the deviation (executor STOP law).
- **Candidate hash mismatch** at gate time: STOP; no composition.
- **Ambiguous upload outcome** (timeout, connection loss, non-JSON error): **do not re-upload.** Read back the deployments list and the script etag first; establish whether the upload landed; only a proven non-landing may be re-attempted, and only within the same GO after reporting the ambiguity to Julie.
- **1101 signature at any point** (DO-backed routes 500 while /health answers): Julie's WAIT law — take no response action of any kind; the gate suspends; report and wait.
- **Observability PATCH failure**: STOP and report plainly that the code is uploaded but observability restoration failed; do not improvise a second mechanism.
- **Post-deployment verification mismatch** (§6): STOP; no corrective act beyond reporting; rollback is separately authorized (§9).
- **Foreign activity** (any state movement not attributable to this gate's counted acts): STOP and report.

## 9. Rollback procedure (separately authorized — NOT part of this gate)

Rollback is **not** authorized by the deployment GO and requires Julie's separate explicit authorization after a reported need. If ever authorized, the procedure of record is:
- **Target:** the pre-A1 build — the S1 candidate (build `ef69b8f91dad3acbed0b9c36cf3c11e238e27f72`, etag at census `d0eb6ea9…`) — redeployed from its pinned tree by the same compose-and-upload mechanics, with the same bindings/observability preservation and read-backs.
- **Preconditions:** halt asserted and queue paused confirmed by read-back before the rollback upload; an external accounting archive of the phase/quota state taken first.
- **Data posture:** the repair tables created under A-1 **remain in place**; the pre-A1 build never references them (offline-proven: T-36 executes the base build against populated repair tables incl. an unresolved intent — containment and diagnostics operate, repair rows untouched). No data deletion accompanies a rollback.
- **Floor law (permanent):** build `6a73d9622e1b4eac00c58e289de1c674ed6b3d6b` is the minimum build that may ever run against this data; it does not enforce the provider-attempt counter and must never be represented as a safe re-arm fallback. The A-1 rollback target (the S1 build) sits above that floor and carries its own adjudication compatibility, as established in the standing record.

## 10. The T-27 evidence supplement and preserved deferrals

**Supplement (final ruling §4):** test **T-27s**, added to the A-1 battery after acceptance and run on the identical candidate tree (no production source change resulted; the battery stands at 48 pass / 0 fail / 5 skipped in the complete rerun pinned with this proposal):
- **Full-row comparisons**: after the first modeled delivery vs after the duplicate, `SELECT *` over **all columns** of `ledger_ops` and `outbox` are exactly equal (deep equality on complete rows) — closing the projection-level qualification on the accepted T-27.
- **Due-work confirmation**: the first modeled delivery demonstrably **processes due work** — the pending watchdog row whose due the repair registered transitions to done, its pass is recorded complete, and continuation arms a fresh pending watchdog row.
- The ruling's stop condition did not trigger: the stronger assertions exposed **no substantive defect**.

**Preserved deferrals (unchanged; none reported as passed):**
- T-12, T-21, T-22 — DEFERRED to A-3 (scheduler tests; A-3 separately gated).
- T-29 — DEFERRED to L-1 (first-pass witness criteria; L-1 separately gated).
- T-24b — procedural (the attended execution fence's human elements; discharged in future execution paperwork, not in the harness).
- B-G2 battery — DEFERRED TO COMPOSITION (tree-bound; accepted disposition; rerun obligation attaches to the separately authorized composed candidate).
- Runtime adoption by every DO instance — not established by this deployment either; deployment proves script delivery plus the §6 read-backs only.

## 11. Explicit exclusions — confirmation

**No repair evaluation and no repair acknowledgment is part of this deployment gate.** The evaluate route is touched only by the §7 admission checks, which cannot invoke an evaluation. Also excluded: generation release of any kind; containment transitions; queue or settings changes (other than the conditional observability restoration of §3.2, which restores the pre-existing configuration); scheduler activation or entrypoint work (A-3); L-1 execution; Batch/WS2 in any form; book onboarding; conflicts-row disposition (Q6 preserved); any stimulus or wake act. **Deployment concludes HELD**: halt asserted, queue paused, containment NORMAL, recorder state untouched.

## 12. Execution shape (for the future GO)

- Attended: Julie present and holding exclusive control for the gate's duration; no other operator activity against production during the window.
- Counted acts: the §3 inventory only (1 upload + at most 1 conditional PATCH). Every act is recorded in a gate ledger with its full request/response identity as it happens; the execution record is pinned and filed for Rowan's documentary execution review, as in prior gates.
- Timing: no urgency attaches to this deployment (Julie's standing no-hurry posture for the Reader workstream); the gate runs when Julie chooses, in a single attended window.

**Turn: Rowan's** (documentary review of this proposal). Then Julie's, for the deployment GO decision.
