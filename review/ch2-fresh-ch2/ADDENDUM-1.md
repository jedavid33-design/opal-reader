# ADDENDUM 1 — corrections to the fresh Chapter 2 generation plan

**Status: REPO-ONLY, documentation-only. This addendum submits
no intent, makes no production call, generates nothing, and
spends nothing.** It amends exactly one document:
`review/ch2-fresh-ch2/GENERATION-PLAN.md` as pinned at
`8a2423757328ce600d808347d169954856b9e86d` ("the plan"). Where
this addendum and the plan differ, this addendum governs. Every
passage not listed in §D below stands exactly as pinned.

**Basis.** Rowan's GATE-8 review of the plan (roundtable issue
#15, comment 6538149892): *"GATE-8 FRESH CHAPTER 2 GENERATION
PLAN REVIEW (RT-H-20261030-4576f8): HOLD FOR TWO DOCUMENTARY
CORRECTIONS."* Rowan accepted the plan's §0 correction, its
minting semantics, and its re-derivation, and required two
documentation corrections — C1 and C2 — plus one approval-stage
evidence note, before plan PASS and Julie's spend go. Her
ruling: *"This is NOT a request for a rebuild or new
implementation. Wren can pin a narrow addendum amending C1 and
the billing language, without touching production, and
re-handoff for a targeted review."* This addendum is that
narrow correction, and nothing more.

---

## A. Correction C1 — digest drift is a STOP, never a recompute

Rowan's requirement, in substance: *"§1.4 currently says if
counts match but the plane digest differs, recompute the
predicted plan id, check C2, and proceed. That can swap the
eligible IDs/text/voice/other book inputs under the same
counts, and it conflicts with §1.5's exact pinned expected
plan id. Replace the exception with: any digest mismatch is
STOP, no submission; recapture the exact 18 identities,
binding/voice status and costs, file an updated reviewed plan
and obtain fresh explicit Julie approval before any altered
submission. Count/character equality alone is insufficient.
The original `plan:b2dc…` remains the ONLY permitted identity
under this proposal."*

### A1 — Plan §1.4, check C1: the exception is deleted and replaced

**Old rule (§1.4, C1, final sentences):**

> If counts differ → **STOP**. If only the digest differs,
> recompute the predicted id from the fresh eligible set and
> re-run C2 before proceeding — never submit against a stale
> prediction.

**New rule (replaces those sentences in full; the rest of the
C1 bullet — the quote route and the expected values — is
unchanged):**

> **Any mismatch — in the digest, in any count, or in any
> character total — is a STOP. No submission.**
> Count/character equality alone is insufficient: matching
> counts with a different digest can conceal swapped eligible
> ids, text, voice, or other book inputs under the same
> totals, and would silently change the identity Julie
> approved. On any mismatch: recapture the exact 18
> identities, their binding/voice status, and their costs;
> file an updated plan for Rowan's review; and obtain fresh
> explicit Julie approval before any altered submission. The
> predicted plan id `plan:b2dc2a3d1cd367a0245b9102` (§1.1,
> §1.5) is the **only** identity this proposal permits — it
> is never recomputed as a way to proceed.

### A2 — Plan §1.4, check C2: conforming amendment

So that §1.4 reads consistently after A1 (C2 previously spoke
of "the predicted plan" generically, the phrase the deleted
exception traded on):

**Old rule (§1.4, C2):**

> **C2 — the predicted plan does not exist.**
> `GET /v2/d6-plans/plan:b2dc2a3d1cd367a0245b9102` → 404
> `plan_not_found` (verified at proposal time; re-verify at
> execution).

**New rule (replaces the C2 bullet in full):**

> **C2 — the one permitted plan does not exist.**
> `GET /v2/d6-plans/plan:b2dc2a3d1cd367a0245b9102` → 404
> `plan_not_found` (verified at proposal time; re-verify at
> execution). This check applies to that exact id only. It is
> never re-run against a recomputed or substitute id: under
> amended C1, a changed plane is a STOP and a new approval
> cycle, not a new prediction.

### A3 — Passages reviewed for C1 and deliberately NOT amended

- **§1.5** stands unchanged. Its exact expected response —
  `planId: plan:b2dc2a3d1cd367a0245b9102`, `created: true` —
  with *any other shape a STOP*, is the standard amended §1.4
  now conforms to; Rowan cited it as such.
- **§1.3** (the command-id paragraph) stands unchanged. Its
  treatment of a `created: false` response as a STOP is a
  post-submission rule and never relied on the deleted
  exception.
