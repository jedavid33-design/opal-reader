# P8 F-A / F-B / F-C remediation build — addendum

Status: **repo-only build, Julie-authorized Oct 22 ("Build as
proposed")**. Nothing in this build was uploaded or published; the
staging worker still runs the previously deployed build. This
addendum records what the build changed and the evidence gathered;
the F-A upload and the F-B/F-C republication remain separate gates.

Design authority: the remediation proposal as corrected by Rowan's
review (opal-roundtable issue #15, comments 6353069802 / 6353146397 /
6353186341). In particular, F-B implements Rowan's corrected proof —
a direct candidate-transport `quotaView()` — and NOT the proposal
draft's `surfaces.quotaModel()` proof, which is invalid because
`client-store.mjs` `refreshMoney()` catches every `quotaView()`
rejection and returns cached money.

## F-A — worker gate refusals carry the allowlisted CORS headers

`v2/worker-entry.js`: `stagingGate(request, env, cors)` — the four
refusals (403 env-scope, 403 request-scope, 503 token-not-configured,
401 token mismatch) now merge the `cors` object `fetchHandler`
already computes via the unchanged allowlisted `corsHeaders()`.
Statuses, bodies, gate order, fail-closed behavior, and all success
paths are byte-identical to before. Tests:
`tests/p8-part1-b7-revision.test.mjs` (per-denial origin matrix,
no-credential-leak, browser-shaped preflight→denied sequence,
success-path invariance). Negative demonstration: against the
pre-fix entry exactly the 5 new CORS tests fail; the invariant tests
pass on both versions.

## F-B — preview connect proves the candidate before installing it

`v2-preview/preview-app.js`:

- `connectPreviewClient` refuses a blank token as its first
  statement (before identity, health, or transport), and — after the
  unchanged exact health gate — awaits the candidate TRANSPORT's
  `quotaView()` directly, requiring a well-formed payload
  (`assertWellFormedQuotaView`: the six numeric fields the real
  coordinator view carries), BEFORE composing the assembled client.
- `connect()` no longer discards the installed client/transport up
  front; a blank field is a visible no-op refusal. Attempts are
  sequenced (`connectAttemptSeq`): a superseded attempt neither
  installs nor relabels the health line, whether it fails or
  succeeds late.
- Failures surface the real error (`Connection refused: …`, with the
  server's message verbatim); the token field is cleared only on
  success; the token is never logged or persisted.

Tests: `tests/p8-preview-p1-p2.test.mjs` (blank / wrong / expired /
network / malformed-200 / stale-cache trap / re-auth, plus the two
P1 tests whose authenticated-call counts now include the proof) and
`tests/p8-preview-ui.test.mjs` (double-Connect no-op, verbatim
refusal, both race directions). Negative demonstration: against the
pre-fix preview module, all 7 new F-B tests and both updated P1
contract tests fail; all 4 new UI tests fail.

## F-C — identifier inputs and not-found diagnostics

`v2-preview/index.html`: `#bookId` and `#readId` gain
`autocapitalize="none" autocorrect="off" spellcheck="false"` (no
other input changed). `preview-app.js`: `loadBook`'s not-found path
reports through `bookNotFoundLines(bookId)` — the submitted ID
verbatim, plus "IDs are case-sensitive; check the exact case" when
the ID contains uppercase. IDs are never rewritten or normalized.
Tests: `tests/p8-preview-p1-p2.test.mjs` (static attribute
assertions; verbatim/hint unit tests).

## Evidence discipline

Smoke coordinator baseline after the acceptance session stands at
settings revision 3 / position receipt 2; this build performed no
live contact of any kind, and any future smoke is read-only against
that baseline (Rowan 6353069802 / 6353186341). Full build report:
`~/workspace/your_files/opal-reader-v2-p8-fabc-build-report.md`.
