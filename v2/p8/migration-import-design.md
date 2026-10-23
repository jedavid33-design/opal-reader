# Opal Reader v2 — P8 migration-specific import path: design

*Responds to Rowan's D10 scope ruling + import-path STOPs (board
6354217340) and Wren's ack (6354236546). Authorized by Julie
(Oct 22, ~20:19 ET, "Build it"): repo-only design + implementation
+ synthetic rehearsal. No uploads, no live contact, no real data.*

*Base pin: `5f9748cfcd66d5eb9857d6a49dbe4ac5bd48692b`
(`v2/p8-integration`). All line references below are to that tree.*

## 0. What Rowan ruled, and what this design does about it

D10-independence is valid **in principle** for importing
pre-existing, durable, byte-verified audio — but the import
protocol the binding audit described (§5.2 of
`opal-reader-v2-p8-binding-audit-report.md`) is **not cleared as
implemented**, for four source-level reasons (I1–I4). This design
does not patch the described protocol; it **replaces the split
path for migration** with a dedicated, migration-specific
verified bind primitive — one of the two shapes Rowan's ruling
explicitly offers for I1 ("replace the split path with a
migration-specific verified bind primitive"). The general paths
(`SyncPush`, `AdoptAudio`) keep today's behavior and defaults,
byte for byte, for every non-migration caller.

Two new durable command types, both fenced to migration use:

- `MigrateImportBindings` — one command per book: prime →
  byte-verify → bind **both planes** inside the command's single
  DO transaction, or apply nothing at all.
- `MigrateRecordFlipGate` — the external per-book flip gate as a
  durable record that the coordinator itself refuses to write
  unless its own state proves both-plane completeness.

One new read surface:

- `migrationBookView(bookId)` on the coordinator, exposed
  read-only as `GET /v2/migration/book/<bookId>` through the
  existing SELECT-only facade (`v2/api.mjs:12`) — the read-back
  instrument for the flip fence.

## 1. I1 — one source of truth, both planes, one transaction

**The defect, at source.** `SyncPush` accepts binding entities by
revision/identity validation plus upsert only:
`_validateSyncChange`'s bindings branch (`v2/coordinator.mjs:1904`,
bindings at 1926–1936) checks book/occurrence ownership and CAS,
and `_applyValidatedSyncChange` then simply `_upsertSyncEntity`
(`v2/coordinator.mjs:1878`). It never calls `validateAndBind`,
`probe.exists`, `probe.hash`, or any digest check. The
byte-verifying path is a **different command**: `AdoptAudio`
(`v2/coordinator.mjs:385–388`) → `validateAndBind`
(`v2/coordinator.mjs:974`), writing the SQL `bindings` /
`cache_index` tables. The client reads the **sync** family
(`v2/client-store.mjs:326`, `:369` — `caches.bindings.entities`),
not the SQL tables. So a binding could be client-visible via
SyncPush while the coordinator's own index refuses it — the
two-plane divergence, acute for the 31 identity-refused rows.

**The design.** `MigrateImportBindings` is the single import
primitive. Within the one transaction `handleCommand` already
opens per command (`v2/coordinator.mjs:339`, apply at `:352–366`),
it validates **every** row of the book against primed byte facts
(§2–§3) and current DB state; if **any** row is blocked, the
command records a `rejected` outcome with the per-row certificate
and **applies nothing** — no content entity, no sync entities, no
SQL rows, no audit rows (the durable `commands` record is the
refusal's audit surface; unlike `AdoptAudio`, the migration path
writes no `binding_conflicts` residue, so a corrected retry
starts from a provably clean slate). If every row verifies, it
applies, in the same transaction:

1. the book's content entity (if carried and not already present
   identically — divergence is a validation failure, §4);
2. per row, the SQL plane: a `bindings` insert (or idempotent
   recognition) plus the `cache_index` anchor, written by a
   migration-internal bind that mirrors `validateAndBind`'s
   checks but reads primed facts instead of the snapshot probe;
3. per row, the sync plane: the `bindings` entity
   `<bookId>:<occurrenceId>` with payload
   `{ cacheKey, revisionKey, sha256, format, size, provenance }`,
   where `sha256` is the import-time computed digest (§3). An
   already-identical entity is recognized, not rewritten (no
   revision churn on idempotent re-import).

**Source of truth, stated explicitly.** For an imported binding,
the authoritative record is the SQL plane (`bindings` +
`cache_index` anchor), exactly as for `AdoptAudio`; the sync
entity is the client-visible projection of the same verified
fact, written in the same transaction from the same primed
bytes. The two planes therefore cannot diverge *at import*: they
commit or roll back together. Any *later* divergence (tampering,
a bug, a partial future write) is detectable through
`migrationBookView`'s set-equality computation and blocks the
flip gate (§4). Reconciliation rule: a book may be recorded
flipped only when the book's **imported manifest row set** — the
reference set the import command itself records durably in
`migration_books` (canonically digested, so a re-import under a
different row set is a divergence, never an overwrite) — is
exactly the set present in both planes, with per-occurrence
`cacheKey` equality and digest-anchor equality
(sync payload `sha256` = `cache_index.sha256` = freeze manifest
expectation = import-time computed digest). The reference set
is the manifest rows, not the book's full occurrence list: a
book legitimately has occurrences with no audio yet (Forever
Pucked: 407 segments, 50 bindings), and completeness is a
statement about the bindings being flipped, not about the book
being finished.

