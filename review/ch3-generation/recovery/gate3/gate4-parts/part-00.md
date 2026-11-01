# GATE 4 PROPOSAL — Resume and complete Forever Pucked Chapter 3 (the plan's 15 remaining segments): bounded generation under separate re-arm and unpause sub-gates, ends HELD (for Rowan review)

**Status:** PROPOSAL ONLY — prepared by Wren, 2026-11-01. Nothing in this document is executed by its filing. No production mutation of any kind has been made in its preparation; every live figure below comes from read-only reads taken 2026-11-01 ~17:36–17:51Z.
**Review requested from:** Rowan (design/source reviewer, Opal Roundtable).
**Authorizing review for this drafting:** Rowan's Gate 3 retry EXECUTION REVIEW PASS, board comment **6561581179** (issue #15, `jedavid33-design/opal-roundtable`), which closed Gate 3 and charged Wren to "prepare a separate Gate 4 proposal for the 15 pending Chapter 3 segments, including fresh census, stop conditions, bounded generation/spend, and explicit independent re-arm and queue-unpause gates." That review authorizes NO Gate 4 execution, re-arm, unpause, generation, or spend. **Julie's new GO is required before any production action under this proposal.**
**Subject (exact):** plan `plan:e377a5559961b294154276b6`, job `plan:e377a5559961b294154276b6:ch2`, Forever Pucked (`5c589095-f812-48a2-8ab2-03ba2791f2b2`), chapterIndex 2, phase `forever-pucked` — its 15 remaining eligible occurrences (§2.3).
**Live build this proposal is written against:** `1c2d1d0fa7ebb769f68cfb327fb9fde7d4d30867` (range-fix build; verified live via `/health` at census-of-drafting time). **System HELD** at drafting: GENERATION_HALT `"1"`, queue `opalreader-generation-v2` `delivery_paused: true`.
**Record chain:** Gate 3 retry record pin `ea72cf9852d49c62336a492d070cfd128d5eccec` (repo `jedavid33-design/opal-reader`, branch `ui1-review`); Gate 3 retry proposal pin `0ead570fd9713ec72ec84fe59080a54919e3c8af`; range-fix deploy record pin `b986b562f1824fec2c15810ee4ef023d42a4362f`.

---

## 0. Why this gate exists, and the one discovery that shapes it

### 0.1 Where things stand

Phase A (Oct 31, 2026) generated and committed 8 of Chapter 3's 23 plan segments, then stalled permanently on shipped code: the cohort grant never closed, `driveOnce` refused every successor grant while one read `issued`, and 52 quota slots leaked as open reservations. Gate 2 built the operator grant finalizer; Gate 3 attempt 1 stopped at the preview (HTTP 500); the range-fix replaced all five production LIKE constructions with prefix range scans and deployed held (build `1c2d1d0f`); the Gate 3 retry then executed ALL PASS (Nov 1, 2026): the preview returned HTTP 200 `finalizable` on the fixed build, the finalizer applied exactly once — grant `reported`, claim `completed`, the 8 reservations closed `grant_settled`, derived PT 2026-10-31 totals 44/0/44 — phase accounting unchanged, exactly 1 mutation, ends HELD. Rowan's execution review PASS (6561581179) closed Gate 3. **Gate 4 is the resumption Rowan named next: generate the 15 segments that remain.**

### 0.2 The discovery: the plan is already self-driving — and has been cycling cohort grants, ledger-only, since the finalizer landed

Fresh reads taken for this proposal (2026-11-01, after Gate 3 closed) establish a fact no earlier document records, and Gate 4's design is built on it:

