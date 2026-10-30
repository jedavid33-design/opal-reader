# gen-pkg-1 DEPLOY PLAN — AMENDMENT: OPTION B (PAUSE-FIRST CONTAINMENT)

**Status: review-only amendment — authorizes nothing.** This
document amends the signed Gate 1 operational plan
(`DEPLOY-PLAN.md` + `DEPLOY-PLAN-ADDENDUM-D0D4.md`, Rowan
final sign-off 6527392384) in exactly the respects named in
§2 below, in response to Rowan's D0 grant-lifecycle re-review
(issue #15, comment 6528590586), which rejected Option A,
selected the Option B pause-first containment route **for
planning**, and required a narrow, executable amendment for
focused re-review. It builds on Rowan's D0 STOP disposition
(6528308537, ruling (ii)) and the grant-lifecycle correction
(`DEPLOY-PLAN-ADDENDUM-D0-GRANT-LIFECYCLE.md`, pinned at
`b0e85809204443184e3bc896e377effa5565e8d9`), whose evidence
Rowan accepted in part. **No Reader code, no baseline suite,
and no prior evidence is changed by this amendment.**

**Revision note.** This text incorporates the three narrow
procedural corrections of Rowan's focused review of the
original amendment filing (6528867886): **OB-1** — the
executable order is fixed to Step P → Step D0 → Step D1 →
Step R → Step D2 → Step D3 → Step D4 → Step S (§3);
**OB-2** — Step P STOP semantics are "no subsequent
mutation", with the queue state recorded UNKNOWN unless a
trustworthy read-back establishes it (§3 Step P, §4);
**OB-3** — supersessions **S9/S10** (§2) replace the
remaining blanket "live grant" STOP phrases in addendum
§§C/D with the scoped S3 criterion. Nothing else changed.

**Authorization status — read first.** This amendment changes
the signed live sequence: the queue-delivery pause moves from
D2 (inside the gate) to a new Step P **before** D0. Per
6528590586, Julie's earlier Gate 1 approval (6527603308) and
her conditional continuation (6528244638 — ruling-(i)-only)
do **NOT** authorize this changed procedure. Execution of
every step below requires, in order: (1) Rowan's acceptance
of this amendment on focused re-review, and then
(2) **Julie's separate production authorization for the
changed procedure as a whole**. Until both exist, Gate 1
remains STOPPED and no step below — including the Step P
pause itself — may be performed.

---

## 1. What this amendment does, and only what it does

1. Adds **Step P**: a separately authorized queue-delivery
   pause + read-back as the **first live mutation**, before
   D0 (§3, Step P).
2. Re-runs **D0 fresh under containment**, applying the
   per-grant non-dispatchability criterion of the
   grant-lifecycle addendum (§2 there) in place of the
   superseded all-terminal-grants test (§3, Step D0).
3. Supersedes the specific signed language listed in §2 —
   nothing else (§2).
4. States the containment / re-arm distinction as an
   operative condition of Gate 1 (§5).

Everything else in the signed plan and addenda stands at full
strength: D1's exact pin/envelope/ancestry proof and the
adversarial spoofed-planId test; the §C immediate pre-upload
quiescence re-check; D2's upload (envelope lands with
GENERATION_HALT `"1"`); D3 observability; D4 read-backs
including exhaustive plan-list and diagnostics verification
on the candidate; the Julie-attended playback/sync smoke
while halted; the rollback section (rollback is Julie's
separate decision, never silent); and every STOP condition
not explicitly superseded in §2.

---

## 2. Supersessions — exact list

The following signed language is superseded **only** as
stated. Where replacement text exists in the grant-lifecycle
addendum, that text is incorporated by reference and becomes
operative plan language on Julie's authorization of this
amendment.

