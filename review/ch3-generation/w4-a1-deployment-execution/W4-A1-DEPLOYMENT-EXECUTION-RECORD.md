# W-4 TRACK A — A-1 DEPLOYMENT EXECUTION RECORD

**Case:** Opal Roundtable, issue #15 · **Handoff:** `RT-H-20261114-c872f3`
**Gate window:** Saturday 2026-11-14, attended, ~10:56–12:05 ET (Julie present throughout; exclusive control held).
**Authorization:** Julie's deployment GO (board 6880173930), given on Rowan's deployment-proposal ruling (board 6879916107).
**Operative specification:** the deployment proposal (pin `021a2fd9…`) as amended by ruling conditions D-G1–D-G6.
**Verdict: EXECUTED — ALL CHECKS PASS. Gate concludes HELD.** Counted administrative mutation attempts: **2 of a maximum 2** (D-G2 ceiling respected). No repair evaluation, no acknowledgment, no stimulus, no generation release occurred.

Review pin (repo `jedavid33-design/opal-reader`, branch `ui1-review`): `<PIN>`

## 1. Gate-entry census (all 15 items PASS at their expected values)

Executed immediately before composition/upload; reads via the operator and client connectors (production scope) and the Cloudflare API. No deviation on any item; no 1101 signature on any read (C-15 satisfied by the reads themselves plus Julie's presence and clearance in the window).

| # | Item | Observed (= expected) |
|---|---|---|
| C-1 | Deployments | latest `52147532-8612-4f40-b7f4-c9e6142c9a9d` at 2026-11-07T04:50:45Z (the halt flip); code deployment `ee7bcb14…` at 2026-11-07T01:25:44Z |
| C-2 | Script etag | `d0eb6ea9b378eaed9a42a4a481d3b5738dc733c13d690463b85a1b918b4674a3`, 1,516,396 B (GET artifact saved, R4) |
| C-3 | /health | build `ef69b8f91dad3acbed0b9c36cf3c11e238e27f72`; generation `halted`; coordinator `armed` |
| C-4 | Settings | 10 bindings; `GENERATION_HALT` `"1"`; `OPALREADER_PHASE_POLICY` `"enforce"`; compatibility `2026-08-29` + `nodejs_compat`; observability enabled + logs persisted (full object captured) |
| C-5 | Queue | `delivery_paused: true`; sole consumer `f260f2188d80426bb0588685e9d084eb` |
| C-6 | Containment | NORMAL; known true; absent false; verified true; `updatedAt` 1793933356719; prev episode 3, 1 attempt, not exhausted, closedAt 1793933356719 |
| C-7 | Capabilities | `generationState: halted`; standard admitted; batch `admitted: false` (`batch_not_armed`) |
| C-8 | Quota reconcile | `ok: true`; censusComplete true; drift [] |
| C-9 | Phase accounting | both surfaces identical: settled 1,406,466; estimatedUnverified 19,018; reservedUnverified 5,648; unknownOpen 0; remaining 12,087,886 of 13,500,000 |
| C-10 | Conflicts | exactly the four preserved rows (ids 1–4 with their recorded occurrence ids) |
| C-11 | Plans | exactly 6 at expected states/totals (smoke `parked_quota` 19/20; four complete; old Ch 2 `retired`); parked Ch 3 job `1832c21f…` `parked_policy` rev 1, grants [] |
| C-12 | Settings | revision 1; monthlyCap 50; lane standard (two surfaces agree) |
| C-13 | Recorder | latest pass 451 at 1794024228557, complete; `armedAt` 1794024828557; pending 1/1; `recordingFailures` 0 |
| C-14 | Watermarks | content 18 / bindings 1861; no changes beyond |
| C-15 | Fault clearance | all census reads answered normally; no fault signature; GO validity and exclusive control confirmed in-window (D-G1) |

## 2. Candidate and composed-artifact identities

- Candidate tree re-hashed at gate time against the accepted RC manifest (pin `8a16def4…`): **31 parts, zero mismatches, no extra files.**
- Stamped set: a deploy copy in which exactly one part differs — `v2/host/build-identity.mjs` — and within it only the `BUILD_COMMIT` string (`86ad06ab…` → `8a16def42e941790ef2eeb460366bb19ef977801`), verified byte-for-byte outside that string. Stamped part SHA-256: `d1c90ca0d3ce8d65981426d50a69fed1635c98c5d3557abb3dc609c064685700`. The candidate tree itself was never modified.
- Composed artifact identity: the multipart upload body (1,557,787 B; 31 file parts + metadata); the resulting script etag is recorded at §3.

## 3. Counted mutation ledger (D-G2: maximum two attempts)

**Attempt 1 — code upload.** Multipart PUT to the scripts endpoint for `opalreader-api-v2-prod` at 2026-11-14T15:58:41Z: metadata `main_module: v2/worker-entry-prod-d6.js`, compatibility carried from the census settings, 10 bindings carried with the three secrets as `{"type":"inherit"}` (no secret value read or carried). **Result: HTTP 200, success true, errors [].** Upload response: deployment_id `29e92ced663b42788346bc363c652aee`; new script etag `611a23c8aa326160441a33a4b83c0c1a32f6cf2b81c6ad0a53978e9bf29131fb`; deployments list records the new deployment as `67c2263e-3c5e-4698-9925-f0b077d861af` at the same timestamp. Outcome: **confirmed landing** (no ambiguity; no retry made or needed).

**Attempt 2 — observability restoration PATCH (conditional, exercised).** The post-upload script-settings read showed observability **null** (the upload reset it) with every other protected setting correct — the exact condition D-G2 permits. One multipart PATCH to `/workers/scripts/opalreader-api-v2-prod/settings` (single `settings` part) restored the census-captured observability object. **Result: HTTP 200, success true.** Read-back: observability identical to the census object (enabled; logs enabled + persisted); **script etag unchanged** (`611a23c8…`, 1,554,619 B) — the PATCH touched no code.

No other mutation of any kind was attempted.

## 4. Preservation-first verification (D-G3, immediately post-upload)

Before all other verification: upload outcome and deployment identity established (§3); `GENERATION_HALT` still `"1"`; queue still paused with the same sole consumer; the full binding inventory **byte-identical** to the census capture (all 10 bindings, names/types/values); compatibility unchanged; observability dispositioned (§3, attempt 2) and re-verified with script identity. All preserved.

## 5. Remaining verification (§6 sequence, as amended by D-G4)

1. **/health**: build **`8a16def42e941790ef2eeb460366bb19ef977801`**; generation `halted`; coordinator `armed`.
2. **Repair-status #1**: HTTP 200; `initialized: true` with verified zero state (projection strikes 0; derivation verified, effectiveStrikes 0; no intents; no events) — the D-G4 permissible case (cold construction initialized the additive schema; recorded here as the expected deployment-adjacent effect, per D-G4).
3. **Diagnostics `drive=1`**: recorder unchanged — latest pass 451 at 1794024228557, complete; reported registration `armedAt` **1794024828557, bit-identical across the upload**; pending 1/1; `recordingFailures` 0.
4. **Repair-status #2**: initialized true; strikes 0; events 0; unresolved [].
5. **Containment**: NORMAL, verified, `updatedAt` 1793933356719, episode summary unchanged.
6. **Capabilities**: `halted`; batch `admitted: false` (`batch_not_armed`).

## 6. Route-admission results (§7 / D-G5 classification)

- Credential-less `GET /v2/d6-repair-status` (routing headers present, operator credential omitted): **HTTP 403** `migration_operator_required`.
- Credential-less `POST /v2/d6-repair-evaluate`: **HTTP 403** `migration_operator_required`.
- Operator-credentialed `POST /v2/d6-repair-evaluate` with body `{}`: **HTTP 400** `repair_body_not_allowed` (`repair_action_not_allowed`). Classification per D-G5: DO contact YES; valid repair operation NO; evaluation invoked NO; acknowledgment invoked NO; repair-handler mutation NONE.
- **No valid-body POST was made.** No evaluation or acknowledgment was invoked at any point in the gate.

## 7. Terminal census (D-G6 — compared against the §1 gate-entry baseline)

Quota reconcile `ok: true`, censusComplete true, drift []; phase accounting identical (settled 1,406,466 / estimated 19,018 / reserved 5,648 / remaining 12,087,886); conflicts exactly the same four rows; all six plans at identical states and totals; parked job `parked_policy` rev 1, grants []; application settings revision 1 (cap 50, lane standard); watermarks content 18 / bindings 1861. **Protected state unchanged**, apart from the authorized code deployment, the restored observability configuration, and the empty additive repair schema. All terminal hold conditions established: halt asserted, queue paused, containment NORMAL.

## 8. Deviations, STOPs, and unresolved observations

- **Deviations: none.** No STOP fired. No ambiguous outcome occurred (both mutations returned confirmed landings on their single attempts).
- Documentary observations (recorded, not acted on): (i) the census deployments list names the Nov 7 halt-flip deployment `52147532…` where older paperwork cited `f4c14000…` (a version identifier in the upload responses of that era) — timestamps and substance agree; (ii) repair-status #1 already read `initialized: true` (the D-G4 permissible case, §5.2); (iii) the upload response's `deployment_id` (`29e92ced…`) and the deployments-list id (`67c2263e…`) are both recorded as returned (§3).
- Runtime adoption by every DO instance is **not** established by this gate (standing limitation, unchanged). Offline evidence does not establish platform alarm delivery (unchanged).

## 9. Closing state

**HELD.** Build `8a16def42e941790ef2eeb460366bb19ef977801` is live; `GENERATION_HALT` `"1"`; queue paused; containment NORMAL; the repair machinery is deployed, initialized, empty, and **unused**. First production use remains for L-1, separately gated. A-3 remains separately gated. Rollback was not needed and remains separately authorized (target: the pre-A1 S1 build `ef69b8f9…`; repair tables remain in place under it, per T-36). W-4 remains an **OPEN HISTORICAL DEVIATION**.

**Turn: Rowan's** (documentary review of this execution record). Then Julie's, for whatever comes next.
