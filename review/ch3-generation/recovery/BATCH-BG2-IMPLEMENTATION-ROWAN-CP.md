ROWAN-CP — WS2 B-G2 offline implementation, complete, for source review.

<BG2IMPL-PIN>

Wren will pin, in the code repo, this implementation package:
the implementation record, the manifest, and verbatim copies of
the eight changed files. The full candidate tree is pinned via
the record's hashes (MANIFEST.md carries the per-file delta and
the full 31-part sha256 manifest). Nothing was deployed,
posted, or provider-called: this is the offline build only, and
the candidate ships with D6_LANE_ALLOWLIST = ["standard"].

WHAT LANDED (spec §3, in §7 order): §3.2 classification surface
inside getBatch (pure classifier; policy only on structured
token evidence; unknown shapes → failed_known; raw provider
text never persisted). §3.4/§4.1 the fence bundle in one
coord._tx (execution → intent → attempt at upper bound → fence
→ markDispatching/quota), the count durable before any POST,
batch_quota_unarmed refusing before any write. §3.3 the D6
Batch branch (one submission per occurrence; known rejections
stay counted; ambiguity fail-closed; halt-at-submit leaves the
fence standing). §3.5 durable terminal receipts + the terminal
bundle; recoveryScan receipt-guarded. §3.6 the poll driver on
drive passes (durable poll state + observations, pass-token
idempotence, started-row-before-GET), D-4's fixed parameters
as observation-only classifications, §3.6.6 continuation,
§3.6.5 cohort reporting, the §3.8 shared commit tail
(exactly-once binding; landed success resumed by re-poll,
never resubmission). §3.7 lease custody + tolling. §3.9 the
follow-on partition. §3.10 adjudication (fail-closed multiple
match, all identifiers preserved verbatim, duplicate-exposure
as an upper-bound scenario, operator decision act as the only
resolution; legacy reconcileBatch hardened; no enumeration
caller is wired anywhere except the operator route). §5 the
two POST routes + the inventory GET, all in the house operator
pattern. §3.12 the inventory read surface + rollback NOT-do
invariants pinned at source level. §3.13 inertness proven on
the shipped tree.

B2-R1..R4: R1 custody proven incl. harness crash() restart and
the baseline-build rollback shape (refuses the message, touches
no Batch row); the floor-build boundary is stated in the
record, not smoothed. R2 ORIGINATION is built as a report
consequence in handleReport (the seam alone was insufficient,
as you held): a non-repair batch job's policy_block report
mints the first kind:"repair" job on the Standard lane with
the deviation markers + repairOrigin, deterministic per-parent
ids, granted in the same transaction; the shared
segmentAttemptsUsed derivation is proven plan-linked (repair
grant slots 12 − 1 = 11 after one Batch attempt); the E2E
(Batch block → originated repair → F3 split chain → exactly
one binding) is green. R3 the halted fence is durably visible
with retained exposure, and clearing the halt structurally
cannot re-POST (fence_without_outcome conversion + the
ambiguity gate; submit count stays 1 in test). R4 every grouped
write was fault-injected on the real harness: fence W1–W6
(incl. day-rollover), terminal bundle, known-outcome bundle,
adjudication adoption/run/decision writes, follow-on creation
— each rolls back whole to a byte-identical snapshot; returned
refusals convert to thrown rollbacks; a nested outer _tx abort
takes the bundle with it.

EVIDENCE: one exit run of everything on the final tree
(tests/run-all.sh, 2026-11-06T15:43:04Z, overall exit 0):
containment 42/42, P2 32/32, R5A 23/23, V3 5/5, BG2 110/110 —
all exit 0. All 29 §4.3 windows covered (CW-01..23, AW-01..05,
FW-01). The P2/R5A identity-fixture staleness is CURED in the
build's fixtures (regenerated from the trees on disk before
every run), not rested on. Delta vs the composed tree: exactly
the §3 file map — 8 files (coordinator +440, d6-executor +921,
genstore +267, service +208, adapters +172, entry +311,
executor +18, gen-constants +11 lines); quota-budget.mjs and
the client untouched.

DEVIATIONS (all named in the record with reasons): the suite
lives in the build workspace, not containment-v4/tests;
behavioral families run on a throwaway fixture copy with the
allowlist flipped in the copy only (the §3.13 mechanism);
standing-battery scaffolding adaptations (cured fixtures,
historic behavioral twins, R5A marker assertion dropped —
behavioral groups byte-identical); executor layer 3 verbatim
(unreachable for Batch jobs by lane routing); synthesized +
receipt resumes by re-poll/flush-adopt rather than the literal
reenterFlush (reenterFlush fails on an absent object; §3.8
requires the landed success preserved); poll observations are
drive-pass-scoped (the queue branch's immediate poll passes no
pass token); a fence-time quota refusal's daily_limit is
staged in memory only (the bundle rolled back — nothing
durable exists to re-derive it from; the occurrence stays
granted and re-fences later); house-style refusal names for
the situations the spec does not name (listed in the record).

OPEN, unchanged (§8): B-1 pricing (no differential assumed or
claimed), B-2/B-3 as B-G3 predicates, O-1 (D-4 observation
only), O-5 (real error shapes first observed at B-G3; taxonomy
changes require a new reviewed change), O-6 platform-
unverified behaviors. Nothing here authorizes staging,
production, a provider call, or the allowlist flip.

Ask: source review of the B-G2 implementation package against
the conditional scope pass + B2-R1..R4. Whose turn: Rowan's.
