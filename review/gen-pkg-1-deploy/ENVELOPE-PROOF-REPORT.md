# ACTUAL-D6-ENVELOPE PROOF — gen-pkg-1 FINAL candidate pin f3b6e6e9 (D9-E)

**Purpose (Rowan round-6 sign-off, comment 6523652449, condition A;
D9-E evidence completion, comment 6526547700):** assemble the
ACTUAL D6 upload envelope from the FINAL signed candidate tree
(D7-2 quarantine + D8 corrections) and validate THAT envelope
against the pinned D6 spec. The predecessor report in this
package proved the round-5 candidate `5ae38942…` (26 modules) —
HISTORICAL; this report supersedes it for the operative
candidate.

**Result: PASS — 18/18 assertions** (`proof-pass.log`,
`proof-result.json`). **Negative proofs: all three mutations
FAIL as required** (details below). **Candidate tree untouched**
(digests identical before and after). **Clean-checkout replay**
of this exact proof from the pinned evidence commit: PASS
18/18 with all byte comparisons identical — record in
`replay/` (D9-E).

Prepared locally only: no deploy, no upload, no production
contact of any kind.

## Assembly (mirrors the proven G4 / seed-fix D1–D2 records)

Harnesses: `proof-d6-envelope.mjs` (this directory — the filed
D8 harness; resolves its candidate by a local path) and
`replay/proof-d6-envelope-replay.mjs` (the replayable variant —
same 18 checks, candidate dir explicit/validated, outputs to a
separate directory; PIN restamped to `f3b6e6e9…` for D9-E).

- Module parts = the import closure rooted at the D6 entry
  `v2/worker-entry-prod-d6.js` over the candidate tree's
  `worker/` module set (same closure algorithm as the pinned
  validator): **27 module parts, 1,183,927 module bytes** —
  the round-5 closure's 26 plus `generation/quarantine.mjs`
  (the D7-2/D8 fence module). Full per-part table with SHA-256
  hashes: `proof-pass.log` + `parts-manifest.json`
  (SHA-256 `f20dee51ab011d8a931b41588b1cc235f9adf54072ad9a160c3b6ad247301d03`).
- `host/build-identity.mjs` is the sole stamp part: its part
  bytes carry `BUILD_COMMIT = f3b6e6e9fd7a44532ceef86e484a79e466b36d4d`
  exactly once; the tree on disk keeps `"UNBUILT"` (verified —
  checks E5/E6; tree hash of that file unchanged, `bcb29105…`).
- Metadata derived from the pinned D6 spec
  (`worker/p8/deploy-spec-prod-d6.json`, SHA-256 `0dafd14c…`,
  unchanged since round 5): `main_module`,
  `compatibility_date` 2026-08-29, `compatibility_flags`
  [nodejs_compat], the spec's **seven** bindings, plus the
  three required secrets as `{"type":"inherit","name":...}`
  (10 bindings total, names only, zero `secret_text`, zero
  secret values), and the spec's observability object.
  **No `migrations` key** (the D6 spec applies no DO
  migration). Assembled metadata: `assembled-metadata.json`
  (SHA-256 `e08b06bc…` — byte-identical to the round-5 proof's
  metadata, as expected: the spec did not change); full
  multipart body: `assembled-envelope.bin` (1,190,846 bytes,
  SHA-256
  `9cb9d0da0d0790e2a5a0e558c6ff50d6958c83ab2942e487830e6132c15cd9ce`).

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
  FAIL E7 (6 bindings), E8, E9, and E10 (total drops to 9) —
  14/18.
- **Mistype `"enfore"`** (`proof-negative-typo-enforce.log`):
  FAIL E8, E9 — 16/18.
- **Wrong entry module** (`v2/worker-entry-prod.js`)
  (`proof-negative-wrong-entry.log`): FAIL E2 — 17/18.

## Disclosed choices for Rowan

1. The G4-era upload metadata carried an inert
   `queues.consumers` entry that the API ignored (it did not
   create the consumer — G4 attempt 1). This proof's metadata
   omits it, matching the documented upload schema; consumer
   topology is validated against the spec (E13) and must be
   read-back-verified live at the deploy gate. Omitting it
   changes nothing operationally.
2. The proof harness lives OUTSIDE the candidate tree
   precisely so the signed tree stays byte-identical; it
   re-implements the pinned validator's closure/assembly
   method rather than modifying the validator.

## Tree integrity

- Local candidate tree digests BEFORE and AFTER the proof
  (`treehash-before.txt` / `treehash-after.txt`, established
  method `logs/round4/treehash.py`): full local tree
  (378 files) `39d46bca63e3f6a93cf567951a755914ae285b98372f27cd112d888bf6fed2f9`;
  `worker/` subtree (57 files)
  `300568ad32d2a6ecb795509cbe1a4924f0275b39d37a486dd8d65748d903481a`.
  The D8 pin record's digest for the same tree (pin-record
  method: sorted per-file SHA-256 manifest hash) is
  `30a954c45831e4c95f596b8eb6442944b35e11c19bfadce59d27b712dffec84a`.
- Client untouched by D7-2/D8 (worker-only corrections); the
  operative client publication digest is
  `97e280948341e0d993975f46ebf089c10e9a2dfdc74487783ff80dd2069cc398`.
- `ui1-review` ref read back at proof time:
  `f3b6e6e9fd7a44532ceef86e484a79e466b36d4d`
  (`pin-ref-readback.txt`).
- Key file hashes (`key-file-hashes-before.txt`): entry
  `1564b784…`, service `5670dfb3…`, quarantine `64a491f3…`,
  spec `0dafd14c…`, build-identity `bcb29105…`.
