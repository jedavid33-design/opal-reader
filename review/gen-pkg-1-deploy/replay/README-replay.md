# gen-pkg-1 D6 envelope proof — REPLAY package (D7-1, updated D9-E)

**What this is.** A self-contained, replayable copy of the
gen-pkg-1 actual-D6-envelope proof, added as evidence-only
files under `review/gen-pkg-1-deploy/` in response to Rowan's
D7-1 (board issue #15, comment 6524120231), and UPDATED by
D9-E (comment 6526547700) for the FINAL candidate: the D8
corrections pin `f3b6e6e9fd7a44532ceef86e484a79e466b36d4d`.
The originally filed harness (`../proof-d6-envelope.mjs`, the
filed D8 record) resolves its candidate tree by a *local*
path (`../../worker-build/worker` from `logs/d8/`), so from
its pinned GitHub layout it cannot be re-run — hence this
replay variant. (Historical note: the D7-1 version of this
package proved the round-5 candidate `5ae38942…`, 26 modules;
that record is superseded by this D9-E update and remains
visible in this branch's history.)

**Contents of this package**

- `replay/proof-d6-envelope-replay.mjs` — the replay harness
  (21,587 B, SHA-256
  `caefdc95221d16982185602b398ba33b3772d7a3ff4c914dffaed2dc37852102`).
  Same 18 checks (E1–E18) and same three negative variants as
  the filed harness; differences are only in candidate
  resolution and output placement:
  - candidate worker dir: explicit `--candidate-worker-dir <dir>`,
    VALIDATED (must contain `worker-entry-prod-d6.js`,
    `p8/deploy-spec-prod-d6.json`, `host/build-identity.mjs`;
    refuses with exit 2 otherwise), or the pinned-layout default
    `../gen-pkg-1/worker` relative to the harness file (the
    delta-pinned partial tree — use the explicit tested path
    against `candidate/worker`);
  - ALL outputs go to `--out <dir>` (default a fresh `os.tmpdir()`
    subdir) — never into the evidence tree.
  - D9-E change vs the D7-1 harness: the stamped PIN only
    (`5ae38942…` → `f3b6e6e9…`), plus this header note. No
    check logic changed.
- `candidate/worker/**` — the COMPLETE worker half of the
  FINAL signed candidate (57 files, byte-identical copies;
  see digest bookkeeping below), plus
  `candidate/candidate-worker-manifest.txt` (per-file SHA-256
  manifest) and `candidate/candidate-delta-manifest.txt`
  (source delta vs the previously pinned candidate).

**Why candidate/ exists (the delta-pin finding).** The repo
only ever pinned round-DELTA files under `review/gen-pkg-1/`:
the full signed candidate exists completely only locally
(`~/workspace/gen-pkg-1/worker-build`). A proof that cannot
be re-run from the pinned evidence is not reviewable, so the
complete worker tree is pinned here, as evidence, next to the
harness that consumes it. The client half of the candidate
is NOT included: the envelope proof consumes only the worker
tree (it assembles the Worker upload). The client
publication digest
(`97e280948341e0d993975f46ebf089c10e9a2dfdc74487783ff80dd2069cc398`)
stands as recorded in the D7/D8 filings.

**Digest bookkeeping**

- Full local candidate tree (established method,
  `logs/round4/treehash.py`: os.walk, per-level sorted, `logs`
  dirs excluded, digest input = concat of `"<relpath>\n<file-sha256>\n"`):
  `39d46bca63e3f6a93cf567951a755914ae285b98372f27cd112d888bf6fed2f9`
  (378 files) — the final D8 candidate. (The D8 pin record's
  digest by its own documented manifest method:
  `30a954c45831e4c95f596b8eb6442944b35e11c19bfadce59d27b712dffec84a`.)
- `candidate/worker` subtree by the same method:
  `300568ad32d2a6ecb795509cbe1a4924f0275b39d37a486dd8d65748d903481a`
  (57 files). Per-file manifest SHA-256:
  `de43523e5e912b1809d79147c23b5b90d1a66cb9fdb8508b6b9a7f5b6ecb3d0d`
  (the manifest file itself additionally carries a 6-line header).
- Staged copy verified byte-identical to the local source: the
  staged subtree treehash equals the local subtree treehash,
  and the per-file manifest was computed from the staged copy.
- Source delta vs the previously pinned candidate (56 files,
  round-5): **1 added** (`generation/quarantine.mjs`),
  **4 changed** (`generation/d6-executor.mjs`,
  `generation/grant-guards.mjs`, `generation/service.mjs`,
  `worker-entry-prod-d6.js`), **52 unchanged**, **0 removed**
  (`candidate/candidate-delta-manifest.txt`). The delta spans
  D7-2 + D8 because the previously pinned candidate predates
  D7-2.
- Pinned artifacts this replay must reproduce byte-for-byte
  (filed in this package, from the D8 proof run):
  `assembled-envelope.bin` SHA-256 `9cb9d0da0d0790e2a5a0e558c6ff50d6958c83ab2942e487830e6132c15cd9ce`;
  `assembled-metadata.json` SHA-256 `e08b06bc840810739ef5a2fbd5279c6670c1759235fa830121964507f162a9fd`;
  `parts-manifest.json` SHA-256 `f20dee51ab011d8a931b41588b1cc235f9adf54072ad9a160c3b6ad247301d03`.
- Control run (pre-pin, harness vs the staged candidate copy):
  PASS 18/18 (exit 0); negatives FAIL as required —
  drop-seventh 14/18 (fails E7/E8/E9/E10), typo-enforce 16/18
  (fails E8/E9), wrong-entry 17/18 (fails E2) — and every
  output byte-identical to the pinned artifacts above,
  including all four `proof-result*.json`. The control pass
  log differs from the filed `../proof-pass.log` only by the
  replay harness's two header lines (candidate dir + output
  dir announcements).

**Exact replay commands** (from a clean checkout of the commit
that pins this package; `<CO>` = checkout root):

```
cd <CO>/review/gen-pkg-1-deploy
node replay/proof-d6-envelope-replay.mjs --candidate-worker-dir "$PWD/candidate/worker" --out /tmp/d9-out-pos
node replay/proof-d6-envelope-replay.mjs --candidate-worker-dir "$PWD/candidate/worker" --out /tmp/d9-out-neg-drop --mutate drop-seventh
node replay/proof-d6-envelope-replay.mjs --candidate-worker-dir "$PWD/candidate/worker" --out /tmp/d9-out-neg-typo --mutate typo-enforce
node replay/proof-d6-envelope-replay.mjs --candidate-worker-dir "$PWD/candidate/worker" --out /tmp/d9-out-neg-entry --mutate wrong-entry
cmp /tmp/d9-out-pos/assembled-envelope.bin  assembled-envelope.bin
cmp /tmp/d9-out-pos/assembled-metadata.json assembled-metadata.json
cmp /tmp/d9-out-pos/parts-manifest.json     parts-manifest.json
```

Expected: positive run prints `ACTUAL D6 ENVELOPE VALIDATION: PASS
(18/18 assertions)`, exit 0; each negative prints FAIL with the
failing-check sets listed in the control run above, exit 1; all
three `cmp` comparisons silent (byte-identical). Only the positive
run writes `assembled-*` / `parts-manifest.json`; mutation runs
write only their `proof-result-<variant>.json`.

**Signed subtrees untouched.** The D9-E commits change ONLY
paths under `review/gen-pkg-1-deploy/`. The signed candidate
subtree `review/gen-pkg-1/**` — including the D8 source/test
deltas at pin `f3b6e6e9…` — is not modified by them; this is
verified by recursive tree diff in the pinning record filed
on the board.

**Secrets sweep.** Everything staged was swept for credential
shapes (AWS/GitHub/OpenAI/Google key patterns, PEM blocks,
bearer values, secret-shaped assignments, email addresses):
zero hits. The worker code references credentials by binding
NAME only; the P8 freeze manifest is binding metadata only
(IDs, digests, sizes — its own header states no book text),
and a field-shape check confirmed no text/speechText fields
anywhere in it.

**Run record (clean-checkout replay).** Executed from a fresh
GitHub tarball of the D9-E evidence commit that pins this
package; the full record (tarball hash, commands, results,
byte comparisons, checkout digests) is pinned alongside this
file as `replay-pass.log`, `replay-negative-*.log`,
`replay-result*.json`, `comparison.txt`, and
`checkout-manifest.txt` in the child commit that carries the
updated version of this README.
