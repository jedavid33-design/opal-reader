# TURN-ON 2 — P-13 RECONCILIATION EVIDENCE (R-A)

**Date:** 2026-11-09. **Executor:** Wren (offline documentary work; production not modified — read-only data pulls and previously captured census evidence only; production remains HELD).
**Question (Rowan ruling R-A, handoff `RT-H-20261109-dc9b02`):** is the Chapter 5 quote's book digest transition `7d76a053…` → `831e456d…` **exclusively** caused by the first attempt's 19 Chapter 4 bindings? R-A accepts `831e456d…` as the P-13 post-generation expectation for this GO's permitted re-run **if and only if** (a) a before/after canonical occurrence-disposition comparison accounts for all differences and they are exhausted by the 19 identified bindings, and (b) an independent recomputation of SHA-256 from the pinned canonicalization yields `831e456d…`.
**Result: both conditions are satisfied, in full, on the evidence below.**

## 1. The pinned canonicalization

From `v2/generation/eligible-set.mjs` in the live build's source tree (S1 candidate tree = the deployed build `ef69b8f91dad3acbed0b9c36cf3c11e238e27f72`; its parts were verified 31/31 byte-identical to the deployed worker at the first turn-on deploy, and gate-morning census P-1 re-verified the build and etag):

- Module file SHA-256: `a9932a82ab3a81eeca38a80d3a555b56951a1d4dcef02fcf686bd9a9a264d1f7`.
- Every occurrence of the book appears exactly once, in reading order. Disposition per occurrence, first match wins: (1) `bound_already` — the occurrence has a binding; (2) `excluded_parked` — an entry of the parked job, not released/exempted; (3) `excluded_ch3` — same chapter as the parked job, not an entry, not exempted; (4) `voice_prompt` — the segment's POV resolves to a removed-provider voice (azure | fish | speechify | elevenlabs); (5) `eligible` — everything else.
- **Digest = SHA-256 hex of `JSON.stringify([[occurrenceId, disposition], …])`** in reading order.

## 2. Inputs (all structural; no book text was read into any output — the script consumes only occurrence ids, POV keys, chapter indices, and binding entity keys)

