# REPORT — final-envelope packaging (for the parent agent)

**Done.** Repo-only, no production contact, no deploy, no
GitHub posts/pins, source tree only READ (never modified).
Deliverables in `~/workspace/ch2-program/final-envelope/`:

- `DEPLOY-PROPOSAL.md` — the no-effect gate-(a) re-proposal
  for the FINAL tree (Rowan COMBINED SOURCE PASS 6546514192):
  exact envelope, metadata spec, and the revised gate-(a)
  checklist (P0 census + race fence, Step P, D0 strict
  provenance drift, D1 = this package's harness + Rowan's
  changed-file blob comparison, D2/D3/D4), gate (b) summarized
  as separate, gate (c) out of scope, rollback law with the
  permanent floor `6a73d9622e1b4eac00c58e289de1c674ed6b3d6b`
  (etag `a9a4c0c4…`) and the plain statement that **the floor
  does not enforce the provider-attempt counter**, plus all
  standing honesty lines (100/day app-selected, outside-Reader
  usage uncountable, winner provenance + historical charge
  unresolved, harness ≠ smoke).
- `tree-inventory.json` — same schema as the earlier
  proposal's: every file of the final tree with SHA-256 +
  size, plus the envelope section.
- `harness/validate-final-envelope.mjs` — the D1 harness
  (adapted from the disposition deploy's proven
  `proof-ch2disp-envelope.mjs`), with its run artifacts
  (`proof-result.json`, `proof-result-<mutation>.json` ×7,
  `parts-manifest.json`, `assembled-metadata.json`,
  `assembled-envelope.bin`).
- `logs/` — `harness-pass.log` + one log per mutation.

## What was assembled (CONFIRMED, harness-produced)

- **Source tree:** `quota-routes-fix2/worker-build` — **805
  files, 9,981,856 B** total. `v2/` is a symlink to `worker/`;
  files inventoried once under `worker/`.
- **Envelope:** import closure rooted at
  `v2/worker-entry-prod-d6.js` = **28 module parts** (a harness
  output on this tree, E3: every relative import resolves;
  only bare specifier `node:crypto`). **1,332,876 module bytes
  tree / 1,332,909 stamped** (stamp part 378 B UNBUILT → 411 B
  with a 40-char pin). Assembled multipart envelope (placeholder
  pin): **1,339,824 bytes**, SHA-256
  `90bdfbe16655692e94b865d048f57ad2027d1ed5bafc6f22663b048856868c7b`.
