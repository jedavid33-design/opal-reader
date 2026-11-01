# Opal Roundtable — New-Thread Handoff & State Report for Rowan

**Date:** November 1, 2026
**Prepared by:** Wren, at Julie's request (Julie is starting you in a fresh ChatGPT thread because the old one has grown too large to work in comfortably)
**Purpose:** Everything you need to continue as reviewer without re-reading the full board history. The board (repo `jedavid33-design/opal-roundtable`, issue #15) remains the authoritative record; this report is the current-state summary. Review pins live in the CODE repo `jedavid33-design/opal-reader`, branch `ui1-review` — every pin cited below names that repo and branch.

---

## 1. Your role and the standing protocol

- You are **Rowan**, design/source reviewer in the Opal Roundtable: **Julie** (owner, decides) + **Rowan** (you, review) + **Wren** (executor, Muse side).
- **Approval Mode:** investigation and discussion are free inside a case; consequential action (deploy, production calls, generation, spend) happens only on Julie's explicit word, gate by gate. Your PASS never authorizes the next gate; each gate needs its own review + Julie's separate GO, recorded on the board before execution.
- **Julie does not read the board.** Wren briefs her in chat and records her decisions on the board, labeled as recorded by Wren. Julie reaches you by poking you in ChatGPT herself (her 🪑 signal to Wren).
- **Wake-up emails are SUSPENDED** (Julie's instruction, Oct 26, 2026). Handoffs are board posts only, each with a unique Handoff ID `RT-H-<yyyymmdd>-<6 lowercase hex>` (never prefixed `ROWAN-RESPONSE:` — that prefix is yours alone, for completed replies).
- **Your reviews are documentary unless you say otherwise:** you review Wren's pinned records and filings; you do not independently rerun tests, recompute hashes, or inspect live production. State that boundary in each verdict, as you have been doing.
- **Evidence discipline (hard-won, keep enforcing it):** claims at their true, narrower strength; counts/figures verified against the operative manifest or live reads, never from memory; an executor's own explanation never clears its own STOP; consistency with an aggregate is not proof of a per-item fact; baseline/test-fixture amendments are case-by-case, never blanket; if Wren overstates, hold it and name the overstatement.
- **Executor STOP law (standing):** if any pre-flight census item differs from the paperwork expectation — even by one item, even if it looks like harmless bookkeeping — the executor stops before any further mutation, preserves state, and reports; proceeding requires a fresh explicit GO or your ruling on that deviation. Post-hoc acceptance does not retroactively authorize having proceeded.
- **Free tiers only** (GitHub + Cloudflare). Any cost is flagged to Julie before building. No spoilers from book content, ever, in this work.

## 2. Where the project stands (the one-paragraph version)

Opal Reader v2 is live and Julie uses it daily. The last open workstream is finishing **Chapter 3 of *Forever Pucked*** generation. A generation run stalled at 8 of 23 segments because a quota grant never closed (Oct 31). You and Wren built an operator-only grant finalizer to close it; the first Gate 3 attempt to use it stopped when the finalizer's read-only preview returned HTTP 500 (Nov 1). Diagnosis pointed at a family of fragile SQL pattern-matching (LIKE) queries — hypothesis supported, **never proven**. You approved replacing all five LIKE sites with a prefix range scan (Option B); that fix is now **built, reviewed, and deployed**, and the deploy passed your execution review today. The system sits **HELD** (generation halted + queue paused) on the fixed code. **The next step is Wren's Gate 3 retry proposal** — one valid preview, then the finalizer — which you will review before Julie decides.

## 3. Current live production state (verified Nov 1, 2026, after the deploy)

- **Worker** `opalreader-api-v2-prod`, live build **`1c2d1d0fa7ebb769f68cfb327fb9fde7d4d30867`** (the range-fix build). GENERATION_HALT = "1" — **generation halted**; coordinator reports `armed`; observability enabled + persisted.
- **Queue** `opalreader-generation-v2`: **delivery paused**. System is HELD; the app's Generate button is NOT live.
- **Chapter 3 plan** `plan:e377a5559961b294154276b6`: `active`, **done 8 / 23**, failed 0. Its grant `grant:plan:e377a5559961b294154276b6:ch2:1:full` still **`issued` rev 2**, with 8 open quota reservations (52 slots held against the 100/day provider-attempt cap). Closing this grant is the entire point of Gate 3.
- **Chapter 3 parked job** untouched (`parked_policy` rev 1). Phase B (the separate final-segment exemption) has never been touched and must not proceed — Phase A never completed.
- **Phase accounting (forever-pucked):** settled 732,303; estimatedUnverified 19,018; reservedUnverified 5,648; unknownOpen 0; remaining 12,762,049 of the 13,500,000 phase budget (≈ $13.50). Settings revision 1 (Standard lane, $50 outer cap). **Batch remains unarmed.**
- **Conflicts table: exactly four `schedule_dead` lease rows** — the standing baseline. All four carry `found = "LIKE or GLOB pattern too complex: SQLITE_ERROR"`. The baseline is pinned verbatim (pin `9284f5ef`, see §5); any change to this set is a STOP-and-new-baseline event, never an executor judgment call. Never clear any row without separate authorization.
- **Quota guard armed;** reconcile `ok: true`, sole exception the one adjudicated straddler attempt (labeled `estimated_unverified`, never dispositionable). Provider-attempt day totals (PT): Oct 29 = 57, Oct 30 = 79, Oct 31 = 96 of 100, Nov 1 = 0.
- **Sync watermarks:** content 18, bindings 1826.
- **Rollback floor (permanent):** build `6a73d9622e1b4eac00c58e289de1c674ed6b3d6b` is the minimum build that may ever run against this data; it does NOT enforce the attempt counter and must never be represented as a safe re-arm fallback. Any rollback needs separate Julie authorization + held pre-state + external accounting archive + proven compatibility.

## 4. The chain that got us here (compressed, with verdicts)

1. **Phase A stall (Oct 31):** Chapter 3 generation completed 8 segments, then stalled permanently on shipped code — the grant's only closer was a report handler that never completed it; reservations leaked; no new grant could issue. Julie's playback of the 8 finished segments PASSED ("Partial 11/27" in her app).
2. **Recovery design:** operator-only grant finalizer (Option A) — preview (read-only derivation + precondition digest) then a digest-bound finalization action. You: diagnosis PASS, design CONDITIONAL PASS → build → your PASS.
3. **Gate 2D deploy (Oct 31):** finalizer deployed halted (build `408f9149`); after an attempt-1 census STOP (a fourth conflict row — the stalled grant's own lease row), you accepted a revised four-row baseline (pin `9284f5ef`) and the retry executed ALL PASS.
4. **Gate 3 attempt 1 (Nov 1): STOPPED at the preview.** Census passed 21/21, holds placed, then the single preview call returned **HTTP 500 `LIKE or GLOB pattern too complex: SQLITE_ERROR`**. Finalizer never called; GO consumed; system left HELD. **Root cause not established** — the error string matches the conflict rows' `found` field observationally, nothing more.
5. **Diagnosis (Nov 1):** the preview derivation's only LIKE is one site; five LIKE sites total in the tree (1 finalizer + 4 coordinator), all the same construction family production has thrown on. **H1 (the preview threw at that LIKE) is SUPPORTED, NOT proven.** Your ruling: do not re-invoke the preview merely to reproduce the error. Stage 1 passive diagnosis executed clean (state stable, conflicts unchanged).
6. **Remediation (Nov 1):** options analysis — you gave ANALYSIS PASS; **Option B (prefix range scan)** chosen: exact intended set, index-served, no schema change. (Option D, a derived column, was rejected: it cannot serve the stalled grant's existing rows.)
7. **Range-fix build (Nov 1):** shared helper + all five sites swapped; new equivalence suite 19/19; finalizer classification + precondition digest on the fixture **byte-identical to the unpatched build's**; full battery 1,197 tests, failing set name-identical to baseline (22 known). Zero SQL LIKE/GLOB sites remain in `worker/`. Your verdict: **SOURCE PASS, candidate only** (documentary; H1 still unproven).
8. **Range-fix deploy (Nov 1):** proposal PASS, then your HOLD for one wording clarification → Amendment 1 → your **FINAL PROPOSAL REVIEW PASS**. Julie GO. Execution: census zero deviations, **exactly 1 mutation** (the upload; observability survived, conditional PATCH unspent), 31/31 parts byte-identical, denied probes 6/6, **ends HELD certified**. Your verdict today: **EXECUTION REVIEW PASS (documentary)** — comment 6561225702.
9. **What the deploy does NOT prove:** the cause of the Gate 3 500, or that the preview now succeeds. The retry is the test.

## 5. Key pins and references (all in `jedavid33-design/opal-reader`, branch `ui1-review`, unless noted)

| Item | Reference |
|---|---|
| Current `ui1-review` head (deploy record) | `b986b562f1824fec2c15810ee4ef023d42a4362f` |
| Live build stamp (= range-fix candidate) | `1c2d1d0fa7ebb769f68cfb327fb9fde7d4d30867` |
| Range-fix envelope | 31 parts, 1,438,980 B, SHA-256 `3508d1bf722a426f7332afbdadcc2012cbd8271d35e5b8a4e1758b5eb850ac8c` |
| Deploy proposal (as amended, operative) | pin `6d533dfea25034091084cb0629a049688301c823` |
| Deploy execution record | pin `b986b562…`; board filing 6561039589 (RT-H-20261101-5e08c3) |
| Your execution review PASS | board comment 6561225702 |
| Conflicts baseline (four rows, verbatim) | pin `9284f5ef…` |
| Range-fix build record | pin `d01c15ed…` |
| Remediation options analysis | pin `c3f58ad8…` |
| Gate 3 attempt-1 record (STOPPED AT E3) | pin `b5fc3784…` |
| Board | `jedavid33-design/opal-roundtable`, issue #15 (latest comment 6561246961, Wren's acknowledgment) |

## 6. What happens next

- **Wren is preparing the Gate 3 retry proposal now** (your specification from the execution review): fresh exact-match census against the four-row baseline; the system already held; **one valid preview call** on the fixed build; an E3.5-style conflict re-check immediately before the finalizer call; the finalizer action bound to the preview's precondition digest; post-action audit read-backs; ends HELD. Stop conditions per the standing law. It will be pinned and filed on issue #15 for your review. **Your review comes first; Julie's GO second; execution third.** Nothing is authorized until all three happen.
- **After a successful Gate 3:** Gate 4 (resume the remaining 15 Chapter 3 segments, ≈ $0.294 modeled) needs its own proposal + your review + Julie's GO, then Julie's playback check. Phase B (final segment) and Batch arming remain separately gated after that, in Julie's chosen order: finish Chapter 3 first, then Batch.
- **Still open and unproven, by design:** H1 (why the preview 500'd) — the retry's outcome is evidence, not a verdict on mechanism. State it that way if it comes up.

## 7. Working agreements worth restating

- Wren files records with SHA-256 pins and read-backs; treat any filing as *reported* until its pin and read-back check out — you have caught real errors this way (part counts, envelope claims, overstated billing inferences) and Wren corrects them on the record.
- Julie decides with tappable buttons in chat after a plain-language briefing that separates your technical position from Wren's recommendation. Dense gate language gets a plain version first.
- If the board watch ever reports a post of yours that you didn't make, it's a known glitch — Wren verifies your posts firsthand against the API before acting, and has never acted on a fabricated one.

**Turn: Rowan's** — nothing is pending your review until Wren files the Gate 3 retry proposal. This handoff is also filed on issue #15 so the board record stays continuous with the new thread.

— Wren
