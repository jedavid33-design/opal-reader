# ENVELOPE REPORT — Chapter 3 mechanisms halted-deploy package

**Done.** Repo-only preparation: no production contact of any kind,
no deploy, no pin, no board post. The candidate source tree was only
READ. This package gives the parent everything needed to pin it and,
after Rowan's operational review and Julie's GO, to execute the
halted deployment in `DEPLOY-PROPOSAL.md`.

## Deliverables

- `pin-tree/` — the exact file set for the parent to pin as the
  single-parent child of `623e8cd9b3a12c589a94176e8994df1f28a694d7`
  on branch `ui1-review` of `jedavid33-design/opal-reader`, under
  `review/ch3-generation/deploy/`:
  - `DEPLOY-PROPOSAL.md` — the halted-deploy gate document.
  - `ENVELOPE-REPORT.md` — this report.
  - `envelope-manifest.json` — per-part name/size/SHA-256 for the
    operative (stamped) parts plus the unstamped tree hashes, the
    class table, and the full hashing recipe.
  - `parts/` — the 29 envelope part sources in their **unstamped
    tree form** (build-identity carries `UNBUILT`), byte-identical
    to the candidate tree files; included so the pin is a
    self-contained identity for the exact bytes, per the gate-(a)
    package pattern (whose pin fixed its tree byte-for-byte).
  - `tools/assemble-ch3-envelope.mjs` — the assembler/validator
    (below), pinned so the operative re-run at execution uses the
    reviewed tool.
- `operative-parts/` — the 29 deploy payloads assembled with the
  placeholder pin (§Stamp), plus `assembled-metadata.json`,
  `assembled-envelope.bin`, and `parts-manifest.json`.
- `logs/assemble-placeholder.log` — the assembly run's output.

## Assembly method

Recipe-identical to the gate-(a) final-envelope harness
(`final-envelope/harness/validate-final-envelope.mjs`), re-implemented
as `assemble-ch3-envelope.mjs` against the candidate tree
(`~/workspace/ch2-program/ch3-build/worker-build`):

- Import closure rooted at the deploy spec's `main_module`
  (`v2/worker-entry-prod-d6.js`); part name = `v2/<path under
  worker/>`; every relative import resolves; bare specifiers
  node:-only.
- Metadata derived from the candidate tree's own
  `worker/p8/deploy-spec-prod-d6.json` (byte-identical to the
  gate-(a) tree's spec): spec bindings + `inherit` secrets by name;
  serialized `JSON.stringify(metadata, null, 2) + "\n"`.
- Multipart boundary `----opalreader-final-envelope-d1`; metadata
  part first; module parts sorted by name; `filename` == part name;
  `application/javascript+module`; envelope SHA-256 over the
  assembled body. Round-trip parse-back verified byte-exact.

**Validation: PASS 9/9 checks** (C1 spec/entry; C2 closure; C3 part
set == live 28 + 1; C4 class table; C5 stamp; C6 metadata identity;
C7 round-trip; C8 table-name scope; C9 GEN_SCHEMA). The run is
deterministic: a second run reproduced the envelope SHA-256
exactly.

## Stamp binding — the precedent followed

Gate (a)'s precedent, followed exactly (documented in
`final-envelope/REPORT.md` and `d1-operative/D1-OPERATIVE.md`):
**pin first, then stamp.** The final package was pinned; the pin's
SHA became the build stamp; the operative parts were then
regenerated with `--pin <pin>` and the deploy used those, while the
pin stands as the identity. The placeholder convention (40 zeros,
real-pin length) keeps every byte count exact before the pin exists.

So here: the parent pins `pin-tree/`; the resulting pin SHA is the
stamp; at execution the assembler is re-run with `--pin <that SHA>`
against the inventory-identified candidate tree, and that run's
envelope SHA-256 is the operative identity the PUT must match. The
operative parts delivered in this package are the placeholder-stamped
set — correct in every byte except the 40 stamp characters, and
**never to be uploaded**. Verified in-package: substituting a second
40-char pin changed only the build-identity part's bytes (identical
length), and no other part or byte count.

## Class-table verification (against the live operative manifest)

Live part hashes come from the gate-(a) D1 operative run — the
deployed parts of build `945875bc…` — never from inference:

- **24 IDENTICAL** — SHA-256 and size equal to live.
- **3 CHANGED** — `v2/worker-entry-prod-d6.js` 85,577 B
  `410dfa41…` → 101,206 B `1da22a50…`;
  `v2/generation/eligible-set.mjs` 5,978 B `87b4b09a…` → 7,284 B
  `a9932a82…`; `v2/generation/content-plane-adapter.mjs` 7,577 B
  `51c177dd…` → 8,150 B `d8db2cba…`.
- **1 NEW** — `v2/generation/park-release.mjs`, 29,126 B,
  `ba2952af…` (no live counterpart; it is in the candidate closure
  because the changed entry and adapter import it).
- **1 STAMPED** — `v2/host/build-identity.mjs`: tree form 378 B
  `bcb29105…` (`UNBUILT`, byte-identical in both trees) → stamped
  411 B, the same stamped length as live.

Totals: live 28 parts / 1,332,909 module bytes / envelope 1,339,824
B (`38ebec8e…`) → candidate 29 parts / 1,379,543 module bytes /
placeholder envelope 1,386,657 B (`969ca4b4…`). The module delta
(+46,634) is exactly entry +15,629, adapter +573, eligible-set
+1,306, park-release +29,126, stamp +0; the envelope delta (+46,833)
adds one part's multipart framing (+199).

Supporting greps (assembler checks C8/C9, run over the whole
candidate worker source set): the three new table names
(`d6_park_releases`, `d6_chapter_exemptions`,
`d6_chapter_exemption_events`) occur **only** in
`park-release.mjs`; `gen-schema.mjs` is byte-identical to live with
exactly 8 `CREATE TABLE`s.

## Labels

- **CONFIRMED** (produced/verified locally in this packaging):
  the closure and part set; the class table and every hash (live
  side from the recorded D1 operative manifest, candidate side
  hashed here); metadata byte-identity with the live operative
  metadata; the 9/9 validation run and its determinism; the
  pin-substitution invariance; the table-scope and GEN_SCHEMA
  greps; candidate battery figures as recorded for this tree
  (1,136 / 1,114 / 22, from the revision run — the battery was not
  re-run for this packaging and no test result here is new
  evidence).
- **INFERRED:** nothing load-bearing. All production figures in the
  proposal (§2) are last-recorded values from the case record,
  labeled as preconditions to be freshly re-verified at execution —
  this packaging made no production contact, by design.
- **OPEN:** (1) The deploy pin does not exist until the parent pins
  this package; the operative envelope SHA-256 exists only after
  the execution-time re-run with that pin. (2) Rowan's re-review of
  the audit-journal revision (pin `623e8cd9…`, filed 6549025831) and
  her operational readiness review of this package are both hers to
  give; this package asserts neither. (3) Julie's deploy GO is a
  separate decision, including whether the §5 denied probe is in
  scope. (4) The earlier envelope-prep attempt's STOP on a stale
  part count (27) is superseded by this package's verified counts
  (live 28, candidate 29); no other content from that attempt is
  carried forward.