- **Classification vs live** (live hashes taken from the
  earlier proposal's `tree-inventory.json` — **all 27 live
  parts were recorded there; no live hash had to be guessed**;
  the NEW part has no live counterpart by definition, and the
  stamp part's live form carries the live pin): **7 CHANGED**
  (coordinator, d6-executor, gen-constants, genstore, service,
  host/adapters, **worker-entry-prod-d6.js**) + **1 NEW**
  (quota-budget) + **1 STAMPED** (build-identity) + **19
  identical**.
- **Metadata:** main_module `v2/worker-entry-prod-d6.js`,
  compat `2026-08-29` + `nodejs_compat`, 10 bindings (7 spec +
  3 inherit secrets by name: GEMINI_API_KEY,
  OPALREADER_ACCESS_TOKEN, OPALREADER_MIGRATION_OPERATOR_TOKEN),
  `GENERATION_HALT "1"`, observability per spec, **no
  `migrations` key**, top-level keys exactly the proven set.

## Harness outputs, verbatim

Positive run (`logs/harness-pass.log`): **exit 0** —

```
FINAL ENVELOPE VALIDATION: PASS (23/23 assertions)
envelope: 1339824 bytes, sha256 90bdfbe16655692e94b865d048f57ad2027d1ed5bafc6f22663b048856868c7b (pin 0000000000000000000000000000000000000000, PLACEHOLDER — re-run at D1 with the real final-package pin)
```

Checks E1–E23: E1 spec identity, E2 entrypoint, E3 closure,
E4 node:-only, E5 per-part tree hash (stamp special-cased),
E6 stamp exactly once, E7 seven spec bindings, E8 bindings
exact, E9 phase-policy shape, E10 inherit secrets, E11 no
migrations, E12 DO topology, E13 queue topology, E14 compat,
E15 observability, E16 multipart round-trip (filename == part
name, `application/javascript+module`, no duplicates), E17
halt "1", E18 exact metadata key set, E19 inventory agreement,
E20–E23 operator-fence source assertions (bootstrap handler:
stamp + halt + strict-body/figureless refusals; dispose
handler: stamp + halt + closed allowlist + domain-refusal-only
catch; reconcile handler: stamp + validated pagination +
`censusComplete` + **no `cache.flush()` in the handler
segment**; public entry: operator-alone class membership,
stamp set server-side exactly once, bootstrap raw-text forward
with named read-error refusal, reconcile offsets forwarded).

Negative mutations — **every one FAILs validation (exit 1)**,
as required:

| Mutation | Result | Failing checks |
|---|---|---|
| `drop-part` (quota-budget removed) | FAIL 21/23 | E16, E19 |
| `duplicate-part` (adapters assembled twice) | FAIL 22/23 | E16 (duplicates named) |
| `wrong-hash` (one byte flipped in adapters) | FAIL 22/23 | E5 |
| `spoofed-operator-route` (bootstrap handler's admitted-stamp check removed) | FAIL 21/23 | E5, **E20** |
| `wrong-halt` (GENERATION_HALT "0") | FAIL 21/23 | E8, E17 |
| `unexpected-metadata` (extra top-level key) | FAIL 22/23 | E18 |
| `migrations` (migrations key added) | FAIL 21/23 | E11, E18 |

One harness bug was found and fixed during packaging (not a
source finding): the E22 segment slice initially ran past the
reconcile handler into later handlers that legitimately call
`cache.flush()`; the segment is now bounded at the next
internal handler. The final tree itself needed **no**
correction — the reconcile handler segment contains no
`cache.flush()` (QROUTE-18's read-purity fix, verified in
source here).

## Discrepancies vs the earlier snapshots (enumerated, CONFIRMED by hash diff)

**Vs the quota-fix2 snapshot** (`deploy-proposal/`, the
"28-part proposal" this package supersedes):

- Whole tree: **804 files / 9,919,655 B → 805 files /
  9,981,856 B (+62,201 B)**. The complete file-level diff is
  exactly: **1 file CHANGED** — `worker/worker-entry-prod-d6.js`
  (`079e982b…`, 64,548 B → `410dfa41…`, 85,577 B, +21,029 B) —
  and **1 file ADDED** — `tests/quota-operator-routes.test.mjs`
  (41,172 B, sha256 `180c7338…`); **0 files removed, every other
  file byte-identical** (including `quota-budget.mjs`
  `2b399245…`, the coordinator, the cache-refresh adapters, and
  all unknown-billing protections). No inconsistency found: no
  unreachable new module, no missing part.
- Envelope: **28 parts in both**; module bytes (tree)
  **1,311,847 → 1,332,876 (+21,029 — the entry delta exactly)**;
  classification vs live shifts only through the entry:
  CHANGED **6 → 7**, identical **20 → 19**, NEW 1 and STAMPED 1
  unchanged.

**Vs the routes-tree revised plan** (`quota-routes/
REVISED-DEPLOY-PLAN.md` §1.3, the intermediate snapshot):

- Module bytes (tree) **1,327,787 → 1,332,876 (+5,089)** — the
  two route-fix rounds, both entry-only. Entry hash/size
  progression, all verified in this packaging:
  live/quota-fix2 `079e982b…` 64,548 B → routes `91ab9d5c…`
  80,488 B → routes-fix `d862612e…` 85,012 B → routes-fix2 /
  FINAL `410dfa41…` 85,577 B. Counts in that plan (28 parts,
  7 CHANGED + 1 NEW + 1 STAMPED + 19 identical) are unchanged
  in the final tree; only the entry's hash/size and the totals
  moved.

## Battery (not re-run — stated, per instructions)

The worker test battery was **NOT** run again for this
package. Source is unchanged since the pinned run on this
exact tree (Rowan-inspected, 6546514192): **135 suites 113/22;
1,099 tests 1,077/22; runner exit 0 (wrapper completion);
route suite 20/20; the 22 failing suites set-identical to
baseline; zero `AssertionError`.** No test result in this
package is new evidence; the only new validation here is the
envelope harness above.

## Labels

- **CONFIRMED** (produced/verified in this packaging by
  hashing and running the harness locally): the whole-tree and
  envelope inventories, the vs-live and vs-snapshot diffs, the
  closure completeness, the metadata derivation, the 23/23
  positive run, and all seven mutation refusals.
- **INFERRED:** nothing load-bearing. The stamped byte counts
  use a 40-char placeholder pin; a real commit SHA is also 40
  chars, so stamped sizes carry over exactly — only the stamp
  content and the envelope SHA-256 change at D1.
- **OPEN:** (1) The real final-package pin does not exist
  until this package is pinned; gate (a) D1 must re-run the
  harness with `--pin <pin>` and record that run's envelope
  SHA-256 as the operative one (the placeholder SHA in this
  package is for reproducibility only and must never be
  uploaded against). (2) All production figures in the
  proposal are last-recorded, not live-read; P0 re-verifies
  them and STOPs on material difference. (3) Rowan's
  operational readiness review of this package, then Julie's
  gate-(a) decision — neither is given by this package.
