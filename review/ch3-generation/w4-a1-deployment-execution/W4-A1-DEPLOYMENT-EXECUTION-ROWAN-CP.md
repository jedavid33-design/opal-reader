ROWAN COPY-PASTE — W-4 Track A: A-1 DEPLOYMENT EXECUTION RECORD (for documentary execution review)

Case: Opal Roundtable, issue #15. Handoff: RT-H-20261114-c872f3.
Authorization: Julie's deployment GO (board 6880173930), on your deployment-proposal ruling (board 6879916107). Operative specification: proposal pin 021a2fd9… as amended by D-G1–D-G6.

READ ORDER (Dropbox folder "Opal Roundtable - For Rowan"; the pin carries the identical record plus the deployment-proposal ruling verbatim):
1. W4-A1-DEPLOYMENT-EXECUTION-RECORD.md — the complete record: census, identities, ledger, preservation, verification, admission, terminal census.

RESULT IN BRIEF — EXECUTED, ALL CHECKS PASS, GATE CONCLUDED HELD
- Gate-entry census: all 15 items at their expected values (no deviation; no fault signature; GO validity and exclusive control confirmed in-window per D-G1).
- Candidate: re-hashed at gate time against the accepted manifest — 31 parts, zero mismatches. Stamped set differs only in build-identity.mjs, and there only in the BUILD_COMMIT string (→ 8a16def4…), verified byte-for-byte outside the string.
- Counted attempts: exactly 2 of the D-G2 maximum. (1) Code upload — HTTP 200, success; deployment 67c2263e… (upload response deployment_id 29e92ced…); new etag 611a23c8…. Confirmed landing; no retry. (2) The conditional observability PATCH — exercised because the upload demonstrably reset observability to null with all other protected settings correct: HTTP 200; observability restored identical to the census object; script etag UNCHANGED by the PATCH.
- Preservation-first (D-G3): halt still "1", queue still paused with the same sole consumer, binding inventory byte-identical to the census capture, compatibility unchanged — all established before the remaining verification.
- Verification: /health build 8a16def42e941790ef2eeb460366bb19ef977801, halted, armed. Repair-status #1 already initialized:true with verified zero state (the D-G4 permissible case; recorded as the expected deployment-adjacent effect). Diagnostics drive=1: recorder untouched — pass 451 latest, reported registration 1794024828557 BIT-IDENTICAL across the upload, pending 1/1, failures 0. Repair-status #2: initialized, 0 strikes, 0 events. Containment NORMAL/verified, unchanged. Capabilities halted, batch_not_armed.
- Admission (D-G5 classification): credential-less GET and POST both 403 migration_operator_required; operator POST {} → 400 repair_body_not_allowed (DO contact YES; no valid operation, no evaluation, no acknowledgment, no handler mutation). No valid-body POST was made.
- Terminal census (D-G6): quota reconcile clean; phase accounting identical; the four conflicts; all six plans and the parked job identical; settings revision 1; watermarks 18/1861. Protected state unchanged apart from the authorized deployment, the restored observability, and the empty additive schema.
- Deviations: NONE. No STOP fired. No ambiguous outcome. Documentary observations (deployment-id naming across eras; the initialized:true first read; the two deployment identifiers) are recorded in the record at §8, at their actual strength.
- Closing state: HELD — build 8a16def4… live, halt asserted, queue paused, containment NORMAL, repair machinery deployed, initialized, empty, and UNUSED. No evaluation, acknowledgment, stimulus, or generation release occurred. First use remains L-1's separate gate; rollback was not needed and remains separately authorized.

QUESTIONS
(i) Does the execution record pass documentary review?
(ii) Any qualification you want carried into the L-1 preparation when Julie directs it?

Production remains HELD. W-4 remains an open historical deviation. L-1 and A-3 remain separately gated. WS2/Batch untouched.

Reply route: via Julie, as always. End by naming whose turn it is.
