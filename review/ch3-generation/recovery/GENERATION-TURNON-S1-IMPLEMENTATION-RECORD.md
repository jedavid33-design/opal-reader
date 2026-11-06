# WS1 — S1 ENFORCEMENT IMPLEMENTATION RECORD

_The WS1 return under Rowan's WS1 specification pass (relayed by Julie 2026-11-06; verbatim record `ROWAN-WS1-SPEC-PASS-WS2-EVIDENCE-HOLD.md`; board verbatim 6689255324): **PASS — OFFLINE IMPLEMENTATION AUTHORIZED.** This record returns (1) the built candidate and its exact one-file delta, (2) the COMPLETE test implementation and captured logs, (3) the full manifest and exit codes, (4) the no-mutation evidence, and (5) the bound-book admission + eligibility-quote evidence. Offline build only: no production or staging contact of any kind, no deploy, no provider call, no submission. Review pin: `<S1IMPL-PIN>` (repo `jedavid33-design/opal-reader`, branch `ui1-review`). Operative sources: the build specification (pin `f61f46e6179712c6628023308bc9a53682f6d681`) and the deployed source (the containment-v4 composed tree, live build `fdb02395b3775dc945baa395591a73060ab146c4`)._

**Integration warning — complied with.** This candidate derives from the COMPOSED tree only. The WS2 B-G2 candidate also changes `service.mjs`; it was never read as a base, never copied from, and is untouched. The candidates remain separate; no composition was performed or attempted.

---

## 1. What was built

The candidate tree (`s1-build/candidate-tree/`) is the composed tree plus EXACTLY the spec §1.2 branch in `v2/generation/service.mjs`. The complete delta (full-tree diff against a byte copy of the composed tree; the diff has no other hunks):

```
446a447,452
>     // E1 (S1 enforcement): in an enforcement-bound construction, a
>     // book with no registry row may not submit unbudgeted. The
>     // per-book-budget policy (Q1 ruling) is enforced HERE, at the
>     // only admission gate, on the row already read above.
>     if (enforcePhasePolicy)
>       return { ok: false, reason: "book_not_onboarded" };
```

+6 lines, one file, `node --check` clean. Nothing else in the tree differs (proven three ways: the full-tree diff above; the manifest comparison, §3; and the standing batteries' T0 identity groups in the final run, which verify the candidate's differ-set against the regenerated fixture — exactly one part).

## 2. The test implementation (complete, filed with this return)