1. **No new submission is needed to resume.** `driveOnce` runs on the coordinator's watchdog alarm for every plan whose state is not terminal (`worker/generation/service.mjs:888`, plan selection at :931-933). Its grant step fires whenever the plan's current job has `pending` occurrences and no live (`issued`) grant (`service.mjs:980-984`) and calls `coord.requestGrant(jobId)`. The Gate 3 finalizer removed the one condition that had frozen this machinery — a permanently `issued` grant.
2. **The GENERATION_HALT fence does not block plan-bound grant issuance.** The halt refusal inside the grant guard applies only to *plan-less* jobs (`worker/generation/grant-guards.mjs:168-181`); for a plan-bound job the guard checks quarantine holds, the phase unknown-billing halt, and the phase budget — not the halt flag. What the halt actually fences is *delivery*: the production host wires `sendGrant` only when `GENERATION_HALT === "0"` (`worker/worker-entry-prod-d6.js:319-345` — "While halted there is NO queue delivery function: outbox rows stay visibly unsent").
3. **So, since ~17:39Z today, the machinery has been cycling:** `driveOnce` issues a bounded cohort grant for the job (8 occurrences — §3.3), the grant's outbox row is never invoked (no sender while halted), and when the grant's 15-minute lease expires (`worker/coordinator.mjs:134` `LEASE_MS`; grant row written at :1743-1744, lease scheduled at :1758), the lease path voids the provably-unsent dispatch (`lease_expired_undelivered`, `coordinator.mjs` lease branch), releases its reservations, returns the occurrences to `pending`, and re-advances the job — which re-grants a fresh cohort on a later pass.
4. **Observed directly, twice, ~13 minutes apart (2026-11-01):** at ~17:36Z the granted set was positions {68, 69, 73, 75, 80, 82, 83, 89} with 7 `pending`; at ~17:50Z the granted set had rotated to {70, 71, 78, 79, 84, 86, 87, 89} — 7 of the 8 previously-granted occurrences back to `pending` (position 89 granted at both reads), a fresh cohort granted in their place. At both reads: PT 2026-11-01 derived totals **dispatched 0 / reserved 96 / consumed 96** (96 = 8 × 12, §3.3), reconcile `ok: true`, `currentDayBlocked: false`, zero provider dispatches, zero spend. The churn is ledger-only, self-limiting, and reconcile-clean; it created **no** new conflicts rows (§4.4 reads still exact-match the baseline four) and moved **no** money (§2.4 exact at both reads).

Consequences for this gate, stated plainly:

- Gate 4 does **not** create, submit, or repair anything. Its production acts are exactly: lift the halt (wires the sender), unpause the queue (delivers what the sender sends), watch the machinery finish the plan, then return the system to HELD.
- Because a cohort grant may be live at any instant — in either phase of its cycle — the census (§4) asserts **invariants**, not a frozen granted-set, and the executor never needs to know which cohort is current: whichever grant is `issued` when delivery opens is the first delivered grant, and if its delivery window has already lapsed the drain voids it and re-grants fresh (`coordinator.mjs:1872-1876`). Both branches are designed machinery, not deviations.
- The exact current grant identity (`grant:plan:e377a5559961b294154276b6:ch2:<job revision>:full` — the id embeds the *job revision*, `coordinator.mjs` `_issueGrant`, so it changes every cycle) is a census-time read, never a proposal constant. **Open question Q1 (§10)** asks Rowan to rule on the census surface for it.

---

## 1. Scope

### 1.1 In scope — exactly this

Under one Julie GO (§10), the executor performs, in order:

1. **E0** — a fresh census (§4) under the executor STOP law (§7). Any mismatch stops the gate before any mutation.
2. **R1 (re-arm sub-gate)** — lift GENERATION_HALT to `"0"`, settings-only, exactly one settings mutation, after the reconcile precondition (§5.2).
3. **R2 (unpause sub-gate)** — unpause queue `opalreader-generation-v2`, exactly one queue mutation, as its own separate step, after R1's read-backs (§5.3). **The queue is unpaused LAST among the opening acts** — no opening act follows it.
4. **G** — monitored generation: the shipped machinery (and only it) grants, delivers, executes, reports, and settles successive cohorts until the plan completes (§5.4), inside the bounds of §5.5 (attempt cap, cost ceiling, PT-day rules).
5. **C (closing sub-gate)** — on completion: re-pause the queue, then re-halt (containment order), exactly two mutations, then the full read-back checklist (§6). **This proposal recommends the gate END HELD** (§5.6) — the system returned to the exact posture it was found in.

### 1.2 Explicitly out of scope / not authorized by this proposal

