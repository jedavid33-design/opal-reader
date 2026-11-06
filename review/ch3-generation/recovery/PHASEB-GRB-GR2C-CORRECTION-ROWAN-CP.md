# FOR ROWAN — GR-B / GR-2C AMENDMENT: NARROW CORRECTION (start here)

Read `00-INSTRUCTIONS-FOR-ROWAN.md` first if you have not. Production
hold stands; this package is the narrow correction your final
readiness review (items 3 and 5) commissions. It authorizes nothing,
presents no GO to Julie, and no production act of any kind is pending
or implied.

PIN: `<CORR-PIN>` — one pin commit carries the correction and this cp
(repo jedavid33-design/opal-reader, branch ui1-review). Sizes and
SHA-256 are in the file list at the bottom. The correction is well
under the parts threshold; no parts accompany it.

## What this is, in one paragraph

Your final readiness review of the GR-B / GR-2C amendment (pin
`74c5c525…`) accepted everything as filed — V-3 at harness strength
(item 1), the identity-fixture documentary disposition (item 2), and
OQ-5 (item 4) — subject to **one correction** (item 3): amendment
§2.3's operative gloss defined the safe void of `seg:87:full` and
the issuance of `seg:88:full` as *poll observations* ("the first
poll at which … reads voided / issued"). In the shape the checkpoint
exists to observe — demonstrated in V-3's T1 — both events complete
**inside one drive pass**, the first completed poll already shows
`seg:87` voided and `seg:88` issued, and the two events are
established separately by the **ordered transition records**, not by
any intermediate poll. This correction strikes that one operative
paragraph and replaces it with the model you ruled; it conforms the
mirroring passage in the §6 GO proposal; and it changes **nothing
else** — no other boundary, predicate, or word of the amendment or
the GO proposal moves.

## The correction, compressed

- **The preservation set is now four items**: (i) the first
  recorder-row capture; (ii) the first available accounting
  capture; (iii) the distinct void/reissue event evidence — the
  ordered transition records, each event identified in its recorded
  order; and (iv) two consecutive complete settled-state polls.
- **Same-pass satisfaction**: where the void and reissue complete
  within a single pass, GR-2C(c)/(d) are satisfied on the transition
  records of (iii) together with the settled polls, even if the
  first completed poll already shows the settled pair. **No
  separately observable intermediate `pending` state is required**;
  the occurrence's `granted` → `pending` → `granted` path, where it
  completes within one pass, is evidenced by the transition records
  rather than by a poll.
- **The guard is at full strength**: if the ordered transition
  evidence is unavailable, the events must **not** be inferred
  merely from the settled grant state — STOP, both holds standing,
  return for review. A completed pass still does not prove the
  successor issued; the successor is proved by its issuance
  transition record, preserved distinctly from the recorder row.
- **Preserved unchanged**: the two-consecutive-complete-polls rule;
  the 15-minute hard bound, no extension; the job-revision 89/90
  rule (the recorded event sequence — now the records of (iii) —
  must explain the count); zero exposure throughout. The transient-0
  rule is restated for the same-pass shape: the settling polls must
  show derived reserved **exactly 12**; a 0 in an intermediate poll
  remains permissible only as an observed, explainable intermediate
  bracketed by the identified void and reissue event evidence; where
  no intermediate poll exists, no 0 need be observed; **24 at any
  poll remains a STOP**.
- Struck and replacement texts are quoted verbatim in the
  correction (§§2–4), including the §6 GO passage, so the correction
  is self-contained. Amendment §§2.2, 2.4 and everything else stand
  exactly as pinned; the correction states expressly how §2.2(c)'s
  "identified transitions (§2.3)" and §2.2(d)'s transient-0 language
  read under the corrected §2.3, and amends no §2.2 text.

## The ask

**Final confirmation of this narrow correction** (review item 5).
On your confirmation, the amendment as corrected — with its
completed V-3 annex and the conformed §6 GO proposal — stands as the
operative readiness package, and the §6 GO proposal stands ready for
presentation to Julie for her separate authorization decision.
Nothing reaches her before your confirmation. Disposition of your
review, for the record: items 1, 2, and 4 ACCEPTED as filed; item 3
corrected here; item 5 pending this confirmation.

## Reply route and turn

Reply to Julie in ChatGPT, as usual; she relays. **Turn: Rowan's**
for the final confirmation. Julie's GO is a later, separate turn,
unrequested here. Production remains HELD at NORMAL; the preserved
plan and the idx-26 exemption stand untouched. OQ-2 remains OPEN
PENDING PRODUCTION OBSERVATION; W-4 remains unresolved.

## File list

- `PHASEB-GRB-GR2C-CORRECTION.md` — 14,665 bytes, SHA-256
  `0f3f95de7cad1c0d3ce29cf6c739d4977a7afa884d671f9ec1d5cfdb8db24de3`;
  no parts (below the ~30 KB threshold).
- `PHASEB-GRB-GR2C-CORRECTION-ROWAN-CP.md` — this file (its size/hash
  are those of the pinned copy; a file cannot carry its own hash).
