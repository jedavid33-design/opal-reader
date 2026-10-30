# gen-pkg-1 DEPLOY PLAN — ADDENDUM: D0/D4 SNAPSHOT SPECIFICATION

**Status: review evidence — authorizes nothing.** This
addendum expands the D0 and D4 sections of `DEPLOY-PLAN.md`
(the filed plan is unchanged; this is a separate, disclosed
document) to the standard Rowan's EVIDENCE ACCESS HOLD (board
issue #15, comment 6523897639, point 2) requires: the snapshot
must *prove* zero active/grantable work, not merely assert "no
active plans". Where a surface genuinely cannot prove a fact,
this addendum says so and names the compensating evidence —
nothing is claimed at a strength the surfaces cannot carry.

---

## A. The recorded production inventory (the closed set)

The live build (`ac451df8`) exposes a per-plan status route
and per-job views, but **no plan-list surface and no
diagnostics surface** (both arrive with the candidate). D0
therefore enumerates generation work against the closed
production inventory — every D6 plan and job ever created in
production, from the deploy/arming/smoke/follow-on records:

| Item | ID | Expected state at D0 |
|---|---|---|
| G10 smoke plan | `plan:3183ecbf2ac4bf50bbc6166e` | `complete`; its one occurrence committed/ready |
| G10 smoke job | `plan:3183ecbf2ac4bf50bbc6166e:seg` | terminal; its grant terminal (`reported`) |
| FP Chapter 2 plan | `plan:603ab416bd67ab1b25de97be` | `halted_unknown`, stopReason `phase_halted_unknown_billing`; entries: 8 execution `failed`, 1 `unknown_billing`, 9 never attempted, 0 committed |
| FP Chapter 2 job | `plan:603ab416bd67ab1b25de97be:ch1` | job view grants: none live (see §B.4) |
| FP Chapter 3 parked job | `1832c21fcf0425454227c4736048a8a632f422abca4a2685ddb775bb1681406a` | `parked_policy`, lane standard; 27 occurrence rows (3 `ready` / 24 `pending`); parked fingerprint prefix `b991f18a…` as recorded in the G8/G9 proof records (recompute by the G8 proof method and require equality with that record) |

**Any plan, job, or grant discovered at D0 that is not in this
inventory is a STOP**: the inventory is incomplete, quiescence
cannot be certified, and the discrepancy is investigated and
explained before the gate proceeds.

---

## B. D0 — pre-state snapshot (live build; read-only)

Each item is recorded verbatim to the gate evidence directory.

1. **Script archive + identity.** `cf-api GET
   …/workers/scripts/opalreader-api-v2-prod` (etag from
   response headers); download the 26 content parts and hash
   them against `ARCHIVE-AND-ROLLBACK.md` §1.1. Expected:
   build `ac451df8…` (via `/health`), etag `37b464ac…`, 26/26
   part-hash match. This is also the Gate-1 rollback-archive
   verification, done before anything is overwritten.
2. **Deployed configuration.** `cf-api GET …/settings`
   (bindings: names/types; plain-text values recorded; secret
   names only) — expected 9 bindings with GENERATION_HALT
   `"0"`; `cf-api GET …/script-settings` — observability
   enabled + persisted.
3. **Settings + quota, sampled twice.** `v2prod-api GET
   /v2/settings` and `GET /v2/quota`, taken **twice at least
   one full watchdog cycle (≥10 minutes) apart**: settings
   revision 1 / lane standard / cap $50; quota
   `attemptsToday`, `spentMicroCents`, `ledgerSeq`,
   `settingsRevision`, and `parked` must be **identical across
   both samples**. (Quota figures are grant-time *estimates*
   by construction; they are recorded as read, never presented
   as provider spend.)
4. **Plan and job states — the grantable-work proof.** For
   every inventory row in §A:
   - `GET /v2/d6-plans/<planId>` for both plans: state,
     stopReason, and the full entry accounting (occurrence
     states + execution states) must match §A exactly.
   - `GET /v2/jobs/<jobId>` for all three jobs: job state plus
     the **grants array** — a grant in state `issued`,
     `delivered`, or `handoff_uncertain` is live/grantable
     work and is a **STOP**; every grant must be in a terminal
     state (`reported`, `voided`, `superseded`, `closed`).
   - Any execution record visible in a plan's entries in a
     non-terminal state (`granted`, `attempted`) is a
     **STOP** — with one named exception: Chapter 2's single
     `unknown_billing` execution is the recorded halt artifact
     itself (terminal for driving purposes; the plan is
     `halted_unknown` and the live driver cannot move it —
     and in the candidate the R4-1 exclusion keeps it out of
     driver selection outright).
5. **Outbox — disclosed limitation, compensating evidence.**
   The live build exposes no outbox read surface; an unsent
   dispatch would exist only as the outbox row of a grant, and
   that grant would appear in its job's grants array in a live
   state. §B.4's all-terminal grants result, combined with the
   two-sample stability in §B.3 and the pause-first sequencing
   in D2 (delivery is paused *before* the upload, so no outbox
   row can be consumed by either build across the swap), is
   the operative proof. No stronger outbox claim is made.
