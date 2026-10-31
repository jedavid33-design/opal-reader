# BUILD REPORT — CORRECTION ADDENDUM

**This addendum corrects two stale statements in
`BUILD-REPORT.md` (same folder). The report itself is not
edited; this addendum is the correction of record, in the
same append-only style as the diagnosis addendum.**

## (a) "Nothing posted or pinned" is stale

`BUILD-REPORT.md` states in its scope header (L7–8) that
"nothing was deployed, nothing was posted or pinned", and
repeats in §6 that there was "No deploy, no merge, no pin,
no board post." Those sentences were true of the local build
at the moment they were written, and the **no-deploy /
no-merge** parts remain true — but the **no-pin / no-post**
parts are superseded:

- **CONFIRMED:** the remediation package **was pinned** at
  commit **`dcce900f4a3ccec2c6cbeef7aedf959d81ceebde`** in
  `jedavid33-design/opal-reader`, branch **`ui1-review`**
  (under `review/ch2-fresh-ch2/remediation/`).
- **CONFIRMED:** it **was filed** on issue #15
  (`jedavid33-design/opal-roundtable`) as comments
  **6544774137** and **6544780568** (the first filing's
  heredoc-mangled text superseded by the corrected second
  filing).
- **CONFIRMED:** Rowan reviewed the package and gave the
  cache patch a **REPO-ONLY SOURCE PASS** at comment
  **6544821907** — the same comment that placed the quota
  proposal (not the cache patch) on DESIGN HOLD, which
  `QUOTA-ADDENDUM.md` now answers.

Nothing in this correction changes the report's §6 caveats:
no production calls were made by the build, winner
provenance remains UNRESOLVED, and deploying the patch
remains a separate decision.

## (b) Two relative links should be sibling paths

`BUILD-REPORT.md` links the quota proposal as
`../QUOTA-PROPOSAL.md` (L11) and the diagnosis addendum as
`../DIAGNOSIS-ADDENDUM.md` (L189). Both targets are
**siblings of the report in the same remediation folder**,
not parent-directory files:

- Local tree (`~/workspace/ch2-program/remediation/`):
  `BUILD-REPORT.md`, `QUOTA-PROPOSAL.md`, and
  `DIAGNOSIS-ADDENDUM.md` sit side by side — the links
  should read `./QUOTA-PROPOSAL.md` and
  `./DIAGNOSIS-ADDENDUM.md`.
- The pin likewise places all three in one directory,
  `review/ch2-fresh-ch2/remediation/`, at commit
  `dcce900f4a3ccec2c6cbeef7aedf959d81ceebde` — the same
  sibling relationship holds there, so the corrected
  `./`-relative links resolve in both locations.

— Wren (correction addendum only; BUILD-REPORT.md unchanged)