- **§4, step E0** ("Any drift = **STOP**, report, no
  submission") stands unchanged; it already states the rule
  A1 restores to §1.4.
- The word "digest" also appears at plan §1.2 (the book-scope
  quote) and §2 (derivation 1) as statements of captured fact.
  Neither relies on the recompute-and-proceed exception;
  neither is amended.

---

## B. Correction C2 — no zero-duplicate-billing promise for position 50

Rowan's requirement, in substance: *"§3 heading 'cannot …
double-bill' is too strong for position 50, whose previous
split attempt has UNKNOWN actual Google charge, NULL cost, and
`provider_unverified`. The retired executor fence excludes a
new stale-plan dispatch; it cannot prove the prior request
wasn't billed, nor prevent a fresh call on the same text from
becoming a second paid request. Keep the dual-plan dispatch
exclusion claim, but explicitly disclose possible repeat
provider charge for previously attempted text in §3, §5 and
the decision presented to Julie. No claim that the 5,648
reservation caps this exposure."*

The dual-plan **dispatch** exclusion — plan §3, items (i)–(v) —
stands unchanged. What changes is the billing claim around it,
in three places.

### B1 — Plan §3: heading qualified, disclosure paragraph added

**Old heading (the closing paragraph of §3):**

> **Why the old plan's work cannot double-execute or
> double-bill.**

**New heading (items (i)–(v) beneath it unchanged):**

> **Why the old plan's work cannot double-execute — and the
> one repeat-charge exposure no fence can exclude.**

**New paragraph, appended immediately after item (v):**

> **Disclosure — possible repeat provider charge for
> position 50.** The exclusion above is a *dispatch*
> exclusion: the retired plan can never run again, and no
> occurrence is ever granted under two plans. It is **not**
> a promise of zero duplicate provider billing. Position 50
> (occurrence `59acff00-d6a4-4e2b-9734-34d50f4f59f0`, 1,349
> chars) is the segment whose retired-run split attempt was
> the gate-5 disposed unknown: that attempt's **actual
> Google charge remains UNKNOWN**, its `cost_micro_cents` is
> NULL, and the phase carries `provider_unverified` for it
> (§5). The executor fence cannot prove the earlier request
> was not billed by Google, and it cannot prevent this run's
> fresh call on the same text from becoming a **second paid
> request** if the earlier one was in fact charged. Julie's
> go therefore accepts a possible repeat provider charge for
> this one segment's previously attempted text, on top of
> the modeled figures in §5. The **5,648 micro-cent
> reservation does not cap this exposure**: it is the split
> attempt's persisted *modeled* allowance inside the phase
> ledger — an internal accounting term, not a provider
> figure, not a verified upper bound, and not a ceiling on
> any past or future Google charge (§5 disclosures). Rowan's
> correction names position 50 specifically; no equivalent
> unknown-billing exposure is recorded for any other segment
> in the 18.

### B2 — Plan §5: disclosure bullet added

**New bullet, appended to the §5 "Disclosures" list,
immediately after the bullet ending "…into this run":**

> - **Repeat-charge exposure on the fresh run (added by
>   Addendum 1, Rowan C2).** The fresh run will issue a new
>   provider call for position 50's text (occurrence
>   `59acff00-d6a4-4e2b-9734-34d50f4f59f0`). Because the
>   disposed attempt's actual Google charge is unknown, that
>   new call may be a **second paid request for the same
>   text**. This exposure is real, unquantifiable from any
>   surface available to Wren, and **not capped by the 5,648
>   reservation**, which is an internal modeled allowance
>   only. It is disclosed here, in §3 (as amended), and in
>   the decision presented to Julie (§6, as amended).

### B3 — Plan §6: what Julie's go presentation must contain

**New bullet, added to §6 immediately after the first bullet
(the one stating that execution requires Julie's distinct
go):**

> - **What Julie's go presentation must contain (added by
>   Addendum 1).** The decision presented to Julie for the
>   §4 sequence must include, in substance: (1) the
>   repeat-charge disclosure — *"One segment (position 50)
>   was already sent to Google once in the retired run, and
>   we do not know whether Google charged for that attempt.
>   Generating it fresh may mean paying for that segment's
>   text twice. The small reservation figure in our books
>   ($0.0056) does not limit that possible extra charge."*;
>   and (2) the prepay-balance statement required by §5 as
>   amended (a fresh balance sought from Julie when
>   available, or the explicit statement that the current
>   provider balance remains unverified — last verified
>   $17.83, Oct 29, 2026). A go given without these two
>   statements in the presentation is not the go this plan
>   contemplates.

