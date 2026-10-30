# ACTUAL-D6-ENVELOPE PROOF — gen-pkg-1 candidate pin 5ae38942

**Purpose (Rowan round-6 sign-off, comment 6523652449, condition A):**
the round-5 validator's 26/26 run validated the D6 successor
SPEC (checks P6/P7) plus the OLD pre-D6 production dist
(main_module `v2/worker-entry-prod.js`, 5 bindings, D6 modules
excluded). This proof closes that gap: it assembles the ACTUAL
D6 upload envelope from the signed candidate tree and validates
THAT envelope against the pinned D6 spec.

**Result: PASS — 18/18 assertions** (`proof-pass.log`,
`proof-result.json`). **Negative proofs: all three mutations
FAIL as required** (details below). **Candidate tree untouched**
(digest identical before and after; see "Tree integrity").

Prepared locally only: no deploy, no upload, no production
contact of any kind, nothing posted to the board.

## Assembly (mirrors the proven G4 / seed-fix D1–D2 records)

Harness: `proof-d6-envelope.mjs` (this directory — a separate
proof script; the pinned validator `tools/validate-prod-envelope.mjs`
was NOT modified and the candidate tree was not changed).

- Module parts = the import closure rooted at the D6 entry
  `v2/worker-entry-prod-d6.js` over the candidate tree's
  `worker/` module set (same closure algorithm as the pinned
  validator): **26 module parts, 1,137,209 module bytes** —
  including the gen-pkg-1 modules the old envelope excluded
  (`generation/service.mjs` at its new 58,250 B, plus
  `generation/binding-projection.mjs` and
  `generation/phase-policy.mjs`). Full per-part table with
  SHA-256 hashes: `proof-pass.log` + `parts-manifest.json`.
- `host/build-identity.mjs` is the sole stamp part: its part
  bytes carry `BUILD_COMMIT = 5ae38942e493a4b53f541b5e1f589060d58d158d`
  exactly once; the tree on disk keeps `"UNBUILT"` (verified —
  check E5/E6; tree hash of that file unchanged, `bcb29105…`).
- Metadata derived from the pinned D6 spec
  (`worker/p8/deploy-spec-prod-d6.json`, SHA-256 `0dafd14c…`):
  `main_module`, `compatibility_date` 2026-08-29,
  `compatibility_flags` [nodejs_compat], the spec's **seven**
  bindings, plus the three required secrets as
  `{"type":"inherit","name":...}` (10 bindings total, names
  only, zero `secret_text`, zero secret values), and the spec's
  observability object. **No `migrations` key** (the D6 spec
  applies no DO migration). Assembled metadata:
  `assembled-metadata.json` (SHA-256 `e08b06bc…`); full
  multipart body: `assembled-envelope.bin` (1,143,926 bytes,
  SHA-256 `2f5ce34e…`).

## Checks (all PASS; see proof-pass.log for details)

- **E2/E3/E4** — entry is `v2/worker-entry-prod-d6.js`, an
  actual part; every relative import in the closure resolves;
  bare specifiers are `node:`-only.
- **E5/E6** — every part hash-compares to the signed candidate
  tree (build-identity under the stamp rule above); the stamp
  carries the pin exactly once.
- **E7/E8/E9** — exactly seven spec bindings, each with the
  specced name/type/value-class fields (COORDINATOR →
  `OpalReaderCoordinatorProd`; R2 → `opalreader-storage`;
  ALLOWED_ORIGIN, scope `production`, GENERATION_HALT `"1"`,
  OPALREADER_PHASE_POLICY plain_text `"enforce"` exactly once
  with no extra keys; queue → `opalreader-generation-v2`).
- **E10** — secrets inherit-by-name only (GEMINI_API_KEY,
  OPALREADER_ACCESS_TOKEN, OPALREADER_MIGRATION_OPERATOR_TOKEN).
- **E11/E12** — no migrations key; DO topology binds the
  EXISTING production class (no `script_name`, no new class);
  the D6 entry exports that same class; spec records the
  existing v1 migration.
- **E13** — queue topology per spec: producer binding in the
  envelope; spec declares exactly one consumer (this script,
  batch 10 / retries 3) on `opalreader-generation-v2`; the v1
  queue is not bound; no R2_KEY_PREFIX. (Consumer attachment is
  queue-side state — an upload cannot create it (G4 attempt 1);
  the deploy plan read-back-verifies the live consumer at the
  gate.)
- **E14/E15/E18** — compatibility and observability exactly per
  spec; metadata top-level keys are exactly the proven D6 set.
- **E16** — the multipart envelope round-trips byte-identically;
  every module part carries `filename` == part name and
  `Content-Type: application/javascript+module`.
- **E17** — the upload lands HALTED: GENERATION_HALT `"1"` in
  the assembled metadata.

## Negative proofs (validation FAILS each time, exit 1)

- **Drop the seventh binding** (`proof-negative-drop-seventh.log`):
  FAIL E7 (6 bindings), E8, E9, and E10 (total drops to 9).
- **Mistype `"enfore"`** (`proof-negative-typo-enforce.log`):
  FAIL E8, E9.
- **Wrong entry module** (`v2/worker-entry-prod.js`)
  (`proof-negative-wrong-entry.log`): FAIL E2.

## Disclosed choices for Rowan

1. The G4-era upload metadata carried an inert
   `queues.consumers` entry that the API ignored (it did not
   create the consumer — G4 attempt 1). This proof's metadata
   omits it, matching the documented upload schema; consumer
   topology is validated against the spec (E13) and must be
   read-back-verified live at the deploy gate. Omitting it
   changes nothing operationally.
2. The proof harness lives OUTSIDE the candidate tree
   (`logs/deploy-plan/proof-d6-envelope.mjs`) precisely so the
   signed tree stays byte-identical; it re-implements the
   pinned validator's closure/assembly method rather than
   modifying the validator.

## Tree integrity

- Worker tree digest (established method,
  `logs/round4/treehash.py`) BEFORE and AFTER the proof:
  `2d16fe291dfa8d067fae82110089e501ca28bd93e80a047ac5efd0ffee840fb2`
  (375 files) — identical to the signed round-5 digest in
  BUILD-REPORT.md. Client-build tree likewise unchanged
  (`52335597…`, 687 files; the signed client *publish* tree
  remains `365ecbdd…`).
- `ui1-review` ref read back at proof time:
  `5ae38942e493a4b53f541b5e1f589060d58d158d`
  (`pin-ref-readback.txt`). Nothing was re-pinned.
- Key file hashes match BUILD-REPORT round-5 exactly: entry
  `9cfd4c40…`, service `700b8a8d…`, spec `0dafd14c…`
  (`key-file-hashes-before.txt`).