Non-migration commands are untouched: `SyncPush` still does not
verify bytes (it is the client-sync path; client byte
confirmation remains the client store's `byteCheck` flow), and
`AdoptAudio` still verifies through the request snapshot. This
design claims the exception only for the migration primitive,
which is the scope Rowan's ruling contemplates.

## 2. I2 — cold visibility: priming inside the import operation

**The defect, at source.** The host cache's probe reads a
request-local snapshot (`v2/host/adapters.mjs:587–594`), and the
worker's `_cache()` (`v2/worker-entry.js:117–139`) populates that
snapshot only via `hydrateIndex`, which loads **only keys
already in `cache_index`** (`v2/host/adapters.mjs:476–482`). On
a fresh production coordinator every pre-existing v1 object is
invisible: `validateAndBind` returns `object_missing` for audio
that exists. A `byteCheck` (`adapters.mjs:596`) hydrates one key
for its own request only.

**The design.** A new host seam, `primeForMigration(cacheKey)`,
on the R2 audio cache (`createR2AudioCache`,
`v2/host/adapters.mjs:445`), wired into the coordinator's
environment by `hostEnv` (`v2/worker-entry.js:96`) as
`env.migrationPrime`. It performs a direct bucket `get` of the
exact candidate object keys for the cache key — inside the same
import operation, before any bind — and returns the verified
fact record (§3). It never consults or mutates the snapshot (the
general probe path is byte-identical to before), and it never
writes: `get` only, no `head`, no `put`, anywhere on this path.

`handleCommand` runs the prime **asynchronously before** opening
the command transaction, only for `MigrateImportBindings`, only
after the receipt-replay check (a replayed command re-primes
nothing and re-applies nothing). The prepared facts are passed
into the synchronous apply step as data; the transaction itself
stays synchronous, matching the coordinator's storage contract.
If `env.migrationPrime` is absent, every row blocks with
`migration_prime_unavailable` — the path fails closed rather
than falling back to the snapshot. Under the staging worker the
prime inherits the existing key-prefix fence
(`v2/worker-entry.js:117–139`): a staging cache is constructed
with `smoke-p8/`, so a migration prime there can only ever see
smoke objects and real-book imports fail `object_missing` —
consistent with Rowan's note that the staging script cannot
validate real v1 audio. The production-scope worker remains a
separate routing/deploy authorization; nothing here exercises
it.

## 3. I3 — byte-true verification, three-way, fail closed

**The defect, at source.** `hydrateKey` sets the snapshot's
`sha256` **and** `recordedSha256` to
`meta.sha256 ?? sha256Hex(bytes)` (`v2/host/adapters.mjs:463–465`).
When an object carries a `sha256` custom-metadata field,
`probe.hash` can return the **advertised metadata**, so
`validateAndBind`'s digest comparison
(`v2/coordinator.mjs:1002–1013`) can degenerate into
metadata-vs-metadata. (For v1 objects this happens not to bite —
v1 wrote no `sha256` metadata — but the migration path may not
rest on that accident.)

**The design.** `primeForMigration` **always** computes
`computedSha256 = sha256Hex(bytes)` from the bytes it just
downloaded. The metadata value is retained as a **separate**
field, `metadataSha256` (`customMetadata.sha256 ?? null`),
alongside `metadataIdentity`, the object key actually hit, the
format (from the object key's extension — the same format
evidence `hydrateKey` uses), the byte length, and the object's
etag. Per row, inside the transaction, verification is
three-way and fail-closed, in this order (first failure names
the row's reason; any failure blocks the **whole book**):

1. no primed fact → `object_missing`;
2. the object key actually read ≠ the expected key for
   `(cacheKey, manifest.format)` under the host's key shape, or
   primed format ≠ manifest format → `object_key_mismatch` /
   `format_mismatch`;
3. primed byte length ≠ manifest size → `size_mismatch`;
4. **computed ≠ freeze-manifest expected SHA-256** →
   `content_hash_mismatch`. This is the swapped-bytes case: the
   bytes changed under a stale label, and neither the metadata
   nor the manifest can talk the computed digest out of it;
5. metadata SHA-256 present and ≠ computed →
   `metadata_digest_mismatch`. This is the tampered-metadata
   case: bytes are exactly as frozen, the label lies, and the
   import still refuses — a label that disagrees with its own
   bytes is not evidence this path will carry;
6. an existing `cache_index` anchor for the key whose SHA-256
   disagrees with computed → `content_hash_mismatch` (bytes
   swapped under a previously anchored key are a conflict,
   never a fresh success — the same rule `validateAndBind`
   enforces at `v2/coordinator.mjs:1006–1013`).

Only after all six does the identity rule (§5) run. Key,
length, format, and every authoritative digest are verified
before anything binds — Rowan's ordering, verbatim.

## 4. I4 — the per-book commit / visibility fence

**The limit, at source.** `handleCommand` persists receipt +
application in one transaction (`v2/coordinator.mjs:339–366`),
and a SyncPush book group validates-then-applies inside its
command — but content push, bindings push, 1,799 `AdoptAudio`
operations, position and jobs share **no** cross-plane
transaction. The audit's §5.2 sequence inherited that limit.

**The design.** The fence has three locks, and a book is
"flipped" only when all three hold:

- **Lock 1 — atomic import.** `MigrateImportBindings` collapses
  the audit's steps 1–3 for the bindings plane into **one
  command, one transaction** (content + both binding planes, §1).
  There is no interleaving in which a book is half-imported: any
  blocked row rejects the whole command and applies nothing.
  Position events and job aggregates keep riding their own
  receipted commands (`PushPositionEvents`, `SubmitJob`) — they
  are not bindings, D10 does not concern them, and the flip
  gate's read-back (lock 2) is where their presence is checked
  for the cutover runner's full per-book protocol; this build's
  gate command certifies the **bindings plane**, and says so.
- **Lock 2 — read-back set-equality.** After import, the runner
  reads the book through `migrationBookView` — served by the
  SELECT-only facade (`v2/api.mjs:12–27`), which holds no write
  capability in scope — and requires `complete: true` with an
  empty divergence list: the imported manifest row set (§1)
  present identically in the sync bindings set and the SQL
  bindings set, cacheKey equality per occurrence, digest anchors
  equal across planes and manifest. A divergence injected after
  import (a deleted row, a swapped key) shows up here, not at
  playback.
- **Lock 3 — the explicit gate record.** `MigrateRecordFlipGate`
  `{ migrationId, bookId, certificateSha256 }` writes the
  `migration_gates` row **only if the coordinator's own in-
  transaction check** re-proves both-plane completeness at gate
  time (same set-equality as lock 2, computed inside the
  transaction) — the runner's read-back is necessary but not
  sufficient; the record cannot be written over an incomplete
  or divergent book (`flip_gate_incomplete`, with the missing
  list). Re-gating a book under a **different** certificate is
  refused (`flip_gate_conflict`); the same certificate replays
  idempotently. Supersession, if ever needed, is a new reviewed
  decision, not a flag.

**Idempotency / receipt semantics.** Both commands ride the
existing durable receipt machinery: the same `command_id`
returns the stored outcome with `replayed: true` and applies
nothing twice. A **new** command id carrying an already-imported
book converges idempotently: identical rows are recognized
per-row (`accepted_idempotent`), identical content is not
rewritten, sync entities are not revision-bumped, and any
divergence from the already-imported fact is a validation
failure for the whole command. An interrupted import therefore
has exactly two possible durable states — not imported, or
imported — because each book's import is one transaction; a
crash **between** import and gate leaves an imported-but-
ungated book, which is not flipped and remains v1-visible in
every sense that matters: **nothing is client-visible until the
global client repoint**, which is a separately gated cutover
step that only runs for gate-recorded books.

## 5. The 31 — typed, migration-only provenance acceptance

**The fact, at source.** For a non-legacy revision,
`validateAndBind` requires the object's recorded identity to
equal the revision key (`v2/coordinator.mjs:1023–1031`), with
existing `cache_index` identity winning and the storage record
as fallback. `hydrateKey` defaults a v1 object's recorded
identity to its cache key (`v2/host/adapters.mjs:463`) because
v1's `storeAudio` metadata is `{provider, voiceId, format[,
generationMode]}` — no identity field exists to record. The 31
fingerprinted-distinct bindings (29 *Pucked Up*, 2 *Pucked
Over*, per the audit) have revision keys that are fingerprints
of a **later slicing** than the retained audio's cache key, so
the strict rule refuses them `identity_mismatch` — correctly,
for every path that lacks independent evidence.

**The design.** A row of `MigrateImportBindings` may carry a
`provenanceAttestation`, a typed object:

```
{ kind: "freeze_snapshot_attestation",
  snapshotDigest,            // must equal the command's freezeDigest
  bookId, occurrenceId, revisionKey, cacheKey,   // must equal the row's
  sha256, size, format,      // must equal manifest AND primed facts
  r2Key,                     // must equal the object key actually read
  r2Etag,                    // must equal the primed object's etag when one is supplied by the host
  identityLimitation: "v1_metadata_no_identity" }
