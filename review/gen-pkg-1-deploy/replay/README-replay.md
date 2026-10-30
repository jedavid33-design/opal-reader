# gen-pkg-1 D6 envelope proof — REPLAY package (D7-1)

**What this is.** A self-contained, replayable copy of the gen-pkg-1
actual-D6-envelope proof, added as evidence-only files under
`review/gen-pkg-1-deploy/` in response to Rowan's D7-1 (board issue
#15, comment 6524120231): the originally filed harness
(`../proof-d6-envelope.mjs`, the historical record, untouched)
resolved its candidate tree by a *local* path
(`../../worker-build/worker` from `logs/deploy-plan/`), so from its
pinned GitHub layout it could not be re-run — and, as the first
replay attempt proved (run A: FATAL, candidate dir missing required
files), the pinned candidate under `review/gen-pkg-1/worker` is
itself incomplete (see "Why candidate/ exists" below).

**Contents of this package**

- `replay/proof-d6-envelope-replay.mjs` — the replay harness
  (21,479 B, SHA-256
  `a1cc05c4af9e114ef7fcb36fdb0de37044918f62f84a4f4b5b5281d498ccd930`).
  Same 18 checks (E1–E18) and same three negative variants as the
  filed harness; differences are only in candidate resolution and
  output placement:
  - candidate worker dir: explicit `--candidate-worker-dir <dir>`,
    VALIDATED (must contain `worker-entry-prod-d6.js`,
    `p8/deploy-spec-prod-d6.json`, `host/build-identity.mjs`;
    refuses with exit 2 otherwise), or the pinned-layout default
    `../gen-pkg-1/worker` relative to the harness file;
  - ALL outputs go to `--out <dir>` (default a fresh `os.tmpdir()`
    subdir) — never into the evidence tree.
- `candidate/worker/**` — the COMPLETE worker half of the signed
  candidate (56 files, byte-identical copies; see digest
  bookkeeping below), plus `candidate/candidate-worker-manifest.txt`
  (per-file SHA-256 manifest).

**Why candidate/ exists (the delta-pin finding).** The repo only
ever pinned round-DELTA files: `review/gen-pkg-1/worker` holds 6
files, and only 5 of the 26 envelope-closure module parts exist
anywhere in evidence commit `a6288de5…`. The full signed candidate
exists only locally (`~/workspace/gen-pkg-1/worker-build`). A proof
that cannot be re-run from the pinned evidence is not reviewable,
so the complete worker tree is now pinned here, as evidence, next
to the harness that consumes it. The client half of the candidate
is NOT included: the envelope proof consumes only the worker tree
(it assembles the Worker upload). The client publish tree digest
(`365ecbddf0bc17066c1eed5a6349735a290070482a50cddccda96c7a1e31dbd8`)
stands as recorded in the round-5 report.

**Digest bookkeeping**

- Full local candidate tree (established method,
  `logs/round4/treehash.py`: os.walk, per-level sorted, `logs`
  dirs excluded, digest input = concat of `"<relpath>\n<file-sha256>\n"`):
  `2d16fe291dfa8d067fae82110089e501ca28bd93e80a047ac5efd0ffee840fb2`
  (375 files) — the source-signed round-5 candidate.
- `candidate/worker` subtree by the same method:
  `fc5891f6f2c7568c4c454ca1c5acd4218a77d03bb2c158a95ea76d6a6e68a229`
  (56 files). Per-file manifest SHA-256:
  `e522ee6d05c55f6a85edc4c66bd9ecbc884bfb12510b4e0d06f6403660b0acc0`
  (the manifest file itself additionally carries a 6-line header).
- Staged copy verified byte-identical to the local source: the
  per-file manifests of source and staged copy diff empty, and the
  staged subtree treehash equals the local subtree treehash.
- Pinned artifacts this replay must reproduce byte-for-byte
  (filed in the parent evidence commit `a6288de5…`):
  `assembled-envelope.bin` SHA-256 `2f5ce34ee47b822de9829890ae9878447c361d5f89abbe5440852d0a4f39e5f1`;
  `assembled-metadata.json` SHA-256 `e08b06bc840810739ef5a2fbd5279c6670c1759235fa830121964507f162a9fd`;
  `parts-manifest.json` SHA-256 `754876a832864fdf07e615a75a300f9b44472de5123e0c5ee141950f9eef4aeb`.
- Control run (pre-pin, harness vs the local candidate tree):
  PASS 18/18 (exit 0); negatives FAIL as required — drop-seventh
  14/18 (fails E7/E8/E9/E10), typo-enforce 16/18 (fails E8/E9),
  wrong-entry 17/18 (fails E2) — and every output byte-identical
  to the pinned artifacts above, including all four
  `proof-result*.json`.

