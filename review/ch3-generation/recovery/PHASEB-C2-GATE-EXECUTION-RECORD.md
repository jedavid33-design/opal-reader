# Phase B — Gate C2 EXECUTION RECORD: PASS — passive containment readability verified, ends HELD

**Outcome: PASS.** One C2 attempt executed under Julie's GO; all three capture sets matched every hard expectation exactly; no STOP condition fired; no Class R or Class M finding occurred. **Mutation tally: ZERO of every class. Ends HELD.** The GO is consumed by this attempt.

**Authorization:** Julie's GO recorded on the board BEFORE execution — comment **6588233526**, Handoff ID `RT-H-20261102-c20002` (Nov 2, 2026, ~3:55 p.m. ET). Governing package: `PHASEB-C2-READINESS-PACKAGE.md`, pin `36d0556436756b3433b853b0ba006a1a305f2f7e` on `ui1-review` (repo `jedavid33-design/opal-reader`). Execution-start comment **6588278976** (Handoff ID `RT-H-20261102-399337`), posted and read back byte-identical before Set 1.

**Pin:** this record is pinned on `ui1-review` at `<RECORD-PIN>` (the pin value is resolved in the board filing for this record, per the established pin-slot pattern; the Dropbox copy of the companion cp carries the filled value, disclosed there and on the board).

---

## 1. Window and sets

| Set | Capture window (UTC) | Offset from Set 1 start | Checker |
|---|---|---|---|
| Set 1 (census) | 2026-11-02T20:57:52Z → 20:58:06Z | — | 16/16 PASS (incl. read availability), exit 0 |
| Set 2 | 2026-11-02T21:07:19Z → 21:07:34Z | +9m27s | 16/16 PASS, exit 0 |
| Set 3 (closing) | 2026-11-02T21:22:19Z → 21:22:34Z | +24m27s | 16/16 PASS, exit 0 |

Each set performed exactly the package's 15 named reads (R-1…R-15; 24 response envelopes per set plus the R-4 etag header read). Raw envelopes preserved: `c2-gate-execution/evidence/` (81 files), indexed by `c2-gate-execution/EVIDENCE-MANIFEST.md` (87 files incl. tooling and checker logs; SHA-256 `58ab27f6bd5165f7f65827f879ea39565dd38f511b9182fe5b0c29fc85965682`).

**Timing note (disclosed, §6 item D-1):** Sets 2 and 3 began 33 seconds ahead of the nominal +10/+25-minute marks relative to Set 1's start timestamp — the inter-set sleeps were anchored to Set 1's checker completion, not to its start. The package's cadence is the C1-proven ~+10/+25 spacing; no hard expectation fixes exact seconds.

## 2. Per-item results — expected vs observed (identical at all three sets unless noted)

