# ENVELOPE REPORT — Range-fix deploy package (Option B prefix RANGE scans)

Prepared as proposal-only work under Rowan's **SOURCE REVIEW
PASS** on the range-fix candidate (recorded on board issue #15
as comment **6560249061**; candidate pin
`d01c15ed732436223f0207e4d126a588150187af`, repo
`jedavid33-design/opal-reader`, branch `ui1-review`). **No
deployment is executed or authorized by this package.** The
system remains HELD — generation halted, queue paused, live
build `408f91497131a151a199b3f9ec4cbb283a8febd5`.

## Contents of this package (pinned under `review/ch3-generation/recovery/gate3/diagnosis/range-fix/deploy/`)

- `ENVELOPE-REPORT.md` — this report.
- `envelope-manifest.json` — per-part name/size/SHA-256 for the
  assembled parts plus the unstamped tree hashes, the class
  table, and the envelope identity of the placeholder run.
- `parts/` — the 31 envelope part sources in their **unstamped
  tree form** (build-identity carries `UNBUILT`), byte-identical
  to the range-fix build tree files
  (`~/workspace/ch2-program/ch3-recovery/range-fix-build/worker-build/`,
  candidate pin `d01c15ed732436223f0207e4d126a588150187af`).
- `tools/assemble-rangefix-envelope.mjs` — the assembler/
  validator used (recipe-identical to the Gate 2D retry
  finalizer assembler), pinned so the operative re-run uses the
  reviewed tool.

## Assembly method

Recipe-identical to the Gate 2D retry envelope: import closure
rooted at the deploy spec's `main_module`
(`v2/worker-entry-prod-d6.js`) over the candidate tree's
`worker/` directory; part name = `v2/<path under worker/>`;
metadata derived from the tree's own
`worker/p8/deploy-spec-prod-d6.json` (spec bindings + `inherit`
secrets by name; serialized `JSON.stringify(metadata, null, 2)
+ "\n"`); multipart boundary `----opalreader-final-envelope-d1`;
metadata part first; module parts sorted by name; `filename`
== part name; `application/javascript+module`. The delta
reference is the Gate 2D retry operative manifest — the parts
of the **live** build `408f9149` (30 parts).

**Validation: PASS 10/10 checks** (C1 spec/entry; C2 closure
resolves, bare specifiers node:-only; C3 part set == live 30 +
`prefix-range.mjs` == **31, counted from the assembled
manifest**; C4 class table; C5 stamp exactly once, stamped
length == live stamped length 411 B; C6 metadata byte-identical
to the live operative metadata — `GENERATION_HALT "1"`, 10
bindings, no migrations; C7 multipart round-trip, bytes exact;
C8 `d6_grant_finalizations` occurs only in grant-finalizer.mjs;
C9 GEN_SCHEMA byte-identical to live, exactly 8 tables; C10
`prefix-range.mjs` imported by both coordinator.mjs and
grant-finalizer.mjs). Deterministic: two placeholder runs
produced the identical envelope SHA-256.

## Class table (vs the live `408f9149` operative manifest, 30 parts)

- **27 IDENTICAL** — SHA-256 and size equal to live.
- **2 CHANGED**:
  - `v2/coordinator.mjs` — 274,953 B /
    `5d0727638b24e497c7b7ca73d6deead411a5ebc8e475163f78aa0b01d72a3de5`
    → 276,256 B /
    `bca88fe92bfd316c727866f7f69817e290fc8167006d32362577010c2037e20a`
  - `v2/generation/grant-finalizer.mjs` — 39,842 B /
    `15dd575f77efb0d5159f3674162728662b102891cd95cd7b680bf4a8bd0794ee`
    → 40,172 B /
    `0da45d8e6d156d1fc7441ce97e3338aa2a9e143a5560d640ee909c5727f8c076`
- **1 NEW** — `v2/generation/prefix-range.mjs` — 3,628 B /
  `a6546b3e94247adcd4215aa1ed4ab691a2595520a2783dd67849056a498da514`
- **1 STAMPED** — `v2/host/build-identity.mjs`: tree form
  (`UNBUILT`, 378 B) → stamped with this pin's SHA at operative
  assembly; stamped length 411 B, equal to the live stamped
  length.

Totals: live 30 parts / envelope 1,433,520 B (SHA-256
`00f7db62a21e4a0b249fc68a07f9dabc048fa3bf5be62109015b17fb344f928b`)
→ candidate **31 parts** (counted FROM the assembled manifest)
/ total module bytes 1,431,462 / placeholder envelope 1,438,980
B, SHA-256
`9d33848161019a36ea214fbeac50b7a7dfb1e451b076d02130434dd564ae2a98`.
The operative envelope (stamped with this pin) differs from the
placeholder only in the build-identity part's stamp bytes; its
identity is recorded in the deployment proposal that pins this
package's child commit.

## Stamp binding

Gate-(a) / Gate 2D precedent, followed exactly: **pin first,
then stamp.** This package is pinned as a single-parent child
of `d01c15ed732436223f0207e4d126a588150187af` on `ui1-review`;
the resulting pin SHA becomes the `/health` build stamp — the
candidate build stamp. At deploy time (under a future Julie
GO) the assembler is re-run with `--pin <that SHA>` against
the range-fix tree and that run's envelope is the operative
upload payload. The placeholder-stamped envelope is never
uploaded.

— Wren