---

## C. Approval-stage evidence note — the $17.83 prepay figure

Rowan: *"$17.83 prepaid is dated October 29, not a current
balance. Keep this date visibly attached; before any actual
go, seek a fresh balance from Julie when available, or state
explicitly that current provider balance remains unverified
for her informed decision."*

The plan already dates the figure everywhere it appears
(§5: "verified by her screenshot on Oct 29, 2026"; "only Julie
can refresh it"). One closing passage is amended to make the
fresh-balance step a requirement of the go, not an option.

### C1 — Plan §5, "Google prepay — dated, not fresh" bullet: closing replaced

**Old closing:**

> No top-up is proposed or needed for this scope; if Julie
> refreshes the balance before her go, the refreshed figure
> is recorded in the execution record as her evidence, and
> nothing in this plan's math depends on it.

**New closing (replaces those sentences in full):**

> No top-up is proposed or needed for this scope, and
> nothing in this plan's math depends on the balance figure.
> **Approval-stage requirement (added by Addendum 1): before
> Julie's actual go, a fresh AI Studio balance will be
> sought from Julie when available. If she provides one, the
> refreshed figure — with its date — is what the decision
> presented to her cites, and it is recorded in the execution
> record as her evidence. If no fresh balance is available,
> the decision presented to her must state explicitly that
> the current provider balance remains unverified (last
> verified: $17.83, Oct 29, 2026), so her go is an informed
> one.** The $17.83 figure keeps its Oct 29, 2026 date
> attached everywhere it appears.

---

## D. Complete list of amended passages

| # | Location in the plan | Amendment |
|---|---|---|
| A1 | §1.4, check C1 (final sentences) | Recompute-and-proceed exception deleted; any mismatch (digest, count, or chars) is STOP, no submission; recapture + updated reviewed plan + fresh explicit Julie approval required; `plan:b2dc2a3d1cd367a0245b9102` the only permitted identity |
| A2 | §1.4, check C2 (whole bullet) | Conforming: check pinned to the one permitted id; never re-run against a recomputed/substitute id |
| B1 | §3, closing paragraph heading + new paragraph after item (v) | Heading qualified (dispatch exclusion only); position-50 repeat-charge disclosure added; 5,648 reservation expressly does not cap the exposure |
| B2 | §5, Disclosures list (new bullet) | Repeat-charge exposure disclosed in the budget section |
| B3 | §6 (new bullet after the first) | Julie's go presentation must carry the repeat-charge disclosure and the prepay-balance statement |
| C1 | §5, "Google prepay — dated, not fresh" bullet (closing sentences) | Fresh balance to be sought from Julie before her go, or the decision must state explicitly that the current balance remains unverified |

Every passage found by searching the plan for "recompute" and
"digest" is accounted for above: the sole "recompute" passage
is A1; the remaining "digest" mentions (§1.2, §2) are
statements of captured fact that never relied on the
exception and are not amended (§A3).

## E. Confirmation — nothing else changes

- No other section, figure, or statement of
  `GENERATION-PLAN.md` at pin `8a242375…` is amended. In
  particular: the §0 correction, the minting semantics
  (chapter scope, chapterIndex 1, keepGoing `false`, lane
  `standard`, phase `forever-pucked`), the predicted plan id
  `plan:b2dc2a3d1cd367a0245b9102`, the re-derivation
  (18 eligible / 25,091 chars; 20 `bound_already`), the
  grant-guard arithmetic (6,979,913 ≤ 13,500,000), the §4
  execution sequence and unknown-billing runbook, all §5
  figures, and the §6 non-authorizations all stand as pinned.
- The package's `README.md` and
  `evidence/rederivation-assessment.json` are unchanged.
- This addendum touches no production code, no test, and no
  live state. It authorizes nothing: no intent submission,
  Google call, generation, spending, Batch arming, Chapter 3
  action, or stale job/grant mutation — Rowan's HOLD said the
  same, and this addendum does not widen it.

## F. Turn

Rowan's — **targeted review of corrections C1 and C2 (and the
§C evidence note) only**. Then Julie's — a *separate* explicit
decision on one Chapter 2 submission, presented with the B3
disclosures. The system remains armed/unpaused but idle in
the meantime, by design.

— Wren
