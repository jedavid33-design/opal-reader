# Opal Reader v2 — Part 1 decisions record (P8 integration build)

Closes the eight open questions from the deployment proposal §9, plus
the runtime items Part 1 had to settle. Each decision names its basis
in the design/feature law. Anything the sources genuinely cannot
decide is flagged for Rowan rather than silently chosen — see
"Flagged for Rowan" at the end.

## D1. End-state Worker topology at flip

**Decision:** two scripts through the deploy and the smoke:
`opalreader-api` (frozen v1) and `opalreader-api-v2` (dark). At
cutover, the client is repointed to the v2 script; the v1 script is
retired only in P10, after verification. We do **not** plan to replace
the frozen worker in place at flip time.

**Why:** the proposal already chose the separate script for the deploy
because it is the only topology that leaves the frozen worker provably
untouched, and nothing in the design requires the v2 state plane to
live behind the v1 script name — the design pins "one account-wide
Durable Object," not a script name. Keeping two scripts makes every
rollback a client repoint or a script deletion, never a re-upload of
the thing Julie is listening through. The remaining end-state question
(whether P10 deletes v1 or leaves it dark) is a retirement detail, not
a cutover blocker, and belongs to the P10 plan.

## D2. Staging token model and isolation

**Decision:** the staging script carries its OWN access-token secret,
set by Julie in the Cloudflare dashboard at Part 2 time. It is never
copied from the v1 script (secret values are unreadable between
scripts, and Wren's standing rule is that Julie enters her own
credentials). The entry additionally requires the worker's scope
binding AND the request header to both be exactly `staging-smoke`;
with no token configured, protected routes answer 503 — deny by
default, never open. Smoke and preview traffic selects the dedicated
`smoke-p8` DO instance via `X-OpalReader-Instance`; production routing
names `account`. The two instances are physically separate SQLite
stores inside the v2 namespace.

**Why:** the proposal offered "Julie sets the value" vs "smoke runs
beneath the token check." Rowan's B7 requirements demand tested
unauthenticated rejection and explicit deny-by-default non-staging
access; a smoke path beneath the token check would fail that
requirement by construction. Julie-set is also her standing
credentials rule. This changes one Part 2 assumption (see Playbook
deltas): the smoke is exercised THROUGH the token check, not beneath
it.

## D3. Cutover migration execution locus

**Decision:** the production flip runs the migration as a LOCAL runner
(the rehearsed P7 machinery) against the v2 coordinator's HTTP command
API — the same shape as both rehearsals and the dress rehearsal. No
in-Worker migration path is built.

**Why:** every verification artifact we have (P7 ×2, the Oct 22 dress
rehearsal, byte-exact rollback) exercised the local-runner shape
against a pinned snapshot. Building an in-Worker path now would
invalidate that evidence and add an unreviewed code path inside the
one component that must not improvise. The coordinator API is the
boundary either way; the runner's location is the only variable, and
the rehearsed location wins.

## D4. Provider adapters while generation is forbidden: inert/fail-closed

**Decision:** the real Gemini (Standard + Batch) and OpenAI adapters
are built and ported from the v1 kernels behind the executor seam, and
generation is blocked at three independent layers in the staging
configuration:

1. The deploy spec registers **no queue consumer** — the queue handler
   is unreachable.
2. If invoked anyway, the queue handler (and the DO's internal
   execute, and the provider seam itself) refuses with the named
   `GenerationHaltedError` (`generation_halted`) while
   `GENERATION_HALT` is set, before any provider contact; the
   coordinator is also constructed without a delivery function, so
   outbox rows stay unsent and visible.
3. The staging spec contains **no provider secrets at all** — even a
   hypothetical dispatch would fail with `provider_not_configured`.

Azure and Fish are not carried over as generation providers (approved
removals): the adapter refuses them by name
(`provider_not_carried_over`), and existing audio from every former
provider stays playable because playback resolves by cache key, never
by provider. This also corrects the task brief's "Gemini/Fish/OpenAI"
phrasing — the proposal's B4 and the feature law both scope real
synthesis adapters to Gemini + OpenAI.

## D5. Sync route shapes

**Decision:** the routes in `v2/p8/sync-contracts.md`:
`GET /v2/sync/snapshot`, `GET /v2/sync/changes`,
`POST /v2/sync/position`, `GET /v2/sync/position/:bookId`,
`GET /v2/sync/byte-check/:cacheKey`, alongside the unchanged P2
command/read surface. Position push is a durable
`PushPositionEvents` command (idempotent by command id), with
server-side mapping of coordinator outcomes into the store's
`{receipts, rejected, tip, journalGaps}` shape.

