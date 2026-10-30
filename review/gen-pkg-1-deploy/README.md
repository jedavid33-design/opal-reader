# gen-pkg-1 DEPLOY EVIDENCE PACKAGE — review-only

**What this is.** The complete deploy-plan + actual-D6-envelope
evidence for the signed gen-pkg-1 candidate, pinned to GitHub
for Rowan's independent review under her EVIDENCE ACCESS HOLD
(board issue #15, comment 6523897639). Everything cited in
Wren's handoff (comment 6523842542) as a local file is present
here as a reviewable artifact.

**Evidence commit: this commit** — a NEW child commit on
branch `ui1-review` whose sole parent is the signed pin
**`5ae38942e493a4b53f541b5e1f589060d58d158d`**. It adds ONLY
the files in this directory (`review/gen-pkg-1-deploy/`).
The signed candidate is unchanged by this commit (proof in
the Verification section below).

**Status: review evidence — authorizes nothing.** No deploy,
binding write, client publication, reconciliation/retirement,
Chapter 2 retry, Batch arming, generation, or spending is
approved by anything in this package. Chapter 2 stays halted;
Chapter 3 stays parked.

## Reading order

1. `DEPLOY-PLAN.md` — the complete three-gate deploy plan
   (filed copy; content identical to the local draft except
   the status line noting it is the filed copy).
2. `DEPLOY-PLAN-ADDENDUM-D0D4.md` — the expanded D0/D4
   snapshot specification (Rowan point 2), a separate
   disclosed addendum; the plan itself is not rewritten.
3. `ARCHIVE-AND-ROLLBACK.md` — the live-archive verification,
   compatibility assessment, and rollback decision boundary
   (Rowan points 2 and 3), with `live-archive-manifest.json`
   as its machine-readable part manifest.
4. `ENVELOPE-PROOF-REPORT.md` + `proof-d6-envelope.mjs` (the
   exact assembly/checker harness) + `parts-manifest.json`,
   `assembled-metadata.json`, `assembled-envelope.bin`,
   `proof-pass.log`, and the three `proof-negative-*.log`
   files with their `proof-result*.json` companions — the
   actual-D6-envelope proof (Rowan point 1).

## Inventory (SHA-256, as committed)

| File | Bytes | SHA-256 |
|---|---|---|
| `ARCHIVE-AND-ROLLBACK.md` | 16191 | `4ede391f3995736d0ab4ee26c2e024c0c0a37440255c23e9ebaf442ca5f5dcac` |
| `DEPLOY-PLAN-ADDENDUM-D0D4.md` | 10202 | `ab6abf33b42d258db588ef8e0d4f27441abe9c652e79020ce54c36cea840a77a` |
| `DEPLOY-PLAN.md` | 16454 | `f977ba31ffbaeecc5cc7d3729efab7de836cb1223db1b89d50f7cf9da651664d` |
| `ENVELOPE-PROOF-REPORT.md` | 6087 | `2167d935494ec493626d6e0dd2f2f3f27efbb2510130196b684d82dcade1d5cf` |
| `assembled-envelope.bin` | 1143926 | `2f5ce34ee47b822de9829890ae9878447c361d5f89abbe5440852d0a4f39e5f1` |
| `assembled-metadata.json` | 1352 | `e08b06bc840810739ef5a2fbd5279c6670c1759235fa830121964507f162a9fd` |
| `envelope-hashes.txt` | 277 | `0c5c623339f8d594400cce69389b4ec00dfbce3b27fb685321623c753ea20181` |
| `key-file-hashes-before.txt` | 571 | `e6af3ca8561ae194313e286256b685cb8731670c5cbcc20e9c736edc32f0ef72` |
| `live-archive-manifest.json` | 5368 | `40af217f8e4401e1c6bd77849824883d7c0eda3af489a3b7c8d1dd67b1df340b` |
| `parts-manifest.json` | 6289 | `754876a832864fdf07e615a75a300f9b44472de5123e0c5ee141950f9eef4aeb` |
| `pin-ref-readback.txt` | 58 | `aa05d1f00c9a2e5284b8a2fb8620fd6ba44c68fca6530e8b83868084781511db` |
| `proof-d6-envelope.mjs` | 18905 | `23ed0d835d1f3b167e6bc2ac4a5422188d7575a4d3bfb629b34af37f31009d56` |
| `proof-negative-drop-seventh.log` | 7123 | `085f7a245a5153d3fd99c4729acb8956cf5cf75f101596c66a594c0da47cfd8e` |
| `proof-negative-typo-enforce.log` | 7228 | `41ea4e4dffd98415b438ba61722d8512c4a0d8fd8420a44f36b4c008e4924948` |
| `proof-negative-wrong-entry.log` | 7186 | `6ca820669caa898a065a855580600e48bbc41ab6cfdca93cccdd5b15c42893cc` |
| `proof-pass.log` | 7140 | `0790a7ccb672aec3f42b3f40802b03480a8f5abc47ad9b04aff3b80e98b3ca60` |
| `proof-result-drop-seventh.json` | 4618 | `4f12ffb887bf6a9e099adda0238371bea8bc06f27b513a20ed6a2a67a94ef2d6` |
| `proof-result-typo-enforce.json` | 4725 | `a09c9cf24931662370106a042549872189a9f655062390368579fd4a0f8bf828` |
| `proof-result-wrong-entry.json` | 4671 | `d635f15324e96f5ec50305f9a751b02e9a287e5c8f85709303f61f4091732981` |
| `proof-result.json` | 4616 | `e5442ba770ab5a7cf881ac5e6d7f6934463458037f5d3c458b87a9c5e2c57ac6` |
| `treehash-after.txt` | 124 | `dde0103514d5af96ef567b780035e084b63f8d4baa5380728fe4840a9e8bb18c` |
| `treehash-before.txt` | 124 | `dde0103514d5af96ef567b780035e084b63f8d4baa5380728fe4840a9e8bb18c` |
| `treehash-client-after.txt` | 124 | `3c146ee996f361f9d83e35b68b58363b6fe2f20524c713146c225cdffb4f2c61` |
| `treehash-client-before.txt` | 124 | `3c146ee996f361f9d83e35b68b58363b6fe2f20524c713146c225cdffb4f2c61` |
| `README.md` | (this file) | not self-embedded — verify via this commit's git blob for this path |

## The assembled envelope binary — included, and why

`assembled-envelope.bin` (1,143,926 bytes, SHA-256
`2f5ce34ee47b822de9829890ae9878447c361d5f89abbe5440852d0a4f39e5f1`)
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

- **Construction.** This commit's tree was built with
  `base_tree` = the signed pin's tree
  `dbca5aa042e19b2fd525ab5198c39af309693758`, adding only the
  paths listed in the inventory, all under
  `review/gen-pkg-1-deploy/`. No other path was created,
  modified, or deleted.
- **Read-back (performed on the pushed commit).** Ref
  `ui1-review` resolves to this commit; this commit's parent
  list is exactly
  [`5ae38942e493a4b53f541b5e1f589060d58d158d`]; a recursive
  tree comparison against the parent shows the ONLY
  differences are the added `review/gen-pkg-1-deploy/` entries
  — every other path carries an identical blob/tree SHA.
  In particular the signed review trees are unchanged:
  `review/gen-pkg-1` tree
  `3627e8a9b423c6d922c53f6de91feb022c738769`, its `worker`
  subtree `8767c2cf8fd37f55bdbb37b94bfb2d491011eb4e`, and its
  `client` subtree `c6c561579bd3c155c1ca3f54c6f2b68ceed92cdd`.
- **Signed local tree digests** (directory-content digests of
  the trees Rowan signed off; identical before and after the
  proof work — see `treehash-before.txt` /
  `treehash-after.txt` and the client pair):
  worker tree (375 files)
  `2d16fe291dfa8d067fae82110089e501ca28bd93e80a047ac5efd0ffee840fb2`;
  client publish tree
  `365ecbddf0bc17066c1eed5a6349735a290070482a50cddccda96c7a1e31dbd8`
  (BUILD-REPORT, Round-5 corrections).

## Secrets sweep

The whole package (including the binary) was swept for
credential-shaped strings (GitHub/OpenAI/AWS/Google key
shapes, PEM blocks, bearer values, `secret_text` bindings)
before pinning. Result: **no credentials, no tokens, no
secret values anywhere**. The only `secret_text` strings in
the package are the proof checker's own negative assertions
(e.g. check E10's label "zero secret_text, zero secret values
in the envelope"). Secret *names* appear only as `inherit`
binding names in the metadata, as Rowan's specification
requires. No personal content and no book text is included.
