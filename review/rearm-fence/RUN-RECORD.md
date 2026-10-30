# Workstream A — run record

- Authorization: Julie, Oct 30 2026 (board record 6531496748); scope: design-first, repo-only, no production contact beyond existing read surfaces (none was needed — all production facts from the Gate-1/D0 evidence record), no board posts except the final filing.
- Rowan's condition read firsthand: comment 6528590586 + Option-B amendment §5 (DEPLOY-PLAN-AMENDMENT-OPTION-B.md:457–487).
- Trace: source inspection of ~/workspace/gen-pkg-1/worker-build/ (live pin f3b6e6e9). Bottom line: halted today = no contact (3 halt layers); re-armed = provider contact for the 9 never-attempted occurrences via d6-executor.mjs:335; the missing check is a plan-state read on the dispatch path (zero plan-state references in d6-executor.mjs).
- Design: Option A (plan-state dispatch fence) recommended; Options B/C compared; purge named non-probative adjunct. Tests T1–T9 specified.
- Pin: 8bd9d4ac748d9d8c68fc5d9bda8af769c971f315 on ui1-review, parent exactly 548a0ffefdd263643506ed26fd984aa8dbb449b4 (STOP-checked before and after; head had not moved). Compare-verified: +2 files (review/rearm-fence/DESIGN-PACKET.md, TRACE-EVIDENCE.md), 0 modified/deleted. Blobs asserted equal to locally computed git blob ids before commit.
- Filing: opal-roundtable issue #15 comment 6531630012, Handoff RT-H-20261030-9c1e13. Turn: Rowan's (design ruling).
- No code built. No deploy/re-arm/reconcile/retire/generation authorized or taken.

## Revision 1 — Rowan's design ruling applied (Oct 30, 2026)

- Ruling: design ACCEPTED IN PRINCIPLE; 4 corrections required before building (authoritative resolution not via message-first `planIdFor`; one resolution feeding BOTH quarantine + state fences; enumerated fail-closed taxonomy; extended adversarial tests). No deploy/re-arm authorized.
- Grounding: read-only inspection of ~/workspace/ch2-program/fix/worker-build/ (Workstream B tree). Verified: `planIdFor` message-first + error-swallowing (d6-executor.mjs:110–122); quarantine block consumes it, link fallback swallowed (:518–545); `d6_plan_jobs` schema/writers (gen-schema.mjs:42–44; service.mjs:156, 160–164); `_oneOrNull` strict cardinality (coordinator.mjs:400–407); closed state vocabulary + driver selection (service.mjs:840). Also corrected the packet's drifted driver citation :824 → :840.
- Packet revised in place with a marked Revision-1 note; §2.1 strict resolver spec added; tests extended T1–T9 → T1–T15 (T8 broadened to per-step fault injection; T10–T15 new). TRACE-EVIDENCE gained a Revision-1 addendum (items 16–21); original log otherwise unedited.
- Pin + filing: see pin.txt / handoff-id.txt (Revision-1 entries appended below the originals).
