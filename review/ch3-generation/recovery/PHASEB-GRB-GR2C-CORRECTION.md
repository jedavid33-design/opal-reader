# Phase B — GENERATION-RESUME gate: the GR-B / GR-2C amendment — NARROW CORRECTION (the §2.3 same-pass evidence wording, and §6 conformed)

_Prepared by Wren, 2026-11-05, under Rowan's GR-B / GR-2C final readiness review (local record `ROWAN-GRB-GR2C-FINAL-REVIEW.md`; amendment pin `74c5c525ab7de539396aa24f29c5b54084c73c49`). This is the narrow correction that review's item 3 commissions and its item 5 returns for final confirmation: it corrects **one passage** — the operative evidence gloss at amendment §2.3 — and conforms **one passage** of the §6 GO proposal that mirrors it. Everything else in the review was accepted as filed (items 1, 2, 4) and is not re-opened here. This correction is documentary only: it authorizes nothing, requests no GO, performs no production act. Production remains HELD at NORMAL (GENERATION_HALT `"1"`, queue paused, no alarm registration standing); the preserved plan and the idx-26 exemption stand untouched. OQ-2 remains OPEN PENDING PRODUCTION OBSERVATION; W-4 remains unresolved._

Pin (this document and the companion cp ride one pin commit): `<CORR-PIN>` — repo `jedavid33-design/opal-reader`, branch `ui1-review`. (Pin-slot pattern, as established: a commit cannot name itself; the pinned copy carries the slot.)

## 0. What this correction amends — and what it does not touch

**Amended:** `PHASEB-GRB-GR2C-READINESS-AMENDMENT.md` (pin `74c5c525…`) at:

- **§2.3** — the operative paragraph beneath the ruling's quoted protocol correction (the blockquote itself is Rowan's text and stands verbatim, unamended). The struck paragraph and its replacement are at §2–§3 below.
- **§6** — the GR-2C passage inside the quoted GO proposal, conformed to the corrected §2.3 model. The struck passage and its replacement are at §4 below. No other word of the GO proposal changes; all its boundaries stand exactly as filed.

**Untouched, expressly:**

- Review **item 1** — V-3 ACCEPT AT HARNESS STRENGTH. Not re-argued; no further harness run is required or proposed (the ruling: none is required unless the implementation or assertions change; neither changes here — this correction is evidence *wording*, not implementation).
- Review **item 2** — the regression identity failures' documentary disposition ACCEPTED (P2 31/32 and R5A 21/23 preserved alongside the passing behavioral counts; neither suite relabelled PASS). Untouched.
- Review **item 4** — OQ-5 ACCEPT (the Wren-side scheduler stands outside the counted production-command ledger; its setup verification, escalation, and termination requirements remain mandatory). Untouched.
- Amendment §§1, 2.1, 2.2, 2.4, 3, 4, 5, 7, 8 — untouched. In particular the **poll discipline, the two-consecutive-complete-polls rule, the job-revision 89/90 rule, the 15-minute hard bound with no extension, and the zero-exposure law** of §2.2 all stand exactly as pinned; §3 below states how two of §2.2's cross-references read under the corrected §2.3, and changes no §2.2 text.

## 1. The ruling, item 3 — verbatim

> 3. GR-2C: ACCEPT SUBJECT TO ONE CORRECTION. Preserve the recorder requirement, 15-minute hard bound, two consecutive complete settling polls, reservation checks, and zero-exposure law.
>
> Revise §2.3 so a same-pass safe void and reissue can satisfy the checkpoint when the underlying ordered transition records separately establish both events, even if the first completed poll already shows seg:87 voided and seg:88 issued.
>
> Require the executor to preserve the first recorder-row capture, the first available accounting capture, the distinct void/reissue event evidence, and two consecutive complete settled-state polls. Do not require a separately observable intermediate pending state when the transactions complete within one pass. If ordered transition evidence is unavailable, do not infer it merely from the settled grant state; STOP and return for review.

And item 5, the part that governs this correction's scope:

> 5. Revised GR-B GO: NOT YET APPROVED FOR PRESENTATION. Correct the same-pass evidence wording in the operative protocol and proposed GO, keeping all other boundaries unchanged. Return the narrow correction for Rowan’s final confirmation.

## 2. Struck — amendment §2.3's operative paragraph