**Exact replay commands** (from a clean checkout of the commit
that pins this package; `<CO>` = checkout root):

```
cd <CO>/review/gen-pkg-1-deploy
node replay/proof-d6-envelope-replay.mjs --candidate-worker-dir "$PWD/candidate/worker" --out /tmp/d7-out-pos
node replay/proof-d6-envelope-replay.mjs --candidate-worker-dir "$PWD/candidate/worker" --out /tmp/d7-out-neg-drop --mutate drop-seventh
node replay/proof-d6-envelope-replay.mjs --candidate-worker-dir "$PWD/candidate/worker" --out /tmp/d7-out-neg-typo --mutate typo-enforce
node replay/proof-d6-envelope-replay.mjs --candidate-worker-dir "$PWD/candidate/worker" --out /tmp/d7-out-neg-entry --mutate wrong-entry
cmp /tmp/d7-out-pos/assembled-envelope.bin  assembled-envelope.bin
cmp /tmp/d7-out-pos/assembled-metadata.json assembled-metadata.json
cmp /tmp/d7-out-pos/parts-manifest.json     parts-manifest.json
```

Expected: positive run prints `ACTUAL D6 ENVELOPE VALIDATION: PASS
(18/18 assertions)`, exit 0; each negative prints FAIL with the
failing-check sets listed in the control run above, exit 1; all
three `cmp` comparisons silent (byte-identical). Only the positive
run writes `assembled-*` / `parts-manifest.json`; mutation runs
write only their `proof-result-<variant>.json`.

**Signed subtrees untouched.** The commits that add this package
change ONLY paths under `review/gen-pkg-1-deploy/`. The signed
candidate subtree `review/gen-pkg-1/**` (tree SHA `3627e8a9…` at
evidence commit `a6288de5…`) is not modified by them; this is
verified by recursive tree diff in the pinning record.

**Secrets sweep.** Everything staged was swept for credential
shapes (AWS/GitHub/OpenAI/Google key patterns, PEM blocks, bearer
values, secret-shaped assignments, email addresses): zero hits.
The worker code references credentials by binding NAME only; the
P8 freeze manifest is binding metadata only (IDs, digests, sizes —
its own header states no book text), and a field-shape check
confirmed no text/speechText fields anywhere in it.

**Run record (clean-checkout replay, executed 2026-10-30T13:43Z).**
The package was materialized fresh from the GitHub tarball of
commit `739fe3ada6b0f5489547e89482e48808840dd7a1` (the commit that
pins `candidate/` + this `replay/` directory; parent `a6288de5…`;
tarball SHA-256 `8752baccf1dfc7ce72b9605c2713fe4597e880eff4226a951b88adf6b133f2c8`,
12,362,044 B — full details in `checkout-manifest.txt`) and the
harness was run from `review/gen-pkg-1-deploy/` inside that
checkout, with `--candidate-worker-dir` pointing at the checkout's
own `candidate/worker` and outputs to temp dirs:

```
node replay/proof-d6-envelope-replay.mjs --candidate-worker-dir "$PWD/candidate/worker" --out <tmp>/out-pos           # exit 0
node replay/proof-d6-envelope-replay.mjs --candidate-worker-dir "$PWD/candidate/worker" --out <tmp>/out-neg-drop  --mutate drop-seventh   # exit 1
node replay/proof-d6-envelope-replay.mjs --candidate-worker-dir "$PWD/candidate/worker" --out <tmp>/out-neg-typo  --mutate typo-enforce   # exit 1
node replay/proof-d6-envelope-replay.mjs --candidate-worker-dir "$PWD/candidate/worker" --out <tmp>/out-neg-entry --mutate wrong-entry    # exit 1
```

Results: positive **PASS 18/18**; negatives FAIL with exactly the
filed failing-check sets (drop-seventh E7/E8/E9/E10, 14/18;
typo-enforce E8/E9, 16/18; wrong-entry E2, 17/18). Byte-compare
(`comparison.txt`): generated `assembled-envelope.bin`,
`assembled-metadata.json`, `parts-manifest.json` and all four
`proof-result*.json` are **byte-identical** to the artifacts filed
in the parent evidence commit. The checkout's `candidate/worker`
digests match the staged/local values exactly (treehash
`fc5891f6…`, 56 files; per-file manifest SHA-256 `e522ee6d…`).
Logs and results are pinned alongside this file as
`replay-pass.log`, `replay-negative-*.log`, `replay-result*.json`,
`comparison.txt`, and `checkout-manifest.txt` in the child commit
that carries this updated README.