```

The identity rule for the migration path is then:

- legacy revision (`legacy:<cacheKey>` form): the anchor rule,
  unchanged (`revisionKey === "legacy:" + cacheKey`, else
  `legacy_anchor_mismatch`);
- recorded identity (index identity ?? metadata identity ??
  the v1 default, the cache key) **equals** the revision key →
  strict acceptance, as today;
- recorded identity **disagrees**, and an attestation is
  present and **fully validates** against the row, the
  manifest, and the primed facts (every field above), and the
  disagreement is *exactly* the known v1 limitation — no
  identity in the index, no identity in the object's metadata,
  so the recorded identity is the cache-key default and nothing
  else → **provenance acceptance**: the binding is written with
  `provenance = "migration:freeze_snapshot_attestation"`, and a
  `migration_audit` row durably records the migration id, the
  row, the recorded identity at import, and the attestation's
  SHA-256 fingerprint, so the acceptance is per-row auditable
  forever;
- anything else — no attestation, an attestation field that
  disagrees with bytes/manifest/key (`attestation_invalid`), or
  a **positive** foreign identity in index or metadata (a real
  identity that is simply *wrong* — not the v1 absence the
  attestation speaks to) → `identity_mismatch`, blocked, whole
  book rejected.

Stated limit: group validation reads pre-command state (the
same semantics as SyncPush book groups). The real corpus' one
shared object is shared by two rows whose revision keys both
equal the shared cache key, so it imports strictly, first time
and on re-import. Two *distinct* revision keys over one shared
key would anchor the first row's identity in `cache_index` at
apply; a later re-import of the second row would then meet a
positive index identity and fail closed (`identity_mismatch`)
rather than re-open the provenance path — a named, visible
stop for a human decision, never a silent relaxation. That
shape does not occur in the audited corpus.

Fences: the acceptance exists **only** inside
`MigrateImportBindings` (a migration-identified command);
`AdoptAudio` and every other path keep strict refusal of the
same rows — no general suppression of `identity_mismatch`
anywhere. No audio is mutated or overwritten (the path performs
no R2 writes at all), no provider is called, and the
`cache_index` identity anchored at bind follows
`validateAndBind`'s existing precedent (the revision key),
with the pre-import recorded identity preserved in
`migration_audit` — the coordinator asserts the binding's
identity going forward; the audit row remembers why that was
permitted. If this proof cannot be made in rehearsal, the
fallback is Rowan's: *Pucked Up* and *Pucked Over* stay frozen
and listenable on v1.

## 6. The per-binding certificate

The runner assembles, per book, a certificate whose
input→digest→outcome rows keep the three evidence classes
distinct — never merged, never upgraded:

- **Class A — snapshot-era listing facts**: key, size, and etag
  as recorded in the freeze-time bucket listing.
- **Class B — freeze byte-pass raw verification**: the SHA-256
  the dress rehearsal computed from the object's bytes; carried
  into the import as the row's manifest expectation.
- **Class C — import-time per-object raw verification**: the
  SHA-256 recomputed **inside this import operation** from the
  bytes the prime downloaded, plus the separately retained
  metadata SHA-256 and the live etag observed at prime.

`MigrateImportBindings`' outcome carries, per row:
`{ occurrenceId, revisionKey, cacheKey, objectKey,
manifestSha256, computedSha256, metadataSha256, etag,
status: accepted | accepted_idempotent | accepted_provenance |
blocked, reason? }` — the class-C column verbatim from the
operation itself, joined by the runner with classes A and B
from the freeze manifest. A row whose class C is missing or
blocked reads as blocked in the certificate no matter how
strong its A/B evidence is: the certificate never lets
snapshot-era evidence impersonate import-time verification,
which is the distinction Rowan's ruling requires preserved.

## 7. Schema and surface changes (complete list)

- `v2/coordinator.mjs`: `COMMAND_TYPES` +=
  `MigrateImportBindings`, `MigrateRecordFlipGate`; three new
  tables (`migration_books`, `migration_audit`,
  `migration_gates`), created by the same idempotent DDL as
  every other table; the prime hook in `handleCommand`
  (post-replay, pre-transaction, migration type only);
  `_prepareMigrationImport`, `_migrateImportBindings`,
  `_migrationCompleteness`, `_migrateRecordFlipGate`,
  `migrationBookView`. No existing function changes behavior.
- `v2/host/adapters.mjs`: `primeForMigration` on the R2 audio
  cache (get-only; snapshot untouched).
- `v2/worker-entry.js`: `hostEnv` wires `migrationPrime` from
  the request cache.
- `v2/api.mjs`: `GET /v2/migration/book/<bookId>` on the
  read-only facade.
- `tests/helpers/do-harness.mjs`: `makeHarness` accepts extra
  env entries (e.g. `migrationPrime`) — additive, all existing
  callers unaffected.

## 8. What this design does NOT claim

- It does not fix, waive, or narrow D10 for the executor: every
  executor-produced binding and all generation remain gated on
  the flush-before-commit redesign.
- It does not exercise any live path: the rehearsal is synthetic
  (cold DO over a fake bucket), and the production-scope worker
  is a separate routing/deploy authorization.
- It does not schedule a flip. It asks Rowan to rule on whether
  the **implemented** path earns the D10-independent exception
  for scheduling per-book flips — the cutover list, routing,
  deploy, and queue decisions remain separately gated, and
  Forever Pucked's Chapter 3 remains `PARKED_POLICY`.

## 9. Corrections addendum — G1–G4 (Rowan re-review 6354569652)

Rowan's re-review accepted the architecture and withheld the
production-implementation clearance on four source-level gates.
This addendum records the corrections, each with its design
choice. Nothing here widens §8: D10 still gates all generation,
and no live path is exercised.

### G1 — the request path no longer hydrates the corpus

The defect: `worker-entry.js` `_cache()` called
`cache.hydrateIndex(sql)` on EVERY Durable Object request, and
`hydrateIndex` downloads every `cache_index` object's full bytes
into the request snapshot. After a real import (1,798 objects,
≈5.35 GB at the approved freeze) the next settings read would
fetch and hold the entire corpus, and book N+1's import would
re-download books 1..N.

The correction: the snapshot starts EMPTY per request and fills
only with keys a surface names.

- `_cache()` performs no hydration (the staging prefix fence is
  unchanged). `hydrateIndex` remains in `adapters.mjs` for
  callers that genuinely bound themselves to a whole index (the
  direct cache tests); no request path calls it.
- The migration prime already fetches exactly its own rows'
  objects (`primeForMigration`); byte-check already fetches its
  one named key. Both are unchanged.
- The two synchronous probe consumers reachable from commands —
  `AdoptAudio` (payload cache key / job occurrences) and outcome
  reconciliation (job occurrences) — get an explicit scoped
  hydration: `hostEnv.hydrateCacheKey`, applied in `api.mjs`
  before `handleCommand` for exactly the keys the command names
  (its payload `cacheKey`, plus the `cache_key`s recorded for its
  `jobId`'s occurrences), and in the executor entry for exactly
  the message job's recorded occurrence keys. If a legacy path is
  ever found to have depended on the eager snapshot beyond those
  keys, this seam — not a restored global hydrate — is where its
  keys get named.
- `alarm()` reaches no byte-probe path (grants, lease expiry,
  and the queue probe only) and hydrates nothing.
- Proof is through the REAL worker path (`workerEntry.fetch` →
  the real `OpalReaderCoordinator` class → the real API), not the
  coordinator harness: a counting bucket asserts an import fetches
  exactly its own book's keys/bytes; settings, quota, sync
  snapshot, the migration read-back facade, and the flip gate
  then perform ZERO audio GETs; a second book's import never
  re-fetches the first book's objects; the cache factory's own
  `stats()` reads { entries: 0, residentBytes: 0 }.

Resource shape at corpus scale (1,798 keys / ≈5.35 GB), before →
after: any read-only request ≈1,798 GETs + ≈5.35 GB downloaded
and held → 0 GETs, 0 bytes. Import of one book: that book's
objects only (≤ its own byte total), once. Gate/read-back: SQL
only.

### G2 — operator-only admission + the pinned approved freeze

Two independent halves; either alone would be insufficient.

**Admission.** The migration command types
(`MIGRATION_COMMAND_TYPES`) are fenced at the server entry
(`workerEntry.fetchHandler`, after the staging gate and instance
check, before the coordinator namespace is touched):

- The credential is a DISTINCT secret,
  `OPALREADER_MIGRATION_OPERATOR_TOKEN`, presented in the
  `x-opalreader-operator-token` header. It is never the client
  access token: if the two are configured to the same value, the
  entry treats the operator credential as NOT configured.
- Unset/empty → `503 migration_operator_not_configured`. Set but
  not presented/mismatched → `403 migration_operator_required`.
  Both refusals carry the allowlisted CORS object (F-A
  discipline). In every deployment built from the current deploy
  spec the secret is deliberately unset (recorded in
  `v2/p8/deploy-spec.json`), so the migration commands are
  unreachable, full stop.
- Admission is marked on the forwarded internal request
  (`x-opalreader-operator-admitted: 1`), overwritten
  UNCONDITIONALLY on every forwarded request, so a
  client-supplied mark is worthless. `api.mjs` re-checks the mark
  for migration command types and refuses with 403 before the
  coordinator is constructed — defense in depth at the DO side of
  the boundary. (Direct in-process callers of the coordinator —
  tests, the executor host — are inside the trust boundary; the
  coordinator-side pin below still binds them.)

**The pinned freeze.** Authorization is not enough: the caller
could be an operator presenting THEIR OWN manifest. So the
approved freeze is pinned in code as data —
`v2/p8/approved-freeze-manifest.mjs`, generated by
`tools/derive-approved-freeze-manifest.mjs` from the freeze
snapshot in `~/workspace/opal-reader-p8-data/` (the pinned
migration basis, digest
`1c73c56c8005660788a93d7283faae24abcd979ce110264c5da462ea82f2dc18`),
cross-checked against the per-binding audit workpapers. It
carries, per book, the canonical row-set digest and per-row
tuples `[occurrenceId, revisionKey, cacheKey, size, format,
sha256Prefix, etag]` — digests and technical binding metadata
only, never book text, never audio. One honesty note: the
freeze's byte-pass recorded SHA-256 values as 16-hex prefixes, so
the pin binds prefixes; the FULL digest is still verified from
downloaded bytes inside the import operation, and the caller's
full `manifest.sha256` must carry the pinned prefix.

`_migrationManifestError` enforces the pin before anything is
primed or applied: the payload's `freezeDigest` must equal the
pinned snapshot digest (`migration_freeze_unapproved`); the book
must be pinned (`migration_freeze_unapproved`); the row count and
every row's occurrence/revisionKey/cacheKey/size/format and
digest prefix must match the pinned row
(`migration_manifest_mismatch`). Caller input may only MATCH
the pinned identity, never define it. The attestation check
additionally requires the attestation's `r2Etag` to equal the
PINNED (freeze-listing) etag, not merely the live one.

Trust boundary, stated plainly: the coordinator reads the pin
from `env.approvedFreezeManifest` when deployment configuration
supplies one, else the committed module. The override exists so
tests can pin synthetic books; deployment configuration is
operator-controlled (Julie + the deploy spec), request data can
never reach it, and no deploy spec sets it. The committed pin is
what any deployment built from this tree runs with.

### G3 — the certificate is derived and anchored by the server

Pre-correction, `MigrateRecordFlipGate` stored any truthy
caller string (the tests gated with `"cert-j"`). Now, at import
time and BEFORE anything is applied, the coordinator derives a
canonical certificate digest over the verified plan:
`sha256(canonicalJson({ v, bookId, migrationId, freezeDigest,
rowsSha256, rows: [{ occurrenceId, revisionKey, cacheKey,
objectKey, computedSha256, metadataSha256, etag, status }] }))`
(statuses normalized so an idempotent re-import derives the same
digest as the first import). The digest is anchored on the
`migration_books` row (`certificate_sha256`, a new column) and
returned in the import outcome and the read-back view. A
re-import whose recomputed anchor differs — e.g. an object whose
recorded metadata label changed under identical manifest rows —
is refused `migration_book_divergence` before applying anything:
the anchored certificate certifies what was actually observed,
and changed observations are a new fact, not a replay.

The gate now requires the presented `certificateSha256` to
EXACTLY equal the anchored digest, checked after completeness:
anything else — an arbitrary string, another book's certificate,
a malformed value — is `flip_gate_certificate_mismatch`. (The
old caller-string `flip_gate_conflict` rule is subsumed: a stored
gate's certificate equals the anchor by construction, so
same-digest replay remains idempotent and no other string can
reach the conflict branch.) A certificate presented under another
migrationId still fails earlier, at the gate's migration check
(`flip_gate_incomplete`).

### G4 — gate completeness is exact bidirectional set equality

`_migrationCompleteness` previously proved only that the expected
rows were present. It now proves the stored state EQUALS the
approved import, in both directions:

- Forward, per expected row: the SQL binding exists with equal
  cache key and the provenance its pinned form requires
  (`migration:freeze_snapshot_attestation` for
  fingerprinted-distinct rows, `migration` otherwise); the
  `cache_index` anchor exists with equal sha256 and format and a
  consistent identity (the revision key; for legacy rows, null or
  the cache-key default); the sync entity exists, is not a
  tombstone, and its data is canonically equal to exactly
  `{cacheKey, revisionKey, sha256, format, size, provenance}`.
- Reverse: every sync bindings row for the book must be an
  expected occurrence (a live extra OR a tombstone diverges);
  every SQL binding whose occurrence belongs to the book's
  content must match an expected (occurrence, revisionKey) pair.
  This direction leans on the data model's own invariant —
  occurrence ids are globally unique (the corpus uses UUIDs; the
  `bindings` table is occurrence-keyed with no book context) —
  and the test fixtures now honor it.
- Provenance audit: exactly one `migration_audit` row per
  attested row, under the book's own migration id, outcome
  `accepted_provenance`, with integrity recomputed at gate time
  (the stored `attestation_sha256` must recompute over the stored
  `attestation_json`, and the attestation must be field-equal to
  the approved row, including the pinned freeze etag). Audit rows
  for non-attested occurrences or under a foreign migration id
  diverge.
- Targeted mutation tests cover: extra sync row, extra SQL row,
  wrong sync revisionKey, changed index format, changed size,
  missing audit row, tampered audit row, foreign-migration audit
  row, partial import, unexpected tombstone — every one refuses
  the gate.

### Consistency — the import identity pins more fields

`migration_books`' divergence fence previously hashed four row
fields. Canonical rows now carry `{occurrenceId, revisionKey,
cacheKey, sha256, size, format}`, and the fence also rejects a
re-import whose `migrationId` or `freezeDigest` differs from the
stored record — including after a gate record exists. Combined
with G2 (payload must match the pinned size/format per row) and
G3 (the anchored certificate must re-derive identically), a
stored book's import identity cannot be redefined by any later
command.

### Changed surfaces (this correction)

- `v2/coordinator.mjs`: `MIGRATION_COMMAND_TYPES`; the pinned
  manifest import + `_approvedFreeze` / `_pinnedBook` /
  `_pinnedForm` / `_migrationManifestError`; attestation etag
  pinned to the freeze; canonical rows extended; the anchored
  certificate; `migration_books.certificate_sha256`; the
  bidirectional `_migrationCompleteness`; the gate's certificate
  check; the view's `importRecord.certificateSha256` +
  `pinnedFreeze`.
- `v2/p8/approved-freeze-manifest.mjs` (new, generated):
  the pinned approved freeze (see G2).
- `tools/derive-approved-freeze-manifest.mjs` (new): its
  generator, with the freeze-internal consistency checks
  (corpus digest, listing↔byte-pass agreement, audit agreement;
  the 7 `device-voice` corpus rows name no R2 object and are
  excluded, as the audit excluded them).
- `v2/worker-entry.js`: no eager hydration; scoped hydration in
  the executor entry; the operator admission fence; `hostEnv`
  gains `hydrateCacheKey`.
- `v2/api.mjs`: the admission re-check; scoped command
  hydration.
- `v2/host/adapters.mjs`: `hydrateKeys` + `stats` on the cache.
- `v2/p8/deploy-spec.json`: the operator secret recorded as
  deliberately unset for staging.
- Tests: `tests/p8-migration-corrections.test.mjs` (new: G1
  through the real Worker path, the G2 HTTP boundary, G3, the G4
  mutation suite, the consistency fence); the migration fixtures
  and the two migration suites updated to pin their synthetic
  books and gate with anchored certificates; the scale
  rehearsal's occurrence ids made globally unique per the data
  model's invariant (counts, classes, and behavior unchanged).

## 10. D3 addendum — production topology, chunked import, measured limits

Built under the corrected cutover plan (Rowan plan reviews
6355302486 / 6355404829; D1 planning sign-off 6355565715; Julie's
distinct D3 authorization). Repo-only: nothing here was uploaded,
no live surface was contacted, and every proof runs on synthetic
fixtures through the real Worker entries and the real coordinator.

### P1 — the production topology (implemented)

The plan's P1 correction disproved the claim that the staging
script could serve production through a cross-script DO binding
(the owner script's code/env run). The production surface is
therefore a separate script, `opalreader-api-v2-prod`, whose entry
(`v2/worker-entry-prod.js`) defines and owns its coordinator class
`OpalReaderCoordinatorProd` and binds it through its OWN new
Durable Object namespace, created by its own migration
(`v2/p8/deploy-spec-prod.json`: `new_sqlite_classes:
["OpalReaderCoordinatorProd"]`, `new_tag: "v1"` — migration tags
are per-script/per-namespace, so this "v1" is the first migration
on the production namespace and is unrelated to staging's "v1").

The class subclasses the staging entry's class and overrides
exactly three surface hooks in `v2/worker-entry.js`
(`_expectedScope`, `_scopeRequiredError`, `_enforceR2Namespace`);
all coordinator logic behind the fences is shared verbatim.
Production fences, mirrored from staging and disjoint in both
directions: scope "production" (a staging-shaped request to prod
is refused `production_scope_required`, a production-shaped
request to staging is refused `staging_scope_required`); the only
routable instance is "account" ("smoke-p8" is refused
`production_instance_required`); the R2 namespace is unprefixed
and the class refuses to construct its cache if any
`R2_KEY_PREFIX` is configured (`production_r2_prefix_forbidden`),
so the shape does not depend on error-free upload metadata;
`GENERATION_HALT = "1"`; NO queue binding and no queue handler
export at all; no provider secrets; the operator fence is present
with both secret NAMES recorded in the spec and deliberately unset
(set by Julie herself at D2). Deploy rollback truth: deleting the
script may leave inert DO storage behind; pre-import the store is
empty and read by no client. Cross-worker integration tests
(both real entries, separate state) prove all of it
(`tests/p8-d3-production-surface.test.mjs`), and the production
creation envelope is validated locally, with biting negatives
(`tools/validate-prod-envelope.mjs`,
`tests/p8-d3-prod-envelope.test.mjs`).

### P2 — the chunking contract (implemented)

`MigrateImportChunk` (a third migration command type, operator-
fenced at both layers like the others) imports one book in
pinned chunks:

- **Pinned partitions.** `v2/p8/approved-freeze-chunks.mjs`
  (generated by `tools/derive-approved-freeze-chunks.mjs` from
  the committed whole-book pin) records, per book, the exact
  ordered partition of the pinned rows under the code limits:
  each chunk is the contiguous slice `[start, start+rowCount)`
  of the book's pinned rows, with its byte total and a row-set
  digest over the slice's pinned tuples. The coordinator
  re-derives the slice from the whole-book pin and verifies the
  chunk digest before priming — chunks are matchable, never
  caller-definable. The real freeze partitions into 25 chunks
  (Pucked Up 6, IHOL 3, Pucked Over 6, Finding Home 3, Forever
  Pucked 1, Pucked 4, The Goal 2).
- **Receipt/command id scheme.** First attempt at chunk n:
  `<migrationId>:<bookId>:chunk:<n>`. A corrected attempt after a
  durable rejection uses a new deterministic attempt id with a
  retry-generation suffix (`...:chunk:<n>:g2`). Ids are opaque to
  the coordinator; the scheme is the runner's contract and is
  what the three retry cases below are stated in.
- **Per-chunk execution.** A chunk primes + byte-verifies ONLY
  its rows through the shared three-way validator (the same code
  the whole-book import uses, extracted as
  `_validateMigrationRows`), persists its class-C evidence in
  `migration_chunks`, and commits atomically: any blocked row
  rejects the whole chunk and nothing of it is applied. Chunks
  must land in pinned order (`migration_chunk_out_of_order`).
  Applied chunks write the SQL evidence planes (bindings, cache
  anchors, provenance audit) but NO sync entity and no import
  record — partial state is invisible to clients, and the flip
  gate cannot pass (`flip_gate_incomplete`: there is no
  `migration_books` row to certify). Bookkeeping lives in
  `migration_imports` / `migration_chunks`; the carried content
  is held in the bookkeeping, not the sync plane, until
  completion. The two import paths never interleave on one book
  (`migration_book_divergence` both ways).
- **Completion.** When the final chunk lands, the SAME
  transaction derives the ONE server-side whole-book certificate
  from ALL chunks' persisted evidence — the G3 anchor formula
  over the whole book (shared `_migrationAnchorSha256`), never a
  chain of chunk certificates — anchors it in `migration_books`
  and materializes the sync plane (content + binding entities).
  The existing `MigrateRecordFlipGate` and G4 bidirectional
  completeness then apply UNCHANGED. A chunked import and a
  whole-book import of the same book anchor the identical
  certificate (proven).
- **Retry semantics (the plan's three cases, all demonstrated).**
  (a) Ambiguous transport interruption: the same command id
  resolves to the true outcome via the durable receipt. (b)
  Successful chunk: the same id replays the stored receipt with
  ZERO additional R2 GETs and a single effect; re-issuing an
  applied chunk under a NEW id converges on the recorded
  application (also zero GETs — accepted chunks are never
  re-fetched on resume). (c) Durably rejected chunk: the same id
  replays ONLY the refusal, even after the underlying problem is
  repaired; the corrected attempt requires a NEW retry-generation
  id, which is the only path that re-executes. No automatic retry
  exists anywhere. An aborted book stays imported-but-ungated
  and invisible; removal remains a separate reviewed step.
- **Negative suite** (`tests/p8-d3-chunking.test.mjs`): missing
  chunk, duplicate chunk, reordered chunks (rows within a payload
  and chunks out of order), substituted chunk (another chunk's
  rows; another book's rows), wrong migrationId, altered
  snapshot/manifest, late bytes drift, late metadata drift,
  corrupted chunk bytes, cross-book overlap, gate-before-final-
  chunk, and chunk rejection leaving earlier verified ungated
  chunks intact with the book still ungated/unflipped. All 31
  attestation rows + the one shared key flow through chunking
  with provenance intact (scale rehearsal).

### P3/P4 — measured resources and the derived limits

Measured through the REAL production Worker path (production
entry → real DO class → counting procedural R2 fake) at the
freeze's worst shapes; full numbers in the D3 build report. The
prime buffers exactly one object at a time: the corpus' largest
object (5,787,234 B) shows an ArrayBuffers growth of ≈1 object
(5.5 MiB); across the whole Pucked Over import (510 rows,
1,555,992,872 B, 6 chunks of 82–88 rows / ~250–262 MB) resident
growth stays flat (ArrayBuffers delta ≈ 7 MiB; heap ≈ 10 MiB),
per-chunk wall 362–512 ms and CPU 389–467 ms locally, and GET
calls total exactly 1,020 (510 rows × 2: the WAV probe
multiplier). Read-back + gate afterwards: 0 audio GETs. What
this cannot prove is also stated in the report: local process
figures include the Node runtime and the fixture; they bound the
per-object buffer term and the per-chunk CPU/wall shape, and do
not measure the production isolate, R2 latency, or DO storage —
D2 re-checks current platform limits before any upload.

The derived limits live in `v2/p8/migration-chunk-limits.mjs`
(single source for derivation and enforcement) and are enforced
by the coordinator over the PINNED chunk, before priming, with
zero R2 contact on refusal: `maxItemBytes` 16 MiB
(`migration_item_oversize`; 2.9× the largest real object, keeping
one item's transient footprint at a small fraction of the 128 MB
isolate ceiling), `maxChunkBytes` 250 MiB and `maxRowsPerChunk`
100 (`migration_chunk_oversize`; the plan's planning cap,
confirmed conservative by the measured per-chunk CPU/wall and
the flat memory shape).

### Changed surfaces (D3)

- `v2/coordinator.mjs`: `MigrateImportChunk` in `COMMAND_TYPES`
  + `MIGRATION_COMMAND_TYPES`; `migration_imports` /
  `migration_chunks` tables; the chunk pre-prime state check in
  `handleCommand`; `_approvedChunks` / `_pinnedChunk`;
  `_migrationChunkState`; `_migrateImportChunk`; the row
  validator and the G3 anchor extracted as shared helpers
  (`_validateMigrationRows`, `_migrationAnchorSha256`) used by
  both import paths; the whole-book import's chunked-in-progress
  fence; the view's `chunkedImport`.
- `v2/p8/migration-chunk-limits.mjs` (new): the derived limits +
  the partitioner (single source of truth).
- `v2/p8/approved-freeze-chunks.mjs` (new, generated) +
  `tools/derive-approved-freeze-chunks.mjs` (new): the pinned
  chunk partitions of the approved freeze.
- `v2/worker-entry.js`: the three surface hooks on
  `OpalReaderCoordinator` (staging defaults = pre-D3 behavior);
  `json` / `corsHeaders` exported for the production entry.
- `v2/worker-entry-prod.js` (new): the production surface —
  `OpalReaderCoordinatorProd`, the production gate, no queue
  handler.
- `v2/p8/deploy-spec-prod.json` (new): the production deploy
  spec (topology, rollback truth, secret names only).
- `tools/build-p8-part1.mjs`: also emits the production upload
  metadata + spec (staging emission unchanged).
- `tools/validate-prod-envelope.mjs` (new): the production
  creation-envelope validator.
- Tests: `tests/p8-d3-chunking.test.mjs`,
  `tests/p8-d3-production-surface.test.mjs`,
  `tests/p8-d3-scale-rehearsal.test.mjs`,
  `tests/p8-d3-resource-proofs.test.mjs`,
  `tests/p8-d3-prod-envelope.test.mjs` (all new); chunk helpers
  in `tests/helpers/migration-fixtures.mjs`.
