# Gate 7 supplement — executor source pin for Rowan's review

**Purpose.** Answer Rowan's **GATE-7 HOLD FOR EXECUTOR SOURCE PIN**
(roundtable issue #15 comment **6537706368**) on the gate-7 re-arm
proposal (pin `75368c31677e59ea6d5a12677e84aab69d097930`). Repo-only:
no production change, no code change anywhere. This supplement
locates the actual executor module of deployed build
`6a73d9622e1b4eac00c58e289de1c674ed6b3d6b`, explains why Rowan could
not find it where she looked, and gives her direct fetchable
pointers she can verify herself.

## 1. Short answer

Rowan's observation is **correct**: the file is **not** at
`review/ch2-disposition/worker/generation/d6-executor.mjs` in the
disposition pin — that snapshot never contained it (see §3). The
executor **did** ship in the deployed envelope, and it **is**
fetchable from the pinned GitHub tree at this exact path:

- **Repo:** `jedavid33-design/opal-reader`
- **Path:** `review/rearm-fence/worker/generation/d6-executor.mjs`
- **Present at commits:** the re-arm-fence F1/F2 pin
  `288508073b5218a6e0dd90b68d497a331ad872b6`, and inherited unchanged
  in every later `ui1-review` tree checked, including the deployed
  disposition build pin `6a73d9622e1b4eac00c58e289de1c674ed6b3d6b`,
  the gate-6 record pin `b7da8a670f1ca68520dc6bff0f78f646dd81b734`,
  and the gate-7 proposal pin
  `75368c31677e59ea6d5a12677e84aab69d097930`.
- **Git blob:** `2d79fb1cbeba8a25e3f9d34225f7cf0bff7eb0ae`
- **Size:** 44,181 bytes
- **SHA-256 of the file bytes:**
  `68e3f84ed6ee9bd4ac59c4732f72ab1c53661df00798ad7cbe23a9a5a2c881b9`

Fetch it at any of those commits, e.g. GitHub contents/raw for
`review/rearm-fence/worker/generation/d6-executor.mjs?ref=6a73d9622e1b4eac00c58e289de1c674ed6b3d6b`
(or `ref=28850807…`, or `ref=75368c31…` — same blob at each).

**Remedy copy in this supplement commit:** because the natural
lookup path was empty, this supplement ALSO pins a review copy of
the module at
`review/ch2-rearm/worker/generation/d6-executor.mjs`
in the supplement commit itself, clearly labeled a review copy.
Its blob is the same git blob `2d79fb1c…`; its SHA-256 is the same
`68e3f84e…`. It is byte-identical to (a) the `rearm-fence` pinned
copy, (b) the local deployed tree file
`worker/generation/d6-executor.mjs`, and (c) the deployed envelope
part (see §2). The copy changes no code: it is the same bytes,
placed where the re-arm review can reach them directly.

## 2. Proof it shipped in the deployed envelope

The disposition deploy envelope manifest is authoritative for what
shipped (`~/workspace/ch2-program/disposition-deploy/envelope/parts-manifest.json`,
SHA-256 `543a3b312af6037cf4f1f53650f3e61541d4561db5568d7d81de12c716504d0a`;
assembled envelope SHA-256
`7d82eccf80b1f8fd5d38f9dd7deafb1f2b41a72829f14dc1b4e962acc394ee32`;
envelope proof 18/18, proposal pin `ea654d20…`, Rowan
OPERATIONAL-PLAN PASS 6536365406). Its 27 module parts (the task
brief said 28 parts counting the metadata part; the manifest lists
27 module parts + metadata) include, verbatim:

```
{ "part": "v2/generation/d6-executor.mjs",
  "bytes": 44181,
  "sha256": "68e3f84ed6ee9bd4ac59c4732f72ab1c53661df00798ad7cbe23a9a5a2c881b9",
  "tree": "worker/generation/d6-executor.mjs",
  "stamped": false }
```

So in the **deployed envelope** the module's name/path is
`v2/generation/d6-executor.mjs`, sourced from the tree path
`worker/generation/d6-executor.mjs`. Wren independently re-fetched
the GitHub blob `2d79fb1c…` for this supplement: 44,181 bytes,
SHA-256 `68e3f84e…` — matching the envelope part hash exactly —
and byte-diffed it against the local deployed tree file: identical.

## 3. Why the disposition snapshot omits it — honestly

The disposition snapshot was a **delta-only snapshot**, by design
of that build. The disposition build changed exactly four worker
files versus its base (`generation/genstore.mjs`,
`generation/service.mjs`, `generation/grant-guards.mjs`,
`worker-entry-prod-d6.js`); its pin script
(`~/workspace/ch2-program/disposition/pin-build.py`, local record)
pinned exactly nine paths under `review/ch2-disposition/`:
BUILD-REPORT, two log files, those four worker files, and the two
new disposition test suites. `d6-executor.mjs` was **unchanged by
the disposition build**, so it was not re-pinned there.

That is the whole explanation — and it is a fair criticism of the
gate-7 proposal that it asserted the path
`generation/d6-executor.mjs` without naming the pinned tree where
the file actually lives. Rowan fetched exactly the two neighbours
that WERE in the delta snapshot (`service.mjs`, for `driveOnce`,
and `worker-entry-prod-d6.js`) and correctly reported the executor
missing beside them.

The executor instead entered the pinned lineage earlier, with the
Workstream A re-arm fence build that created it in its current
form (fence F1/F2 corrections pin `28850807…`), under
`review/rearm-fence/worker/generation/d6-executor.mjs`, alongside
its test suite and build report (§5). The combined Chapter 2 deploy
and the disposition deploy both shipped that same blob unchanged
(part SET identical 27/27 in both envelopes; the disposition delta
was exactly five changed parts — the four disposition files plus
the build-identity stamp).

## 4. Import chain (production entry → executor)

Deployed entry: envelope part `v2/worker-entry-prod-d6.js`
(tree `worker/worker-entry-prod-d6.js`; pinned for the disposition
delta at `review/ch2-disposition/worker/worker-entry-prod-d6.js`,
pin `6a73d962…` — the copy Rowan already fetched).

- **Line 236:** `import { createD6Executor } from "./generation/d6-executor.mjs";`
  — relative to the entry, `./generation/d6-executor.mjs` is the
  envelope part `v2/generation/d6-executor.mjs`.
- **Lines 825–834 (`_execute`, the DO-internal execute path):**
  `const executor = createD6Executor({ coord, store, providers, flushStore, cache, workSource, consumerId: … "opalreader-v2-prod-d6" });`
  then `const result = await executor.handleMessage(message);`
  then `return json(200, result);` — a refusal object is a normal
  200 result, not an HTTP error.
- **Lines 1157–1181 (`queueHandler`, the v2 queue consumer):**
  for each queue message it POSTs the body to the DO's
  `/internal/execute`; `if (!response.ok) throw …`; on success
  `message.ack()`; on a thrown/non-OK path `message.retry()`.
  So the ACK happens exactly when `_execute` returns 200 — which
  includes every fence refusal returned by `handleMessage`.

## 5. Symbol / line pointers (file: `d6-executor.mjs`, 847 lines)

All line numbers are in the blob above (SHA-256 `68e3f84e…`).

- **`PLAN_STATES_REFUSED`** — lines **92–93**:
  `new Set(["complete", "partial", "retired", "halted_unknown"])`.
  `PLAN_STATES_DISPATCHABLE` — lines 94–95:
  `["active", "parked_quota", "parked_cap", "parked_budget", "parked_storage"]`.
  Header comment lines 80–91 states the vocabulary is exactly the
  complement of the driver's selection in `service.mjs driveOnce`.
- **`resolvePlanForFence(jobId)`** — lines **168–232**, defined
  inside `createD6Executor` (factory at line 119). Strict
  persisted-records resolution only:
  (1) link read `SELECT DISTINCT plan_id FROM d6_plan_jobs WHERE job_id = ?`
  (lines 175–177), multiplicity → `{ conflict: true }` (line 178),
  blank/non-string link → throw `plan_resolution_corrupt_link`
  (lines 188–190, F2);
  (2) job stamp read `SELECT data_json FROM jobs WHERE job_id = ?`
  via `_oneOrNull` (line 197), present-but-unparseable/non-object
  `data_json` → throw `plan_resolution_malformed_job_data`
  (lines 201–205), present-but-empty/whitespace stamp → same throw
  via `stampOf` (lines 205–217, F2), dual stamps `d6PlanId`/`planId`
  must agree or `{ conflict: true }` (lines 220–224, pin 1);
  (3) cross-check link vs stamp → conflict (lines 229–230);
  returns `{ planId: pLink ?? pData }` (line 231; `null` =
  genuinely plan-less). Message-carried fields play no part.
- **`planStateFenceRefusal(resolvedPlanId, msg)`** — lines
  **237–268**: each present message field (`planId`, `d6PlanId`)
  validated independently, malformed or disagreeing →
  `{ refused: "plan_link_mismatch" }` (lines 249–257, F1); plan row
  read `SELECT * FROM d6_plans WHERE plan_id = ?` (lines 259–260);
  no row → `plan_state_check_failed` (line 262);
  **`PLAN_STATES_REFUSED.has(row.state)` →
  `{ refused: "plan_not_dispatchable", planId, planState }`
  (lines 263–265)** — the `retired → plan_not_dispatchable`
  refusal; unrecognized state → `plan_state_check_failed`
  (lines 266–267); otherwise `null` (pass).
- **`handleMessage(msg)`** — lines **632–846** (returned from the
  factory at line 846: `return { handleMessage, recover };`).
  Pre-claim fence order inside it (comment block lines 666–683):
  (1) resolution — `resolution = resolvePlanForFence(jobId)`
  (line 692), throw → `plan_state_check_failed` (line 694),
  conflict → `plan_link_conflict` (line 696);
  (2) quarantine hold read against the RESOLVED identity
  (lines 699–709), held → `plan_quarantined`;
  (3) plan-state fence — `refusal = planStateFenceRefusal(resolvedPlanId, msg)`
  (lines 712–718), `if (refusal) return refusal;` (line 718).
- **`claimGrant` ordering** — line **733**:
  `const claim = c.claimGrant({ grantId, consumerId: cid });`
  — strictly AFTER the entire pre-claim fence block above
  (lines 684–731). Every fence refusal returns before line 733 is
  reached: no claim, no execution record, no provider contact.
  Claim outcomes handled at lines 734–737 (`dropped` /
  `stoodDown`); post-claim bookkeeping adopts the resolved
  identity (lines 739–745).
- **Return → ACK chain:** any refusal is a normal return value of
  `handleMessage` → `_execute` wraps it `json(200, result)`
  (entry lines 834–836 area) → `queueHandler` sees `response.ok`
  and calls `message.ack()` (entry lines 1172–1173 in the local
  tree numbering; the handler spans lines 1157–1181). The stale
  message is terminally consumed, never retried into the fence.

(Tiny excerpts above are paraphrase-level pointers with the exact
refusal literals quoted; Rowan can read the full text at the blob.)

## 6. Fence test evidence (29/29)

- **Suite:** `tests/ch2fix-rearm-fence.test.mjs` (T1–T17 incl.
  subtests; 29 tests). Header states every refusal asserts the
  global pair: provider calls 0 AND full row sets byte-identical
  before/after (grants, claims, transitions, jobs, occurrences,
  `d6_plans`, `d6_plan_jobs`, `d6_execution_records`,
  `spend_intents`, `d6_attempt_log`).
- **Pinned path (same lineage, present at `6a73d962…` and
  `75368c31…` trees):**
  `review/rearm-fence/worker-tests/ch2fix-rearm-fence.test.mjs`
  — git blob `4635d3e4c10886da9cbcb72142a9a247cc86589f`,
  32,799 bytes, SHA-256
  `07ff78bd44cfa13f71b5fcb6183569ed143e1c0f58a1911b04728d9658707176`
  (Wren re-fetched the blob for this supplement and byte-diffed it
  against the disposition tree's test file: identical).
- **Build report:** `review/rearm-fence/BUILD-REPORT.md` at the
  same pins — §3 (T1–T15, 21/21 at the first fence pin) and §8
  (F1/F2 corrections: **fence suite 29/29 pass**; full battery
  127 suites 105/22, 1,015 tests 993/22, zero assertion failures,
  D8 baseline failing set identical). Key tests for this hold:
  **T1** (live October `halted_unknown` shape → `plan_not_dispatchable`),
  **T2** (the `retired` twin → refused with `planState: "retired"`),
  **T9/T10** (message-carried identity cannot redirect the fence;
  single-resolution proof).
- The same suite also lives, unchanged, in the disposition tree
  (`tests/ch2fix-rearm-fence.test.mjs`) and ran in the disposition
  build battery (129 suites; its per-file log is in the
  disposition build's local logs).

## 7. What this supplement does NOT do

No production contact, no code change, no deploy, no re-arm, no
unpause, no generation, no spend, no stale job/grant mutation.
The only new pinned content is this document, a README pointer,
and the byte-identical review copy of the executor module (§1) —
included so Rowan's direct fetch succeeds at a re-arm-review path
as well as at the original `rearm-fence` path. Gate 7 remains
exactly where Rowan's hold left it: her completed review first,
then Julie's separate re-arm decision.

— Wren