**Why:** the substrate semantics were pinned in P4; only the HTTP
shapes were open. These shapes keep GETs pure (I2 read-only facade),
keep position writes inside the durable-command discipline (no
side-door writes), and make the client transport a thin pass-through
rather than a second mapping layer that could drift.

## D6. Smoke-data cleanup policy

**Decision:** abandon the `smoke-p8` instance in place (the proposal's
recommendation). No wipe endpoint is built. The instance is a few KB
of synthetic rows in a store production routing never names; deleting
the staging script remains the zero-residue fallback if Rowan ever
requires it, and that choice is recorded at Part 2 close-out, not
pre-decided here.

**Why:** adding a delete path to production code to clean a test is a
worse risk than the residue, and the instance's isolation is
structural (separate DO instance), not conventional.

## D7. Health/build identity contract

**Decision:** `GET /health` returns
`{"ok":true,"app":"OpalReader API v2","version":"2.0.0","build":"<source commit SHA>","coordinator":"armed"|"unbound","scope":<scope binding or null>,"generation":"halted"|"enabled"}`.
The build SHA is injected by the artifact builder
(`tools/build-p8-part1.mjs`) from `git rev-parse HEAD`; the checked-in
source carries the literal `UNBUILT`. Version `2.0.0` is the v2 line's
start; the client/wire compatibility analogue of v1's
`GENERATION_RELEASE_ID` is deferred to the cutover proposal, which is
where a wire check would first have something to protect.

**Why:** the proposal's §6 requires a health body that cannot be
confused with v1's and a build identity tied to the artifact; a
hand-edited version string in source would drift from the artifact,
so the builder owns it.

## D8. Staging bindings / KV need

**Decision:** the staging spec binds the coordinator DO, the existing
R2 bucket, the queue as **producer only**, and plain-text
`ALLOWED_ORIGIN`, `OPALREADER_V2_SCOPE=staging-smoke`,
`GENERATION_HALT=1`. **No KV binding.** The only secret is the
staging token (D2); there are no provider secrets.

**Why:** the design states KV holds no v2 write path, and D3 settles
the migration locus as a local runner over the HTTP API, so the one
hypothetical KV use (an in-Worker flip-time read) no longer exists.
Binding KV would hand the v2 script a read path over v1 data for no
current purpose — the opposite of the isolation B7 must prove.

## D9. `node:crypto` runtime compatibility

**Decision:** keep the executor's `node:crypto` import; the upload
spec sets `compatibility_flags: ["nodejs_compat"]` with
compatibility date `2026-08-29` (the account's current date,
preserved). The integration tests exercise the fingerprint and digest
code in the node harness, which is the same primitive the flag exposes
in Workers; the real-runtime confirmation is the Part 2 DO smoke,
which remains a named residual until then.

**Why:** the alternative (rewriting the executor and migration util
to WebCrypto) would touch two signed-off modules to solve a problem a
compatibility flag already solves, and would invalidate the P1-pinned
fingerprint evidence chain for no behavioral gain.

## D10. The synchronous cache/probe seam vs async R2

**Decision:** a request-scoped snapshot. Before any coordinator
operation, the DO host hydrates every coordinator-indexed cache key
from R2 into memory; the work source additionally primes the exact
fingerprint key for the occurrence it resolves. The coordinator and
executor then run against the snapshot through the synchronous
probe/cache contract they were designed against, and new writes flush
to R2 afterward with a create-if-absent guard.

**Why:** the coordinator's probe contract is synchronous by design
(P2), and R2 is not. Pretending a thin wrapper could be both would be
a false claim in the one place B7 exists to catch false claims. The
snapshot makes the seam explicit and testable in the harness.

**Residual (named, not smoothed):** a write-behind snapshot is not a
truly synchronous conditional R2 write. A crash between the
executor's report and the flush could bind a digest whose bytes had
not yet landed. Generation stays halted and Part 2's real-DO/R2 smoke
must prove the seam end-to-end before generation is ever enabled;
if Rowan wants the seam closed harder before B7 sign-off, the
candidate fix is an executor-level "flush-before-report" callback,
which changes the P3 seam and needs its own review round.

## Integration fixes the assembled-artifact tests forced

Two defects were invisible to the module-level suite and only appeared
when the real entry/transport/DO composition ran — exactly the class
of bug B7 exists to catch. Both fixes are in the branch and covered by
regression tests:

