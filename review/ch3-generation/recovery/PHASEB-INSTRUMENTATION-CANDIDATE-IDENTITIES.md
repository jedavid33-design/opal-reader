# Phase B P2 instrumentation — candidate identities

Status: CANDIDATES ONLY — scratch tree, NOT deployed. Production remains on build `1c2d1d0f` and HELD.

## Deployed basis (the tree the candidates were built from)

- Build: `1c2d1d0fa7ebb769f68cfb327fb9fde7d4d30867` (range-fix build, live)
- Script ETag: `f15fb1ae40f870fc4493f3499db0b096c4d801b9fff8d20fe5538d84c69c82ed`
- Parts: 31 deployed parts, census-downloaded copy at `phaseb-attempt3/evidence/parts-e0/` (attempt-3 evidence), re-hashed 31/31 against the deployed manifest during the diagnostic investigation.

## Candidates (local scratch tree, never deployed)

- Entry part `worker-entry-prod-d6.js`: 127,131 B, SHA-256 `45daf26ca850835c698863cb08ca39a8c6f1b2f1450488d1e710f0cd87d7c4ab`
  Local path: `instrumentation-spec/scratch/candidate-tree/v2/worker-entry-prod-d6.js`
- Service part `generation/service.mjs`: 88,070 B, SHA-256 `41f27492447296f25f958836a65d8e04592c2ba3cd330a2d2854ed98433eefda`
  Local path: `instrumentation-spec/scratch/candidate-tree/v2/generation/service.mjs`

## Diff vs deployed parts

- Combined diff SHA-256: `85236a4800a79c689100811d1bab751d42c89c781659e5a89e6cd28cd91b8ac0` (33,874 B)
  Local path: `instrumentation-spec/scratch/combined.diff`
- Stats: total +659/−16 — entry +418/−15 (4 hunks), service +241/−1 (3 hunks).
- A `patch -p1` round-trip on pristine `parts-e0` reproduces both candidates byte-for-byte (also asserted in-suite by battery test T0).

## Battery

- T0–T10 battery executed on the exact final candidate tree: 32/32 pass, exit code 0.
- Log pinned alongside as `PHASEB-INSTRUMENTATION-BATTERY-RUN-LOG.txt`, SHA-256 `1fcacefa8e60062a87e9a3ecff47a59667346a1450d9282daf818bffbb85c2ce`.

## Documents pinned with this note

- Spec SHA-256 `a805b473f293073cad5fd97bbdba05f30c12d76b3b41d78b3742fc0b1e34110e` (98,793 B)
- Gate SHA-256 `d1e954ea1c6321e6782f1f892529c0c24c7bc042c3d68f5548aff10df69a5b9c` (31,890 B)
- Amendment notes SHA-256 `670995e8b924d0367be8ea416ce405ea85ba19bdefc51d4042a193820215d5fc` (19,983 B)

Rowan's amended-package review: PASS (recorded on the Roundtable board; verbatim pinned alongside as `ROWAN-P2-AMENDED-INSTRUMENTATION-REVIEW.md`). The PASS authorizes no production execution; any gate attempt requires Julie's separate explicit GO.