| # | Location | Superseded language | Replacement |
|---|---|---|---|
| S1 | Addendum §A, G10 smoke job row | "terminal; its grant terminal (`reported`)" | Grant-lifecycle addendum §1.1 corrected row: job state `generating`; its one grant `grant:plan:3183ecbf2ac4bf50bbc6166e:seg:1:full` in state `issued`, revision 2; the occurrence `ready`, execution `committed`; non-dispatchability assessed per grant-lifecycle §2.1. (Rowan, 6528590586 finding 1: §A's `reported` claim was erroneous.) |
| S2 | Addendum §A, FP Chapter 2 job row | "job view grants: none live (see §B.4)" | Grant-lifecycle addendum §1.1 corrected row: job state `generating`; its one grant `grant:plan:603ab416bd67ab1b25de97be:ch1:1:full` in state `issued`, revision 2; its 18 occurrence rows `granted`; non-dispatchability assessed per grant-lifecycle §2.2, including the disclosed stale-message leg (§2.2(e) there) at its true strength. |
| S3 | Addendum §B.4 | The classification "a grant in state `issued`, `delivered`, or `handoff_uncertain` is live/grantable work and is a STOP; every grant must be in a terminal state (`reported`, `voided`, `superseded`, `closed`)" — as applied to D6 grants | The **per-grant non-dispatchability criterion** of grant-lifecycle addendum §§1.2 + 2, **as applied under Step P pause-first containment** (§3, Step D0): each inventoried grant is assessed element-by-element (grant/job state and revision; lease-row disposition read live from `GET /v2/conflicts`; per-occurrence execution outcomes; quota/ledger immobility across both samples; the code-derived outbox/claim elements anchored to the re-verified live-build identity). This supersession is **scoped**: it covers exactly the two inventoried grants in exactly their recorded states. Any grant **not** in the §A inventory, in any state, remains an unconditional STOP (inventory incomplete). Either inventoried grant appearing in any state or revision other than the recorded `issued` / revision 2 is a STOP. §B.4's remaining rules stand (per-plan state/stopReason/entry accounting must match §A exactly; non-terminal execution records are a STOP beyond the one named Ch 2 `unknown_billing` artifact). |
| S4 | Addendum §B.5 | The reliance on "§B.4's all-terminal grants result" as the compensating evidence for the live build's lack of an outbox read surface | Three-part replacement, no element of which overclaims: (i) the grant-lifecycle §2.0(b–c) derivation — both lease schedule rows read **dead** on a live surface (`GET /v2/conflicts`), with the delivered-branch elimination against the observed end-state; (ii) **Step P containment** — from the pause read-back onward, no queue message can be delivered to either build for the duration of the gate, so the redelivery hypothetical is removed from the gate environment rather than argued away; (iii) the **standing residual disclosure**: the queue's own ACK state and message depth have **no live read surface** (§B.6's limitation is NOT cured by this amendment), outbox/claim states remain derived, and nothing in Gate 1 is represented as proof that no previously accepted queue message exists — the consequence of that residue is assigned to the re-arm gate, §5. §B.5's closing sentence stands verbatim: no stronger outbox claim is made. |
| S5 | Addendum §B.6, expected queue state at D0 | "delivery ENABLED (the armed state)" | Under this amendment, the expected and **required** queue state at the fresh D0 is delivery **PAUSED** (effected at Step P and read back), sole consumer `f260f2188d80426bb0588685e9d084eb` on `opalreader-api-v2-prod` (batch 10 / retries 3), producers unchanged. §B.6's no-depth-field limitation stands unchanged. |
| S6 | Addendum §D.3 | "grants arrays unchanged from D0, **all terminal**" | Grant-lifecycle §1.2 correction: grants arrays at D4 must be **unchanged from the fresh D0** — same grant IDs, same `issued` states, same revisions. "All terminal" is deleted; it was the same error as S1/S3 on the post-state side. |
| S7 | Main plan, in-flight assessment ¶(a) | "with **every grant in a terminal state** and no non-terminal execution beyond the one named Ch 2 `unknown_billing` artifact" | "with every inventoried grant satisfying the per-grant non-dispatchability criterion (addendum §B.4 as superseded by Amendment Option B §2/S3, applied under Step P containment) and no non-terminal execution beyond the one named Ch 2 `unknown_billing` artifact". The remainder of the in-flight assessment — closed inventory, two identical samples ≥10 minutes apart, Ch 2 `halted_unknown`, Ch 3 `parked_policy` + fingerprint, settings revision still 1, unknown inventory item = STOP, no in-flight variant — stands unchanged. |
| S8 | Main plan, D2 step 1 | "Pause queue delivery first" **as a D2 act** | The pause is performed at **Step P** (§3), before D0, under the authorization named there. D2 retains the pause as a **verified precondition**: immediately before the upload, queue delivery is read back and must still show `delivery_paused == true`; any other reading is a STOP (unexplained state movement; §4). The D2 upload itself, its multipart form, and its metadata (including GENERATION_HALT `"1"`) are unchanged. |
| S9 | Addendum §C, STOP sentence | "**Any** active plan, **live grant**, non-terminal execution (beyond the named Ch 2 artifact), moved ledger, moved watermark, or queue-state change = **STOP**" — the term "live grant" in §C's STOP conditions | In §C's STOP conditions, "live grant" is replaced by: **any non-inventory grant, any change to the two inventoried grant IDs/states/revisions, or failure of the S3 per-grant non-dispatchability assessment under verified queue containment**. Every other §C STOP condition stands verbatim in effect: any active plan, any non-terminal execution (beyond the named Ch 2 artifact), any moved ledger, any moved watermark, or any queue-state change = STOP. Scoped exactly as S3: the two inventoried grants in their recorded states only; live grants are **not** waived generally. Operative at Step R (§3), whose cross-reference is updated to this superseded phrasing. |
| S10 | Addendum §D, final STOP conditions | "Addendum STOP conditions (in addition to the plan's): any plan ID outside the §A inventory at D0 or D4; **any live grant**; any `reserved`/`dispatching` attempt; diagnostics totals differing from D0; the parked Chapter 3 fingerprint differing from the G8/G9 record" — the term "any live grant" in §D's STOP conditions | In §D's STOP conditions, "any live grant" is replaced by: **any non-inventory grant, any change to the two inventoried grant IDs/states/revisions, or failure of the S3 per-grant non-dispatchability assessment under verified queue containment**. Every other §D STOP condition stands verbatim in effect: any plan ID outside the §A inventory at D0 or D4; any `reserved`/`dispatching` attempt; diagnostics totals differing from D0; the parked Chapter 3 fingerprint differing from the G8/G9 record. §D.3's "all terminal" remains corrected by S6. Scoped exactly as S3; live grants are **not** waived generally. Operative at Step D4 (§3), whose cross-reference is updated to this superseded phrasing. |

**No other signed language is superseded.** In particular:
the STOP-on-unknown-plan/job/grant rule; the two-sample
≥10-minute stability rule; the byte-verified rollback-archive
requirement; D1 in full; D3; D4 (as corrected by S6, and
with §D's final STOP conditions as superseded by S10); the
§C re-check (with its STOP sentence as superseded by S9);
the rollback section; and the Gate 2 / Gate 3 sections and
their separate-decision status.

---

## 3. The executable sequence (Option B)

Steps run in this exact order — the only order this
document states anywhere: **Step P → Step D0 → Step D1 →
Step R → Step D2 → Step D3 → Step D4 → Step S**. The §C
quiescence re-check (Step R) runs **after** D1 and
**immediately before** D2's upload, exactly as signed §C
requires, preserving its ≥10-minute sampling across the
D0 → re-check interval. "Authorization" names whose word
covers the step; all steps after Step P run under the
single Julie production authorization for this changed
procedure (see Authorization status), which is sought only
after Rowan accepts this amendment.

### Step P — Queue-delivery pause + read-back (FIRST live mutation)

- **Action.** Pause delivery on queue
  `opalreader-generation-v2` (id
  `93b6a35fb8cf4788a91a2c90b748ae66`):
  `cf-api PUT /client/v4/accounts/b35ff435ff24d134ff640e0099dd13fc/queues/93b6a35fb8cf4788a91a2c90b748ae66`
  with body `{"queue_name":"opalreader-generation-v2","settings":{"delivery_paused":true}}`
  (cf-api request bodies are a positional argv JSON string —
  a `--data` flag is silently ignored). Then **read back**
  `cf-api GET` the same queue and require
  `settings.delivery_paused == true`, recorded verbatim to
  the gate evidence directory.
- **Authorization.** Julie's separate production
  authorization for this changed procedure — and nothing
  else. Rowan's acceptance of this amendment is a review
  precondition, not production authorization. No earlier
  approval covers this step.
- **What the pause is — and is not.** The pause is
  **containment going forward**: from the read-back moment,
  no queue message can be delivered to (consumed by) either
  build for as long as the pause holds. The pause does
  **NOT** retroactively prove that no in-flight or
  previously accepted queue message exists; the Cloudflare
  queue surface exposes no message-depth or ACK read
  (addendum §B.6), and this amendment claims no such proof.
  A previously accepted message, if one exists, remains
  undelivered while the pause holds — that is the whole of
  the containment claim, and it is sufficient for Gate 1
  because Gate 1 never re-enables delivery (§5 assigns the
  residue to the re-arm gate, where it belongs).
- **STOP handling.** If the PUT fails, errors, or the
  read-back shows anything other than
  `delivery_paused == true` (including the read-back itself
  failing): **STOP before anything else.** The guarantee on
  this path is **no subsequent mutation** — no later step
  runs and nothing further is changed — **not** "no
  mutation": a transport error can follow a successful
  pause, so the queue may already be paused even though
  Step P has STOPped. The queue state is therefore recorded
  as **UNKNOWN** unless a trustworthy read-back establishes
  it: if a read-back shows `delivery_paused == true`, the
  state is recorded **PAUSED** and retained PAUSED; if it
  shows delivery enabled, the state is recorded **ENABLED**;
  if no trustworthy read-back is available, the state is
  reported **UNKNOWN** and resolved through a read-only
  recheck before any further Julie-authorized production
  step. There is **no automatic retry and no unpause** on
  this path, and no upload. A re-attempt of the pause is a
  new attempt under §4 — permitted only after the failure
  is explained and a trustworthy read-back has established
  the queue state; an unexplained or repeated failure ends
  the attempt (§4). If a PUT's outcome is ambiguous
  (transport error after send) but the read-back shows
  `delivery_paused == true`, the pause counts as effected
  and the anomaly is recorded in the gate record.

### Step D0 — Fresh closed-inventory snapshot UNDER containment (read-only)

Runs only after the Step P read-back passes. All values are
recorded verbatim to the gate evidence directory and are
taken **twice, at least one full watchdog cycle (≥10
minutes) apart, both samples after the Step P read-back**;
every compared value must be **identical across both
samples**.

1. **Queue state (containment in force).** `cf-api GET` the
   queue + consumers: delivery **PAUSED** (S5), sole
   consumer `f260f2188d80426bb0588685e9d084eb` on
   `opalreader-api-v2-prod` (batch 10 / retries 3),
   producers unchanged. Delivery found enabled, or consumer
   set changed, at either sample = **STOP**.
2. **Source identity + rollback archive.** `cf-api GET
   …/workers/scripts/opalreader-api-v2-prod` (etag from
   response headers) + `v2prod-api GET /health`: build
   `ac451df8b772ddc3f64d4c6418678ce78b243d58`, etag
   `37b464ac1c2f1d7913da82e85e09638ad7e1b5c6021e3406c6cc4a5ddb9df675`,
   /health generation `"enabled"` (the live build's
   GENERATION_HALT is still `"0"` as found — containment
   during this window is the Step P pause, see §5 note);
   download the 26 content parts and hash them against
   `ARCHIVE-AND-ROLLBACK.md` §1.1: **26/26 part-hash
   match** required. This is the Gate-1 rollback-archive
   verification, done before anything is overwritten.
3. **Deployed configuration.** `cf-api GET …/settings`:
   the 9 expected binding names/types with GENERATION_HALT
   `"0"` (secret names only, never values); `cf-api GET
   …/script-settings`: observability enabled + persisted.
4. **Per-plan / per-job reads (closed inventory, §A as
   corrected by S1/S2).**
   - `GET /v2/d6-plans/plan:3183ecbf2ac4bf50bbc6166e`:
     state `complete`; its one entry execution `committed`,
     occurrence `ready`.
   - `GET /v2/jobs/plan:3183ecbf2ac4bf50bbc6166e:seg`: job
     `generating` rev 2; grants array exactly
     [`grant:plan:3183ecbf2ac4bf50bbc6166e:seg:1:full`,
     state `issued`, revision 2].
   - `GET /v2/d6-plans/plan:603ab416bd67ab1b25de97be`:
     state `halted_unknown`, stopReason
     `phase_halted_unknown_billing`; entries exactly 8
     execution `failed`, 1 `unknown_billing`, 9 never
     attempted, 0 committed.
   - `GET /v2/jobs/plan:603ab416bd67ab1b25de97be:ch1`: job
     `generating` rev 2; grants array exactly
     [`grant:plan:603ab416bd67ab1b25de97be:ch1:1:full`,
     state `issued`, revision 2]; its 18 occurrence rows
     `granted`.
   - `GET /v2/jobs/1832c21fcf0425454227c4736048a8a632f422abca4a2685ddb775bb1681406a`:
     `parked_policy`, lane standard, 27 occurrence rows
     (3 `ready` / 24 `pending`); parked fingerprint
     recomputed by the G8 proof method must equal the
     recorded `b991f18a…` value exactly.
   - **Non-dispatchability criterion applied here** (S3):
     the readable elements above, plus item 5's conflicts
     read, plus item 6's two-sample immobility, jointly
     re-verify the grant-lifecycle §2 proof at gate time;
     the code-derived elements (outbox delivered-branch
     elimination, claim state) stand as reviewed in that
     addendum and are anchored by item 2's build-identity
     verification — the code they cite is the code proven
     identical to the live build `ac451df8`.
   - **STOP**: any plan, job, or grant not in this
     inventory; any inventoried item in any other state,
     revision, or accounting; any non-terminal execution
     beyond the named Ch 2 `unknown_billing` artifact; any
     unexplained grant of any kind.
5. **Conflict evidence (new at this D0).** `GET
   /v2/conflicts` (client connector): exactly the two
   recorded rows, both `reason: schedule_dead`,
   `cache_key: lease` —
   id 1, ref `grant:plan:3183ecbf2ac4bf50bbc6166e:seg:1:full`,
   died 2026-10-29T23:54:14.808Z after 8 attempts, error
   `LIKE or GLOB pattern too complex: SQLITE_ERROR`;
   id 2, ref `grant:plan:603ab416bd67ab1b25de97be:ch1:1:full`,
   died 2026-10-30T00:24:14.632Z after 8 attempts, same
   error. Any additional row, any missing row, or any field
   difference = **STOP**.
6. **Settings + quota, both samples.** `GET /v2/settings`:
   revision **1**, lane standard, cap $50. `GET /v2/quota`:
   `attemptsToday` 0, `spentMicroCents` 371485,
   `ledgerSeq` 19, `settingsRevision` 1, `parked` null —
   identical across both samples. (Quota figures are
   grant-time *estimates* by construction; recorded as read,
   never presented as provider spend.)
7. **Sync watermarks + counts.** `GET
   /v2/sync/snapshot?family=content` and `?family=bindings`
   (headers/summary only): content highWatermark **18**,
   bindings highWatermark **1800**; counts 7 books /
   2,610 segments / 1,799 binding rows — identical across
   both samples.
8. **Neighbors.** v1 script etag `ea6f8196…`; staging etag
   `61553a07…`; v1 queue `e2706b79473d4ece90f37bd784c83386`
   paused with its sole consumer on the v1 worker.
9. **Prepay (record-only).** Julie's AI Studio balance as
   last reported by her screenshot ($17.83 at Oct 29). This
   procedure spends nothing; no agent surface exists for
   this figure.
10. **Quarantine note.** The live build predates the
    candidate's quarantine machinery; no quarantine holds
    can exist on it, and no generation submission is made
    by anyone during this gate (the live client is
    playback-only; D6 intents are submitted server-side by
    Wren, who submits none). Hold-state enumeration applies
    at D4, on the candidate, per §D as signed.

- **STOP handling (whole step).** Any mismatch, any
  detected in-flight or unknown work, any unexplained
  grant, or any state movement between the two samples =
  **STOP**. The system is left as §4 describes (delivery
  PAUSED, old build live); the discrepancy is investigated
  and explained before any further step is even proposed.

### Step D1 — Envelope re-verification (no production contact)

Exactly the signed plan's D1, unchanged in full: (a)
immutable source pin `f3b6e6e9fd7a44532ceef86e484a79e466b36d4d`
and signed subtree byte-identity; (b) pinned evidence/replay
record (`f21238df…`, `0ebc53a4…`) in ancestry and gate-time
replay envelope byte-identical to SHA-256
`9cb9d0da0d0790e2a5a0e558c6ff50d6958c83ab2942e487830e6132c15cd9ce`
via the mandatory explicit `--candidate-worker-dir
"$PWD/candidate/worker"` invocation from a clean checkout;
(c) branch ancestry / expected reviewed head — pin an
ancestor, never the moving tip. **Plus** the adversarial
spoofed-planId test (a message-carried planId must not
conceal a held plan when job linkage says otherwise), run in
the local test environment only. Any mismatch = **STOP**.

### Step R — §C immediate pre-upload quiescence re-check (read-only)

Runs **after Step D1 completes and immediately before
Step D2's upload**, exactly where signed §C places it. The
signed plan's §C, with the named amendments only: the
consequential clarification from S5/S8 (the re-check
repeats addendum §B.2–B.7 as superseded, so the queue read
must again show delivery **PAUSED**), and the **S9**
supersession — the grants assessment is the S3 per-grant
non-dispatchability criterion under verified queue
containment, not the deleted all-terminal test, and §C's
"live grant" STOP term applies only as replaced by S9
(any non-inventory grant, any change to the two inventoried
grant IDs/states/revisions, or failure of the S3 assessment
= STOP); every other §C STOP condition stands verbatim in
effect. Every value identical to the fresh D0 record
(wall-clock fields excepted); the §B.3 ≥10-minute
two-sample rule may be satisfied across the D0 → re-check
interval as the signed §C provides. Any movement =
**STOP**.

### Step D2 — Upload (pause verified, then upload)

1. **Verify containment immediately before upload**: queue
   read-back must still show `delivery_paused == true`
   (S8). Any other reading = **STOP**.
2. **Upload** the D1-validated envelope exactly as the
   signed plan's D2 specifies: multipart PUT to
   `…/workers/scripts/opalreader-api-v2-prod`, ES-module
   form (`"main_module": "v2/worker-entry-prod-d6.js"`,
   per-module `filename` attributes, content type
   `application/javascript+module`), secrets
   inherit-by-name only, `compatibility_date` 2026-08-29 +
   `nodejs_compat` preserved. The envelope metadata carries
   **GENERATION_HALT `"1"`**. The consumer is NOT
   (re)attached here; it is verified by read-back at D4.
3. Record the PUT response (new etag, deployment_id,
   entry_point, handlers [fetch, queue]).
- **STOP handling.** PUT failure or an unexpected response
  (etag/entry_point) = **STOP**. If the PUT's outcome is
  unknown, read back the script etag and parts before any
  further act — **never re-upload blindly**. Post-upload
  STOPs leave the system per §4; the rollback question goes
  to Julie under the signed plan's Rollback section.

### Step D3 — Observability

Exactly the signed plan's D3, unchanged: `GET
…/script-settings`; if observability survived via upload
metadata, record and move on; if null, re-apply via
**multipart PATCH to `…/workers/scripts/opalreader-api-v2-prod/settings`**
(never `/script-settings`; single `settings` part,
observability object only), then verify observability
enabled + persisted **and** the script etag unchanged.
PATCH failure or an etag change = **STOP**.

### Step D4 — Post-state verification (read-only)

Exactly the signed plan's D4 + addendum §D, with §D.3 as
corrected by S6:
- /health build == pin `f3b6e6e9…`; generation `"halted"`.
- Deployed bindings via `GET …/settings`: exactly the
  specced **10 names**, GENERATION_HALT `"1"`,
  OPALREADER_PHASE_POLICY `"enforce"`.
- Script etag == the D2 PUT response etag; downloaded parts
  **27/27 byte-identical** to the validated envelope.
- Settings revision still **1**; `/v2/quota` unchanged from
  the fresh D0; counts 7 / 2,610 / 1,799; watermarks
  content 18 / bindings 1800.
- Exhaustive plan list on the candidate
  (`GET /v2/d6-plans?limit=100`, paginated to exhaustion):
  exactly the §A inventory plan IDs, states `complete` /
  `halted_unknown`, stopReasons unchanged.
- Operator-only diagnostics (`GET /v2/d6-diagnostics`) for
  each inventoried plan and the Ch 3 job: execution +
  attempt counts/outcomes identical to the fresh D0
  accounting; **zero** attempt rows in phase `reserved` or
  `dispatching` anywhere; Ch 2 still exactly 8 failed-known
  + 1 unknown. Stated at its true strength (per
  6528590586): diagnostics read execution records and the
  attempt log — they do **not** show queue, outbox, or
  claim status, and are **not** proof of no queued message.
- Grants re-check (S6): all three jobs' grants arrays
  unchanged from the fresh D0 — same IDs, same `issued`
  states, same revisions.
- Ch 3 job still `parked_policy`, fingerprint unchanged.
- Queue: delivery still **PAUSED**; consumer list exactly
  the one consumer on `opalreader-api-v2-prod`; producers
  unchanged. Neighbors unchanged.
- Any line differing = **STOP** (signed plan's Gate 1 STOP
  conditions, as corrected by §2 — including addendum §D's
  final STOP conditions with "any live grant" applied only
  as superseded by **S10**: any non-inventory grant, any
  change to the two inventoried grant IDs/states/revisions,
  or failure of the S3 assessment under verified queue
  containment = STOP; all other §D STOP conditions stand
  verbatim in effect).

### Step S — Playback/sync smoke (Julie-attended, while halted)

Exactly as signed: after D4 is fully green, Julie opens
Reader on one device, plays an existing segment (the G10
smoke segment is a good pick), and confirms sync completes
without error — while the worker remains HALTED and queue
delivery remains PAUSED. Her listen is the human proof that
Gate 1's landing state serves playback and sync. A failed
smoke = Gate 1 not complete; the failure is diagnosed
before anything further is proposed.

**Gate 1 completion state (if every step passes):** new
build `f3b6e6e9…` live, GENERATION_HALT `"1"`, queue
delivery **PAUSED**, settings revision 1, Ch 2
`halted_unknown`, Ch 3 `parked_policy`. Nothing has been
generated; nothing has been spent.

---

## 4. State left on any STOP — the left-paused rule

- **STOP at Step P** (pause failed / read-back mismatch):
  **no subsequent mutation** is made and no later step
  runs — but the system is **not** asserted to be exactly
  as found: a PUT that fails or errors may nonetheless
  have paused the queue. The queue state is recorded as
  **UNKNOWN** unless a trustworthy read-back establishes
  it — PAUSED is retained PAUSED, ENABLED is recorded
  ENABLED, and an unavailable read-back is reported
  UNKNOWN and resolved through a read-only recheck before
  any further Julie-authorized production step. Neither
  the old enabled queue state nor a generation-halted
  state is promised for an unverified state. The old build
  `ac451df8` remains live; there is no automatic retry and
  no unpause. The attempt ends; any new attempt requires
  the failure to be explained and, if the pause itself
  must be re-attempted under changed circumstances,
  Julie's word.
- **STOP at any later step** (D0, D1, R, D2, D3, D4, or S):
  the system is left with queue delivery **PAUSED** — on
  the old build if the stop precedes the upload, or halted
  on the new build (GENERATION_HALT `"1"`) if it follows.
  **Delivery is never automatically re-enabled.** Un-pausing
  is itself a **Julie decision** — it is the first half of
  the re-arm and belongs to that gate (§5), not to failure
  recovery. A stopped gate therefore leaves Reader playback
  and sync fully working, generation unconsumable via the
  queue, and no path to provider contact through queue
  delivery — a safe state with no time pressure.
- Rollback after a post-upload STOP remains exactly as the
  signed plan's Rollback section provides: proposed to
  Julie with the D4 evidence, never silent, default
  proposal halted with delivery left paused.

## 5. Gate-1 containment ≠ re-arm safety proof (operative condition)

Stated plainly, as a condition of this amendment:

- **What Gate 1 under Option B proves:** the new worker can
  be landed into a contained environment — queue delivery
  paused before any read or mutation, quiescence re-verified
  under that containment, the upload made while no queue
  message could be consumed by either build — and left
  halted and paused with playback/sync proven.
- **What it does NOT prove:** that no previously accepted
  queue message exists, or that a stale Chapter 2 queue
  message could never be redelivered after a future
  delivery re-enablement. The queue's ACK state and depth
  have no read surface; the grant-lifecycle §2.2(e)
  stale-message leg rests on derived + empirical delivery
  evidence, and Rowan has ruled (6528590586) that this does
  not meet the standard for a permanent non-dispatchability
  claim under generic re-arm. Candidate diagnostics do not
  close this gap: they report execution attempts, not
  queue/outbox/claim status, and **must not be represented
  as proof of no queued message**.
- **Operative consequence:** even after a fully successful
  Gate 1, **generic re-arm remains BLOCKED** — no halt flip,
  no delivery enablement — until a separate reviewed control
  either (a) proves a stale Chapter 2 queue message cannot
  contact the provider for the 9 unattempted occurrences, or
  (b) closes that risk through an enforceable, tested
  server-side fence. That proof/fence is a future case with
  its own Rowan review and its own Julie authorization; it
  is not designed, implied, or pre-approved here.
- Note on the containment window (Step P → D2): the old
  build remains live with GENERATION_HALT `"0"` as found.
  Containment in that window rests on the delivery pause —
  in this architecture provider contact occurs only through
  queue consumption — together with the standing facts that
  no new grant can be issued for either inventoried job
  (grant-lifecycle §2.0(e)) and no submission is made during
  the gate (playback-only live client; intents are
  server-side and none are submitted). The window is kept
  as short as the two-sample rule allows and ends at the
  halted upload.

## 6. Scope box — what this amendment never authorizes

Not authorized by this amendment, by Rowan's acceptance of
it, or by Julie's production authorization for the changed
procedure — each remains its own separate gated decision:

- Re-arm of any kind (GENERATION_HALT flip, queue delivery
  enablement) — additionally **blocked** per §5 until the
  re-arm safety proof exists;
- Gate 2 (production phase-binding write);
- Gate 3 (client publication);
- Any quarantine release;
- Chapter 2 reconcile / retire / retry / new plan, and any
  resolution of its unknown-billing record;
- Chapter 3 parked-job resume;
- Batch arming; any generation; any spending or top-up;
- Rollback (Julie's separate decision, per §4);
- Any change to the signed candidate, the baseline suites,
  or any production code.

## 7. Unchanged confirmations

- Signed identities stand: Worker pin
  `f3b6e6e9fd7a44532ceef86e484a79e466b36d4d`; envelope
  SHA-256
  `9cb9d0da0d0790e2a5a0e558c6ff50d6958c83ab2942e487830e6132c15cd9ce`
  (27 modules); client publish digest `97e28094…`
  (Gate 3 — not this gate). Gen-pkg-1 remains **5/6** until
  Gate 1 actually executes and completes.
- The Chapter 2 `halted_unknown` / unknown-billing fence
  and the Chapter 3 parked job are untouched by every step
  above. The unknown attempt's billing remains unresolved;
  nothing here reconciles, retires, or estimates it away.
- Evidence for every step lands in the gate evidence
  directory (`logs/gate1/` pattern), verbatim, as the
  signed plan requires.

**Whose turn: Rowan's** — focused re-review of this
amendment (sequence, supersessions, containment/re-arm
distinction, left-paused rule); then **Julie's** — her
separate production authorization for the changed procedure,
sought only if Rowan accepts.

— Wren
