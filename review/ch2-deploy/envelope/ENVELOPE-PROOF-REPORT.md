# ACTUAL ENVELOPE PROOF — combined Chapter 2 package, pin 288508073b5218a6e0dd90b68d497a331ad872b6

**Purpose:** Rowan's standing caveat (gen-pkg-1 round-6 sign-off,
carried into the Chapter 2 program): validate the ACTUAL upload
envelope of the tree being deployed, not a spec. This proof
assembles the actual multipart envelope for the combined
Chapter 2 worker (gen-pkg-1 + Workstream B fixes B1/B2/B3 +
Workstream A re-arm fence, F1/F2 corrections included) from the
reviewed tree at `~/workspace/ch2-program/fix/worker-build/` and
validates that envelope against the pinned D6 spec
(`worker/p8/deploy-spec-prod-d6.json`, SHA-256 `0dafd14c…` —
byte-identical to the gen-pkg-1 spec).

**Result: PASS — 18/18 assertions** (`proof-pass.log`,
`proof-result.json`). **All three negative mutations FAIL as
required** (exit 1 each). Prepared locally only: no deploy, no
upload, no production mutation. (Two read-only production reads
— `/health` and the queue/script-settings GETs — were taken for
the proposal's pre-state section; they mutate nothing.)

Harness: `proof-ch2-envelope.mjs` (this directory) — the proven
gen-pkg-1 actual-envelope harness (`~/workspace/gen-pkg-1/logs/
deploy-plan/proof-d6-envelope.mjs`) with exactly two substitutions:
the candidate tree path and the pin constant. The candidate tree
is only READ.

## Assembly

- Module parts = the import closure rooted at the production
  entry `v2/worker-entry-prod-d6.js` over the tree's `worker/`
  module set: **27 module parts, 1,217,416 module bytes**.
- **Closure delta vs the gen-pkg-1 envelope (26 parts,
  1,137,209 B), fully explained:** exactly ONE added part,
  `v2/generation/quarantine.mjs` — byte-identical in both trees
  (it is not among the six modified files); it enters the closure
  only now because the fenced executor imports it directly
  (the strict quarantine read moved into the executor's pre-claim
  block). Zero removed parts; zero unexplained parts.
- `host/build-identity.mjs` is the sole stamp part: its part
  bytes carry `BUILD_COMMIT = 288508073b5218a6e0dd90b68d497a331ad872b6`
  exactly once; the tree on disk keeps `"UNBUILT"` (verified, E5/E6).
- Metadata derived from the pinned D6 spec: `main_module`
  `v2/worker-entry-prod-d6.js`, `compatibility_date` 2026-08-29,
  `compatibility_flags` [nodejs_compat], the spec's seven bindings
  (incl. `GENERATION_HALT` plain_text `"1"` and
  `OPALREADER_PHASE_POLICY` plain_text `"enforce"`), plus the
  three required secrets as `{"type":"inherit","name":...}`
  (10 bindings total; names only, zero `secret_text`, zero secret
  values), and the spec's observability object. **No `migrations`
  key** (the D6 spec applies no DO migration).
- Assembled metadata: `assembled-metadata.json`, SHA-256
  `e08b06bc840810739ef5a2fbd5279c6670c1759235fa830121964507f162a9fd`
  — byte-identical to the Gate-1 metadata (same spec, same
  bindings; the deploy changes code only, never bindings).
- Full multipart body: `assembled-envelope.bin`, **1,224,335
  bytes**, SHA-256
  `9c5f1ce4103dea7d07099f2332c954cdecd25c299e12f14077ccf9b9033ff21a`.
- Per-part manifest: `parts-manifest.json` (SHA-256
  `15d76daf…`), 27 parts each SHA-256-listed against its tree
  source.

## Checks (all PASS; proof-pass.log)

E1 spec identity; E2 entry exact + present as a part; E3 every
relative import resolves (27-module closure); E4 bare specifiers
node:-only; E5/E6 every part hash-compares to the reviewed tree,
stamp rule exact; E7/E8/E9 exactly seven spec bindings, each
name/type/value exact, phase policy `"enforce"` once with no
extra keys; E10 secrets inherit-by-name only; E11/E12 no
migrations key, DO topology binds the EXISTING class
`OpalReaderCoordinatorProd` (no `script_name`, no new class) and
the entry exports it; E13 queue topology (producer binding in the
envelope; consumer is queue-side state, read-back-verified at
the gate); E14/E15/E18 compatibility + observability exact,
metadata top-level keys exactly the proven set; E16 multipart
round-trips byte-identically, every module part `filename` ==
part name, Content-Type `application/javascript+module`; E17 the
upload lands HALTED (`GENERATION_HALT "1"` — which is also the
CURRENT live value, verified read-only at proposal time; this
deploy neither raises nor lowers the halt).

## Negative proofs (each FAILS validation, exit 1)

- Drop the seventh binding → FAIL E7/E8/E9/E10
  (`proof-negative-drop-seventh.log`).
- Mistype `"enfore"` → FAIL E8/E9 (`proof-negative-typo-enforce.log`).
- Wrong entry (`v2/worker-entry-prod.js`) → FAIL E2
  (`proof-negative-wrong-entry.log`).

## Tree identity

- Combined worker tree (`worker-build/worker/`, established
  treehash method): SHA-256
  `baf478e656ed506c3134d8a6e45143f18346dc7e20cf19fd7e03767d9e8609b4`
  (57 files). Whole build tree (`worker-build/`): `3bf93e93…`
  (382 files).
- Delta of the combined worker tree vs the live build's source
  tree (`~/workspace/gen-pkg-1/worker-build/worker/`, digest
  `300568ad…`): exactly **6 modified files, 0 added, 0 removed** —
  `generation/d6-executor.mjs` (B3 seam + fence + F1/F2),
  `generation/genstore.mjs` (B2 + reconcile route store),
  `generation/policy-split.mjs` (B3, additions only),
  `generation/service.mjs` (B2 comment/surface),
  `host/adapters.mjs` (B1), `worker-entry-prod-d6.js` (B2 route).
  Test-side: exactly 4 added suites (`ch2fix-adapter-block`,
  `ch2fix-presplit`, `ch2fix-reconcile-route`,
  `ch2fix-rearm-fence`), zero baseline-suite edits.
- Deploy spec file byte-identical to the gen-pkg-1 spec
  (`0dafd14c…`).
