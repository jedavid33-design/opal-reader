# FOR ROWAN — Standalone Restoration EXECUTION RECORD (start here)

Read `00-INSTRUCTIONS-FOR-ROWAN.md` first if you have not. Production hold
stands; this package is a documentary execution record for your review. It
authorizes nothing, and nothing in it asks for execution authority.

PIN: `<RESTORE-EXEC-PIN>` — one pin commit carries the execution record and
this cp (repo jedavid33-design/opal-reader, branch ui1-review). Sizes and
SHA-256 are in the file list at the bottom; verbatim 9,000-byte parts
accompany the record (it exceeds ~30 KB), exact-concat verified.

## What happened, in one paragraph

Julie gave the standalone restoration GO in the pinned §6 wording (recorded
on the board, comment 6675499312, BEFORE the census). The R-0 fresh
closing-state confirmation — the readiness package's §3 read set run as one
preflight act in the execution session (your Q-1) — matched **every**
expectation exactly: containment `CHAIN_STOPPED` on both surfaces with the
stop record exact (episode 3, verified, attempts 1, not exhausted,
`prevEpisode*` all null) and `stopConfidence "verified_current"` freshly
derived on both; `armedAt` null; recorder frozen at pass 296; the preserved
plan `active` with its entry `granted`, the Phase B job `generating` rev 88
with the single live grant `seg:87:full`; phase accounting equal on **both**
surfaces; GENERATION_HALT `"1"`; queue paused; build `fdb02395…` with the
script etag read by the §3.2 method (see the thinness note below). Exactly
one `clear` was then sent — **once, with no rejection, no re-send, and no
second act of any kind** — carrying the §4.1 authorizationRef and the §4.2
reason **verbatim** (751 chars; byte-identical to the pinned text, verified
programmatically). It applied: state `NORMAL`, `idempotent: false`, the
current-episode stop fields reset, and episode 3 closed into the summary —
`prevEpisodeId 3`, `prevEpisodeAttempts 1`, `prevEpisodeExhausted false`,
`prevEpisodeClosedAt 1793933356719` (bit-equal to the commit's
`updatedAt`). The closing confirmation read NORMAL on both surfaces with
`stopConfidence "not_applicable"` on both (assumption A-4 confirmed by
observation), `armedAt` still null, both holds standing, and **no delta
anywhere except the ledger's own writes**: 12 closing files byte-identical
to their opening counterparts, 3 differing only in read-time timestamp
fields (`asOf` / `quotedAt`). Totals exactly the §4.4 expectation: **1
state write, 2 audit rows, 0 `deleteAlarm`, 0 `setAlarm`, $0**. The system
ends HELD in NORMAL with no alarm registration standing. The GO is
consumed.

## The four readiness conditions, as discharged

- **Q-1** — confirmation and census were one preflight act (02:48:22Z–
  02:49:00Z), the act following 15 s after the last opening read, same
  session. Any deviation would have stopped the gate before mutation;
  none arose.
- **Q-2** — the historical audit disclosure is carried in the record (§1.2)
  **at documentary strength, in your words**: transition responses, state
  fields, timestamps, and episode arithmetic; episode 3, all four C3
  transitions, and the rejected C3-1 request accounted. **It is not a
  direct enumeration of audit-table rows**, and the same qualification is
  applied to this gate's own two rows (§5 of the record): rows 5
  (`clear:applied`) and 6 (`stop_episode_closed`) are established by the
  transition response, the deployed source's commit shape, and the
  resulting `prevEpisode*` state — not by an audit-table read. No audit
  surface is invented.
- **Q-3** — the reason went out exactly as you accepted it: the record
  quotes the full sent body, and the body file (`r1-body.json`) was
  compared byte-for-byte against the pinned §4.2 text.
- **Q-4** — the one-act ledger ran clean: a single send, applied. The
  no-re-send rule was never engaged. The record notes the C3 contrast
  expressly so the history stays complete: C3's in-gate corrected re-send
  has no counterpart here.

## Evidence thinness the record itself flags (record §2 notes, §7)

So your review sees the set as it is:

- **E-1 (script etag).** The §3.2 header read was performed at R-0 and
  again at closing, returning
  `bb90f18223e1802e1c417f17359f344499dc2d29c78e54db259f6f9ae4ac5c9e` both
  times — the method gap in C3's E-1 is closed. **But no raw evidence
  file for the read exists in the evidence folder** (a header read yields
  no body, and no header dump was saved; there is no `r06`/`t06` file).
  The etag therefore stands at executor-assertion strength, corroborated
  by the `/health` build marker and the settings surface, both read
  in-set on both passes, and by the value's standing as the Grant 1
  build's etag. Disclosed, not papered over.
- **E-2 (parked-job fingerprint).** Not exposed on the read surfaces
  used; **not** byte-compared (state, revision, grants, and full
  occurrence composition verified, at both passes — the closing file is
  byte-identical to the opening one).
- **Projection shapes (noted, none substantive).** The POST response's
  `stateRead` carries neither `stopConfidence` nor an alarm block — the
  `not_applicable` expectation is discharged by the R-2 read-backs, not
  by `s1`. The two phase-accounting projections carry different field
  sets (capabilities: `bookId`, no `settledBasis` / `unknownOpen` /
  `unverifiedStatus`; diagnostics: those three, no `bookId`) — the
  two-surface comparison is on the shared fields, all equal. `r01`
  nests the alarm block inside the containment object while `r02`'s
  projection carries it as a top-level sibling (values equal). The plan
  totals object carries a fifth field (`prompts: 0`); the conflicts read
  returns rows in descending id order (the set is exactly ids 1–4, every
  field at the pinned baseline). The recorder read is a 50-row
  descending window (ids 296 → 247) with `recorderHealth.lastRecordedAt`
  corroborating the head.
- **Closing evidence shape.** The closing confirmation is one continuous
  read series (02:49:28Z–02:49:36Z) whose first two reads are the R-2
  pair; there is no second, separately captured closing pass.

## What the record does NOT claim

No re-arm occurred and none was tested — `armedAt` is null because the
registration C3 deleted stays absent; this record says nothing about
whether a future wake under NORMAL will deliver. The **W-4 remains
UNRESOLVED**; the **racing-wake recheck remains PLATFORM-UNVERIFIED**;
**post-retry-exhaustion `getAlarm()` semantics remain UNSPECIFIED**.
Runtime adoption generally remains unproven (the standing C1-2
limitation): this gate proves the deployed `clear` path executed its
designed transaction on the production build for this singleton row at
this moment, read back identically on both surfaces — no wider claim.
The resume gate's wake design continues to assume delivery cannot be
presumed; nothing here weakens that assumption.

## Questions for Rowan

1. Documentary execution review: does the record, at its stated strength,
   support **RESTORATION EXECUTED AND CLOSED** — the single `clear`
   applied under Julie's GO (6675499312), ending HELD in NORMAL with
   episode 3 closed and no registration standing?
2. The Q-2 qualification as preserved (§1.2 and §5 of the record —
   documentary accounting for both the C3 history and this gate's rows 5
   and 6): accepted as stated?
3. The E-1 etag position (method performed per §3.2 at both passes; no
   raw artifact saved; value at executor-assertion strength with the
   in-set corroboration named): accepted as the record's strength, or is
   a fresh etag read with a saved artifact wanted before restoration is
   closed?
4. With restoration closed (if you so rule), the generation-resume gate's
   remaining preconditions are its final readiness confirmation and
   Julie's separate GO. Is any further documentary item wanted from Wren
   before that confirmation is prepared?

## Reply route and turn

Reply to Julie in ChatGPT, as usual; she relays. **Turn: Rowan's** for the
documentary execution review. Julie's restoration GO is consumed; the
generation-resume gate remains closed and separately hers to open after
your review and its final readiness confirmation. No production act of any
kind is pending or implied.

## File list

- `PHASEB-RESTORATION-EXECUTION-RECORD.md` — 39,234 bytes, SHA-256
  `f97652bf622f099aaf8b73eabb259812836a3536dc82b5b38b422ac180880456`; parts in `PHASEB-RESTORATION-EXECUTION-RECORD.md.parts/`
  (9,000-byte verbatim parts, exact-concat verified) — part-01 (9,000 B, 33f42ce1…), part-02 (9,000 B, 33e16539…), part-03 (9,000 B, 304efd2c…), part-04 (9,000 B, c221d776…), part-05 (3,234 B, 46a769f5…).
- `PHASEB-RESTORATION-EXECUTION-ROWAN-CP.md` — this file (its size/hash are those of
  the pinned copy; a file cannot carry its own hash).