| Input | Source | SHA-256 |
|---|---|---|
| FP content state | Gate-morning-1 census capture `turnon2-execution/census/sync-content.json` — the full content changes feed (watermark **18**, identical at both censuses; FP's latest change is seq 15, revision 3) | `d9a36e623eabc32219d96be7f72e18edccf856b18ccc4ed0588ab6b2a72889b9` |
| Bindings changes feed | Fresh **read-only** pull, 2026-11-09 (~14:57Z), 10 pages, seq 1–1861, highWatermark **1861 (unchanged)**; every change `op = upsert` | page hashes in `reconciliation/results.json` inputs; pages preserved in `turnon2-execution/reconciliation/page-1..10.json` |
| Parked Ch 3 job | Gate-morning-1 census capture `turnon2-execution/census/parked-job.json` | `94f3e0dd5c83a0cdd49bf2b543f16c31008a37aaa582daf4e9ef52b46e5e0aea` |
| Inherited Ch 4 plan + job | Gate-morning-1 census captures `plan-8f14c8885548b9c5ddd6b8df.json`, `job-inherited.json` | `4caaca966bcc3f2d0b3ffcc3598df7974370702334ea23f35fb9940a677cd80d`, `e431624b778eed907046b48cd39813c638f1a35f1c1ec993622b0efc6565b7a2` |

**States compared.** BEFORE = bindings watermark **1842** (the state at the first attempt's census, 2026-11-07T01:23Z — the last state at which the digest of record `7d76a053…` was quoted). AFTER = bindings watermark **1861** (gate morning 1). The content state is the same at both (watermark 18 at both censuses; no content change intervened).

## 3. Method

Reconstruct Forever Pucked's bound-occurrence set at each watermark from the bindings feed (FP entity keys, upserts applied in seq order); build the book plane from the content state (21 chapters, 407 occurrences, reading order = array order, verified equal to chapter-index order; segment POV keys Violet/Alex, both resolving to cast voices on provider **gemini**); attach the parked job exactly as censused; run the pinned `buildEligibleSet` for each state; **independently** recompute SHA-256 from the canonical JSON per §1 (not via the module's own digest return); diff the two canonical lists; cross-check the diff against (i) the bindings feed's delta in the window and (ii) the inherited plan's committed entries; run robustness variants (§5). Script: `reconciliation/reconcile.mjs` (SHA-256 `c187dce4d5d0054bd6e0fe2d66d3882e8b3d2c3ee517bac74cccf5be894bbf2a`); full machine output: `reconciliation/results.json` (SHA-256 `2bd53f21a340a9b0890cf6357abf9b81c938f7bfda4bcc0d4513cf19e2032ace`).

## 4. Results

- **BEFORE digest: module `7d76a0538d8156a050eab0c34ecdb584d92da0c39f6d97a2589fc16ad5e5247f`; independent recomputation identical.** Matches the digest of record.
- **AFTER digest: module `831e456db0d82373d2f408fd9e37d6d9a3dd46e9f2419153be7d2d9755b60f94`; independent recomputation identical.** Matches the gate-morning quote exactly.
- **Universe and order identical in both states** (407 occurrences, same ids in the same reading order).
- **The diff is exactly 19 entries** — every one `eligible` → `bound_already`, every one in chapterIndex 3 (Chapter 4), at reading positions **93–106 and 108–112** (position 92 was already bound before; position 107 is the still-pending parked segment). No other difference exists anywhere in the book.
- The 19 diff ids are **exactly** the bindings-feed delta: FP bindings at seq **1843–1861** are precisely those 19 occurrence ids and no others (FP bound count 93 → 112; the feed contains no deletes — all 1,861 changes are upserts).
- The 19 diff ids are **exactly** the inherited plan's 19 committed/published entries in the gate-morning census reads.
- **Tallies cross-check against every quote of record:** BEFORE whole book eligible **314** (first-attempt whole-book quote: 314 eligible / 414,050 chars); BEFORE chapterIndex 3: bound 1 / eligible 20 (first-attempt quote, digest `7d76a053…`); AFTER chapterIndex 3: bound 20 / eligible 1 (gate-morning record); AFTER chapterIndex 4: eligible 21 / bound 0 (gate-morning Chapter 5 quote); chapterIndex 2: 27 bound in both states (Chapter 3 complete). Recomputed tallies: BEFORE {eligible 314, bound_already 93, voice_prompt 0, excluded_ch3 0, excluded_parked 0}; AFTER {eligible 295, bound_already 112, voice_prompt 0, excluded_ch3 0, excluded_parked 0}.

## 5. Robustness — every judgment call in the reconstruction is provably immaterial

- **Parked release/exemption sets** (not read surfaces): all 27 parked-job occurrences are **bound in both states**, and rule (1) precedes the parked rules, so their dispositions are `bound_already` regardless. Verified mechanically: both digests are unchanged with `releasedIds`/`exemptIds` populated per the paperwork (entries idx 3–25 released, idx 26 exempt), and unchanged with `parkedJob` null entirely. The parked job's entries are exactly the chapterIndex-2 segment set (27/27).
- **POV resolution:** both POV keys resolve to gemini voices (a live provider), so no segment can be `voice_prompt`; verified mechanically — both digests are unchanged with the POV table emptied (unresolved POVs are `eligible` by rule 5, the same result).
- **`blockHistory`** affects only the human-readable reason string of an `eligible` entry (source, §1 module) — never the disposition, never the digest.

## 6. Disposition

R-A's condition is **satisfied**: the differences are exhausted by the 19 identified bindings, and the independent recomputation yields `831e456d…`. Under Rowan's ruling, **`831e456db0d82373d2f408fd9e37d6d9a3dd46e9f2419153be7d2d9755b60f94` is the accepted P-13 post-generation expectation for this GO's permitted re-run.** The executor's earlier tracing is superseded by this demonstrated result. Production was not modified at any point in establishing it; the production HELD state (GENERATION_HALT `"1"`, queue paused) is preserved.

P-12 is **not** addressed by this document — it is governed by ruling R-B and remains uncleared (see the disposition filing that carries this evidence).

**Turn: Julie's** (the November 10 question in the disposition filing), then the gate executor's under the ruling. Production remains HELD.
