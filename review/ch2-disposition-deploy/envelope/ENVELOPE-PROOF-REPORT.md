# ACTUAL ENVELOPE PROOF — uncertainty-disposition package, pin 6a73d9622e1b4eac00c58e289de1c674ed6b3d6b

**Purpose:** Rowan's standing caveat (gen-pkg-1 round-6 sign-off,
carried through the Chapter 2 program): validate the ACTUAL
upload envelope of the tree being deployed, not a spec. This
proof assembles the actual multipart envelope for the
uncertainty-disposition worker (live build `28850807…` source +
the §8 disposition delta + S1/S2 focused corrections) from the
reviewed tree at
`~/workspace/ch2-program/disposition/worker-build/` and
validates that envelope against the pinned D6 spec
(`worker/p8/deploy-spec-prod-d6.json`, SHA-256 `0dafd14c…` —
byte-identical in this tree, verified by hash).

**Result: PASS — 18/18 assertions** (`proof-pass.log`,
`proof-result.json`). **All three negative mutations FAIL as
required** (exit 1 each). Prepared locally only: no deploy, no
upload, no production mutation. (Read-only production reads —
`/health` and the cf-api queue/script-settings/settings GETs —
were taken for the proposal's pre-state section; they mutate
nothing.)

Harness: `proof-ch2disp-envelope.mjs` (this directory) — the
proven combined-package harness (`proof-ch2-envelope.mjs`) with
exactly three substitutions: the candidate tree path, the pin
constant, and the E17 log label (the stale Gate-1-era
parenthetical — which spoke of a live halt of "0" — corrected
to state that the current live value is also "1"; label text
only, no check logic changed). The candidate tree is only READ.

## Assembly

- Module parts = the import closure rooted at the production
  entry `v2/worker-entry-prod-d6.js` over the tree's `worker/`
  module set: **27 module parts, 1,256,138 module bytes**.
- **Closure delta vs the combined Chapter 2 envelope (27 parts,
  1,217,416 B), fully explained:** the part SET is identical
  (27/27, zero added, zero removed). Exactly five parts carry
  changed bytes: the four disposition files
  (`v2/generation/genstore.mjs`, `v2/generation/service.mjs`,
  `v2/generation/grant-guards.mjs`, `v2/worker-entry-prod-d6.js`)
  and the stamp part `v2/host/build-identity.mjs` (its stamp now
  carries this pin). Module bytes grow by exactly the
  disposition delta: +38,722 B.
- `host/build-identity.mjs` is the sole stamp part: its part
  bytes carry `BUILD_COMMIT = 6a73d9622e1b4eac00c58e289de1c674ed6b3d6b`
  exactly once; the tree on disk keeps `"UNBUILT"` (verified,
  E5/E6). **No tree edit is required or made to set the build
  marker** — stamping happens in the harness at assembly time,
  exactly as for the Gate-1 and combined deploys; the deployed
  Worker's `/health` build will therefore read the reviewed pin
  `6a73d962…`.
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
  — byte-identical to the Gate-1 and combined-deploy metadata
  (same spec, same bindings; the deploy changes code only, never
  bindings).
- Full multipart body: `assembled-envelope.bin`, **1,263,057
  bytes**, SHA-256
  `7d82eccf80b1f8fd5d38f9dd7deafb1f2b41a72829f14dc1b4e962acc394ee32`.
  (The `.bin` itself is not pinned; it is deterministically
  re-assembled by the harness from the reviewed tree, and its
  SHA-256 is recorded here and in `envelope-hashes.txt`.)
- Per-part manifest: `parts-manifest.json` (SHA-256
  `543a3b31…`), 27 parts each SHA-256-listed against its tree
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
  (`proof-negative-drop-seventh.log`) — the same failing set as
  the combined package's proof.
- Mistype `"enfore"` → FAIL E8/E9 (`proof-negative-typo-enforce.log`).
- Wrong entry (`v2/worker-entry-prod.js`) → FAIL E2
  (`proof-negative-wrong-entry.log`).

## Tree identity

- Disposition worker tree (`worker-build/worker/`, established
  treehash method): SHA-256
  `6cc8a83033bc86b67ce4ca5aa99a0b298b701e3effb62cf9bf6b446f0b0864d9`
  (57 files — the same file count as the live build's tree).
- Delta of the disposition worker tree vs the live build's
  source tree (`~/workspace/ch2-program/fix/worker-build/worker/`),
  verified by recursive diff: exactly **4 modified files, 0
  added, 0 removed** — `generation/genstore.mjs`,
  `generation/service.mjs`, `generation/grant-guards.mjs`,
  `worker-entry-prod-d6.js`. Test-side: exactly 2 added suites
  (`tests/ch2disp-disposition.test.mjs`,
  `tests/ch2disp-route.test.mjs`), zero baseline-suite edits.
- Deploy spec file byte-identical to the gen-pkg-1 / combined
  spec (`0dafd14c…`).