| # | Census item | Expected | Observed (Sets 1 / 2 / 3) |
|---|---|---|---|
| 1 | Health | build `27b2b3a9f1e7070ef243ee017703246744d57d5c`; generation `halted`; coordinator `armed` | exact, all sets (bodies byte-identical across sets) |
| 2 | Script identity | etag `adb8e5a5b104858a20835a17ffd714a70f72cea5e066c6d61c4b80a49adac46f` | exact, all sets — read from the response ETag header only; the script body was never read (`body_read: false` in each set's meta) |
| 3 | Bindings / holds / observability | exactly 10 bindings; GENERATION_HALT `"1"`; `OPALREADER_PHASE_POLICY` `"enforce"`; observability enabled + `logs.persist: true` | exact, all sets |
| 4 | Settings | revision **1** (lane standard, cap $50) | exact, all sets (bodies identical across sets) |
| 5 | Queue | `delivery_paused: true`; exactly 1 consumer `f260f2188d80426bb0588685e9d084eb` | exact, all sets |
| 6 | Capabilities | standard admitted; Batch `batch_not_armed`; registry `forever-pucked` ↔ `5c589095-f812-48a2-8ab2-03ba2791f2b2` | exact, all sets |
| 7 | Phase accounting | settled **1,029,420**; estimatedUnverified **19,018**; reservedUnverified **5,648**; inFlightUpper **0**; unknownOpen **0**; remaining **12,464,932** of 13,500,000 | capabilities phase block exact at all sets, figures identical across sets — see §6 item D-2 for the second-surface note |
| 8 | Quota | reconcile `ok: true`, drift empty, sole exception straddler `att-37d63768-db4b-447d-8150-580b7c6ee257` (`estimated_unverified`); PT dispatched 57 / 79 / 44 / 76 (Oct 29–Nov 1); 2026-11-02 = 0 and every later PT day 0; derived reserved **0** | exact, all sets; totals identical across the three reconcile pages within each set; `/v2/quota` today: attempts 0, provider dispatches 0, provider reserved 0, all sets |
| 9 | Plans | exactly 5 (smoke `complete`; old Ch 2 `retired`; fresh Ch 2 `complete`; Ch 3 `complete`; Phase B `plan:19cad189fab54b9c804a74a6` `active` {eligible 1, done 0, failed 0, blocked 0}, entry `pending` / `executionState: null`, job `queued` rev 1, quarantine `held: false`, grants []) | exact, all sets |
| 10 | Eligibility | chapter bound **26** / parked **0** / eligible **1**; segment eligible **1** / **569** chars / **8,022**; all three scope digests `cdef2c7ec7bb8434b4e2fac66af49983ac7fa4b4e65bb0eda40354be51ff52d1` | exact, all sets; digests identical across sets |
| 11 | Conflicts | exact match to the pinned four-row `schedule_dead` lease baseline (ids 1–4, all fields) | exact, all sets (bodies identical across sets) |
| 12 | Parked job | `1832c21fcf0425454227c4736048a8a632f422abca4a2685ddb775bb1681406a` `parked_policy` rev 1, fingerprint `b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`, grants [] | exact, all sets (recomputed fingerprint matches) |
| 13 | Watermarks + occupancy | content **18**; bindings **1841** with 0 changes since; idx-26 R2 key FREE | exact, all sets: both change lists empty, `highWatermark` 18 / 1841, R2 LIST under the idx-26 prefix empty |
| 14 | `drive=1` baseline | `tableState: "missing"`; `drivePasses: []`; `recorderHealth: null`; `armedAt` **1793562576104**; `pendingSchedule` **2**; `pendingWatchdog` **1** | exact, all sets (drive blocks identical across sets except the `asOf` timestamp) |
| 15 | Containment projection (both surfaces) | state `NORMAL`; `absent: true`; `verified: true`; `stopConfidence: "not_applicable"`; stop-record and episode fields at their empty values | exact, all sets, both surfaces; the two surfaces agreed in substance at every set (see §3) |

Read availability (package STOP condition 2): every envelope in every set returned HTTP 200 with a body; the R-4 header read returned 200 with an etag. No read errored or was unavailable at any point.

## 3. The containment projection, as observed (verbatim, identical at every set on both surfaces)

Surface A (`GET /v2/d6-containment`) returned the projection below plus the alarm block `{armedAt: 1793562576104, pendingSchedule: 2, pendingWatchdog: 1}`. Surface B (the `containment` block of `GET /v2/d6-diagnostics?drive=1`) returned the identical projection. A programmatic cross-set comparison confirms: projections identical across Sets 1–3 on both surfaces; drive blocks identical except `asOf`; health, settings, conflicts, and phase figures identical across sets.

```json
{
  "state": "NORMAL",
  "known": true,
  "absent": true,
  "verified": true,
  "updatedAt": null,
  "authorizationRef": null,
  "stopStatus": null,
  "stopVerifiedAt": null,
  "stopVerifyAction": null,
  "stopArmedBefore": null,
  "stopArmedAfter": null,
  "stopVerifyAttempts": 0,
  "stopEpisodeId": null,
  "stopEpisodeExhausted": false,
  "prevEpisodeId": null,
  "prevEpisodeAttempts": null,
  "prevEpisodeExhausted": null,
  "prevEpisodeClosedAt": null,
  "stopConfidence": "not_applicable"
}
```

## 4. Consistency verdict and deviation-class accounting

- **Consistency: PASS.** The containment projection was identical in substance across both surfaces at each set and across all three sets; every preservation figure was identical across all three sets. No averaging, no majority reading, no retry past the window was needed or used.
- **Class R (readability failure): none.** No containment surface errored, returned an out-of-projection shape, or disagreed with the other surface at any set.
- **Class M (state movement): none.** No census figure (items 1–14) differed from its expectation at any set; `armedAt` never changed; no recorder row appeared; dispatched stayed 0; no revision, watermark, or conflict row moved within the window.
- **STOP conditions (§6 of the package): none of the seven fired.**

## 5. Claim — at exactly the strength the package allows

This PASS certifies **only** this: the containment state of the deployed build (`27b2b3a9…`, etag `adb8e5a5…`) is **readable on both operator surfaces, consistently reported, stable across the ~25-minute window, and reads NORMAL/absent with the design's empty stop-record projection** — while every protected figure stood still.

It does **not** certify, and must never be cited as certifying:

- **Durable Object runtime adoption-in-full** — consistency across three spaced read sets is supportive observational evidence that the serving path runs the containment code; reads do not enumerate instances, and universal per-instance adoption remains explicitly unresolved.
- **Operational containment effectiveness** — drive suppression, arm suppression, stop verification, and clear were not exercised; their verification is C3's scope, and C3 is partial by construction.
- **Alarm delivery** — the `armedAt` value is unchanged and still stale (2026-11-01T19:49:36.104Z); C2 observed it, provoked nothing, and answers nothing about the stall's H1 question.
- **Live readability of non-NORMAL containment states** — production holds only NORMAL/absent; DRIVE_CONTAINED / CHAIN_STOPPED readability remains harness-evidence only.

## 6. Disclosed notes (true strength; neither is a census deviation — no figure differed from its expectation)

- **D-1 — set timing.** Sets 2 and 3 began at +9m27s and +24m27s relative to Set 1's start (nominal ~+10 / ~+25 minutes). The offset is uniform (33 s) and is disclosed here rather than rounded away.
- **D-2 — phase accounting's second surface.** Census item 7 is stated in the package as "both surfaces." Within C2's enumerated read set, **no captured body carries a `phaseAccounting` block**: the deployed build's `drive=1` response key set is `{alarm, asOf, containment, drivePasses, found, mode, recorderHealth, tableState}` (verified in the raw evidence), and the plan-diagnostics read that carried `phaseAccounting` at C1 was deliberately **not** enumerated in C2's read set. Item 7 was therefore verified exactly on the in-scope surface that carries phase figures — the R-7 capabilities phase block — at every set (settled 1,029,420; estimatedUnverified 19,018; reservedUnverified 5,648; inFlightUpper 0; remaining 12,464,932 of 13,500,000), and a scan of every captured body in each set confirmed no other phase-accounting figures exist in scope to differ. Rowan classifies whether this satisfies item 7's "both surfaces" phrasing; the figures themselves are exact and unmoved.

## 7. Mutation tally — ZERO

| Write class | Budget | Actual |
|---|---|---|
| Worker script uploads | 0 | **0** |
| Script-settings PATCH | 0 | **0** |
| Containment transitions (any action) | 0 | **0** |
| Commands / reports / SubmitJob | 0 | **0** |
| Hold flips / settings flips / queue operations | 0 | **0** |
| Alarm registrations caused by this gate | 0 | **0** |
| Recorder rows caused by this gate | 0 | **0** (table still `missing`, `drivePasses: []`, all sets) |
| Spend | $0 | **$0** |

Zero-mutation is corroborated by the reads themselves: settings revision never moved (1 at every set), sync watermarks never advanced (18 / 1841, empty change lists), the recorder table was never created, and `armedAt` is bit-identical across the window.

## 8. Ends-HELD certification (closing set read-back, 2026-11-02T21:22:19Z–21:22:34Z)

GENERATION_HALT `"1"` (bindings read, Set 3); queue `opalreader-generation-v2` `delivery_paused: true` with its sole consumer; `/health` generation `halted`, coordinator `armed`, build `27b2b3a9…`; settings revision 1; observability enabled + persisted; script etag unchanged. **System HELD.** Production remains under INVESTIGATION HOLD.

**Turn: Rowan's** — independent execution review of this record. No further gate is authorized by the consumed C2 GO.

— Wren (executor)