- **The S1 battery**: `tests/s1-enforcement-battery.test.mjs` (13,268 B, SHA-256 `bb164d6c…`) — the spec §3 battery as written: T-BOUND, T-UNBOUND-NAMED, T-NULL-REFUSAL (explicit-null AND field-omitted calls), T-NO-MUTATION, T-QUOTE-OPEN, T-LEGACY (a second, legacy-constructed service over the SAME coordinator), T-REGRESSION (incl. the lane-fence ordering proof), T-THROWSAFE (fault injector on `d6_phase_bindings` queries; sentinel asserted by identity), T-BOOTSTRAP. It runs on the house harness (`tests/harness.mjs`, a byte-identical copy of containment-v4's: real `node:sqlite`, `.one()` throws with production semantics).
- **The runner**: `tests/run-all.sh` — ONE invocation regenerates the identity fixture from the trees on disk, then runs all five suites, capturing full logs + per-suite exit files + a summary under the log dir.
- **The standing batteries**: byte-identical copies of the WS2 build's disclosed test copies (containment 42, P2, R5A, V-3 + their harnesses — the copies whose behavioral groups are byte-identical to the original batteries), re-pointed at this build's trees. The ONLY substitutions in the copies are scaffolding strings: the fixture filename (`identity-bg2.json` → `identity-s1.json`; 2 load sites + prose) and build-name wording in scaffolding comments (diff vs the WS2 copies: p2 22 lines, r5a 22 lines, v3 4 lines — comments and paths only; containment and every harness: 0 lines). No test body, assertion, or behavioral group was changed.
- **The identity-fixture cure, applied and disclosed**: `tests/regen-fixtures.mjs` (adapted from the WS2 regen script, S1 labels) regenerates `tests/fixtures/identity-s1.json` — the baseline tree's full 31-part manifest + the candidate's changed parts — FROM THE TREES ON DISK before the run. This is the documented cure for the known P2/R5A identity-fixture staleness (the original fixtures pin an older coordinator hash, `c097061a…` vs the composed tree's `5303cb63…`; on the uncured composed tree the standing outcomes were P2 31/32 and R5A 21/23, behavioral groups fully passing, identity groups failing on the stale pin alone — Rowan's documentary disposition of Nov 5, 2026). With the cure, the identity groups verify BOTH trees against hashes measured from the trees themselves, and the suites report at full strength below. The battery test files' behavioral content was not altered to obtain this.

## 3. The final run — counts and exit codes

One complete invocation of `tests/run-all.sh` on the final candidate tree, 2026-11-06T16:06:55Z, logs captured at `test-logs/final-run/` (filed with this return):

| Suite | Tests | Pass | Fail | Exit |
|---|---:|---:|---:|---:|
| **s1 (new)** | 9 | 9 | 0 | 0 |
| containment | 42 | 42 | 0 | 0 |
| p2 | 32 | 32 | 0 | 0 |
| r5a | 23 | 23 | 0 | 0 |
| v3 | 5 | 5 | 0 | 0 |
| **overall** | | | | **0** |

Manifest: `MANIFEST.md` (SHA-256 `013635e0…`) carries the candidate's full 31-part SHA-256 manifest and the comparison against the live build's parts. Basis, stated precisely: the baseline manifest was recomputed from `baseline-tree/` (a byte copy of the composed tree) and is byte-identical to the composed-tree manifest recorded at `ch3-recovery/v3-harness/tree-manifest.sha256`. **Exactly one part differs** — `v2/generation/service.mjs`, `5c5183e6…` → `a7776591…`; the other 30 are byte-identical. The spec §4 STOP condition (a second differing part) is not engaged.

## 4. Ruling item 4 — no-mutation evidence

T-NO-MUTATION snapshots the ENTIRE store (every user table's full contents, canonically ordered — plans, plan entries, the attempt ledger and phase-accounting inputs, quota/dispatch counter tables, epoch notes, and both sync watermarks are all inside the snapshot) before and after the refused intent, with a standing admitted FP plan in the store so the snapshot is non-trivial. Final-run log (`test-logs/final-run/s1.log` lines 4–6):

```
T-NO-MUTATION evidence: snapshot sha256 before=3632ac4d97be3ba2994bfac6ec6796ec3517e5dba96ab4b8b62c5a911dc33666
T-NO-MUTATION evidence: snapshot sha256 after =3632ac4d97be3ba2994bfac6ec6796ec3517e5dba96ab4b8b62c5a911dc33666
T-NO-MUTATION evidence: d6_plans rows=1 (the one seeded FP plan); watermarks/accounting tables inside the identical snapshot
```

The test asserts byte-identity of the two snapshots (not merely of the hashes printed). The refusal — `{ outcome: "rejected", reason: "book_not_onboarded" }` — performed no plan, accounting, quota, epoch, or watermark mutation, at harness strength.

## 5. Ruling item 5 — bound-book admission + quote evidence

Final-run log (`test-logs/final-run/s1.log` lines 1 and 7):

```
T-BOUND evidence: planId=plan:04aea95788cc29f1404484b0 stored phase=forever-pucked book=book-battery
T-QUOTE-OPEN evidence: eligibleCount=3 expectedCostMicroCents=16917 totalChars=1200 digest=4ae3998530088cffaf6e1b2d94666e0441fc1e7966c62275df6e57d5e9490b14
```

T-BOUND: the bound book's chapter intent is admitted and the created plan stores the phase DERIVED from its binding row. T-QUOTE-OPEN: the UNBOUND book's whole-book eligibility quote computes normally (3 eligible synthetic segments, expected cost present) and is identical before and after a refused intent — enforcement refuses generation, not information. T-UNBOUND-NAMED, T-NULL-REFUSAL, T-LEGACY (a legacy construction over the same coordinator still admits phase-null — the refusal discriminates by construction), T-REGRESSION (batch returns `lane_not_allowed` on both bound and unbound/null-phase intents — the fence's ordering is undisturbed), T-THROWSAFE (the sentinel propagates by identity; zero plans while faulted; the same intent admits after disarm), and T-BOOTSTRAP (`phase_binding_required` while the registry is empty; `book_not_onboarded` for the identical intent once it establishes) all pass, with their evidence lines at s1.log lines 2–3 and 8–11.

## 6. Deviations and disclosures

1. **Battery home**: the spec proposed `tests/s1-enforcement-battery.test.mjs` in the candidate's test tree; the battery lives at `s1-build/tests/` (the WS2 build's build-level tests convention), run against `s1-build/candidate-tree`. Naming/location only; the spec's §4 pin discipline (candidate + battery + logs pinned together) is followed.
2. **Standing-battery copies**: the substitutions enumerated in §2 (fixture filename + scaffolding comment wording) are the only differences from the WS2 build's copies; the fixture REGENERATION is the disclosed cure described there. Nothing was silently changed, and the uncured standing outcomes are stated in §2 for contrast rather than hidden.
3. **One battery bug, caught and fixed during the build** (tree untouched): T-BOUND's first run failed on the battery's own wrong assumption that `listPlans` returns an array (it returns `{ plans, nextCursor }`). The battery was corrected (`.plans`) and re-run; the failed first run is disclosed here, and the verdict rests solely on the complete final run of §3.
4. **T-NO-MUTATION's snapshot is stronger than the spec's enumeration**: a full-store dump rather than per-surface reads. No consequence for the claim (byte identity of a superset implies the enumerated surfaces).

## 7. What remains unproven

Harness strength only, per standing law. The battery does not prove platform behavior: DO runtime adoption of a deploy, real platform alarm/SQLite behavior beyond the harness's mirrored semantics, and the production refusal are all proven only inside the future production gate — whose §5 post-deploy refused-intent probe is SPECIFIED (build spec §5) but was NOT run and is NOT claimed here. `phase_unbound` remains unexercised (unreachable with the one-entry budget constant; carried by the §1.3 source table, as the spec states). The conformed GO passage stands as a design template only, exactly as the ruling holds: it is not presented for production authorization, and nothing in this return asks for a deploy.

— Wren (built 2026-11-06; WS1 S1 enforcement candidate, offline, for Rowan's independent review)