- **Phase B** — the chapter's final segment, occurrence `2a85f74f-353d-4c25-a86a-4a4db392868b` (position 91, 569 chars), which reads `excluded_parked` on the plan and belongs to the parked job's exemption path. Gate 4 never touches it, the parked job `1832c21fcf0425454227c4736048a8a632f422abca4a2685ddb775bb1681406a`, or any park-release/exemption route.
- **Batch** — arming or use of the batch lane in any form. The standard lane only, as stamped (`d6StandardOnly`).
- **Any other book, chapter, or plan** — including the rest of Forever Pucked beyond this chapter's plan. Any generation observed that is not this plan's is a STOP (§7).
- **Any code change, deploy, or client publication.** This gate changes no bytes of the worker; build `1c2d1d0f` throughout.
- **Any finalizer invocation.** If a successive grant fails to close, that is a STOP (§7), never a repair under this gate; a finalizer use would need its own gate, exactly as Gate 3 was.
- **Any SubmitJob, command, or intent of any kind.** The resume needs none (§0.2); submitting one is outside the GO.
- **Clearing, editing, or explaining away any conflicts row; any rollback; any second attempt.** One GO covers one attempt (§8).

---

## 2. Identity binding — the exact subject

### 2.1 Book / phase / chapter

| Field | Value |
|---|---|
| Book | Forever Pucked |
| bookId | `5c589095-f812-48a2-8ab2-03ba2791f2b2` |
| chapterId | `2060f9df-f017-4793-a5e1-9d131789d973` |
| chapterIndex | 2 (Chapter 3) |
| Phase | `forever-pucked` (registry-bound to this bookId; unbound phases fail closed) |
| Lane | `standard` (Batch unarmed: capabilities read `batch: {admitted: false, reason: batch_not_armed}`) |

### 2.2 Plan / job

| Field | Value (fresh read, 2026-11-01 ~17:36Z) |
|---|---|
| planId | `plan:e377a5559961b294154276b6` |
| jobId | `plan:e377a5559961b294154276b6:ch2` |
| Plan state | `active`, stopReason `null` |
| Plan totals | eligible 23 / **done 8** / failed 0 / blocked 0 / prompts 0 |
| Quarantine | `held: false, approvalRequired: false` |

### 2.3 The 15 remaining occurrences (structural identity only — no segment text anywhere in this document)

From the fresh plan read, the plan's 23 eligible entries split as: 3 `bound_already` (positions 65–67, pre-plan bindings), 8 `ready`/`committed` (the Phase A cohort: positions 72, 74, 76, 77, 81, 85, 88, 90), and the **15 below**, whose `occurrenceState` at read time was `granted` (8) or `pending` (7) — the §0.2 cycle rotates which; the *set* is invariant:

| Pos | occurrenceId | Chars | State at 17:36Z read |
|---|---|---|---|
| 68 | `81881ab7-fe99-4feb-98f6-bcbf7fc7e2a4` | 1,430 | granted |
| 69 | `72672ef5-8481-403b-ba97-f5c1dc0e4a77` | 1,321 | granted |
| 70 | `c731c8e7-4d18-4f59-bd73-f3c42a093063` | 1,343 | pending |
| 71 | `e651189e-9085-4590-ba4a-f0af18d24287` | 1,256 | pending |
| 73 | `94f6f847-7ded-470e-9a1d-577951c3a496` | 1,456 | granted |
| 75 | `962bc05c-666e-4967-aee2-d2bdd4283084` | 1,397 | granted |
| 78 | `e98450a5-2ee3-4ac7-bdcf-9226749b8000` | 1,371 | pending |
| 79 | `e51a7f03-eb79-4500-965f-f3f77efad254` | 1,215 | pending |
| 80 | `7fa865b8-ed32-4b8c-ae37-fd2d71cba0f6` | 1,471 | granted |
| 82 | `9150d43c-a37a-4bbf-af88-ec88d1669614` | 1,489 | granted |
| 83 | `635505ae-e0ff-4d38-8015-eb66357d3908` | 1,448 | granted |
| 84 | `b522918a-5973-4061-adaa-462460670e6a` | 1,493 | pending |
| 86 | `b8e75022-23a0-41f2-9297-47e71f255394` | 1,291 | pending |
| 87 | `f1aba4cc-ca84-42db-9b38-1104e01fd4e0` | 1,430 | pending |
| 89 | `712f42d8-5460-475a-a41a-fd3e6b57d00e` | 1,453 | granted |

**Total: 15 occurrences, 20,864 chars** — matching the fresh eligibility quote exactly (§2.5). At the ~17:50Z second read, the granted subset had rotated to positions {70, 71, 78, 79, 84, 86, 87, 89} (still 8 granted / 7 pending; position 89 granted at both reads); the set of 15, the totals, and every figure in §2.4–§2.5 were unchanged.

