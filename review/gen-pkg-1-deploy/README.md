# gen-pkg-1 DEPLOY EVIDENCE PACKAGE — review-only (updated D9-E)

**What this is.** The complete deploy-plan + actual-D6-envelope
evidence for the FINAL signed gen-pkg-1 candidate, pinned to
GitHub for Rowan's independent review. Originally filed under
her EVIDENCE ACCESS HOLD (board issue #15, comment 6523897639)
for the round-5 candidate; **updated by D9-E (comment
6526547700)** so that the candidate copy, the envelope proof,
and the operational plan all refer to the final candidate.

**Candidate: the signed pin
`f3b6e6e9fd7a44532ceef86e484a79e466b36d4d`** on `ui1-review`
(D7-2 quarantine + D8 corrections; Rowan code-level PASS,
comment 6526547700). The D9-E evidence commits are NEW child
commits on top of that pin; they add/modify ONLY files in
this directory (`review/gen-pkg-1-deploy/`). The signed
candidate (including the D8 source/test deltas under
`review/gen-pkg-1/**`) is unchanged by them — verified by
recursive tree diff in the pinning record filed on the board.

**Status: review evidence — authorizes nothing.** No deploy,
binding write, client publication, re-arm, quarantine
release, reconciliation/retirement, Chapter 2 retry, Batch
arming, generation, or spending is approved by anything in
this package. Chapter 2 stays halted; Chapter 3 stays parked.

## Reading order

1. `DEPLOY-PLAN.md` — the complete three-gate deploy plan,
   reconciled by D9-E to the final candidate (Gate-1 D1
   envelope hash `9cb9d0da…`, 27 modules, pin `f3b6e6e9…`,
   client publication digest `97e28094…`).
2. `DEPLOY-PLAN-ADDENDUM-D0D4.md` — the expanded D0/D4
   snapshot specification (quiescence obligations; unchanged
   in substance, with a D9-E applicability note).
3. `DEPLOY-PLAN-ADDENDUM-D7.md` — the quarantine-era
   correction of Gates 2/3, the per-plan release gate class,
   the pre-re-arm exhaustive inventory, the D8 correction
   record, and the D9-E completion section.
4. `ARCHIVE-AND-ROLLBACK.md` — the live-archive verification,
   compatibility assessment, and rollback decision boundary
   (with a D9-E note at §2), with `live-archive-manifest.json`
   as its machine-readable part manifest.
5. `ENVELOPE-PROOF-REPORT.md` + `proof-d6-envelope.mjs` (the
   filed D8 harness) + `parts-manifest.json`,
   `assembled-metadata.json`, `assembled-envelope.bin`,
   `proof-pass.log`, and the three `proof-negative-*.log`
   files with their `proof-result*.json` companions — the
   actual-D6-envelope proof for the final candidate.
6. `candidate/worker/**` — the COMPLETE final candidate
   worker tree (57 files) + `candidate-worker-manifest.txt`
   + `candidate-delta-manifest.txt`; `replay/` — the
   replayable harness and the clean-checkout replay record.

## Inventory (SHA-256, as committed by the D9-E package commit)

| File | Bytes | SHA-256 |
|---|---|---|
| `ARCHIVE-AND-ROLLBACK.md` | 16998 | `c5ea2a7b9f86e35cf58d6574b378dfc5c96be49143f8a4570284f63aede0b3c2` |
| `DEPLOY-PLAN-ADDENDUM-D0D4.md` | 10821 | `bd80fbf2e43e018f5f25fcf3fa474f346dc62fd40839c612152d5044196355cc` |
| `DEPLOY-PLAN-ADDENDUM-D7.md` | 16297 | `9804358b6f319f907bc0761618204078248673a3d5740e95750fd4031248fda9` |
| `DEPLOY-PLAN.md` | 19057 | `a4a63b03dd6b81744c1f1105157c4c0b287be352a46331445ca5f0581591a5fc` |
| `ENVELOPE-PROOF-REPORT.md` | 6830 | `83715695498e83002fc22fc543f593c9135c8281462c11bba8f4af0a274cdf82` |
| `assembled-envelope.bin` | 1190846 | `9cb9d0da0d0790e2a5a0e558c6ff50d6958c83ab2942e487830e6132c15cd9ce` |
| `assembled-metadata.json` | 1352 | `e08b06bc840810739ef5a2fbd5279c6670c1759235fa830121964507f162a9fd` |
| `envelope-hashes.txt` | 1159 | `749d8724cac1f2e7c34a1311bf95d5b6cd71b2cb58351550bdc8758d51566f43` |
| `key-file-hashes-before.txt` | 715 | `d2fa3570c6fac2a9b683ab119e7503262c8713b77f222fa5f12ced311fb4b375` |
| `parts-manifest.json` | 6528 | `f20dee51ab011d8a931b41588b1cc235f9adf54072ad9a160c3b6ad247301d03` |
| `pin-ref-readback.txt` | 41 | `95ec30a78125792b6783140a055fdaa285e40308c806d77c1c539af2bb7f202a` |
| `proof-d6-envelope.mjs` | 18905 | `81a74a966bc6d6ae4acdee523875a19bf20ab31a989c6f154fb5dcd1e84da3b0` |
| `proof-negative-drop-seventh.log` | 7274 | `3ca632ed6d86f24e00b76489976ae7fe58a0a9760a1ea87fe0bbf55a9119988d` |
| `proof-negative-typo-enforce.log` | 7379 | `bd918fe1cfbeef394e138cda9bf85478434b3fb1fba981cacd2cf4b9ab6f53df` |
| `proof-negative-wrong-entry.log` | 7337 | `80632b79336a6641a77f04b6f14eb435b21fade403ce84d3a0b3f046764310c7` |
| `proof-pass.log` | 7291 | `6c2adf832053565d8391eac740b4dee348dd8a313f2aee7e14df801247a70128` |
| `proof-result-drop-seventh.json` | 4618 | `42d1087b3cde8218074b60b38bce1c4e1487e03607871db8499cf5f1c433957d` |
| `proof-result-typo-enforce.json` | 4725 | `5378ba60a3c5c16acd9938d25a2fd6970428d31bee0aad4d08b47d2f6c2d4c5c` |
| `proof-result-wrong-entry.json` | 4671 | `523be4d2d366e28d0af8d57995262a4c31cb13409930c509ee2a9563371aa741` |
| `proof-result.json` | 4616 | `022d1e90ff8ed2fdb46c74905d18d9d971965349363844184a4fc308e20309e9` |
| `treehash-after.txt` | 254 | `4ec06b69e0ea6cdd3bab00cb5b881db27c74e47faecddc7d7e27409558848be3` |
| `treehash-before.txt` | 254 | `4ec06b69e0ea6cdd3bab00cb5b881db27c74e47faecddc7d7e27409558848be3` |
| `candidate/candidate-delta-manifest.txt` | 853 | `72a91d44587efebc3032a7eb1b0d1c107c6fd8c60436e43383418da02d5d2098` |
| `candidate/candidate-worker-manifest.txt` | 5663 | `ce525901c09e777e62901e05095494f01bbf03491fcb98ec63f3f23f4f16a7d0` |
| `candidate/worker/api.mjs` | 13632 | `9b1d0eba128c972b5329020018fefc10b0db9250f3134393de190d54e4e3237d` |
| `candidate/worker/audio-route.mjs` | 15965 | `b6383d21be32f119271e1d39f3894bd7f84b15ac1be4c38655601d1dee20d616` |
| `candidate/worker/client-store.mjs` | 22848 | `6d1122a0314976a6eba6f55158b85c8877ae84dc18ec7109b7142633b3dd1b94` |
| `candidate/worker/coordinator.mjs` | 268522 | `c31359ae87cf0271c2186a579e6540461089e0ffaa181e00c732ceed649d8eb3` |
| `candidate/worker/executor.mjs` | 13974 | `5c6db175e68abdf727bf2e1d1a23626be0651db3c6eb48dd4af9e7f7d4ee14c9` |
| `candidate/worker/worker-entry-prod-d6.js` | 48854 | `1564b784557828b64b648a3e50360c80f340d5d587041416573857819ecd6de0` |
| `candidate/worker/worker-entry-prod.js` | 14480 | `1d2f333a75a3ffff3d4e7c9454f218ba8a8042fab179fcd4f50031c6d80a27c5` |
| `candidate/worker/worker-entry.js` | 21520 | `91daefdd4778599db83024b074a5c4e78ef4d396a5d815712b381d40f72bd6e5` |
| `candidate/worker/client/assembled-client.mjs` | 2827 | `4b89d7cbdc546413751579929b50834593170a8f8bfdf24da65a40499a7b3462` |
| `candidate/worker/client/funnel.mjs` | 10035 | `5937587fa32ed44ab87eb478b8a9c67eb8ae8bfc27d458d64f5aac1d9e61c983` |
| `candidate/worker/client/http-transport.mjs` | 3055 | `e32b85307176928f5abf1da48678eade91304db9fdc80abd725216e8d75652b0` |
| `candidate/worker/client/projection.mjs` | 2130 | `3ff5e38d8a7b22586b936b63c5e90587e5e3b130dddb8f57f53d9e04e071cbad` |
| `candidate/worker/client/removals.mjs` | 2114 | `94d71b3f1880ab32d0a414b354aef2923a8efedf1690e0570fce9fbfbd084a8e` |
| `candidate/worker/client/shelf-bridge.mjs` | 14870 | `e57a060433ed4e3562af4597fce1532d4be422edf8b5bb6661876d85735f514b` |
| `candidate/worker/client/surfaces.mjs` | 5024 | `d079cca5981e2e487e281fb5cc949b200f41d07dd52faf08d61239a63ec24a18` |
| `candidate/worker/generation/binding-projection.mjs` | 12818 | `d100f02ce199bbcd6935569c8daabadbd6783d79b0bf1abd41f811e5763d8654` |
| `candidate/worker/generation/content-plane-adapter.mjs` | 7577 | `51c177dd8d2c4c85dbd1ce19180f60f70b3d037c53081be17c9762f93e7b8f38` |
| `candidate/worker/generation/d6-executor.mjs` | 33427 | `d3924554448f0476c54a69a1a8849afc619f093457e46dbea2eca05aab5d313e` |
| `candidate/worker/generation/d6-work-source.mjs` | 5981 | `8fa929b2d283084542d9dc76c1e75278d9f5ea4ed7a8d94540e55bef45e05006` |
| `candidate/worker/generation/eligible-set.mjs` | 5978 | `87b4b09ad08a23160a8b473bd0ecb88cf2f7b1d5fcf1ec0d52dbb96920e51a7c` |
| `candidate/worker/generation/flush-store.mjs` | 8497 | `e8f622bf4ed8745dd342cdbdd8d66f2a59a586ce034e8e1b1e21d68a2460f325` |
| `candidate/worker/generation/gen-constants.mjs` | 3944 | `6922ad7402bcc369bbd48b12d859ccdf93964dbd94ab593ce126aa7af0a2e4ee` |
| `candidate/worker/generation/gen-schema.mjs` | 5307 | `d7ae4936b11fe0d01c9ff8a6e1ccbb7364541ecad7d012b8fc3e712a453aacc5` |
| `candidate/worker/generation/genstore.mjs` | 22164 | `2e1eb5bd2b53fce4b58eb1b06f737326c385f1d49ba612e91a24f3ab43f311bb` |
| `candidate/worker/generation/grant-guards.mjs` | 10018 | `079b0ac6cb46b164fce1e3afe81dddde6d994413353597ab7a0271025805b5e7` |
| `candidate/worker/generation/phase-policy.mjs` | 7299 | `09883c40e365815f48cc9cb9d3bfdf1908f994b809c73ba27535638c7607f37f` |
| `candidate/worker/generation/policy-split.mjs` | 9735 | `cc54ad7631ba51c834abfa33660cf5094ea06650f3c015a80077d230ad29662c` |
| `candidate/worker/generation/proofs.mjs` | 15096 | `e7571e1181a5e0e558ff2d7b524f620c260a601289eb66bcf73c43bce2910d38` |
| `candidate/worker/generation/quarantine.mjs` | 15752 | `64a491f3b1345219cb8816b80252908df9aaaadbd67e910547658aa9ade0fe62` |
| `candidate/worker/generation/service.mjs` | 68101 | `5670dfb3739986c3473bea5ab913b9f1f005925523e1bbaee19f99c9b3b8d4d1` |
| `candidate/worker/generation/settings-reconcile.mjs` | 1138 | `6ba4ec330adf5a34c535233d15528bb1e20cc28d30db641a5cc477b443974d61` |
| `candidate/worker/generation/wrangler-queues.md` | 2030 | `139eb83fff7a2e6958381bd84aa4723dbbd701e2d2593a949007bbc7096383fb` |
| `candidate/worker/host/adapters.mjs` | 34359 | `22557b5993de13d20831eec0761a0c448cafd42d5698ace0f468352fbf825258` |
| `candidate/worker/host/build-identity.mjs` | 378 | `bcb29105888bdd91ff9e33650f6d1fb57b4262c2674ca6e70f0076e5a8c6840d` |
| `candidate/worker/migration/adjudicate.mjs` | 6405 | `163c65f11e4c672a824bae961f05edf8214670fb758c635a821ef5cba3bdd2ab` |
| `candidate/worker/migration/rollback.mjs` | 5496 | `d7625c59181ca40e1986f0ec833091e65c5e8065ff37ea386f233adbc2c6800b` |
| `candidate/worker/migration/shelf-outbox-import.mjs` | 2311 | `1f22a349b0c9f81f68fbfded348bf35f1805f08c0fa6bf4155704f416df27352` |
| `candidate/worker/migration/transform.mjs` | 9250 | `bc5b1233a1c5fa68fc6a5790693938fae2dcb284cea56ef6f6aaf086c1359e6a` |
| `candidate/worker/migration/util.mjs` | 874 | `590af84651258f5bc6311b615f521f02b4f878f24333dac71875f42d307f3e23` |
| `candidate/worker/migration/verify.mjs` | 7948 | `ee91dd5ff1f1e0ddd124ea8c00ac96b0f329a2a2a8a54dbc91fa7514da0463dd` |
| `candidate/worker/p8/approved-freeze-carry.mjs` | 57703 | `24ddc8ee428e6e161fc2114af9a572f348db5959977402090539163cacb5bb46` |
| `candidate/worker/p8/approved-freeze-chunks.mjs` | 6101 | `b49cfcfcaf656d957f0c828566d390d6b2bc4b25238885fa60c3e3293563f06a` |
| `candidate/worker/p8/approved-freeze-manifest.mjs` | 467075 | `e59ab3d37245cc049d23215e0538933d633621ceb3fd29e48afdcda07e519edd` |
| `candidate/worker/p8/deploy-spec-prod-d6.json` | 14804 | `0dafd14c63d420f4c22eaf323e4e2cbac5fbfd2f9fdb2df26014be57a8e55fb4` |
| `candidate/worker/p8/deploy-spec-prod.json` | 5357 | `45fec5c6a99599647b96c2e93af1609225bb416262b4c8401fcdbe30cb865f18` |
| `candidate/worker/p8/deploy-spec.json` | 4005 | `609132e0a626af13ab97acfb7b633f628383d8aae01543832adde828eaf8a7c4` |
| `candidate/worker/p8/f1-fix-addendum.md` | 10963 | `5bddf1963527c39f8c4e1f6a7baca6a1bcc5465c365a3f6c0b9bd3a9232540de` |
| `candidate/worker/p8/f1-revision-addendum.md` | 5671 | `5da106fa5782bf1d8ab06c84e342eda252e4d736478e60f7c7625665a6ab6233` |
| `candidate/worker/p8/fabc-build-addendum.md` | 3839 | `6acf7927f09727f6c6739202f3ad8dcedbf71cc2c113db4b7c4149c3153380f1` |
| `candidate/worker/p8/freeze-audit.md` | 19083 | `0d7e0beb0ca00775cbb86cecb2a1c752651144bde182df75fa2a1715b586f92a` |
| `candidate/worker/p8/freeze-worker.js` | 213422 | `fdf85b81e55eaec04dc93262e5a675e66a1bfc7fab4b50daabf2383a6b0f3c93` |
| `candidate/worker/p8/migration-chunk-limits.mjs` | 4733 | `886c8ea6d79dd6d2014976c50e23fe6553fd3d0ff81dd1f5f2337bf109b0fe41` |
| `candidate/worker/p8/migration-import-design.md` | 46888 | `748486c0afd42467e4a4817e3f8eed57e69b45fc3cc4efaede2769bf97fee7a6` |
| `candidate/worker/p8/part1-decisions.md` | 22576 | `c91414b1a3c22d399fe368406fe0228cd8f9ec9199e7154bd6ea67b2ae41da99` |
| `candidate/worker/p8/platform-pause-procedure.md` | 12174 | `6dc775c892000e5e603dc3c5fddc41890cf4212b4ed64222abbe274930af6db6` |
| `candidate/worker/p8/preview-fix-addendum.md` | 6956 | `63436f8d8394f0ecc7d335fdf2587e54adbc177987fa64480e989552519c1f57` |
| `candidate/worker/p8/sync-contracts.md` | 5849 | `899e96b0ca62f8fd5aa1aacfe567792c9fbcd9a835128009f90b324dd922229b` |
| `replay/README-replay.md` | 7599 | `c1f2b1ab85773df7028e90a7c0dd68b6f9429be7322b5b8bb0e225f80d70b85c` |
| `replay/proof-d6-envelope-replay.mjs` | 21587 | `caefdc95221d16982185602b398ba33b3772d7a3ff4c914dffaed2dc37852102` |
| `README.md` | (this file) | not self-embedded — verify via this commit's git blob for this path |

(The `replay/` run-record files — `replay-pass.log`,
`replay-negative-*.log`, `replay-result*.json`,
`comparison.txt`, `checkout-manifest.txt` — are refreshed by
the child replay-record commit and are inventoried in
`replay/README-replay.md`'s run record.)

## The assembled envelope binary — included, and why

`assembled-envelope.bin` (1,190,846 bytes, SHA-256
`9cb9d0da0d0790e2a5a0e558c6ff50d6958c83ab2942e487830e6132c15cd9ce`)
is included in full rather than as a hash-only note, because
it is stronger evidence: Rowan can re-parse the exact
multipart bytes the proof validated. It was inspected before
inclusion: the envelope contains only (a) the metadata part —
seven non-secret bindings with plain-text values as specced,
plus the three secrets as `inherit` **by name only**, zero
`secret_text` bindings, zero secret values — identical to
`assembled-metadata.json` (SHA-256
`e08b06bc840810739ef5a2fbd5279c6670c1759235fa830121964507f162a9fd`) —
and (b) the candidate's module code. The largest module, the
P8 approved-freeze manifest, contains binding metadata only
(IDs, digests, sizes, formats) — no book text, no audio, no
personal content, per its own header and inspection.

## Verification — the signed trees are untouched

- **Construction.** The D9-E commits' trees are built with
  `base_tree` = the signed pin `f3b6e6e9…`'s tree
  `fb005d85941856e5278602aacce2e0fc85b65e0c`, changing only
  paths under `review/gen-pkg-1-deploy/`.
- **Read-back (performed on the pushed commits and filed on
  the board).** Ref `ui1-review` resolves to the final D9-E
  commit; each commit's parent is exactly the previous head;
  a recursive tree comparison against `f3b6e6e9…` shows the
  ONLY differences are under `review/gen-pkg-1-deploy/` —
  every other path, including all of `review/gen-pkg-1/**`
  (the D8 source/test deltas), carries an identical blob/tree
  SHA.
- **Candidate digests** (see `ENVELOPE-PROOF-REPORT.md` and
  `replay/README-replay.md` for methods): full local tree
  `39d46bca63e3f6a93cf567951a755914ae285b98372f27cd112d888bf6fed2f9`
  (378 files, round4 treehash method); D8 pin-record digest
  `30a954c45831e4c95f596b8eb6442944b35e11c19bfadce59d27b712dffec84a`;
  `candidate/worker` subtree
  `300568ad32d2a6ecb795509cbe1a4924f0275b39d37a486dd8d65748d903481a`
  (57 files). Client publication digest (unchanged by the
  worker-only D7-2/D8 corrections):
  `97e280948341e0d993975f46ebf089c10e9a2dfdc74487783ff80dd2069cc398`.

## Secrets sweep

The whole package (including the binary) was swept for
credential-shaped strings (GitHub/OpenAI/AWS/Google key
shapes, PEM blocks, bearer values, secret-shaped assignments,
email addresses) before pinning. Result: **no credentials, no
tokens, no secret values anywhere**. The only `secret_text`
strings in the package are the proof checkers' own negative
assertions and the P8 deploy specs' `secret_bindings_required`
metadata (names + sourcing notes only — no values; unchanged
from the D7-1-pinned candidate). Secret *names* appear only
as `inherit` binding names in the metadata, as Rowan's
specification requires. No personal content and no book text
is included.

## Historical note

This package previously (commits `a6288de5…`, `739fe3ad…`,
`1c7f0530…`) carried the round-5 candidate `5ae38942…`, its
26-module envelope proof, and its replay record. Those
artifacts are superseded by the D9-E update and remain
available in this branch's history; nothing in the current
package presents them as the operative candidate or proof.
