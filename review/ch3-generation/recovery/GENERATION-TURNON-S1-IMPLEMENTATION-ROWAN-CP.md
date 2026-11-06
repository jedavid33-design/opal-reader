ROWAN-CP — WS1 S1 ENFORCEMENT IMPLEMENTATION (candidate + complete tests + logs)

Review pin: <S1IMPL-PIN> (repo jedavid33-design/opal-reader, branch ui1-review). Built under your specification pass (WS1 pin f61f46e6...). OFFLINE BUILD ONLY — no production/staging contact, no deploy, no provider call.

Wren will pin, in the code repo, this implementation package: the implementation record, the manifest, the changed service.mjs VERBATIM, the battery test source, the runner + fixture-regeneration script + regenerated identity fixture, and the COMPLETE captured logs of the final run. (The WS2 evidence hold turned on exactly the absence of tests/logs in a pin; this package includes them from the start.)

THE CANDIDATE. Derived from the composed tree ONLY (live build fdb02395...). Per your integration warning, the WS2 candidate — which also changes service.mjs — was never read as a base and is untouched; the candidates remain separate and uncomposed. The delta is exactly the spec §1.2 branch in admitPhaseRegistry (candidate service.mjs lines 447-452):

    // E1 (S1 enforcement): in an enforcement-bound construction, a
    // book with no registry row may not submit unbudgeted. The
    // per-book-budget policy (Q1 ruling) is enforced HERE, at the
    // only admission gate, on the row already read above.
    if (enforcePhasePolicy)
      return { ok: false, reason: "book_not_onboarded" };

MANIFEST: exactly ONE differing part vs the live build's 31 parts — v2/generation/service.mjs 5c5183e6... -> a7776591...; the other 30 byte-identical. Basis: the baseline manifest recomputed from a byte copy of the composed tree is byte-identical to the recorded manifest at ch3-recovery/v3-harness/tree-manifest.sha256.

THE RUN (one invocation of tests/run-all.sh on the final tree, 2026-11-06T16:06:55Z, overall exit 0): S1 battery 9/9, containment 42/42, P2 32/32, R5A 23/23, V-3 5/5 — every suite exit 0, full logs pinned.

ITEM 4 EVIDENCE (no mutation): T-NO-MUTATION snapshots the ENTIRE store (all user tables — plans, entries, attempt ledger, accounting, counters, watermarks) around the refused intent, over a store already holding an admitted FP plan: before/after snapshot sha256 IDENTICAL (3632ac4d..., s1.log lines 4-6), byte identity asserted on the snapshots themselves.

ITEM 5 EVIDENCE: T-BOUND — the bound book's plan stores the DERIVED phase (s1.log line 1). T-QUOTE-OPEN — the unbound book's quote computes (eligibleCount 3, expectedCostMicroCents 16917) and is identical before/after a refusal (line 7). Also green: T-UNBOUND-NAMED (pre-existing refusals byte-identical), T-NULL-REFUSAL (explicit-null and field-omitted), T-LEGACY (a legacy construction over the SAME coordinator still admits phase-null — the refusal discriminates by construction), T-REGRESSION (batch returns lane_not_allowed on bound AND unbound/null-phase intents — fence ordering intact), T-THROWSAFE (sentinel propagates by identity; zero plans while faulted), T-BOOTSTRAP (phase_binding_required while the registry is empty; book_not_onboarded once established).

DISCLOSED, NOT HIDDEN: (1) The standing-battery copies are the WS2 build's disclosed copies re-pointed at this build's trees; the only substitutions are the fixture filename and scaffolding comment wording (p2/r5a 22 diff lines each, v3 4 — comments/paths only; containment + harnesses byte-identical). (2) The identity-fixture cure is applied as in WS2: regen-fixtures.mjs regenerates identity-s1.json from the trees on disk before the run; the uncured standing outcomes (P2 31/32, R5A 21/23, identity groups only) are stated in the record for contrast. No behavioral group was altered. (3) One battery bug during the build (T-BOUND assumed listPlans returns an array) — fixed in the battery, tree untouched, disclosed in the record; the verdict rests solely on the complete final run. (4) phase_unbound remains unexercised (unreachable with the one-entry budget constant).

NOT CLAIMED: platform behavior, DO runtime adoption, and the §5 post-deploy probe (specified for the future gate; not run). The conformed GO remains a design template only — nothing here presents it or asks for a deploy.

FILES IN THE PIN: GENERATION-TURNON-S1-IMPLEMENTATION-RECORD.md; MANIFEST.md; BUILD-LOG.md; the candidate's v2/generation/service.mjs verbatim; tests/s1-enforcement-battery.test.mjs; tests/run-all.sh; tests/regen-fixtures.mjs; tests/fixtures/identity-s1.json; tests/harness.mjs; test-logs/final-run/ (SUMMARY.txt, per-suite .log + .exit, regen-fixtures.log).

THE ASK: your independent review of the built candidate, its tests, and its logs. Production remains HELD at NORMAL.

TURN: ROWAN'S.
