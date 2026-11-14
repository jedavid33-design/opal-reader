# W-4 TRACK A — A-1 DEPLOYMENT RECORD RECONCILIATION (§3 completion)

**Case:** Opal Roundtable, issue #15 · **Handoff:** `RT-H-20261114-f1488f`
**Authority:** Rowan's deployment execution ruling (board 6880501262), §3 — "Complete the following using existing captured evidence only. Do not perform another production read for this purpose." Completed without any production contact.
**Subject record:** the A-1 deployment execution record, pin `ab8c2539078ac9751b7a880169a59f206cd9eaa1`. **The pinned record is not altered**; this addendum corrects and completes it alongside, per the ruling's instruction to correct transcription error "without changing the historical record silently."

## A. Gate timing — TRANSCRIPTION ERROR CORRECTED

The record's §header stated the window as "approximately 10:56–12:05 ET." **The closing figure was a transcription error.** The actual timestamps, established from existing artifacts (GitHub creation timestamps and the upload response; no production read):

| Event | UTC | ET |
|---|---|---|
| Julie's deployment GO recorded (board 6880173930) | 2026-11-14T15:56:13Z | 10:56:13 |
| Code upload (attempt 1) landed | 2026-11-14T15:58:41Z | 10:58:41 |
| Execution-record pin commit created | 2026-11-14T16:00:38Z | 11:00:38 |
| Board execution summary filed (board 6880247064) | 2026-11-14T16:00:57Z | 11:00:57 |

The counted gate acts, the preservation-first check, the full verification sequence, and the terminal census all completed inside **15:56–16:01Z (10:56–11:01 ET)**; the documentary tail (pin, board summary, Dropbox rotation, chat report) followed within the same attended session and was complete before Julie relayed Rowan's execution ruling at 11:14 ET. The gate window is therefore correctly stated as **approximately 10:56–11:01 ET for the operative acts**, not 12:05. The error was in the closing time only; no act, reading, or result in the record is affected.

## B. Deployment identities — RECONCILED

Two identifier classes coexist for a Worker deployment event, and this gate itself exhibits both:

- **Upload-response `deployment_id`** — returned in the PUT response body (this gate's upload response: `29e92ced663b42788346bc363c652aee`, pinned at the execution pin under `evidence/upload-response.json`).
- **Deployments-list `id`** — the identifier the deployments list assigns the same event (this gate: `67c2263e-3c5e-4698-9925-f0b077d861af`, created 2026-11-14T15:58:41.781263Z).

Both are retained distinctly, as the record already does.

**The pre-deployment C-1 discrepancy is the same duality, now established from an existing artifact.** The earlier paperwork (turn-on execution record and successors) cited the Nov 7, 2026 suspension-close halt flip as deployment `f4c14000d91e4b0f92bbe7be62bbd8e8`. The A-1 gate census's deployments list named the most recent deployment `52147532-8612-4f40-b7f4-c9e6142c9a9d` at 2026-11-07T04:50:45.172912Z. The captured flip response (`turnon-execution/suspension/rehold-put-response.json`, an artifact of that gate) carries `deployment_id: f4c14000d91e4b0f92bbe7be62bbd8e8` with `modified_on: 2026-11-07T04:50:45.172912Z` and the expected etag `d0eb6ea9…` — **the same event, to the millisecond**. The earlier paperwork therefore cited the PUT response's `deployment_id` (a version-class identifier), not the deployments-list `id`. Neither identifier is wrong; they name the same deployment in different identifier classes. This is documented as an identity reconciliation, not as equality of the identifiers.

**main_module normalization.** The executed upload's metadata named the module path **`v2/worker-entry-prod-d6.js`**, and the upload response confirms `entry_point: v2/worker-entry-prod-d6.js`. The proposal's §3 shorthand ("the module part (worker-entry-prod-d6.js)") and any similar shorthand are normalized to the full path here.

## C. Census completeness — THE TWO ABBREVIATED DETAILS ACCOUNTED

**The known adjudicated quota-reconciliation exception.** The gate-entry census (C-8) and the terminal census both read the reconcile surface as `ok: true`, `censusComplete: true`, `drift: []`. The standing exception those readings coexist with is the single adjudicated straddler **`att-37d63768-db4b-447d-8150-580b7c6ee257`**, dispositioned `estimated_unverified` by the Gate-5 adjudication (exactly one adjudication act, Oct 31, 2026) and carried in the phase accounting's estimatedUnverified figure (19,018 units) at both censuses. Its identity is evidenced in existing captures (e.g., the turn-on gate's census artifact `turnon-execution/census/b12-reconcile.json` and the Nov 9, 2026 census filings). **Limitation, identified rather than reconstructed:** the A-1 gate archived the reconcile outcome fields (ok / censusComplete / drift) but did not archive the full reconcile response body; the exception's presence at gate time is therefore established by the `ok: true` reading together with the unchanged phase-accounting figures, not by a gate-time capture enumerating the exception row.

**The six-row containment audit history.** The gate's containment reads (operator route and the `drive=1` surface; the latter archived at the execution pin under `evidence/drive1-pre.json`) return the state row and the closed-episode summary — NORMAL, verified, `updatedAt` 1793933356719, prevEpisode 3 with 1 attempt, not exhausted — and do not enumerate the audit table. The "audit history = 6 rows" figure in the standing record is a **documentary accounting**: the append-only `d6_containment_events` rows appended by the filed containment transitions across the C1 deployment, the C3 operational verification, and the standalone restoration (each transition's own gate record is the evidence). **Limitation, identified rather than reconstructed:** no gate-time capture enumerates the six rows; the A-1 gate established the state row and episode summary only, exactly as its census stated. The terminal census artifacts already collected are preserved unchanged at the execution pin.

## Disposition

All three §3 items are complete on existing evidence. The reconciliation reveals **no substantive deviation**: the deployment, its two counted attempts, the preservation verification, and the terminal census stand exactly as Rowan's ruling accepted them. No new deployment review cycle is required (ruling §3). The A-1 deployment gate is closed; its mutation ceiling is exhausted; no residual authority survives it.

**Turn: Julie's** (the L-1 preparation GO). Then Rowan's (L-1 package review) and Wren's.