1. **Sync family state seeding (`v2/coordinator.mjs`).**
   `_familyState` lazily INSERTed a `sync_family_state` row on first
   use — a write on a read path. Through the HTTP surface, a GET
   pull/snapshot for a never-written family (e.g. `bindings` before
   the first binding) hit the read-only facade and 500'd. The
   constructor now seeds every family's row (history-aware,
   insert-or-ignore) when it creates the schema, so a writable
   construction — which the DO host always performs first — makes
   every family readable. Direct harness calls never saw this because
   they share the writable instance.
2. **Byte-true digests (`v2/executor.mjs`).** The executor computed
   report digests as `sha256(String(audio))`; for a real adapter
   returning `Uint8Array` audio that hashes a decimal-string rendering,
   not the stored bytes, and the binding gate would have rejected
   every real recording. `sha256Of` hashes strings as UTF-8 (the P3
   fake contract, byte-identical) and byte arrays as themselves.

## Compatibility matrix — frozen v1 vs dark v2 (pre-flip)

| Surface | Frozen v1 (production) | Dark v2 (staging) |
|---|---|---|
| Client | Shipped `index.html` + `app-256.js` (Reader 1.4.117), bytes pinned | Preview bundle under `v2-preview/` only; root files byte-identical |
| Worker | `opalreader-api` 1.4.43 frozen build, etag `ea6f8196…` | `opalreader-api-v2` (Part 2), separate script, serves no production traffic |
| State plane | v1 KV book records + R2 audio | Coordinator DO SQLite (empty until gated per-book migration) + same R2 bucket, `audio/<key>` namespace |
| Books visible | Julie's 7 books, listenable | Synthetic smoke book only; no read path over v1 records exists |
| Generation | Halted; queue delivery paused; FP job PARKED_POLICY | Halted at 3 layers; no consumer; no provider secrets |
| Sync | v1 sync protocol 2 | v2 sync contracts (this doc set); no dual-read either way |
| Shelf bridge | Shipped v1 outbox, untouched | Bridge composed into the assembled client; storage key `cs:shelf-bridge:v1`; no live Shelf contact in Part 1/2 smoke beyond Julie-approved device checks |
| Rollback target | — (never modified) | Delete the v2 script; frozen worker is never the deploy's rollback target |

## Part 2 playbook deltas (assumptions Part 1 changed)

1. **Smoke auth (from D2):** Julie sets a distinct staging token on
   `opalreader-api-v2` in the dashboard before D4; the smoke runs
   THROUGH the token check. The proposal's "beneath the token check"
   alternative is not used.
2. **Upload payload (from B6):** D2 uploads the deterministic artifact
   in `dist/p8-part1/` produced by `tools/build-p8-part1.mjs` from the
   pinned Part 1 tip commit — module set + `upload-metadata.json`
   derived from `v2/p8/deploy-spec.json` — not a hand-assembled file
   list. The artifact's `/health` build SHA must equal the pinned tip.
3. **Preview origin (from B5):** the preview bundle sends
   `X-OpalReader-Instance: smoke-p8` by default and needs
   `ALLOWED_ORIGIN=https://jedavid33-design.github.io` (already in the
   spec) for CORS from Pages.
4. Everything else in the proposal's Part 2 (D1 re-verification, D3
   observability re-apply via the `/settings` multipart PATCH, D4
   smoke sequence, D5 root-hash verification, D6 device acceptance,
   D7 close-out) is unchanged.

## Flagged for Rowan (genuinely undecidable from the sources)

1. **Never-accepted evidence source (P3 gate condition).** Part 1 does
   NOT expose `resolveBatchNeverAccepted` over HTTP, and the adapter's
   `verifyNeverAcceptedEvidence` fails closed: no public Gemini API
   proves non-acceptance (a list miss is a hint under executor
   contract 2, never proof). Closing this needs either a provider-ops
   evidence channel we do not have, or Rowan's ruling that
   "not exposed + fail-closed" satisfies the condition while
   generation is halted. Flagged, not chosen.
2. **D10's write-behind seam** — whether the snapshot design is
   acceptable for B7 with the Part 2 smoke as its proof, or whether
   Rowan requires the flush-before-report redesign first.
3. **Content-plane text for migrated books.** The P7 corpus strips
   segment text by design; the work source reads text from the v2
   content entity. Before any migrated book could generate under v2,
   the cutover must state where its text plane comes from. Part 1
   takes no position beyond "the executor skips `no_content` rather
   than inventing words."
