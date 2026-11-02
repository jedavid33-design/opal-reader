# Rowan — Phase B Containment V3 Ruling (relayed verbatim by Julie)

Relay record: relayed verbatim by Julie in the Coding Projects chat,
2026-11-02 ~1:53 p.m. ET, and recorded here by Wren. Cross-check
note (Wren, 2026-11-02): the board (opal-roundtable issue #15) was
checked at the start of this V4 correction package; its latest comment
is still 6585466526 (Wren's containment V3 package filing). No board
comment carrying this ruling exists yet — this chat relay is
presently the only record, and it is preserved verbatim below.
It was NOT duplicate-posted to the board.

---

🪑 Rowan | Phase B Containment V3 Ruling

Verdict: REVISE BEFORE GATE APPROVAL.

The V3 architecture is accepted as the direction for further offline work. No production gate is approved, no execution GO is issued, and production remains under INVESTIGATION HOLD.

Accepted in principle

1. Five independently authorized scopes: C1, C2, R5a-D, C3, S1, plus standalone restoration.
2. Full physical stop_chain verification belongs in C3, not S1.
3. C3 remains PARTIAL and cannot prove suppression under live wake traffic.
4. MAX_STOP_VERIFY_ATTEMPTS = 3 is provisionally acceptable.
5. Reason-required, audited clear is accepted.
6. The _armAlarmIfEarlier post-await gate re-check is an appropriate correction to the demonstrated V2 race.

Required corrections before renewed review

R1 — Stop-record truth. Reconcile the no-downgrade claim with unsuccessful re-verification. Distinguish last successful verification from current physical confidence, including a later surviving registration or failed read. Prove all displayed status combinations remain truthful.

R2 — Async ordering. Narrow or substantiate the claim that synchronous setAlarm initiation plus later deleteAlarm guarantees the final physical registration. Separate JS ordering from platform storage-effect ordering. Keep A-3 explicitly unresolved where necessary.

R3 — Retry exhaustion. Exhaustion must stop further attempts and return for a fresh Rowan ruling and Julie authorization. Clearing CHAIN_STOPPED must not serve as an informal retry reset. Preserve standalone restoration and its census requirements.

R4 — C3 accounting. Produce an exact action-by-action mutation ledger, including stop-record transactions, audit writes, partial failures, ambiguous responses, and verification retries. Define STOP behavior without duplicate physical acts.

R5 — S1 containment. contain_drive alone does not stop an alarm chain. Revise the contingency to provide a separately authorized, operationally justified chain-stop response, or explain why S1 cannot safely execute. Do not quietly add stop_chain to S1's existing GO.

R6 — Evidence and census. Preserve all V3 evidence and run targeted additional tests for R1–R5. Mark platform-only uncertainties. Keep the fixed alarm timestamp and other census values as hard preflight expectations, not presumed current facts.

Deliverables

Return a V4 correction package containing revised design, async analysis, gate proposals, targeted battery results, exact candidate identities and hashes, and a concise unresolved-risk register.

Do not overwrite V2/V3 pinned evidence. Do not perform production calls, deployments, alarm operations, commands, grant changes, hold changes or restoration.

Next turn: Rowan. Production INVESTIGATION HELD. No GO.
