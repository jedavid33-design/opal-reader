# ENVELOPE REPORT — Gate 2D retry: grant-finalizer deploy package

Prepared during the Gate 2D RETRY execution (Julie's GO, board
comment 6552369883; revised bounded retry plan pinned
`9284f5efee47cd87b2c5639e9dfe50e6fb7e908a`), after the D0 census
passed in full (21/21, conflicts exact-match) and after D1 (halt
flip) and D2 (queue pause) were executed and read back.

## Contents of this package (pinned under `review/gate2d-retry/deploy/`)

- `ENVELOPE-REPORT.md` — this report.
- `envelope-manifest.json` — per-part name/size/SHA-256 for the
  operative (stamped) parts plus the unstamped tree hashes, the
  class table, and the envelope identity of the placeholder run.
- `parts/` — the 30 envelope part sources in their **unstamped
  tree form** (build-identity carries `UNBUILT`), byte-identical
  to the finalizer build tree files
  (`~/workspace/ch2-program/ch3-recovery/finalizer-build/worker-build/`,
  Gate 2 pin `c24bd4716d2ae386fcefd31a97b4a202968671a0` +
  Amendment 1 `4b1d2bd8b06bc7030166ff1eb7d025ff8a9fba61`).
- `tools/assemble-finalizer-envelope.mjs` — the assembler/
  validator used (recipe-identical to the Chapter 3 mechanisms
  assembler), pinned so the operative re-run uses the reviewed
  tool.

## Assembly method

Import closure rooted at the deploy spec's `main_module`
(`v2/worker-entry-prod-d6.js`) over the finalizer tree's `worker/`
directory; part name = `v2/<path under worker/>`; metadata derived
from the tree's own `worker/p8/deploy-spec-prod-d6.json` (spec
bindings + `inherit` secrets by name; serialized
`JSON.stringify(metadata, null, 2) + "\n"`); multipart boundary
`----opalreader-final-envelope-d1`; metadata part first; module
parts sorted by name; `filename` == part name;
`application/javascript+module`.

**Validation: PASS 9/9 checks** (C1 spec/entry; C2 closure; C3
part set == live 29 + 1; C4 class table; C5 stamp; C6 metadata
byte-identical to the live operative metadata; C7 round-trip; C8
`d6_grant_finalizations` occurs only in the new part; C9
GEN_SCHEMA byte-identical to live, 8 tables). Deterministic: two
placeholder runs produced the identical envelope SHA-256.

## Class table (vs the live Chapter 3 operative manifest, 29 parts)

- **27 IDENTICAL** — SHA-256 and size equal to live.
- **1 CHANGED** — `v2/worker-entry-prod-d6.js` (the finalizer
  import, handlers, and routes; +122/−2 vs the Chapter 3 tree).
- **1 NEW** — `v2/generation/grant-finalizer.mjs` (830 lines).
- **1 STAMPED** — `v2/host/build-identity.mjs`: tree form
  (`UNBUILT`) → stamped with this pin's SHA at operative assembly;
  stamped length 411 B, equal to the live stamped length.

Totals: live 29 parts / envelope 1,383,556 B → candidate
**30 parts** (counted FROM the assembled manifest) / placeholder
envelope 1,433,520 B, SHA-256
`166e9311b277dd8989460c3bb2d8938c068a1025392d05e348f70f804079a308`.

## Stamp binding

Gate-(a) precedent, followed exactly: **pin first, then stamp.**
This package is pinned as a single-parent child of
`9284f5efee47cd87b2c5639e9dfe50e6fb7e908a` on `ui1-review`; the
resulting pin SHA becomes the `/health` build stamp. At D3 the
assembler is re-run with `--pin <that SHA>` against the finalizer
tree and that run's envelope is the operative upload payload. The
placeholder-stamped parts under `execution/pin-package/stamped/`
are never uploaded.