6. **Queue state.** `cf-api GET
   /client/v4/accounts/{acct}/queues/93b6a35fb8cf4788a91a2c90b748ae66`
   and `GET …/queues/{id}/consumers`, recorded verbatim.
   Expected: delivery ENABLED (the armed state), sole consumer
   `f260f2188d80426bb0588685e9d084eb` on
   `opalreader-api-v2-prod` (batch 10 / retries 3), producers
   unchanged. The Cloudflare queue read on this surface does
   not expose a message-depth count: if the response carries
   any backlog/depth field it must read 0, and otherwise
   quiescence rests on §B.3–B.5 — this limitation is recorded,
   not papered over. Consumer *attachment* is proven here, by
   live read-back — never inferred from upload metadata.
7. **Sync watermarks + counts.** `GET
   /v2/sync/snapshot?family=content` and `?family=bindings`
   (headers/summary only): content highWatermark 18, bindings
   highWatermark 1800; counts 7 books / 2,610 segments /
   1,799 binding rows.
8. **Shelf — untouched-baseline note.** The Shelf system is a
   separate worker and data plane; this deploy neither reads
   nor writes Shelf state, and the device-local Shelf outbox
   items (including the permanently undeliverable Oct 22 item)
   live on Julie's devices, not in this worker or its queue.
   The deploy-day baseline for "Shelf untouched" is §B.7's
   sync watermarks plus the Gate-3 first-Connect guard reading
   on each device (Julie-attended). Nothing else is claimed.
9. **Neighbors.** v1 script etag `ea6f8196…`; staging etag
   `61553a07…`; v1 queue `e2706b79473d4ece90f37bd784c83386`
   paused with its sole consumer on the v1 worker.
10. **Prepay (record-only).** Julie's AI Studio balance as
    reported by her screenshot ($17.83 at Oct 29). The deploy
    spends nothing; no agent surface exists for this figure.

## C. Immediate pre-upload quiescence re-check

After D1 (envelope re-verification) completes and
**immediately before** D2's queue pause + upload: repeat
§B.2–B.7 in full. Every value must be identical to the D0
record (wall-clock fields excepted), including a fresh
two-sample quota/plan stability span (§B.3's ≥10-minute rule
may be satisfied across the D0 → re-check interval, provided
the two samples straddle at least one watchdog cycle and both
are recorded). **Any** active plan, live grant, non-terminal
execution (beyond the named Ch 2 artifact), moved ledger,
moved watermark, or queue-state change = **STOP** — the
deploy waits; this plan has no in-flight variant.

## D. D4 — post-state additions (candidate surfaces now live)

`DEPLOY-PLAN.md`'s D4 list stands; this addendum adds the
exhaustive checks the new surfaces make possible:

1. **Exhaustive plan list.** `GET /v2/d6-plans?limit=100`,
   paginating with the returned cursor **to exhaustion**: the
   plan-ID set must be exactly the §A inventory
   (`plan:3183ecbf…`, `plan:603ab416…`) — no new plan may
   exist — with states `complete` and `halted_unknown`
   respectively, stopReasons unchanged.
2. **Attempt-level accounting.** Operator-only `GET
   /v2/d6-diagnostics?planId=<id>` for *each* inventoried plan
   (and `?jobId=` for the Chapter 3 parked job): execution +
   attempt counts and outcomes identical to the D0 accounting;
   specifically **zero** attempt rows in phase `reserved` or
   `dispatching` anywhere, and Chapter 2 still exactly 8
   failed-known + 1 unknown.
3. **Grants re-check.** `GET /v2/jobs/<jobId>` for all three
   inventoried jobs: grants arrays unchanged from D0, all
   terminal.
4. **Stability re-check.** `/v2/quota` and `/v2/settings`
   identical to D0 (ledgerSeq, attempts, spent estimate,
   revision 1); sync watermarks still 18 / 1800; counts still
   7 / 2,610 / 1,799.
5. **Queue + bindings (from the plan's D4, restated for
   completeness).** Queue delivery still **paused** with the
   sole consumer read back live; deployed bindings exactly the
   specced 10 names with GENERATION_HALT `"1"` and
   OPALREADER_PHASE_POLICY `"enforce"`; neighbors unchanged.
6. **Playback/sync smoke — Julie-attended, while still
   halted** (per Rowan point 3): open Reader, play an existing
   segment (the G10 smoke segment is a good pick), confirm
   sync completes without error. This belongs after the
   worker upload, before Gate 2 is even proposed.

**Addendum STOP conditions (in addition to the plan's):** any
plan ID outside the §A inventory at D0 or D4; any live grant;
any `reserved`/`dispatching` attempt; diagnostics totals
differing from D0; the parked Chapter 3 fingerprint differing
from the G8/G9 record.

---

## Sources

- Inventory records: G10 smoke record
  (`d6-build/deploy-evidence/g10-smoke/`), Chapter 2 halt
  record + diagnosis
  (`d6-build/deploy-evidence/followon-fp/`), G8/G9 proof
  records (parked-job fingerprint, queue/consumer IDs).
- Live-build surfaces verified against the live source
  (`d6-build/seedfix-build/worker/api.mjs`,
  `worker-entry-prod-d6.js`, `coordinator.mjs` jobView /
  quotaView shapes).
- Candidate surfaces verified against the signed candidate
  source (`gen-pkg-1/worker-build/worker/generation/service.mjs`:
  `listPlans`, `attemptDiagnostics`;
  `worker-entry-prod-d6.js` routes `/v2/d6-plans`,
  `/v2/d6-diagnostics`).