The following paragraph of amendment §2.3 (the operative gloss directly beneath the ruling's quoted protocol correction, which is **not** struck) is **struck in full**:

> Operatively: the execution record must present, as distinct
> evidence items, **(i)** the poll capture carrying the first new
> recorder row (GR-2C(a)/(b)); **(ii)** the first poll at which
> `seg:87:full` reads voided (the void transition); **(iii)** the
> first poll at which `seg:88:full` reads issued (the reissue
> transition); and **(iv)** the two consecutive complete settling
> polls of §2.2. A record that shows only a completed pass and a
> settled state, without (ii) and (iii) identified, has **not**
> discharged GR-2C, however clean the settled state reads.

**The defect, stated plainly.** Items (ii) and (iii) as drafted define the void and the reissue as *poll observations* — the first poll at which each state reads. That is the wrong evidence shape for the transition the checkpoint exists to observe. In the V-3 battery's T1 (amendment §4.4, from `v3-harness/RESULTS.md`), the safe void of `seg:87:full` and the issuance of `seg:88:full` completed **inside one drive pass**: the first post-pass observation already shows `seg:87` voided and `seg:88` issued, and the two events are established separately by the **ordered transition records** — the void transition (named `lease_expired_undelivered`, exactly one) and the issuance transition carrying `seg:88`'s grant id (exactly one; the void applies no job event) — not by any intermediate poll. The source-derived production expectation is the same shape (assessment §3, CR-2). Read literally, the struck paragraph would make GR-2C unsatisfiable in exactly its expected case: no poll can ever show the void before the reissue when both complete between two polls, and the occurrence's `granted` → `pending` → `granted` path within a single pass is likewise unobservable as a polled intermediate state. The identification requirement itself is sound — the ruling preserves it; what changes is *where identification lives*: in the ordered transition records, preserved as evidence, rather than in a sequence of polls that may not exist.

## 3. Replacement — amendment §2.3's operative paragraph, corrected

The struck paragraph is replaced by the following, which becomes amendment §2.3's operative text (the ruling blockquote above it unchanged):

> Operatively: the execution record must present, as distinct
> evidence items, **(i)** the first recorder-row capture (the poll
> capture carrying the first new recorder row, GR-2C(a)/(b));
> **(ii)** the first available accounting capture (the first
> complete poll of the checkpoint read set taken after the probe);
> **(iii)** the distinct void/reissue event evidence — the
> **ordered transition records** that separately establish the
> void of `seg:87:full` and the issuance of `seg:88:full`, each
> event identified in its recorded order; and **(iv)** the two
> consecutive complete settling polls of §2.2. The void and the
> reissue may complete **within a single drive pass**: where they
> do, items (ii)–(iv) are satisfied on the transition records of
> (iii) together with the settled polls, **even if the first
> completed poll already shows `seg:87:full` voided and
> `seg:88:full` issued**, and **no separately observable
> intermediate state is required** — the occurrence's
> `granted` → `pending` → `granted` path, where it completes
> within one pass, is evidenced by the transition records rather
> than by a poll. The guard is unchanged in strength and is the
> other half of this paragraph: **if the ordered transition
> evidence of (iii) is unavailable, the void and the reissue must
> not be inferred merely from the settled grant state** — a record
> that shows only a completed pass and a settled state, without
> the two events separately established by their transition
> records, has **not** discharged GR-2C, however clean the settled
> state reads: **STOP**, both holds standing, and return for
> review.

**How the standing §2.2 cross-references read under this correction** (stated for the record; no §2.2 text is amended):

- **GR-2C(c)**'s requirement that the void and the reissue be "separately identified transitions (§2.3), not inferred from the settled state alone" now resolves to §2.3 as corrected: *identification* is by the ordered transition records of item (iii). The requirement's strength is unchanged — separate establishment of each event remains mandatory; only its evidence carrier changes, from polls to the transition records the pass itself writes.
- **GR-2C(d)**'s transient-0 rule reads as follows under the same-pass shape. The two settling polls must show derived reserved **exactly 12** — unchanged. A transient reading of **0** in an intermediate poll remains permissible **only** as an observed, explainable intermediate: under the corrected model that means a 0 observed in a poll bracketed by the identified void and reissue event evidence of (iii) — the reservation released by the void and not yet re-derived under the successor — and by nothing else. Where the void and reissue complete within one pass and no intermediate poll exists, no 0 need be observed at all; its absence is not a gap. A value of **24 at any poll**, any other reservation value at the settling polls, or any unexplained reservation movement remains a **STOP**, exactly as pinned.
- The **job-revision 89/90 rule** (§2.2) is untouched and reads as before: the revision at the settling polls is accepted only when the recorded event sequence — the recorder rows and the identified void/reissue transitions, now the records of item (iii) — explains the count and the (c)–(d) predicates match. (In the V-3 shape that sequence is exactly one issuance transition, revision 89; nothing in this correction widens or narrows the band.)
- The **separate-evidence principle** itself is preserved, not weakened: a completed drive pass still does not prove the successor issued. Under the corrected model the successor is proved by its issuance transition record, preserved distinctly under item (iii) — separately from the recorder-row capture of item (i), as the protocol correction requires.

## 4. §6 conformed — the GO proposal's GR-2C passage

The GR-2C passage inside amendment §6's quoted GO proposal mirrors the struck §2.3 model ("between those two identified transitions"). The following passage of the pinned GO wording is **struck**:

> deploy-as-stimulus; then **checkpoint GR-2C, with both holds
> still standing**: the first cold pass's recorder row and the
> settled successor grant evidenced **separately**, intermediate
> polls preserved, the void of `seg:87:full` and the sequential
> issuance of `seg:88:full` each identified, derived reserved
> exactly 12 (a transient 0 only in polls between those two
> identified transitions), dispatched and provider attempts 0
> throughout, and **two consecutive complete polls** confirming
> the settled state — the full checkpoint inside the same
> 15-minute bound, with **no extension**;

(The passage ends mid-line, at that semicolon; the unamended
wording continues "on GR-2C's success …" on the same line, in both
the struck and the replacement text.)

and is replaced, in place, by:

> deploy-as-stimulus; then **checkpoint GR-2C, with both holds
> still standing**: the first cold pass's recorder row and the
> settled successor grant evidenced **separately**, intermediate
> polls preserved, the void of `seg:87:full` and the sequential
> issuance of `seg:88:full` each established by the ordered
> transition records — the two events may complete inside one
> pass, in which case no intermediate poll is required and the
> first completed poll may already show `seg:87:full` voided and
> `seg:88:full` issued; if the ordered transition evidence is
> unavailable, the events are not inferred from the settled state
> and the attempt stops, both holds standing — derived reserved
> exactly 12 at the settling polls (a transient 0 only as an
> observed, explainable intermediate bracketed by the identified
> void and reissue event evidence; 24 at any poll stops the
> attempt), dispatched and provider attempts 0 throughout, and
> **two consecutive complete polls** confirming the settled
> state — the full checkpoint inside the same 15-minute bound,
> with **no extension**;

Nothing before or after this passage in the GO wording changes: the census predicates, the single probe and its counting, the lift order, the post-unpause protocol (sliding 35-minute stall window, three-hour checkpoint, A-7), the express bars (no SubmitJob, no exemption call, no containment transition, no Batch, no rest-of-book, no other generation), the ≤ 5 counted-command ceiling, the ends-HELD close on every path, the post-gate observation duty, and the playback-acceptance clause all stand exactly as filed at pin `74c5c525…`.

## 5. Disposition of the final readiness review

| Item | Subject | Disposition |
|---|---|---|
| 1 | V-3 at harness strength | **ACCEPTED as filed** — untouched by this correction |
| 2 | Regression identity failures — documentary disposition | **ACCEPTED as filed** — untouched by this correction |
| 3 | GR-2C — the same-pass evidence wording (§2.3; §6 conformed) | **CORRECTED HERE** (§§2–4 above) |
| 4 | OQ-5 — scheduler outside the counted ledger | **ACCEPTED as filed** — untouched by this correction |
| 5 | Revised GR-B GO — approval for presentation | **PENDING this correction's final confirmation** |

## 6. What stands on confirmation

On Rowan's final confirmation of this correction, the GR-B / GR-2C readiness amendment (pin `74c5c525…`) as corrected here, with its completed V-3 annex and the conformed §6 GO proposal, stands as the operative readiness package, and the §6 GO proposal stands ready for presentation to Julie for her separate authorization decision — presentation itself being a later act, not performed or requested by this correction. Until that confirmation, the GO proposal is **not** presented, and no production act of any kind is authorized or pending: no wake, no hold lift, no dispatch, no SubmitJob, no deployment, no Batch activation. Production remains HELD at NORMAL.

**Turn: Rowan's** — final confirmation of this narrow correction.
