# P8 Part 2 — F1 revision addendum (Rowan 6349834892)

*Repo-only revision of the F1 fix pin (`ef1a560c…`). Nothing was
uploaded; no Cloudflare API was called; the deployed staging script
remains at `f9c05cae`. Rowan's revised-pin review accepted the F1
core correction and held the replacement-upload request for two
narrow preflight proofs. Both are closed by this commit.*

## Proof 1 — the F1 end-to-end tests now run under the staged DO env

**Defect (test-only).** In `tests/p8-part2-f1-fix.test.mjs`,
`makeWorkerEnv()` built the Durable Object's env as
`{ OPALREADER_STORAGE, GENERATION_HALT }`. Real Cloudflare hands a
DO the script's own bindings, so the entry-path scenarios ran with
`OPALREADER_V2_SCOPE` and `R2_KEY_PREFIX` ABSENT inside the DO —
and `OpalReaderCoordinator._cache()`'s staging namespace guard,
which compares the DO env's scope against `"staging-smoke"`, never
fired. The scenarios passed with the fail-closed R2 namespace check
inadvertently bypassed.

**Correction.** The DO env is now the pinned deploy-spec binding
set: the `COORDINATOR` namespace itself, `OPALREADER_STORAGE`
(bucket), `OPALREADER_GENERATION` (queue stub that records sends),
and the plain texts `ALLOWED_ORIGIN` (the pages origin),
`OPALREADER_V2_SCOPE: "staging-smoke"`, `GENERATION_HALT: "1"`,
`R2_KEY_PREFIX: "smoke-p8/"`. The `OPALREADER_ACCESS_TOKEN` secret
binding is modeled presence-only (a marker string) — the harness
models no secret values, and nothing inside the DO reads it.
The bucket fake now records every operation (the B7 safety-test
pattern), and two tests were added:

- the §5-shaped byte-check trio through the entry under the
  corrected env: the object seeded at `smoke-p8/audio/<K>.mp3` is
  visible, its production twin at `audio/<K2>.mp3` is not, a
  malformed key is a 400 — and EVERY recorded bucket key carries
  the `smoke-p8/` prefix, with zero queue sends under the halt;
- the guard is LIVE in this env shape: the same env with the DO's
  `R2_KEY_PREFIX` wrong (`"audio/"`, `""`) or absent fails the
  request closed with the named namespace error and ZERO bucket
  operations.

All pre-existing F1 scenarios (first settings read, SetSettings
apply/replay/conflict, freeze flow) repeat through the corrected
env unchanged — against the FIXED coordinator they pass; no F1
scenario failed, which would have been a stop-and-report defect
signal.

## Proof 2 — the second upload is an update, validated as one

**Fork taken: derived upload-time overlay.** The builder and the
deploy spec are UNCHANGED (the creation envelope remains the
creation artifact; creation validation still passes 20/20). The
update envelope is a separate pinned artifact,
`tools/update-envelope.json`, derived deterministically from the
built creation metadata by `tools/derive-update-envelope.mjs` and
validated by `tools/validate-update-envelope.mjs` (13 assertions,
U0–U12, plus fail-closed negatives in
`tests/p8-upload-envelope.test.mjs`).

**The validated representation** (Cloudflare Script Upload API
schema — `ScriptUpdateParams` — governs, per the preflight rule):

- `migrations` is OMITTED. The field is optional in the update
  schema ("Migrations to apply for Durable Objects associated with
  this Worker") and the update applies none. Replaying the
  creation step is affirmatively wrong: the legacy migrations
  documentation states `new_sqlite_classes` on a later migration
  fails for an already-deployed class, and tags are unique names
  applied at most once. No documented "no-change" migration object
  exists, so none is invented. The script's `migration_tag` is
  persistent script state ("the tag of the Durable Object
  migration that was most recently applied"), re-verified live in
  the execution plan.
- Bindings = the seven configuration bindings field-identical to
  creation, PLUS `{type: "inherit", name: "OPALREADER_ACCESS_TOKEN"}`
  — the documented minimal `WorkersBindingKindInherit` shape
  (`old_name` only renames; `version_id` defaults to "latest", the
  only value script upload accepts). The token's value never
  appears in the payload.
- The request is pinned as `PUT` with query parameter
  `bindings_inherit=strict`: per the schema, "the upload will fail
  if any `inherit` type bindings cannot be resolved against the
  previous version of the Worker. Without this, unresolvable
  inherit bindings are silently dropped" (error 10057).
- `main_module`, compatibility, and observability are identical
  to the creation metadata; the module parts are the creation
  closure, byte-identical.

**Residual ambiguity, stated.** The legacy wrangler prose "all
future Worker code deployments must include a migration tag"
describes the wrangler cumulative-list model; in the single-step
API the tag is server-side script state and the field is
optional. The execution plan converts the residual risk into a
checked fact: the update response and a post-update read must
report `migration_tag` `"v1"` and the unchanged namespace id, or
execution stops.

**Pinned hashes.** Envelope file sha256
`61806b40be194921b1cc627490a4581ea0e697b6b12e44fa32a2fd94ef60f064`;
serialized metadata sha256
`901c2213bbc30a5a1e194c37fb676362db748920ba6b477234741c537dbc3c9b`.
(The metadata is a pure function of the pinned deploy spec, so
these hashes do not move with the build stamp; the validator
re-derives and compares on every run.)

*Execution of the replacement upload is governed by the separate
plan (`opal-reader-v2-p8-part2-replacement-upload-plan.md`,
delivered with the board evidence for this round) and requires
Julie's fresh, separate upload authorization after Rowan closes
the F1 pre-upload gate.*
