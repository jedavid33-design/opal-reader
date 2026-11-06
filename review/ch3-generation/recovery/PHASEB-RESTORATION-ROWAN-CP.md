# FOR ROWAN — Standalone Restoration: Readiness Package (start here)

**PIN:** `<RESTORE-PIN>`

## What this is

This is the readiness package for the **standalone restoration** —
the gate that returns containment from `CHAIN_STOPPED` to `NORMAL` by
exactly one reasoned `clear`. It is NOT part of Gate C3 and NOT part
of the generation-resume gate. It authorizes nothing and executes
nothing; it asks for your ruling on restoration readiness, after
which Julie gives her separate GO (or not) in the wording at §6.

**Where we stand.** Gate C3 branch (d) executed and closed
(2026-11-06T02:24:16Z). Production stands HELD in `CHAIN_STOPPED` with
the stop verified (episode 3, verified at attempt 1). No alarm
registration stands. GENERATION_HALT is `"1"` and the generation queue
is paused, and this gate touches neither.

## What the package contains

- **§1 — Scope and separateness.** Restoration is one `clear`
  (`CHAIN_STOPPED` → `NORMAL`). It is not a re-arm — after the clear,
  `armedAt` stays null; it is not a hold lift; it is not generation;
  it is not the resume gate's wake (which remains that gate's own
  ruled mechanism).
- **§2 — The historical audit review, performed.** The mandatory
  precondition, carried out documentarily. Episode 3 is the only
  episode in the history — opened by the `stop_chain:applied` audit
  row 3, verified at attempt 1 of a bound of 3, **not exhausted**,
  still open, so the R3-V naming requirement does not arise. All
  four reported transitions are reconciled with timestamps,
  authorizationRefs, and the C3 `clear`'s reason ("Gate C3 mechanics
  leg: restore opening state"). The rejected C3-1 request
  (`authorization_ref_required`, zero writes) is accounted as part of
  the history — it is not an audit row. Conclusion: **the history is
  complete and consistent; no inconsistency found.** The one
  limitation is stated at the narrowed strength your ruling accepted:
  no read surface enumerates the audit table directly, so the review
  rests on transition responses, the `updatedAt` chain, the state
  row's stop-record fields, and episode arithmetic — not on a literal
  row listing. Your question on this is Q-2.
- **§3 — Fresh closing-state confirmation.** The exact 16-read
  preflight set (both containment surfaces, the alarm block, holds,
  queue, build identity, plan/job, quota, conflicts, watermarks,
  eligibility), with the C3 closing value as the expectation for every
  item, and a hard STOP on any deviation. This package also closes
  C3's note E-1: it specifies the script-etag read from the
  `cf-api` script GET's response headers (the stock envelope does not
  print headers, so the read uses the connector's own credential
  mechanism) — expected
  `bb90f18223e1802e1c417f17359f344499dc2d29c78e54db259f6f9ae4ac5c9e`.
- **§4 — Execution ledger.** Preflight confirmation → one `clear`
  POST (authorizationRef naming Julie's GO by board comment;
  reason drafted and quoted in full, flagged for your review) →
  read-backs on both surfaces → closing confirmation repeat. Expected
  post-clear state is given field by field: state `NORMAL`,
  `prevEpisodeId 3`, `prevEpisodeAttempts 1`,
  `prevEpisodeExhausted false`, `prevEpisodeClosedAt` set,
  `stopConfidence "not_applicable"` on both surfaces, `armedAt` still
  null, everything else bit-identical. **Mutation budget: exactly 1
  state write + 2 audit rows** (`clear:applied` +
  `stop_episode_closed`), all else 0, $0 — per the gates v4 revised
  budget and the deployed source. Failure branches: rejection → STOP
  and classify; lost response → §R-style re-entry reading state
  first, **never re-send** the `clear`; an idempotent-applied response
  is a deviation, not success.
- **§5 — What restoration does not do.** No re-arm, no hold change, no
  plan/job/grant change, no generation. After restoration the system
  stands HELD at NORMAL with no alarm registration — inert until the
  resume gate acts. The preserved plan stays a live trigger only in
  the documented holds-lifted sense (both holds must lift AND a drive
  pass must occur), which this gate makes impossible by accident.
- **§6 — Drafted GO wording for Julie.**
- **§7 — Assumptions register and open questions.**

## Questions for you

1. **Q-1 — Confirmation vs census.** The package proposes that your
   ruling's "fresh read-only closing-state confirmation" and the
   gates text's "fresh CENSUS executed at its start" are one act —
   the §3 set, run in the execution session immediately before the
   `clear`, valid only within that session. Accept or correct?
2. **Q-2 — Audit-review surface.** The review is at the narrowed
   strength your C3 ruling accepted (no direct audit-table read
   surface exists). Do you accept it at that strength for
   restoration, or do you require a literal audit-table read — which
   would need a surface that does not exist in the current build and
   is not proposed here?
3. **Q-3 — The recorded reason.** Is the §4.2 drafted reason accepted
   as the demonstrated reason for this clear?
4. **Q-4 — No re-send.** §4.5 forbids any corrected re-send of the
   `clear` inside the gate, even for a paperwork-form defect of the
   C3-1 kind — a failed single act returns for ruling. Is that the
   intended posture for a single-act gate?

## Reply route and turn

Please reply to Julie in ChatGPT, as usual. The production hold
stands — nothing here authorizes a production act. End by naming
whose turn it is.

**Turn: Rowan's** — ruling on restoration readiness.

## Files

| File | Size (bytes) | SHA-256 |
|---|---|---|
| `PHASEB-RESTORATION-READINESS-PACKAGE.md` | 41,166 | 5fb5f1ee64aca410964ea9fb67aef5ffcbb0f9bb9bd2063e3468e074caa54629 |
| `PHASEB-RESTORATION-READINESS-PACKAGE.md.parts/part-01` | 9,000 | a49d9faffdabe5842c209194e6fd8305dfb1107578495c8692e74ce95000adc8 |
| `PHASEB-RESTORATION-READINESS-PACKAGE.md.parts/part-02` | 9,000 | e32ddc0e2f034736f158883ef4f3d888b7720ed20f216f5c55a141b975a10eeb |
| `PHASEB-RESTORATION-READINESS-PACKAGE.md.parts/part-03` | 9,000 | 49d1f6baecdebc19c1aca1869916ca2b077e382c509f80bed61bf78b0c4aa175 |
| `PHASEB-RESTORATION-READINESS-PACKAGE.md.parts/part-04` | 9,000 | 4162eb2552a75c6490ad0f2e4b90d0842fc48c106aafc12819619f19af09347a |
| `PHASEB-RESTORATION-READINESS-PACKAGE.md.parts/part-05` | 5,166 | 5ff6ad5fefd7f8b3121577a45c686cb8efc976f128564dedbc6fc317b5f929a8 |

Parts concatenate (in order) to the full package file exactly
(verified: SHA-256 of the concatenated parts equals the full-file
hash above). This cover note is pinned with the `<RESTORE-PIN>` slot
filled on the Dropbox copy, per the established pattern; a file cannot
carry its own hash, so no hash is listed for this note itself.
